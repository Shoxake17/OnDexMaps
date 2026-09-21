/**
 * Past zoomdagi tile'larda ma'lumot bormi — tekshiruv vositasi.
 *
 * "Uzoqlashtirsa xarita yo'qoladi" degan nosozlikda birinchi savol:
 * tile bo'shmi yoki uslub ularni chizmayaptimi? Bu skript birinchisiga
 * javob beradi.
 *
 *   node scripts/check-tiles.mjs
 */
import { PMTiles } from "pmtiles";

const URL_MAP =
  "https://tiles.ondex.uz/ondexmap/uzbekistan.pmtiles";

/** Chust markazi uchun tile koordinatasi. */
function tileFor(lng, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

const p = new PMTiles(URL_MAP);
const meta = await p.getMetadata();
const layers = (meta?.vector_layers ?? []).map((l) => l.id);
console.log(`Tile ichidagi qatlamlar: ${layers.join(", ")}`);

for (const z of [4, 6, 8, 10, 12, 14]) {
  const { x, y } = tileFor(71.2394, 41.0004, z);
  const tile = await p.getZxy(z, x, y);
  const size = tile?.data?.byteLength ?? 0;
  console.log(
    `z${String(z).padStart(2)} (${x}/${y}): ${size ? `${size} bayt` : "BO'SH"}`,
  );
}
