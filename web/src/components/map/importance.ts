/**
 * Muhimlik darajalari (importance tiers) — Google/Yandex Maps kabi DINAMIK
 * ko'rinish uchun.
 *
 * ┌─ MEXANIZM (global standart, OpenMapTiles/Mapbox/MapLibre'ning o'zi) ──
 * Professional xaritalarda har bir ob'ekt turi ikki narsa bilan farqlanadi:
 *   1. QAYERDAN ko'rina boshlaydi — turga xos `minzoom` (kasalxona uzoqdan,
 *      kichik do'kon faqat yaqinlashganda).
 *   2. Joy tor bo'lganda KIM G'OLIB CHIQADI — `symbol-sort-key` (raqam
 *      qancha kichik, shuncha ustuvor). Yaqinlashtirilganda ekranda bo'sh
 *      joy ko'payadi va avval yashiringan (past ustuvorlik) belgilar ham
 *      paydo bo'ladi — mana shu STATIK emas, DINAMIK ko'rinishning siri.
 *
 * MapLibre'da `minzoom` qatlam darajasida (ma'lumotdan hisoblanmaydi), shuning
 * uchun HAR BIR DARAJA — ALOHIDA QATLAM (`usePlacesLayer.ts` → tier1..tier4,
 * xuddi shunday `internal/httpapi/assets/style-chust.json` → `poi-tier1..4`).
 * Bu — OpenMapTiles'ning o'z namunaviy uslublari (osm-bright va h.k.) ham
 * ishlatadigan yondashuv, xayoliy emas.
 * └────────────────────────────────────────────────────────────────────
 *
 * ⚠️ BIR XIL SHKALA: OSM joylari va OnDexMap ob'ektlari SHU YERDAGI 4 daraja
 * va `TIER_MINZOOM` dan foydalanadi (OSM tomoni `style-chust.json` ichida,
 * qo'lda, lekin AYNAN shu sonlar bilan — o'zgartirilsa ikkalasi ham
 * yangilanishi kerak). Shundagina masalan tier-1 OnDexMap kasalxonasi tier-3
 * OSM kafesini to'qnashuvda "yutadi" — manbasidan qat'i nazar, xuddi haqiqiy
 * xaritalardagi kabi.
 */

export type Tier = 1 | 2 | 3 | 4;
export const TIERS: readonly Tier[] = [1, 2, 3, 4];

/**
 * Daraja → eng uzoq masshtab (undan uzoqroqda ko'rinmaydi). Daraja 1 — eng
 * uzoqdan ko'rinadigan (shahar miqyosidagi yirik/kam sonli ob'ektlar).
 *
 * ⚠️ `style-chust.json` dagi `poi-tier1..4` bilan AYNAN bir xil sonlar.
 */
export const TIER_MINZOOM: Record<Tier, number> = { 1: 12, 2: 14, 3: 15, 4: 16.5 };

/** `symbol-sort-key` bazasi: to'qnashuvda daraja 1 doim daraja 2..4 ni yutadi. */
export const TIER_SORT_BASE: Record<Tier, number> = { 1: 1000, 2: 2000, 3: 3000, 4: 4000 };

/**
 * OnDexMap «Tashkilot» turkumi → daraja. Kalitlar `internal/places.Categories`
 * dagi AYNAN shu satrlar (server ro'yxati — yagona haqiqat manbai).
 *
 * Mezon (OpenMapTiles/Google amaliyoti bilan bir xil): shahar miqyosidagi,
 * kam sonli, muhim orientir — 1; kundalik, ko'p ziyorat qilinadigan — 2;
 * oddiy tijorat — 3; kichik/ko'p sonli/texnik — 4.
 */
export const ORG_CATEGORY_TIER: Record<string, Tier> = {
  "Shifoxona / Klinika": 1,
  "Kollej / Universitet": 1,
  Masjid: 1,
  "Yoqilg'i shoxobchasi": 1,
  "Davlat muassasasi": 1,

  "Bank / Bankomat": 2,
  Maktab: 2,
  Bozor: 2,
  Mehmonxona: 2,

  "Oziq-ovqat do'koni": 3,
  Restoran: 3,
  Kafe: 3,
  Choyxona: 3,
  Dorixona: 3,
  "Bolalar bog'chasi": 3,
  Avtoservis: 3,
  "Idora / Ofis": 3,

  "Go'zallik saloni": 4,
  "Kiyim do'koni": 4,
  "Ta'mirlash va xizmatlar": 4,
};
/** Ro'yxatda yo'q (yoki bo'sh) turkum — oddiy tijorat darajasi. */
const ORG_CATEGORY_DEFAULT: Tier = 3;

/**
 * Turkumsiz OnDexMap turlari → daraja (`entrance`, `crossing`, `fence`, `road`
 * bu yerda YO'Q — ular nuqta-belgi emas, o'z alohida ko'rinish qoidasiga ega).
 */
export const KIND_TIER: Record<string, Tier> = {
  // Transport bekati — OSM `bus` bilan bir xil daraja (2): odam uni bir necha
  // ko'chadan ko'rishi kerak, lekin kasalxonadan kam muhim.
  stop: 2,
  parking: 3,
  address: 4,
  barrier: 4,
  gate: 4,
  other: 4,
};
const KIND_DEFAULT: Tier = 4;

/** Bitta ob'ektning darajasi (`kind` + `category`, faqat `organization` uchun kerak). */
export function placeTier(kind: string, category: string): Tier {
  if (kind === "organization") return ORG_CATEGORY_TIER[category] ?? ORG_CATEGORY_DEFAULT;
  return KIND_TIER[kind] ?? KIND_DEFAULT;
}

/**
 * MapLibre ifodasi: `["get","kind"]`/`["get","category"]` xususiyatlaridan
 * daraja (1..4) hisoblaydi. Qatlam filtri (`== N`) va `symbol-sort-key` uchun.
 */
export function placeTierExpr(): unknown[] {
  const orgMatch: unknown[] = ["match", ["get", "category"]];
  for (const [cat, tier] of Object.entries(ORG_CATEGORY_TIER)) orgMatch.push(cat, tier);
  orgMatch.push(ORG_CATEGORY_DEFAULT);

  const kindMatch: unknown[] = ["match", ["get", "kind"]];
  for (const [kind, tier] of Object.entries(KIND_TIER)) kindMatch.push(kind, tier);
  kindMatch.push(KIND_DEFAULT);

  return ["case", ["==", ["get", "kind"], "organization"], orgMatch, kindMatch];
}
