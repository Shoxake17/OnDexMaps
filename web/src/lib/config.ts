/**
 * Muhit sozlamalari — BITTA joyda.
 *
 * Qiymatlar komponentlar ichiga tarqalib ketmasligi kerak: manzil
 * o'zgarganda bitta fayl tahrirlanadi va qaysi sozlama qayerdan
 * kelayotgani doim ma'lum bo'ladi.
 *
 * ⚠️ `NEXT_PUBLIC_` prefiksi — qiymat BRAUZERGA tushadi. Shu sabab bu
 * yerga faqat ochiq ma'lumot yoziladi. Sir (baza paroli, admin kaliti)
 * hech qachon bu yerda bo'lmaydi — ular faqat serverda, Go API ichida
 * qoladi.
 */

/** OnDexMap Go API manzili. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8090";

/**
 * Xarita uslubi API'dan olinadi, ilovaga QOTIRILMAYDI.
 *
 * Sabab: uslub ichida tile manzili bor va u muhitga qarab o'zgaradi
 * (lokal fayl yoki R2). Uslub frontend build'iga yozilsa, tile
 * manzilini almashtirish uchun frontendni qayta qurish kerak bo'lardi.
 */
export const STYLE_URL = `${API_BASE}/tiles/style.json`;

/** Chust markazi — xarita shu yerdan ochiladi. */
export const CHUST_CENTER: [number, number] = [71.2394, 41.0004];

/**
 * Ko'rinish chegarasi: tile ma'lumoti butun O'zbekistonni qamraydi.
 * Undan tashqarida tile yo'q va xarita oq bo'lib qolardi.
 */
export const UZ_BOUNDS: [[number, number], [number, number]] = [
  [55.5, 37.0],
  [73.5, 45.8],
];

/** Mahalla nomlari shu zoomdan boshlab ko'rinadi (uslub bilan bir xil). */
export const MAHALLA_ZOOM_IN = 14.5;

/**
 * Mobil ko'rinishda QORONG'I mavzu yoqilganmi.
 *
 * `false` — telefon qorong'i rejimda bo'lsa ham xarita va panel doim YORUG'.
 * `true` — telefonning tizim mavzusiga ergashadi (qurilma qorong'i bo'lsa
 * qorong'i). Mavzu kodi (`map/theme.ts`, `dark:` klasslari) saqlangan: bayroqni
 * almashtirish yetarli, boshqa hech narsani o'zgartirish shart emas.
 *
 * Desktop'ga ta'sir qilmaydi: u doim yorug'.
 */
export const MOBILE_DARK_THEME = false;
