"use client";

/**
 * OnDexMap logotipi (to'q sariq «joy belgisi») — xaritada DRAG QILINMAYDIGAN
 * yoki suriladigan belgi sifatida. Ikki joyda ishlatiladi: qidiruv natijasi
 * (`SearchBar.tsx`, sof) va «ob'ekt qo'shish» sudraladigan belgisi
 * (`useAddMarker.ts`, `draggable: true`) — ikkalasi ham BIR XIL rasm va
 * o'lchamdan, shuning uchun bu yerda bitta joyda.
 *
 * Rasm `scripts/make-icons.mjs` yasaydi. Uning o'tkir uchi tuvalning pastki
 * chetiga yaqin, shuning uchun belgi har doim `anchor: "bottom"` bilan
 * qo'yiladi — aynan tanlangan nuqtaga «sanchiladi».
 */
export const LOGO_PIN_SRC = "/ondexmap-pin.png";

/** Faqat DOM API (matn/HTML qatori yo'q) — MapLibre marker elementi. */
export function logoPinElement(size: number, cursor: "default" | "grab" = "default"): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText =
    `width:${size}px;height:${size}px;cursor:${cursor};` +
    "filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))";
  el.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.src = LOGO_PIN_SRC;
  img.alt = "";
  img.width = size;
  img.height = size;
  img.draggable = false; // brauzerning rasm sudrashi belgini sudrashga xalaqit bermasin
  img.style.cssText = "display:block;pointer-events:none;user-select:none";
  el.append(img);
  return el;
}
