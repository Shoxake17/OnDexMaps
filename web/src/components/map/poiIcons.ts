"use client";

/**
 * POI belgilari — sprite FAYLISIZ.
 *
 * ┌─ NEGA SPRITE EMAS ─────────────────────────────────────────────────
 * MapLibre odatda belgilarni tayyor sprite (PNG + JSON) dan oladi.
 * Bu bizga ikki narsani qo'shardi: yasash bosqichi (SVG → atlas) va
 * serverdan yana ikkita fayl. Yangi turkum qo'shish har safar sprite'ni
 * qayta yasash va binarni qayta qurishni talab qilardi.
 *
 * Buning o'rniga belgilar BRAUZERDA, tuvalda chiziladi va MapLibre'ga
 * `addImage` bilan beriladi. Uslub faqat NOM so'raydi
 * (`ondex-poi-<class>`), rasm topilmasa `styleimagemissing` hodisasi
 * ishlaydi va biz shu zahoti chizib beramiz.
 * └──────────────────────────────────────────────────────────────────
 */

export const POI_PREFIX = "ondex-poi-";

/** Belgining mantiqiy o'lchami (px). Tuval 2 barobar kattaroq chiziladi. */
const SIZE = 22;
const RATIO = 2;

interface IconDef {
  color: string;
  /** 24×24 koordinatalarida SVG yo'li. */
  d: string;
}

const STROKE = "#ffffff";

// Yo'llar ATAYLAB sodda: 14 px doira ichida murakkab shakl baribir
// ko'rinmaydi, lekin fayl hajmini va chizish vaqtini oshiradi.
const FOOD = "M8 3v8M11 3v8M9.5 11v10M17 3c-1.3 1.8-2 3.6-2 5.4s.7 2.6 2 2.6 2-.8 2-2.6S18.3 4.8 17 3zM17 11v10";
const CUP = "M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 9h2a2.5 2.5 0 0 1 0 5h-2";
const BAG = "M5 8h14l-1.2 12H6.2zM9 8V6.5a3 3 0 0 1 6 0V8";
const CART = "M3 4h2.2l2.3 11h10L20 7H6.5M9 20a1 1 0 1 0 0-.1M17 20a1 1 0 1 0 0-.1";
const CROSS = "M12 6v12M6 12h12";
const CARD = "M3 6h18v12H3zM3 10h18M6 15h4";
const FUEL = "M5 20V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15M4 20h10M13 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2-2M7 7h4v3H7z";
const BED = "M3 18v-6a2 2 0 0 1 2-2h10a4 4 0 0 1 4 4v4M3 18h18M3 14h5M7 10V8a1 1 0 0 1 1-1h1";
const SCHOOL = "M4 10l8-5 8 5-8 5zM7 12.5V17c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5";
const HOSPITAL = "M4 21V9l8-5 8 5v12M12 11v6M9 14h6";
const BUS = "M5 5h14v10H5zM5 15v3M19 15v3M5 9h14M8 12h.01M16 12h.01";
const TRAIN = "M6 4h12v10H6zM6 14l-2 5M18 14l2 5M9 8h6";
const WORSHIP = "M12 3v18M8 8h8M6 21V11l6-4 6 4v10";
const SPORT = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18";
const TREE = "M12 21v-5M12 16l-5-3 2-.5-4-3 2-.5L12 4l5 5-2 .5 4 3-2 .5z";
const INFO = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.01";
const POLICE = "M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z";
const CAR = "M4 16v-3l2-5h12l2 5v3M4 16h16M4 16v2M20 16v2M7 13h.01M17 13h.01";
const DOT = "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z";

/**
 * Turkum → rang va belgi.
 *
 * Kalitlar — OpenMapTiles `poi` qatlamidagi `class` qiymatlari.
 * Ro'yxatda yo'q turkum `other` ga tushadi: bu — ATAYLAB, noma'lum
 * turkum uchun "o'xshash" belgi tanlash yolg'on ma'no berardi.
 */
const DEFS: Record<string, IconDef> = {
  restaurant: { color: "#f59e42", d: FOOD },
  fast_food: { color: "#f59e42", d: FOOD },
  cafe: { color: "#a855f7", d: CUP },
  bar: { color: "#a855f7", d: CUP },
  pub: { color: "#a855f7", d: CUP },
  bakery: { color: "#f97316", d: BAG },
  grocery: { color: "#5ca9e8", d: CART },
  supermarket: { color: "#5ca9e8", d: CART },
  convenience: { color: "#5ca9e8", d: CART },
  shop: { color: "#6fb9ef", d: BAG },
  clothing_store: { color: "#6fb9ef", d: BAG },
  marketplace: { color: "#f97316", d: CART },
  pharmacy: { color: "#4cc15f", d: CROSS },
  hospital: { color: "#14b8a6", d: HOSPITAL },
  doctors: { color: "#14b8a6", d: CROSS },
  dentist: { color: "#14b8a6", d: CROSS },
  bank: { color: "#e8453c", d: CARD },
  atm: { color: "#e8453c", d: CARD },
  fuel: { color: "#9b8cf5", d: FUEL },
  car: { color: "#64748b", d: CAR },
  lodging: { color: "#a78bfa", d: BED },
  school: { color: "#eab308", d: SCHOOL },
  college: { color: "#eab308", d: SCHOOL },
  library: { color: "#eab308", d: SCHOOL },
  place_of_worship: { color: "#8b7355", d: WORSHIP },
  bus: { color: "#0ea5e9", d: BUS },
  railway: { color: "#0ea5e9", d: TRAIN },
  police: { color: "#3b82f6", d: POLICE },
  town_hall: { color: "#3b82f6", d: POLICE },
  post: { color: "#3b82f6", d: CARD },
  park: { color: "#4cc15f", d: TREE },
  garden: { color: "#4cc15f", d: TREE },
  pitch: { color: "#4cc15f", d: SPORT },
  stadium: { color: "#4cc15f", d: SPORT },
  sport: { color: "#4cc15f", d: SPORT },
  swimming: { color: "#38bdf8", d: SPORT },
  attraction: { color: "#f59e42", d: INFO },
  information: { color: "#94a3b8", d: INFO },
  other: { color: "#94a3b8", d: DOT },
};

/**
 * Turkum uchun belgi rasmi.
 *
 * `null` — tuval mavjud emas (masalan test muhitida): chaqiruvchi
 * shunchaki rasm qo'shmaydi va MapLibre belgisiz davom etadi.
 */
export function makePoiIcon(
  className: string,
): { width: number; height: number; data: Uint8ClampedArray } | null {
  const def = DEFS[className] ?? DEFS.other;

  const px = SIZE * RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const c = px / 2;

  // Oq halqa — belgi qanday fonda ham (bino, o't, sun'iy yo'ldosh)
  // ajralib tursin.
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, c - 2.5 * RATIO * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = def.color;
  ctx.fill();

  // 24×24 yo'lni doira ichiga joylashtirish.
  const glyph = 13 * RATIO;
  ctx.save();
  ctx.translate(c - glyph / 2, c - glyph / 2);
  ctx.scale(glyph / 24, glyph / 24);
  ctx.strokeStyle = STROKE;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(def.d));
  ctx.restore();

  return ctx.getImageData(0, 0, px, px);
}

/** MapLibre'ga beriladigan piksel nisbati. */
export const POI_PIXEL_RATIO = RATIO;
