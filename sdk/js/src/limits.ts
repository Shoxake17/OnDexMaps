/**
 * Server tomonidagi CHEGARALAR — SDK ularni so'rovdan OLDIN qo'llaydi.
 *
 * ┌─ NEGA SHU YERDA ───────────────────────────────────────────────────┐
 * Bu raqamlar serverda ham bor. Ikki nusxa — xavf, shuning uchun ular
 * Go tarafdagi `sdk_sync_test.go` bilan QULFLANGAN: server chegarasi
 * o'zgarsa test yiqiladi va SDK'ni yangilash esdan chiqmaydi.
 *
 * Nusxa saqlanishining sababi: chegarani MIJOZ tomonda tekshirish
 * kerakli so'rovni umuman yubormaslikka imkon beradi. Aks holda
 * dasturchi 400 oladi va nima qilishni bilmaydi — bu aynan sinovda
 * ko'rilgan holat edi.
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Xizmat hududi — barcha koordinatalar shu to'rtburchak ichida. */
export const SERVICE_AREA = {
  minLng: 55.5,
  minLat: 37.0,
  maxLng: 73.5,
  maxLat: 45.8,
} as const;

/**
 * Teskari geokodlash hududi — butun mamlakat EMAS.
 *
 * `/v2/reverse` faqat shu to'rtburchak ichida ishlaydi; tashqarisida
 * server `400` qaytaradi. Sabab — ma'lumot: mahalla va ko'cha
 * nomlari hozircha shu hududda to'plangan.
 *
 * ⚠️ MARSHRUT boshqa: u {@link SERVICE_AREA} — butun mamlakat.
 * Ikkalasi bir vaqtlar bir xil edi, shuning uchun ularni
 * adashtirmaslik uchun nomlar aniq.
 */
export const REVERSE_AREA = {
  minLng: 70.5,
  minLat: 40.5,
  maxLng: 72.0,
  maxLat: 41.6,
} as const;

/**
 * Marshrut hududi — butun O'zbekiston.
 *
 * `/v2/directions` o'z OSRM grafigimizdan foydalanadi, u
 * `uzbekistan.osm.pbf` dan qurilgan. 2026-09-28 da o'lchandi:
 * Toshkent ichida, Chust→Toshkent, Buxoro→Toshkent, Nukus→Termiz va
 * Xorazm→Farg'ona (1216 km) — hammasi ishlaydi.
 */
export const DIRECTIONS_AREA = SERVICE_AREA;

/**
 * `/v2/places` uchun to'rtburchak tomonining chegarasi — TARIFGA bog'liq.
 *
 * SDK tarifni bilmaydi (u serverda aniqlanadi), shuning uchun standart
 * holatda eng TOR chegara ishlatiladi. Obunachi uni klient yaratishda
 * `plan: "paid"` berib oshiradi.
 */
export const BBOX_SPAN = {
  free: 0.25,
  paid: 1.0,
  ecosystem: 1.5,
} as const;

export type PlanName = keyof typeof BBOX_SPAN;

/** Bitta `/v2/geocode` so'rovida qaytadigan eng ko'p natija. */
export const GEOCODE_MAX_LIMIT = 25;

/** Rasmiy manzillar. */
export const DEFAULT_API_BASE = "https://maps.ondex.uz/v2";
export const DEFAULT_STYLE_URL = "https://maps.ondex.uz/tiles/style.json";
export const COPYRIGHT_URL = "https://maps.ondex.uz/copyright";
