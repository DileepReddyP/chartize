declare module "shpjs" {
  import type { GeoJsonObject } from "geojson";

  const parseShapefile: (data: ArrayBuffer) => Promise<GeoJsonObject | GeoJsonObject[]>;
  export default parseShapefile;
}
