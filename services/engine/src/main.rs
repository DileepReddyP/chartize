use std::{
    collections::HashMap,
    env, fs,
    io::{Cursor, Read},
    path::{Path, PathBuf},
    time::Instant,
};

use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Multipart, Path as AxumPath, Query as AxumQuery, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::{SecondsFormat, Utc};
use duckdb::{Connection, params};
use ggsql::{
    reader::{DuckDBReader, Reader},
    validate::validate,
    writer::{VegaLiteWriter, Writer},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    root: PathBuf,
    db_uri: String,
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
struct QueryRequest {
    ggsql: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryResult {
    spec: Value,
    generated_sql: String,
    rows: usize,
    columns: Vec<String>,
    selected_data: TablePreview,
    warnings: Vec<String>,
    duration_ms: f64,
}

#[derive(Deserialize)]
struct PreviewParams {
    limit: Option<usize>,
    offset: Option<usize>,
    sort: Option<String>,
    direction: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TablePreview {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    total_rows: u64,
    offset: usize,
    limit: usize,
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

    let root = PathBuf::from(env::var("WAREHOUSE_ROOT").unwrap_or_else(|_| "./data".into()));
    fs::create_dir_all(root.join("datasets")).expect("create warehouse directories");
    let db_path = root.join("warehouse.duckdb");
    let state = AppState {
        db_uri: format!("duckdb://{}", db_path.display()),
        root,
        admin_token: env::var("ADMIN_TOKEN").unwrap_or_else(|_| "change-me-in-production".into()),
        max_import_bytes: env::var("MAX_IMPORT_BYTES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1_000_000_000),
    };
    initialize(&state).expect("initialize warehouse database");

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/catalog", get(catalog))
        .route("/api/datasets/{slug}", get(dataset))
        .route("/api/datasets/{slug}/preview", get(dataset_preview))
        .route("/api/query", post(query))
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
    info!(%bind, "warehouse engine listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("serve warehouse engine");
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

fn initialize(state: &AppState) -> Result<(), ApiError> {
    let connection = open_connection(state)?;
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS warehouse_versions (
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
            active BOOLEAN NOT NULL DEFAULT FALSE
        );
        CREATE INDEX IF NOT EXISTS warehouse_versions_slug ON warehouse_versions(slug);",
    )?;
    Ok(())
}

fn open_connection(state: &AppState) -> Result<Connection, ApiError> {
    let path = state.root.join("warehouse.duckdb");
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

async fn dataset(
    State(state): State<AppState>,
    AxumPath(slug): AxumPath<String>,
) -> Result<Json<DatasetManifest>, ApiError> {
    validate_slug(&slug)?;
    tokio::task::spawn_blocking(move || active_manifest(&state, &slug))
        .await
        .map_err(|error| ApiError::Internal(error.to_string()))?
        .map(Json)
}

async fn dataset_preview(
    State(state): State<AppState>,
    AxumPath(slug): AxumPath<String>,
    AxumQuery(params): AxumQuery<PreviewParams>,
) -> Result<Json<TablePreview>, ApiError> {
    validate_slug(&slug)?;
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).min(10_000_000);
    let direction = params.direction.unwrap_or_else(|| "asc".into());
    tokio::task::spawn_blocking(move || {
        preview_dataset(
            &state,
            &slug,
            limit,
            offset,
            params.sort.as_deref(),
            &direction,
        )
    })
    .await
    .map_err(|error| ApiError::Internal(error.to_string()))?
    .map(Json)
}

fn preview_dataset(
    state: &AppState,
    slug: &str,
    limit: usize,
    offset: usize,
    sort: Option<&str>,
    direction: &str,
) -> Result<TablePreview, ApiError> {
    let manifest = active_manifest(state, slug)?;
    let columns = manifest
        .fields
        .iter()
        .map(|field| field.name.clone())
        .collect::<Vec<_>>();
    if columns.is_empty() {
        return Ok(TablePreview {
            columns,
            rows: vec![],
            total_rows: manifest.row_count,
            offset,
            limit,
        });
    }

    let order = if let Some(sort) = sort {
        if !manifest.fields.iter().any(|field| field.name == sort) {
            return Err(ApiError::BadRequest(format!(
                "Unknown sort column '{sort}'."
            )));
        }
        let direction = match direction.to_ascii_lowercase().as_str() {
            "asc" => "ASC",
            "desc" => "DESC",
            _ => {
                return Err(ApiError::BadRequest(
                    "Sort direction must be asc or desc.".into(),
                ));
            }
        };
        format!(" ORDER BY {} {direction} NULLS LAST", quote_ident(sort))
    } else {
        String::new()
    };

    // Cast to text at the database boundary so the preview can represent mixed
    // schemas without teaching the public API about every DuckDB value type.
    // Geometry payloads are deliberately summarized; the chart still receives
    // the complete geometry through GGSQL.
    let selections = manifest
        .fields
        .iter()
        .map(|field| {
            let identifier = quote_ident(&field.name);
            if field.name.eq_ignore_ascii_case("geometry")
                || field.semantic_type.as_deref() == Some("geometry")
            {
                format!(
                    "CASE WHEN {identifier} IS NULL THEN '' ELSE '[geometry]' END AS {identifier}"
                )
            } else {
                format!("COALESCE(CAST({identifier} AS VARCHAR), '') AS {identifier}")
            }
        })
        .collect::<Vec<_>>()
        .join(", ");
    let connection = open_connection(state)?;
    let mut statement = connection.prepare(&format!(
        "SELECT {selections} FROM {}{order} LIMIT {limit} OFFSET {offset}",
        quote_ident(&manifest.table_name)
    ))?;
    let column_count = columns.len();
    let rows = statement.query_map([], move |row| {
        (0..column_count)
            .map(|index| {
                row.get::<_, Option<String>>(index)
                    .map(|value| value.unwrap_or_default())
            })
            .collect::<Result<Vec<_>, _>>()
    })?;

    Ok(TablePreview {
        columns,
        rows: rows.collect::<Result<Vec<_>, _>>()?,
        total_rows: manifest.row_count,
        offset,
        limit,
    })
}

fn selected_query_preview(
    state: &AppState,
    sql: &str,
    total_rows: usize,
) -> Result<TablePreview, ApiError> {
    let sql = sql.trim().trim_end_matches(';').trim();
    let connection = open_connection(state)?;
    connection.execute_batch("SET memory_limit='2GB'; SET threads=2;")?;
    if uses_spatial_functions(sql) {
        connection.execute_batch("LOAD spatial;")?;
    }
    let columns = {
        let mut statement = connection.prepare(&format!(
            "SELECT * FROM ({sql}) AS chartize_selected LIMIT 0"
        ))?;
        {
            // duckdb-rs populates prepared-statement schema metadata when the
            // statement is stepped, even for a zero-row result.
            let mut rows = statement.query([])?;
            while rows.next()?.is_some() {}
        }
        statement.column_names()
    };
    if columns.is_empty() {
        return Ok(TablePreview {
            columns,
            rows: vec![],
            total_rows: total_rows as u64,
            offset: 0,
            limit: 200,
        });
    }
    let selections = columns
        .iter()
        .map(|column| {
            let identifier = quote_ident(column);
            if column.eq_ignore_ascii_case("geometry") {
                format!(
                    "CASE WHEN {identifier} IS NULL THEN '' ELSE '[geometry]' END AS {identifier}"
                )
            } else {
                format!("COALESCE(CAST({identifier} AS VARCHAR), '') AS {identifier}")
            }
        })
        .collect::<Vec<_>>()
        .join(", ");
    let mut statement = connection.prepare(&format!(
        "SELECT {selections} FROM ({sql}) AS chartize_selected LIMIT 200"
    ))?;
    let column_count = columns.len();
    let rows = statement.query_map([], move |row| {
        (0..column_count)
            .map(|index| {
                row.get::<_, Option<String>>(index)
                    .map(|value| value.unwrap_or_default())
            })
            .collect::<Result<Vec<_>, _>>()
    })?;
    Ok(TablePreview {
        columns,
        rows: rows.collect::<Result<Vec<_>, _>>()?,
        total_rows: total_rows as u64,
        offset: 0,
        limit: 200,
    })
}

async fn query(
    State(state): State<AppState>,
    Json(body): Json<QueryRequest>,
) -> Result<Json<QueryResult>, ApiError> {
    if body.ggsql.len() > 100_000 {
        return Err(ApiError::BadRequest(
            "Query exceeds the 100 KB limit.".into(),
        ));
    }
    tokio::task::spawn_blocking(move || execute_query(&state, &body.ggsql))
        .await
        .map_err(|error| ApiError::Internal(error.to_string()))?
        .map(Json)
}

fn execute_query(state: &AppState, query: &str) -> Result<QueryResult, ApiError> {
    let started = Instant::now();
    let validated = validate(query).map_err(|error| ApiError::BadRequest(error.to_string()))?;
    if !validated.valid() {
        let errors = validated
            .errors()
            .iter()
            .map(|error| error.message.clone())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(ApiError::BadRequest(errors));
    }
    if !validated.has_visual() {
        return Err(ApiError::BadRequest(
            "A warehouse request must include a VISUALISE block.".into(),
        ));
    }
    enforce_read_only(validated.sql())?;

    let reader = DuckDBReader::from_connection_string(&state.db_uri)
        .map_err(|error| ApiError::Internal(error.to_string()))?;
    reader
        .connection()
        .execute_batch("SET memory_limit='2GB'; SET threads=2;")?;
    if uses_spatial_functions(validated.sql()) {
        reader.connection().execute_batch("LOAD spatial;")?;
    }
    let prepared = reader
        .execute(query)
        .map_err(|error| ApiError::BadRequest(error.to_string()))?;
    let rows = prepared
        .data()
        .values()
        .map(|frame| frame.shape().0)
        .max()
        .unwrap_or(0);
    let columns = prepared
        .data()
        .values()
        .next()
        .map(|frame| frame.get_column_names())
        .unwrap_or_default();
    let rendered = VegaLiteWriter::new()
        .render(&prepared)
        .map_err(|error| ApiError::Internal(error.to_string()))?;
    let spec =
        serde_json::from_str(&rendered).map_err(|error| ApiError::Internal(error.to_string()))?;
    // Preview is supplementary: special GGSQL-owned sources (for example its
    // embedded smoke-test tables) may not exist on the warehouse connection.
    // A successful chart must not fail solely because that auxiliary preview
    // cannot be materialized.
    let selected_data =
        selected_query_preview(state, validated.sql(), rows).unwrap_or_else(|_| TablePreview {
            columns: columns.clone(),
            rows: vec![],
            total_rows: rows as u64,
            offset: 0,
            limit: 200,
        });
    Ok(QueryResult {
        spec,
        generated_sql: validated.sql().to_owned(),
        rows,
        columns,
        selected_data,
        warnings: validated
            .warnings()
            .iter()
            .map(|warning| warning.message.clone())
            .collect(),
        duration_ms: started.elapsed().as_secs_f64() * 1000.0,
    })
}

fn enforce_read_only(sql: &str) -> Result<(), ApiError> {
    let trimmed = sql.trim_start();
    let upper = trimmed.to_ascii_uppercase();
    if !(upper.starts_with("SELECT ") || upper.starts_with("WITH ")) {
        return Err(ApiError::BadRequest(
            "Only SELECT and WITH queries are allowed.".into(),
        ));
    }
    let blocked = [
        " INSTALL ",
        " LOAD ",
        " COPY ",
        " ATTACH ",
        " DETACH ",
        " PRAGMA ",
        " CREATE ",
        " DROP ",
        " ALTER ",
        " INSERT ",
        " UPDATE ",
        " DELETE ",
        " EXPORT ",
        " IMPORT ",
        " READ_CSV",
        " READ_JSON",
        " READ_PARQUET",
        " ST_READ",
        " HTTPFS",
        " DUCKDB_EXTENSIONS",
    ];
    let padded = format!(" {upper} ");
    if let Some(keyword) = blocked.iter().find(|keyword| padded.contains(*keyword)) {
        return Err(ApiError::BadRequest(format!(
            "The warehouse query contains a blocked operation: {}.",
            keyword.trim()
        )));
    }
    if sql.matches(';').count() > usize::from(sql.trim_end().ends_with(';')) {
        return Err(ApiError::BadRequest(
            "Only one SQL statement is allowed.".into(),
        ));
    }
    Ok(())
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
        "COPY {} TO {} (FORMAT PARQUET, COMPRESSION ZSTD);",
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
        "UPDATE warehouse_versions SET active = FALSE WHERE slug = ?",
        [&manifest.slug],
    )?;
    tx.execute(
        "INSERT INTO warehouse_versions (
            id, slug, title, description, version, table_name, source_url, license, attribution,
            row_count, spatial, geometry_type, geography_level, time_coverage, published_at,
            fields_json, parquet_path, original_path, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
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
    let select = match ext {
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
        "SELECT id, parquet_path FROM warehouse_versions WHERE slug = ? AND active = FALSE ORDER BY published_at DESC LIMIT 1",
        [slug], |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|_| ApiError::NotFound("No previous version is available.".into()))?;
    connection.execute_batch(&format!(
        "CREATE OR REPLACE VIEW {} AS SELECT * FROM read_parquet({})",
        quote_ident(slug),
        quote_literal(&previous.1)
    ))?;
    let tx = connection.unchecked_transaction()?;
    tx.execute(
        "UPDATE warehouse_versions SET active = FALSE WHERE slug = ?",
        [slug],
    )?;
    tx.execute(
        "UPDATE warehouse_versions SET active = TRUE WHERE id = ?",
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

fn manifest_select() -> &'static str {
    "SELECT id, slug, title, description, version, table_name, source_url, license, attribution, row_count, spatial, geometry_type, geography_level, time_coverage, published_at, fields_json FROM warehouse_versions WHERE active = TRUE"
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

fn uses_spatial_functions(sql: &str) -> bool {
    sql.to_ascii_uppercase().contains("ST_")
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
    let mut candidates = Vec::new();
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
        if extension(
            output
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(""),
        ) == "shp"
        {
            candidates.push(output);
        }
    }
    candidates.into_iter().next().ok_or_else(|| {
        ApiError::BadRequest("ZIP imports must contain a Shapefile (.shp plus sidecars).".into())
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

    #[test]
    fn read_only_policy_rejects_mutation_and_file_readers() {
        assert!(enforce_read_only("SELECT * FROM county_population").is_ok());
        assert!(enforce_read_only("WITH totals AS (SELECT 1) SELECT * FROM totals").is_ok());
        assert!(enforce_read_only("DELETE FROM county_population").is_err());
        assert!(enforce_read_only("SELECT * FROM read_parquet('/etc/passwd')").is_err());
        assert!(enforce_read_only("SELECT 1; DROP TABLE warehouse_versions").is_err());
    }

    #[test]
    fn slugs_are_safe_identifiers() {
        assert!(validate_slug("county_population_2025").is_ok());
        assert!(validate_slug("County-Population").is_err());
        assert!(validate_slug("../warehouse").is_err());
    }

    #[test]
    fn spatial_sql_detection_is_case_insensitive() {
        assert!(uses_spatial_functions("SELECT ST_X(point)"));
        assert!(uses_spatial_functions("select st_pointonsurface(geometry)"));
        assert!(!uses_spatial_functions("SELECT geometry FROM boundaries"));
    }

    #[test]
    fn builtin_query_renders_vega_lite() {
        let state = AppState {
            root: env::temp_dir(),
            db_uri: "duckdb://memory".into(),
            admin_token: "test".into(),
            max_import_bytes: 1_000_000,
        };
        let result = execute_query(&state, "SELECT \"bill_len\", \"bill_dep\", \"species\", \"body_mass\", \"island\" FROM ggsql:penguins LIMIT 20\n\nVISUALISE\nDRAW point\nMAPPING \"bill_len\" AS x, \"bill_dep\" AS y, \"species\" AS colour, \"body_mass\" AS size\nLABEL title => 'How penguin measurements cluster by species', subtitle => 'A built-in dataset confirms that GGSQL is running.'")
            .expect("built-in GGSQL should execute");
        assert_eq!(result.rows, 20);
        assert!(result.spec.get("$schema").is_some());
    }
}
