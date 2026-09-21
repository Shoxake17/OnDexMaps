/**
 * Xarita ustidagi boshqaruvlarning umumiy ko'rinishi (Yandex `LeftSide.png`).
 *
 * Bitta joyda saqlanadi: tugmalar ikki komponentda (yuqori-o'ng
 * vositalar va o'ng-o'rta zoom/geolokatsiya) chiziladi va ular bir xil
 * ko'rinishi SHART. Ikki joyda yozilsa, biri o'zgarganda ikkinchisi
 * ortda qolardi.
 *
 * Xususiyatlar: oq yumaloq kapsula, CHEGARA YO'Q, faqat yumshoq soya;
 * ichidagi tugmalar kvadrat emas, yumaloq burchakli.
 *
 * ⚠️ Konstantalar bir-biriga QARAMA-QARSHI klass (`text-*`, `bg-*`)
 * bermaydi: Tailwind ikki xil `text-*` ni qaysi biri g'olib bo'lishini
 * kafolatlamaydi. Shu sabab "yoniq/o'chiq" ranglari alohida juftlik
 * (`ON`/`OFF`) va chaqiruvchi ULARNING BITTASINI tanlaydi.
 */

/** Oq kapsula (bir nechta tugma uchun). */
export const PILL =
  "flex items-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.16)]";

/** Kapsula ichidagi tugma: faqat shakl, rangsiz. */
export const BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition";

/** Kattaroq tugma (zoom, kompas, geolokatsiya). */
export const BTN_LG =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition";

/** Alohida turadigan kvadrat tugma — kapsulasiz, o'z fonida. */
export const SQUARE =
  "shadow-[0_2px_10px_rgba(0,0,0,0.16)]";

/** Tugma rangi: o'chiq. */
export const OFF = "text-zinc-800 hover:bg-zinc-100 active:bg-zinc-200";

/** Tugma rangi: yoniq — Yandex'dagi kabi ko'k. */
export const ON = "bg-blue-50 text-[#2f6bff] hover:bg-blue-100";

/** Alohida turadigan tugma fonlari (kapsulasiz). */
export const SQUARE_OFF = "bg-white text-zinc-800 hover:bg-zinc-100 active:bg-zinc-200";
export const SQUARE_ON = "bg-blue-50 text-[#2f6bff] hover:bg-blue-100";

/** Marshrut paneli va yoqilgan tugmalarning asosiy rangi. */
export const BLUE = "#2f6bff";
