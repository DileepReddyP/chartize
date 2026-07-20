type GeoGeometry = { type?: string; coordinates?: unknown };

export interface MapViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface MapPointFields {
  x: string;
  y: string;
}

interface GeometryCenter {
  geometry: GeoGeometry;
  longitude: number;
}

interface GeometryPoint {
  geometry: GeoGeometry;
  x: number;
  y: number;
}

function coordinatePairs(value: unknown, pairs: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    if (Number.isFinite(value[0]) && Number.isFinite(value[1])) pairs.push([value[0], value[1]]);
    return;
  }
  value.forEach((child) => coordinatePairs(child, pairs));
}

function geometryCenter(geometry: GeoGeometry): number | null {
  const pairs: Array<[number, number]> = [];
  coordinatePairs(geometry.coordinates, pairs);
  if (!pairs.length) return null;
  let x = 0;
  let y = 0;
  pairs.forEach(([longitude]) => {
    const radians = longitude * Math.PI / 180;
    x += Math.cos(radians);
    y += Math.sin(radians);
  });
  const longitude = Math.atan2(y, x) * 180 / Math.PI;
  return (longitude + 360) % 360;
}

/**
 * GGSQL projects geometry before producing Vega-Lite when a PROJECT clause is
 * present. Raw GeoJSON stays in longitude/latitude. Distinguishing the two
 * prevents the UI from running projected coordinates through Mercator again.
 */
export function geometryUsesLongitudeLatitude(values: Array<Record<string, unknown>>) {
  let found = false;
  for (const value of values.slice(0, 64)) {
    const geometry = value.geometry as GeoGeometry | undefined;
    const pairs: Array<[number, number]> = [];
    coordinatePairs(geometry?.coordinates, pairs);
    for (const [longitude, latitude] of pairs.slice(0, 128)) {
      found = true;
      if (Math.abs(longitude) > 180.0001 || Math.abs(latitude) > 90.0001) return false;
    }
  }
  return found;
}

function featureCollection(entries: Array<{ geometry: GeoGeometry }>) {
  return {
    type: "FeatureCollection",
    features: entries.map(({ geometry }) => ({
      type: "Feature",
      properties: {},
      geometry,
    })),
  };
}

export function geometryFeatureCollection(values: Array<Record<string, unknown>>) {
  return featureCollection(values.flatMap((value) => {
    const geometry = value.geometry as GeoGeometry | undefined;
    return geometry?.type && geometry.coordinates ? [{ geometry }] : [];
  }));
}

function collectionBounds(collection: ReturnType<typeof featureCollection>) {
  const pairs: Array<[number, number]> = [];
  collection.features.forEach(({ geometry }) => coordinatePairs(geometry.coordinates, pairs));
  if (!pairs.length) return null;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of pairs) {
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }
  return { minimumX, maximumX, minimumY, maximumY };
}

function transformCoordinates(
  value: unknown,
  transform: (x: number, y: number) => [number, number],
): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    const [x, y] = transform(value[0], value[1]);
    return [x, y, ...value.slice(2)];
  }
  return value.map((child) => transformCoordinates(child, transform));
}

/**
 * Moves mark geometry while keeping the projection's fit collection fixed.
 * This gives maps predictable pan and zoom without relying on private Vega
 * projection signals, and it works for raw as well as GGSQL-projected data.
 */
export function applyMapViewport(
  values: Array<Record<string, unknown>>,
  focus: ReturnType<typeof featureCollection>,
  viewport: MapViewport,
  pointFields: readonly MapPointFields[] = [],
) {
  if (viewport.zoom === 1 && viewport.panX === 0 && viewport.panY === 0) return values;
  const bounds = collectionBounds(focus);
  if (!bounds) return values;
  const spanX = Math.max(Number.EPSILON, bounds.maximumX - bounds.minimumX);
  const spanY = Math.max(Number.EPSILON, bounds.maximumY - bounds.minimumY);
  const centerX = (bounds.minimumX + bounds.maximumX) / 2;
  const centerY = (bounds.minimumY + bounds.maximumY) / 2;
  const cameraX = centerX + viewport.panX * spanX;
  const cameraY = centerY + viewport.panY * spanY;
  const transform = (x: number, y: number): [number, number] => [
    centerX + (x - cameraX) * viewport.zoom,
    centerY + (y - cameraY) * viewport.zoom,
  ];
  return values.map((value) => {
    const geometry = value.geometry as GeoGeometry | undefined;
    let changed = false;
    const next = { ...value };
    if (geometry?.coordinates) {
      next.geometry = { ...geometry, coordinates: transformCoordinates(geometry.coordinates, transform) };
      changed = true;
    }
    for (const fields of pointFields) {
      const x = value[fields.x];
      const y = value[fields.y];
      if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      const [nextX, nextY] = transform(x, y);
      next[fields.x] = nextX;
      next[fields.y] = nextY;
      changed = true;
    }
    return changed ? next : value;
  });
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function planarCenter(geometry: GeoGeometry): GeometryPoint | null {
  const pairs: Array<[number, number]> = [];
  coordinatePairs(geometry.coordinates, pairs);
  if (!pairs.length) return null;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of pairs) {
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }
  return { geometry, x: (minimumX + maximumX) / 2, y: (minimumY + maximumY) / 2 };
}

/** Selects the dense body of features after GGSQL has projected their vertices. */
export function robustPlanarGeometryFit(values: Array<Record<string, unknown>>) {
  const entries: GeometryPoint[] = values.flatMap((value) => {
    const geometry = value.geometry as GeoGeometry | undefined;
    if (!geometry?.type || !geometry.coordinates) return [];
    const center = planarCenter(geometry);
    return center ? [center] : [];
  });
  if (!entries.length) return undefined;
  if (entries.length < 12) return featureCollection(entries);

  const centerX = median(entries.map(({ x }) => x));
  const centerY = median(entries.map(({ y }) => y));
  const scaleX = median(entries.map(({ x }) => Math.abs(x - centerX))) || 1;
  const scaleY = median(entries.map(({ y }) => Math.abs(y - centerY))) || 1;
  const coverage = entries.length >= 500 ? 0.985 : entries.length >= 30 ? 0.94 : 0.9;
  const count = Math.max(1, Math.ceil(entries.length * coverage));
  const selected = [...entries]
    .sort((a, b) => {
      const distanceA = Math.hypot((a.x - centerX) / scaleX, (a.y - centerY) / scaleY);
      const distanceB = Math.hypot((b.x - centerX) / scaleX, (b.y - centerY) / scaleY);
      return distanceA - distanceB;
    })
    .slice(0, count);

  // A national dataset can have a few distant but intentional features (for
  // example Alaska and Hawaii). Excluding them from the projection while their
  // text marks remain visible makes Vega's responsive layout collapse around
  // the off-camera labels. Only switch to the dense subset when it removes a
  // truly extreme amount of empty space; otherwise preserve the complete
  // analytical extent returned by the query.
  const fullBounds = collectionBounds(featureCollection(entries));
  const selectedBounds = collectionBounds(featureCollection(selected));
  if (!fullBounds || !selectedBounds) return undefined;
  const fullSpanX = fullBounds.maximumX - fullBounds.minimumX;
  const fullSpanY = fullBounds.maximumY - fullBounds.minimumY;
  const selectedSpanX = Math.max(Number.EPSILON, selectedBounds.maximumX - selectedBounds.minimumX);
  const selectedSpanY = Math.max(Number.EPSILON, selectedBounds.maximumY - selectedBounds.minimumY);
  if (Math.max(fullSpanX / selectedSpanX, fullSpanY / selectedSpanY) < 2.75) return undefined;
  return featureCollection(selected);
}

/**
 * Fit a geographic chart to the dense body of returned features. GeoJSON
 * collections often mix a country with a handful of remote territories; using
 * every feature for the projection makes the useful geography postage-stamp
 * sized. The fit subset affects only the camera. Every row remains in the mark
 * data and can still be queried, previewed, or included by a different filter.
 */
export function robustGeometryFit(values: Array<Record<string, unknown>>) {
  const entries: GeometryCenter[] = values.flatMap((value) => {
    const geometry = value.geometry as GeoGeometry | undefined;
    if (!geometry?.type || !geometry.coordinates) return [];
    const longitude = geometryCenter(geometry);
    return longitude === null ? [] : [{ geometry, longitude }];
  });
  if (entries.length < 12) return undefined;

  const coverage = entries.length >= 500 ? 0.985 : entries.length >= 30 ? 0.94 : 0.9;
  const count = Math.max(1, Math.ceil(entries.length * coverage));
  const sorted = entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.longitude - b.longitude);
  const extended = [...sorted, ...sorted.map((entry) => ({ ...entry, longitude: entry.longitude + 360 }))];

  const narrowestWindow = (windowSize: number) => {
    let start = 0;
    let span = Number.POSITIVE_INFINITY;
    for (let index = 0; index < sorted.length; index += 1) {
      const candidate = extended[index + windowSize - 1]!.longitude - extended[index]!.longitude;
      if (candidate < span) {
        start = index;
        span = candidate;
      }
    }
    return { start, span };
  };

  const full = narrowestWindow(entries.length);
  const robust = narrowestWindow(count);
  if (full.span - robust.span < 12 || full.span < robust.span * 1.35) return undefined;

  const selected = extended.slice(robust.start, robust.start + count);
  return featureCollection(selected);
}
