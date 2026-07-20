use std::{
    collections::HashMap,
    env, fs,
    io::{Cursor, Read},
    path::{Path, PathBuf},
};

use axum::{
    Json, Router,
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Multipart, Path as AxumPath, Query as AxumQuery, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::{SecondsFormat, Utc};
use duckdb::{Connection, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tokio_util::io::ReaderStream;
use tracing::info;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    root: PathBuf,
    admin_token: String,
    max_import_bytes: usize,
}

#[derive(Debug, thiserror::Error)]
enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}

impl From<duckdb::Error> for ApiError {
    fn from(value: duckdb::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

impl From<std::io::Error> for ApiError {
    fn from(value: std::io::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FieldMetadata {
    name: String,
    data_type: String,
    nullable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    semantic_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatasetManifest {
    id: String,
    slug: String,
    title: String,
    description: String,
    version: String,
    table_name: String,
    source_url: String,
    license: String,
    attribution: String,
    row_count: u64,
    spatial: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    geometry_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    geography_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    time_coverage: Option<String>,
    published_at: String,
    fields: Vec<FieldMetadata>,
    join_hints: Vec<Value>,
}

#[derive(Deserialize)]
struct ParquetParams {
    version: String,
}

#[derive(Default)]
struct Upload {
    filename: String,
    bytes: Bytes,
    fields: HashMap<String, String>,
}

#[tokio::main]
async fn main() {
    if env::args().any(|argument| argument == "--healthcheck") {
        let bind = env::var("ENGINE_BIND")
            .unwrap_or_else(|_| "127.0.0.1:8787".into())
            .replace("0.0.0.0", "127.0.0.1");
        let ok = bind
            .parse()
            .ok()
            .and_then(|address| {
                std::net::TcpStream::connect_timeout(&address, std::time::Duration::from_secs(2))
                    .ok()
            })
            .is_some();
        std::process::exit(if ok { 0 } else { 1 });
    }
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let root = PathBuf::from(
        env::var("CHARTIZE_DATA_ROOT")
            .or_else(|_| env::var("WAREHOUSE_ROOT"))
            .unwrap_or_else(|_| "./data".into()),
    );
    fs::create_dir_all(root.join("datasets")).expect("create data directories");
    let state = AppState {
        root,
        admin_token: env::var("ADMIN_TOKEN").unwrap_or_else(|_| "change-me-in-production".into()),
        max_import_bytes: env::var("MAX_IMPORT_BYTES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1_000_000_000),
    };
    initialize(&state).expect("initialize catalog database");

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/catalog", get(catalog))
        .route("/api/datasets/{slug}/parquet", get(dataset_parquet))
        .route("/api/admin/imports", post(import_dataset))
        .route("/api/admin/datasets/{slug}/rollback", post(rollback))
        .layer(DefaultBodyLimit::max(state.max_import_bytes))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let bind = env::var("ENGINE_BIND").unwrap_or_else(|_| "127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .expect("bind server");
    info!(%bind, "Chartize data service listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("serve Chartize data service");
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

fn initialize(state: &AppState) -> Result<(), ApiError> {
    let connection = open_connection(state)?;
    let has_legacy_table: bool = connection.query_row(
        "SELECT COUNT(*) > 0 FROM information_schema.tables WHERE table_name = 'warehouse_versions'",
        [],
        |row| row.get(0),
    )?;
    let has_dataset_table: bool = connection.query_row(
        "SELECT COUNT(*) > 0 FROM information_schema.tables WHERE table_name = 'dataset_versions'",
        [],
        |row| row.get(0),
    )?;
    if has_legacy_table && !has_dataset_table {
        connection.execute_batch(
            "DROP INDEX IF EXISTS warehouse_versions_slug;
             ALTER TABLE warehouse_versions RENAME TO dataset_versions;",
        )?;
    }
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS dataset_versions (
            id VARCHAR PRIMARY KEY,
            slug VARCHAR NOT NULL,
            title VARCHAR NOT NULL,
            description VARCHAR NOT NULL,
            version VARCHAR NOT NULL,
            table_name VARCHAR NOT NULL,
            source_url VARCHAR NOT NULL,
            license VARCHAR NOT NULL,
            attribution VARCHAR NOT NULL,
            row_count UBIGINT NOT NULL,
            spatial BOOLEAN NOT NULL,
            geometry_type VARCHAR,
            geography_level VARCHAR,
            time_coverage VARCHAR,
            published_at VARCHAR NOT NULL,
            fields_json VARCHAR NOT NULL,
            parquet_path VARCHAR NOT NULL,
            original_path VARCHAR NOT NULL,
            browser_compatible BOOLEAN NOT NULL DEFAULT FALSE,
            active BOOLEAN NOT NULL DEFAULT FALSE
        );
        ALTER TABLE dataset_versions ADD COLUMN IF NOT EXISTS browser_compatible BOOLEAN DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS dataset_versions_slug ON dataset_versions(slug);",
    )?;
    repack_legacy_parquet(&connection)?;
    Ok(())
}

fn repack_legacy_parquet(connection: &Connection) -> Result<(), ApiError> {
    let pending = {
        let mut statement = connection.prepare(
            "SELECT id, parquet_path, version FROM dataset_versions WHERE browser_compatible = FALSE",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    for (id, path, version) in pending {
        let source = PathBuf::from(&path);
        if !source.exists() {
            continue;
        }
        let temporary = source.with_extension("browser.parquet");
        connection.execute_batch(&format!(
            "COPY (SELECT * FROM read_parquet({})) TO {} (FORMAT PARQUET, COMPRESSION UNCOMPRESSED);",
            quote_literal_path(&source),
            quote_literal_path(&temporary),
        ))?;
        fs::rename(&temporary, &source)?;
        let browser_version = format!("{version}-browser1");
        connection.execute(
            "UPDATE dataset_versions SET browser_compatible = TRUE, version = ? WHERE id = ?",
            params![browser_version, id],
        )?;
        info!(dataset_id = %id, "repacked Parquet for the browser engine");
    }
    Ok(())
}

fn open_connection(state: &AppState) -> Result<Connection, ApiError> {
    let path = state.root.join("chartize.duckdb");
    let legacy_path = state.root.join("warehouse.duckdb");
    if !path.exists() && legacy_path.exists() {
        fs::rename(&legacy_path, &path)?;
    }
    Connection::open(path).map_err(Into::into)
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    let free = fs2::available_space(&state.root).unwrap_or(0);
    Json(json!({ "ok": true, "freeBytes": free, "ggsql": "0.4.1" }))
}

async fn catalog(State(state): State<AppState>) -> Result<Json<Vec<DatasetManifest>>, ApiError> {
    tokio::task::spawn_blocking(move || list_catalog(&state))
        .await
        .map_err(|error| ApiError::Internal(error.to_string()))?
        .map(Json)
}

async fn dataset_parquet(
    State(state): State<AppState>,
    AxumPath(slug): AxumPath<String>,
    AxumQuery(params): AxumQuery<ParquetParams>,
) -> Result<Response, ApiError> {
    validate_slug(&slug)?;
    if params.version.is_empty() || params.version.len() > 100 {
        return Err(ApiError::BadRequest("A dataset version is required.".into()));
    }
    let requested_version = params.version;
    let (path, version, length) = tokio::task::spawn_blocking(move || {
        active_parquet_file(&state, &slug, &requested_version)
    })
    .await
    .map_err(|error| ApiError::Internal(error.to_string()))??;
    let file = tokio::fs::File::open(path).await?;
    Response::builder()
        .header("content-type", "application/vnd.apache.parquet")
        .header("content-length", length)
        .header("cache-control", "private, max-age=31536000, immutable")
        .header("etag", format!("\"{version}\""))
        .body(Body::from_stream(ReaderStream::new(file)))
        .map_err(|error| ApiError::Internal(error.to_string()))
}

async fn import_dataset(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<DatasetManifest>, ApiError> {
    require_admin(&state, &headers)?;
    let mut upload = Upload::default();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| ApiError::BadRequest(error.to_string()))?
    {
        let name = field.name().unwrap_or("").to_owned();
        if name == "file" {
            upload.filename = field.file_name().unwrap_or("upload.bin").to_owned();
            upload.bytes = field
                .bytes()
                .await
                .map_err(|error| ApiError::BadRequest(error.to_string()))?;
        } else {
            let value = field
                .text()
                .await
                .map_err(|error| ApiError::BadRequest(error.to_string()))?;
            upload.fields.insert(name, value);
        }
    }
    if upload.bytes.is_empty() {
        return Err(ApiError::BadRequest("A data file is required.".into()));
    }
    if upload.bytes.len() > state.max_import_bytes {
        return Err(ApiError::BadRequest(
            "Upload exceeds MAX_IMPORT_BYTES.".into(),
        ));
    }
    tokio::task::spawn_blocking(move || publish_upload(&state, upload))
        .await
        .map_err(|error| ApiError::Internal(error.to_string()))?
        .map(Json)
}

fn publish_upload(state: &AppState, upload: Upload) -> Result<DatasetManifest, ApiError> {
    let slug = upload.fields.get("slug").cloned().unwrap_or_default();
    validate_slug(&slug)?;
    let title = required_field(&upload.fields, "title")?;
    let version = Utc::now().format("%Y%m%d%H%M%S").to_string();
    let id = Uuid::new_v4().to_string();
    let version_dir = state.root.join("datasets").join(&slug).join(&version);
    fs::create_dir_all(&version_dir)?;
    let filename = safe_filename(&upload.filename);
    let original_path = version_dir.join(&filename);
    fs::write(&original_path, &upload.bytes)?;

    let import_path = if extension(&filename) == "zip" {
        extract_zip(&upload.bytes, &version_dir)?
    } else {
        original_path.clone()
    };
    let ext = extension(
        import_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(""),
    );
    let spatial = matches!(ext.as_str(), "geojson" | "shp" | "gpkg" | "fgb" | "kml");
    let table_name = format!("dataset__{slug}__{version}");
    let parquet_path = version_dir.join("data.parquet");
    let connection = open_connection(state)?;
    if fs2::available_space(&state.root).unwrap_or(u64::MAX)
        < upload.bytes.len() as u64 * 3 + 500_000_000
    {
        return Err(ApiError::BadRequest(
            "The VPS does not have enough free space to stage this import safely.".into(),
        ));
    }
    create_normalized_table(&connection, &table_name, &import_path, &ext, spatial)?;
    let row_count: u64 = connection.query_row(
        &format!("SELECT COUNT(*) FROM {}", quote_ident(&table_name)),
        [],
        |row| row.get(0),
    )?;
    let fields = describe_table(&connection, &table_name)?;
    connection.execute_batch(&format!(
        "COPY {} TO {} (FORMAT PARQUET, COMPRESSION UNCOMPRESSED);",
        quote_ident(&table_name),
        quote_literal_path(&parquet_path)
    ))?;

    let manifest = DatasetManifest {
        id,
        slug: slug.clone(),
        title,
        description: upload
            .fields
            .get("description")
            .cloned()
            .unwrap_or_default(),
        version,
        table_name: slug,
        source_url: upload.fields.get("source_url").cloned().unwrap_or_default(),
        license: upload
            .fields
            .get("license")
            .filter(|value| !value.is_empty())
            .cloned()
            .unwrap_or_else(|| "Unknown".into()),
        attribution: upload
            .fields
            .get("attribution")
            .cloned()
            .unwrap_or_default(),
        row_count,
        spatial,
        geometry_type: spatial.then(|| "geometry".into()),
        geography_level: None,
        time_coverage: None,
        published_at: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
        fields,
        join_hints: vec![],
    };
    let tx = connection.unchecked_transaction()?;
    tx.execute_batch(&format!(
        "CREATE OR REPLACE VIEW {} AS SELECT * FROM read_parquet({});",
        quote_ident(&manifest.slug),
        quote_literal_path(&parquet_path)
    ))?;
    tx.execute(
        "UPDATE dataset_versions SET active = FALSE WHERE slug = ?",
        [&manifest.slug],
    )?;
    tx.execute(
        "INSERT INTO dataset_versions (
            id, slug, title, description, version, table_name, source_url, license, attribution,
            row_count, spatial, geometry_type, geography_level, time_coverage, published_at,
            fields_json, parquet_path, original_path, browser_compatible, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)",
        params![
            manifest.id,
            manifest.slug,
            manifest.title,
            manifest.description,
            manifest.version,
            manifest.table_name,
            manifest.source_url,
            manifest.license,
            manifest.attribution,
            manifest.row_count,
            manifest.spatial,
            manifest.geometry_type,
            manifest.geography_level,
            manifest.time_coverage,
            manifest.published_at,
            serde_json::to_string(&manifest.fields).unwrap(),
            parquet_path.to_string_lossy(),
            original_path.to_string_lossy()
        ],
    )?;
    tx.commit()?;
    connection.execute(&format!("DROP TABLE {}", quote_ident(&table_name)), [])?;
    info!(slug = %manifest.slug, rows = manifest.row_count, "dataset published");
    Ok(manifest)
}

fn create_normalized_table(
    connection: &Connection,
    table: &str,
    path: &Path,
    ext: &str,
    spatial: bool,
) -> Result<(), ApiError> {
    let source = quote_literal_path(path);
    let source_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_ascii_uppercase();
    let select = match ext {
        "csv" if source_name.starts_with("CAINC") || source_name.starts_with("CAGDP") => format!(
            "SELECT * FROM read_csv({source}, HEADER=true, DELIM=',', QUOTE='\"', SAMPLE_SIZE=-1, STRICT_MODE=false, NULL_PADDING=true, IGNORE_ERRORS=true) WHERE regexp_matches(trim(CAST(\"GeoFIPS\" AS VARCHAR)), '^[0-9]{{5}}$')"
        ),
        "csv" => format!("SELECT * FROM read_csv_auto({source}, SAMPLE_SIZE=-1, HEADER=true)"),
        "tsv" => format!(
            "SELECT * FROM read_csv_auto({source}, SAMPLE_SIZE=-1, HEADER=true, DELIM='\\t')"
        ),
        "json" | "ndjson" => format!("SELECT * FROM read_json_auto({source})"),
        "parquet" | "geoparquet" => format!("SELECT * FROM read_parquet({source})"),
        "geojson" | "shp" | "gpkg" | "fgb" | "kml" => {
            connection.execute_batch("INSTALL spatial; LOAD spatial;")?;
            format!("SELECT * EXCLUDE (geom), ST_AsWKB(geom) AS geometry FROM ST_Read({source})")
        }
        _ => {
            return Err(ApiError::BadRequest(format!(
                "Unsupported import format: .{ext}"
            )));
        }
    };
    if spatial {
        connection.execute_batch("LOAD spatial;")?;
    }
    connection.execute_batch(&format!("CREATE TABLE {} AS {select}", quote_ident(table)))?;
    Ok(())
}

fn describe_table(connection: &Connection, table: &str) -> Result<Vec<FieldMetadata>, ApiError> {
    let mut statement = connection.prepare(&format!("DESCRIBE {}", quote_ident(table)))?;
    let rows = statement.query_map([], |row| {
        let name: String = row.get(0)?;
        let data_type: String = row.get(1)?;
        let nullable_text: String = row.get(2)?;
        Ok(FieldMetadata {
            semantic_type: infer_semantic_type(&name, &data_type),
            name,
            data_type,
            nullable: nullable_text.eq_ignore_ascii_case("YES"),
            description: None,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

fn infer_semantic_type(name: &str, data_type: &str) -> Option<String> {
    let lower = name.to_ascii_lowercase();
    if lower == "geometry" || data_type.to_ascii_uppercase().contains("GEOMETRY") {
        return Some("geometry".into());
    }
    if lower.contains("date") || lower.contains("year") || lower.contains("time") {
        return Some("temporal".into());
    }
    if lower.ends_with("_id") || matches!(lower.as_str(), "fips" | "geoid") {
        return Some("identifier".into());
    }
    if ["INT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "HUGEINT"]
        .iter()
        .any(|kind| data_type.to_ascii_uppercase().contains(kind))
    {
        return Some("measure".into());
    }
    Some("dimension".into())
}

async fn rollback(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(slug): AxumPath<String>,
) -> Result<Json<DatasetManifest>, ApiError> {
    require_admin(&state, &headers)?;
    validate_slug(&slug)?;
    tokio::task::spawn_blocking(move || rollback_dataset(&state, &slug))
        .await
        .map_err(|error| ApiError::Internal(error.to_string()))?
        .map(Json)
}

fn rollback_dataset(state: &AppState, slug: &str) -> Result<DatasetManifest, ApiError> {
    let connection = open_connection(state)?;
    let previous: (String, String) = connection.query_row(
        "SELECT id, parquet_path FROM dataset_versions WHERE slug = ? AND active = FALSE ORDER BY published_at DESC LIMIT 1",
        [slug], |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|_| ApiError::NotFound("No previous version is available.".into()))?;
    connection.execute_batch(&format!(
        "CREATE OR REPLACE VIEW {} AS SELECT * FROM read_parquet({})",
        quote_ident(slug),
        quote_literal(&previous.1)
    ))?;
    let tx = connection.unchecked_transaction()?;
    tx.execute(
        "UPDATE dataset_versions SET active = FALSE WHERE slug = ?",
        [slug],
    )?;
    tx.execute(
        "UPDATE dataset_versions SET active = TRUE WHERE id = ?",
        [&previous.0],
    )?;
    tx.commit()?;
    active_manifest(state, slug)
}

fn list_catalog(state: &AppState) -> Result<Vec<DatasetManifest>, ApiError> {
    let connection = open_connection(state)?;
    let mut statement = connection.prepare(&format!("{} ORDER BY title", manifest_select()))?;
    let manifests = statement.query_map([], manifest_from_row)?;
    manifests.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

fn active_manifest(state: &AppState, slug: &str) -> Result<DatasetManifest, ApiError> {
    let connection = open_connection(state)?;
    connection
        .query_row(
            &format!("{} AND slug = ?", manifest_select()),
            [slug],
            manifest_from_row,
        )
        .map_err(|_| ApiError::NotFound(format!("Dataset '{slug}' was not found.")))
}

fn active_parquet_file(
    state: &AppState,
    slug: &str,
    requested_version: &str,
) -> Result<(PathBuf, String, u64), ApiError> {
    let connection = open_connection(state)?;
    let (stored_path, active_version): (String, String) = connection
        .query_row(
            "SELECT parquet_path, version FROM dataset_versions WHERE active = TRUE AND slug = ?",
            [slug],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| ApiError::NotFound(format!("Dataset '{slug}' was not found.")))?;
    if active_version != requested_version {
        return Err(ApiError::NotFound(format!(
            "Dataset '{slug}' version '{requested_version}' is not active. Refresh the catalog."
        )));
    }

    let stored_path = PathBuf::from(stored_path);
    let candidate = if stored_path.exists() {
        stored_path
    } else {
        state.root.join(stored_path)
    };
    let canonical_root = fs::canonicalize(state.root.join("datasets"))?;
    let canonical_path = fs::canonicalize(candidate)?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(ApiError::Internal(
            "The published dataset file is outside the managed data directory.".into(),
        ));
    }
    let length = fs::metadata(&canonical_path)?.len();
    Ok((canonical_path, active_version, length))
}

fn manifest_select() -> &'static str {
    "SELECT id, slug, title, description, version, table_name, source_url, license, attribution, row_count, spatial, geometry_type, geography_level, time_coverage, published_at, fields_json FROM dataset_versions WHERE active = TRUE"
}

fn manifest_from_row(row: &duckdb::Row<'_>) -> duckdb::Result<DatasetManifest> {
    let fields_json: String = row.get(15)?;
    Ok(DatasetManifest {
        id: row.get(0)?,
        slug: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        version: row.get(4)?,
        table_name: row.get(5)?,
        source_url: row.get(6)?,
        license: row.get(7)?,
        attribution: row.get(8)?,
        row_count: row.get(9)?,
        spatial: row.get(10)?,
        geometry_type: row.get(11)?,
        geography_level: row.get(12)?,
        time_coverage: row.get(13)?,
        published_at: row.get(14)?,
        fields: serde_json::from_str(&fields_json).unwrap_or_default(),
        join_hints: vec![],
    })
}

fn require_admin(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    let provided = headers
        .get("x-admin-token")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if provided != state.admin_token {
        return Err(ApiError::Unauthorized(
            "A valid x-admin-token header is required.".into(),
        ));
    }
    Ok(())
}

fn validate_slug(slug: &str) -> Result<(), ApiError> {
    if slug.is_empty()
        || slug.len() > 80
        || !slug.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        })
    {
        return Err(ApiError::BadRequest(
            "Slug must contain only lowercase letters, digits, and underscores.".into(),
        ));
    }
    Ok(())
}

fn required_field(fields: &HashMap<String, String>, name: &str) -> Result<String, ApiError> {
    fields
        .get(name)
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .ok_or_else(|| ApiError::BadRequest(format!("{name} is required.")))
}

fn extension(name: &str) -> String {
    Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn safe_filename(name: &str) -> String {
    Path::new(name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("upload.bin")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn extract_zip(bytes: &[u8], target: &Path) -> Result<PathBuf, ApiError> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| ApiError::BadRequest(error.to_string()))?;
    let unpacked = target.join("unpacked");
    fs::create_dir_all(&unpacked)?;
    let mut shapefiles = Vec::new();
    let mut tabular_files = Vec::new();
    for index in 0..archive.len() {
        let mut item = archive
            .by_index(index)
            .map_err(|error| ApiError::BadRequest(error.to_string()))?;
        let Some(relative) = item.enclosed_name() else {
            continue;
        };
        let output = unpacked.join(relative);
        if item.is_dir() {
            fs::create_dir_all(&output)?;
            continue;
        }
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut content = Vec::new();
        item.read_to_end(&mut content)?;
        fs::write(&output, content)?;
        let name = output
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        match extension(name).as_str() {
            "shp" => shapefiles.push(output),
            "csv" | "tsv" | "json" | "ndjson" | "parquet" | "geoparquet" => {
                tabular_files.push(output)
            }
            _ => {}
        }
    }
    if let Some(path) = shapefiles.into_iter().next() {
        return Ok(path);
    }
    tabular_files.sort_by_key(|path| {
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        (!name.contains("__ALL_AREAS"), name.len(), name.to_owned())
    });
    tabular_files.into_iter().next().ok_or_else(|| {
        ApiError::BadRequest(
            "ZIP imports must contain a Shapefile or a supported tabular data file.".into(),
        )
    })
}

fn quote_ident(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}
fn quote_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}
fn quote_literal_path(path: &Path) -> String {
    quote_literal(&path.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_state(root: PathBuf) -> AppState {
        AppState {
            root,
            admin_token: "test".into(),
            max_import_bytes: 1_000_000,
        }
    }

    #[test]
    fn slugs_are_safe_identifiers() {
        assert!(validate_slug("county_population_2025").is_ok());
        assert!(validate_slug("County-Population").is_err());
        assert!(validate_slug("../data").is_err());
    }

    #[test]
    fn parquet_downloads_require_the_active_catalog_version() {
        let root = env::temp_dir().join(format!("chartize-data-{}", Uuid::new_v4()));
        let slug = "example_data";
        let version = "20260720120000";
        let path = root.join("datasets").join(slug).join(version).join("data.parquet");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"PAR1test").unwrap();

        let state = test_state(root.clone());
        initialize(&state).unwrap();
        let connection = open_connection(&state).unwrap();
        connection.execute(
            "INSERT INTO dataset_versions (
                id, slug, title, description, version, table_name, source_url, license, attribution,
                row_count, spatial, geometry_type, geography_level, time_coverage, published_at,
                fields_json, parquet_path, original_path, active
            ) VALUES (?, ?, ?, '', ?, ?, '', 'test', '', 1, FALSE, NULL, NULL, NULL, '', '[]', ?, ?, TRUE)",
            params![
                "test-id",
                slug,
                "Example data",
                version,
                slug,
                path.to_string_lossy(),
                path.to_string_lossy(),
            ],
        ).unwrap();

        let (served, served_version, length) = active_parquet_file(&state, slug, version).unwrap();
        assert_eq!(served, fs::canonicalize(&path).unwrap());
        assert_eq!(served_version, version);
        assert_eq!(length, 8);
        assert!(matches!(
            active_parquet_file(&state, slug, "stale-version"),
            Err(ApiError::NotFound(_))
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn catalog_manifest_matches_the_shared_frontend_fixture() {
        let fixture = include_str!("../../../packages/contracts/fixtures/dataset-manifest.json");
        let manifest: DatasetManifest = serde_json::from_str(fixture).unwrap();
        let actual = serde_json::to_value(manifest).unwrap();
        let expected: Value = serde_json::from_str(fixture).unwrap();
        assert_eq!(actual, expected);
    }
}
