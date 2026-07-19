import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = "https://ggsql.org/wasm/mod_spatialite.wasm";
const target = resolve("apps/web/public/wasm/mod_spatialite.wasm");
const response = await fetch(source);

if (!response.ok) {
  throw new Error(`Failed to download SpatiaLite WASM: ${response.status}`);
}

await mkdir(dirname(target), { recursive: true });
await writeFile(target, new Uint8Array(await response.arrayBuffer()));
console.log(`Saved ${target}`);

