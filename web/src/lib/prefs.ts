/**
 * Foydalanuvchining ko'rinish sozlamalari (faqat shu brauzerda).
 *
 * ⚠️ Har o'qish/yozish `try` ichida: maxfiy oynada yoki sayt
 * ma'lumotlari bloklangan holatda `localStorage` ISTISNO tashlaydi.
 * Sozlama yo'qolishi mumkin — bu qabul qilinadi, lekin xarita
 * shu sababli ochilmay qolishi MUMKIN EMAS.
 */

const KEY_3D = "ondexmap:3d";
const KEY_SATELLITE = "ondexmap:satellite";

/** Boshlang'ich ko'rinish — 3D. Saqlangan tanlov ustun turadi. */
export function prefers3D(): boolean {
  try {
    const v = localStorage.getItem(KEY_3D);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    // Kesh yo'q — standart qiymat ishlatiladi.
  }
  return true;
}

export function save3D(on: boolean): void {
  try {
    localStorage.setItem(KEY_3D, on ? "1" : "0");
  } catch {
    // Saqlanmadi — joriy seansda baribir ishlaydi.
  }
}

/**
 * Sun'iy yo'ldosh rejimi oxirgi safar yoqilganmi.
 *
 * Standart — o'chiq: foydalanuvchi uni HECH QACHON yoqmagan bo'lsa,
 * oddiy xarita ochiladi.
 */
export function prefersSatellite(): boolean {
  try {
    return localStorage.getItem(KEY_SATELLITE) === "1";
  } catch {
    return false;
  }
}

export function saveSatellite(on: boolean): void {
  try {
    localStorage.setItem(KEY_SATELLITE, on ? "1" : "0");
  } catch {
    // Saqlanmadi — joriy seansda baribir ishlaydi.
  }
}
