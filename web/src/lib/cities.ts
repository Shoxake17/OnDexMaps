/**
 * Shaharlar ro'yxati — URL va indekslash uchun.
 *
 * ┌─ ⚠️ `id` VA `slug` HECH QACHON O'ZGARTIRILMAYDI ────────────────────
 * Ular URL'ga kiradi (`/maps/10335/tashkent/`) va qidiruv tizimlari
 * ularni indekslaydi. `id` o'zgarsa eski havola 404 bo'lib, to'plangan
 * reyting yo'qoladi. `slug` o'zgarsa, sahifa `id` bo'yicha topiladi va
 * yangi `slug` ga 308 yo'naltiriladi — lekin baribir indeks yangilanishini
 * kutish kerak. Yangi shahr qo'shilsa — ro'yxat OXIRIGA, yangi `id` bilan.
 *
 * `id` lar — OnDexMap'ning O'ZI berganligi: Yandex yoki boshqa xizmatning
 * identifikatori emas. Toshkent uchun 10335 — havola shakli misoldagi
 * bilan mos kelishi uchun tanlangan.
 * └──────────────────────────────────────────────────────────────────
 *
 * Markaz va zoom — shahar sahifasi (`?ll=` bo'lmaganda) shu yerdan ochiladi.
 * Koordinatalar shahar MARKAZI uchun taxminiy: foydalanuvchi baribir xaritani
 * suradi, aniqlik bu yerda muhim emas.
 */

export interface City {
  id: number;
  /** Lotin harflaridagi ASCII nom — URL uchun. */
  slug: string;
  /** Ko'rsatiladigan nom. */
  name: string;
  /** [uzunlik, kenglik]. */
  center: [number, number];
  zoom: number;
  /** Mahalla/qishloq chegaralari bazada bormi (hozir faqat Chust). */
  hasAreas?: boolean;
}

export const CITIES: readonly City[] = [
  { id: 10335, slug: "tashkent", name: "Toshkent", center: [69.338672, 41.229654], zoom: 11 },
  { id: 10336, slug: "samarkand", name: "Samarqand", center: [66.9597, 39.6542], zoom: 12 },
  { id: 10337, slug: "bukhara", name: "Buxoro", center: [64.4286, 39.7747], zoom: 12 },
  { id: 10338, slug: "namangan", name: "Namangan", center: [71.6726, 40.9983], zoom: 12 },
  { id: 10339, slug: "andijan", name: "Andijon", center: [72.3442, 40.7821], zoom: 12 },
  { id: 10340, slug: "fergana", name: "Farg'ona", center: [71.7864, 40.3864], zoom: 12 },
  { id: 10341, slug: "kokand", name: "Qo'qon", center: [70.9425, 40.5286], zoom: 12 },
  { id: 10342, slug: "nukus", name: "Nukus", center: [59.6103, 42.4531], zoom: 12 },
  { id: 10343, slug: "karshi", name: "Qarshi", center: [65.7887, 38.8606], zoom: 12 },
  { id: 10344, slug: "termez", name: "Termiz", center: [67.2783, 37.2242], zoom: 12 },
  { id: 10345, slug: "urgench", name: "Urganch", center: [60.6333, 41.55], zoom: 12 },
  { id: 10346, slug: "navoi", name: "Navoiy", center: [65.3792, 40.0844], zoom: 12 },
  { id: 10347, slug: "jizzakh", name: "Jizzax", center: [67.8422, 40.1158], zoom: 12 },
  { id: 10348, slug: "gulistan", name: "Guliston", center: [68.7842, 40.4897], zoom: 12 },
  { id: 10349, slug: "khiva", name: "Xiva", center: [60.3639, 41.3775], zoom: 13 },
  { id: 10350, slug: "margilan", name: "Marg'ilon", center: [71.7247, 40.4711], zoom: 13 },
  { id: 10351, slug: "chust", name: "Chust", center: [71.2394, 41.0004], zoom: 15.4, hasAreas: true },
];

/** Bosh sahifa (`/`) shu shaharni ko'rsatadi. */
export const DEFAULT_CITY: City = CITIES[CITIES.length - 1];

/**
 * `id` matnini shaharga aylantiradi.
 *
 * FAQAT raqamlardan iborat matn qabul qilinadi: `"10335abc"` yoki `"1e4"`
 * `Number()` da son bo'lib ketardi va noto'g'ri sahifaga olib borardi.
 */
export function findCity(rawId: string): City | undefined {
  if (!/^\d{1,9}$/.test(rawId)) return undefined;
  const id = Number(rawId);
  return CITIES.find((c) => c.id === id);
}

/**
 * Xarita markazi shu masofadan (km) yaqin bo'lsagina "shu shahardamiz" deyiladi.
 *
 * Nima uchun 60: shaharlar orasi eng yaqin joyda ~15 km (Marg'ilon–Farg'ona),
 * eng uzoqda 200+ km. 60 km shahar atrofini (tuman markazlari, qishloqlar)
 * qamraydi, lekin cho'l o'rtasida turgan xaritani "Buxoro" deb ko'rsatmaydi.
 */
export const CITY_RADIUS_KM = 60;

/** Ikki nuqta orasidagi masofa (km) — Haversine. */
function distanceKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Berilgan nuqtaga ENG YAQIN shahar va masofa (km). */
export function nearestCity(lng: number, lat: number): { city: City; km: number } {
  let best = CITIES[0];
  let bestKm = Infinity;
  for (const c of CITIES) {
    const km = distanceKm(lng, lat, c.center[0], c.center[1]);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return { city: best, km: bestKm };
}

/** `id` bo'yicha (ichki, allaqachon tekshirilgan qiymat uchun). */
export function cityById(id: number): City {
  return CITIES.find((c) => c.id === id) ?? DEFAULT_CITY;
}

/** Shahar sahifasining YO'LI (oxirida `/` — `trailingSlash: true` bilan mos). */
export function cityPath(city: Pick<City, "id" | "slug">, sputnik: boolean): string {
  return `/maps/${city.id}/${city.slug}/${sputnik ? "sputnik/" : ""}`;
}

export function cityTitle(city: City, sputnik: boolean): string {
  return sputnik
    ? `${city.name} sun'iy yo'ldosh xaritasi — OnDex Map`
    : `${city.name} xaritasi — OnDex Map`;
}

export function cityDescription(city: City, sputnik: boolean): string {
  return sputnik
    ? `${city.name} shahrining yuqori aniqlikdagi sun'iy yo'ldosh tasviri: ` +
        `ko'chalar, hovlilar va binolar. Masofa o'lchash va marshrut qurish.`
    : `${city.name} shahrining batafsil xaritasi: ko'chalar, binolar, ` +
        `mahallalar va manzillar. Masofa o'lchash va marshrut qurish.`;
}
