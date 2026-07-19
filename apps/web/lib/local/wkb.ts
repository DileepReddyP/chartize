import type { Geometry } from "geojson";

class ByteWriter {
  private bytes: number[] = [];

  u8(value: number) {
    this.bytes.push(value & 0xff);
  }

  u32(value: number) {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  }

  f64(value: number) {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    this.bytes.push(...new Uint8Array(buffer));
  }

  point(coordinates: number[]) {
    this.f64(coordinates[0] ?? Number.NaN);
    this.f64(coordinates[1] ?? Number.NaN);
  }

  geometry(geometry: Geometry) {
    this.u8(1);
    switch (geometry.type) {
      case "Point":
        this.u32(1);
        this.point(geometry.coordinates);
        break;
      case "LineString":
        this.u32(2);
        this.u32(geometry.coordinates.length);
        geometry.coordinates.forEach((point) => this.point(point));
        break;
      case "Polygon":
        this.u32(3);
        this.u32(geometry.coordinates.length);
        geometry.coordinates.forEach((ring) => {
          this.u32(ring.length);
          ring.forEach((point) => this.point(point));
        });
        break;
      case "MultiPoint":
        this.u32(4);
        this.u32(geometry.coordinates.length);
        geometry.coordinates.forEach((point) => this.geometry({ type: "Point", coordinates: point }));
        break;
      case "MultiLineString":
        this.u32(5);
        this.u32(geometry.coordinates.length);
        geometry.coordinates.forEach((line) => this.geometry({ type: "LineString", coordinates: line }));
        break;
      case "MultiPolygon":
        this.u32(6);
        this.u32(geometry.coordinates.length);
        geometry.coordinates.forEach((polygon) => this.geometry({ type: "Polygon", coordinates: polygon }));
        break;
      case "GeometryCollection":
        this.u32(7);
        this.u32(geometry.geometries.length);
        geometry.geometries.forEach((child) => this.geometry(child));
        break;
      default:
        throw new Error("Unsupported GeoJSON geometry type.");
    }
  }

  finish() {
    return new Uint8Array(this.bytes);
  }
}

export function geojsonGeometryToWkb(geometry: Geometry): Uint8Array {
  const writer = new ByteWriter();
  writer.geometry(geometry);
  return writer.finish();
}

