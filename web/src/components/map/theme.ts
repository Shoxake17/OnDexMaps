/**
 * Xarita mavzusi: yorug' (standart) va qorong'i (mobil, qurilma qorong'i
 * rejimda bo'lganda).
 *
 * ┌─ NEGA ISH VAQTIDA BO'YASH, IKKINCHI USLUB FAYLI EMAS ──────────────
 * Ikkinchi `style.json` bo'lsa, mavzu almashganda butun uslub qayta
 * yuklanardi: barcha qatlamlar (mahalla, marshrut, sun'iy yo'ldosh) yo'qolib,
 * qayta qo'shilishi kerak bo'lardi. `setPaintProperty` esa faqat RANGNI
 * o'zgartiradi — qolgan hamma narsa joyida qoladi.
 * └──────────────────────────────────────────────────────────────────
 *
 * Yorug' mavzuga qaytish uchun ASL qiymatlar uslubdan bir marta o'qib
 * saqlanadi (kodga qayta yozilmaydi — uslub o'zgarsa ikki nusxa
 * farq qilib qolmasin).
 */

import type { Map as MLMap } from "maplibre-gl";

type Paint = Record<string, unknown>;

// Palitra: fon #232734 (Yandex qorong'i xaritasi kabi ko'k-kulrang), yo'llar
// fondan ochroq, suv to'q ko'k, yashillik to'q yashil, yozuvlar och kulrang.
const BG = "#232734";

const DARK: Record<string, Paint> = {
  background: { "background-color": BG },
  landcover: {
    "fill-color": [
      "match", ["get", "class"],
      "wood", "#21362c", "grass", "#243a2f", "farmland", "#2a382f",
      "sand", "#37352f", "wetland", "#233a39", "#233a2e",
    ],
  },
  landuse: {
    "fill-color": [
      "match", ["get", "class"],
      "residential", "#282c3a", "suburb", "#282c3a", "neighbourhood", "#282c3a",
      "quarter", "#282c3a", "commercial", "#2b2e3d", "retail", "#2b2e3d",
      "industrial", "#2a2d38", "garages", "#2a2d38", "cemetery", "#22372c",
      "hospital", "#33293a", "school", "#2a2e3c", "kindergarten", "#2a2e3c",
      "college", "#2a2e3c", "university", "#2a2e3c",
      "park", "#22382e", "garden", "#22382e", "recreation_ground", "#23392f",
      "village_green", "#243a2f", "playground", "#23392f", "theme_park", "#23392f",
      "dog_park", "#23392f", "grass", "#243a2f", "pitch", "#22382e",
      "golf_course", "#22382e", "stadium", "#2d313f",
      "#252937",
    ],
  },
  park: { "fill-color": "#22382e" },
  water: { "fill-color": "#1b3a5c" },
  waterway: { "line-color": "#1f4a75" },
  "ms-building-flat": { "fill-color": "#2f3546", "fill-outline-color": "#3a4156" },
  "ms-building-3d": { "fill-extrusion-color": "#343b4e" },
  "road-casing": { "line-color": "#1c1f29" },
  "road-minor": { "line-color": "#3c4358" },
  "road-major": { "line-color": "#4d5670" },
  "road-trunk": { "line-color": "#5a6482" },
  "road-path": { "line-color": "#454c60" },
  rail: { "line-color": "#4a4a54" },
  boundary: { "line-color": "#5a5470" },
  "road-label": { "text-color": "#b4bccd", "text-halo-color": BG },
  "water-label": { "text-color": "#6fa2d6", "text-halo-color": "#1b3a5c" },
  "poi-label": { "text-color": "#e8b48a", "text-halo-color": BG },
  housenumber: { "text-color": "#8c96aa", "text-halo-color": BG },
  "place-label": { "text-color": "#f2f4f8", "text-halo-color": BG },
  // Keyin qo'shiladigan qatlam (MapProvider): mahalla nomi.
  "mahalla-label": { "text-color": "#f2b48a", "text-halo-color": BG },
};

/** Qatlam+xususiyat → uslubdagi ASL qiymat (yorug' mavzuga qaytish uchun). */
const originals = new WeakMap<MLMap, Map<string, unknown>>();

/**
 * Mavzuni qo'llaydi. Bir necha marta chaqirish xavfsiz (idempotent):
 * mahalla qatlami keyin qo'shilgani uchun u ham tayyor bo'lgach yana chaqiriladi.
 */
export function applyMapTheme(map: MLMap, dark: boolean): void {
  let saved = originals.get(map);
  if (!saved) {
    saved = new Map();
    originals.set(map, saved);
  }

  for (const [layer, paint] of Object.entries(DARK)) {
    if (!map.getLayer(layer)) continue;
    for (const [prop, darkValue] of Object.entries(paint)) {
      const key = `${layer}|${prop}`;
      if (!saved.has(key)) {
        // Birinchi marta — yorug' (asl) qiymatni eslab qolamiz. Qorong'i
        // qiymat allaqachon qo'llangan bo'lsa (qatlam kech qo'shilgan) asl
        // qiymat noma'lum va yorug' rejimga qaytishda tegilmaydi.
        saved.set(key, map.getPaintProperty(layer, prop));
      }
      if (dark) {
        map.setPaintProperty(layer, prop, darkValue as never);
      } else if (saved.get(key) !== undefined) {
        map.setPaintProperty(layer, prop, saved.get(key) as never);
      }
    }
  }
}
