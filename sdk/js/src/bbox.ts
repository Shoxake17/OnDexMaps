import { BBOX_SPAN, SERVICE_AREA, type PlanName } from "./limits.js";

/** Xarita kutubxonasining `getBounds()` natijasiga mos minimal shakl. */
export interface BoundsLike {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const qirq = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Ko'rinishni `/v2/places` qabul qiladigan to'rtburchakka aylantiradi.
 *
 * ┌─ NIMA HAL QILINADI ────────────────────────────────────────────────┐
 * Server ikkita shart qo'yadi va ikkalasi ham `400` beradi:
 *
 *   1. to'rtta burchak xizmat hududida bo'lishi;
 *   2. tomon tarif chegarasidan oshmasligi.
 *
 * Birinchisi eng ayyor: Termiz yoki Nukus yonida YAQINLASHTIRILGAN
 * bo'lsangiz ham ko'rinishning bir chekkasi hududdan chiqib ketadi va
 * so'rov yiqiladi. Shuning uchun chekkalar qirqiladi.
 *
 * Tomon chegarasidan oshsa `null` qaytariladi — so'rov YUBORILMAYDI.
 * Bu ataylab: server baribir rad etadi, kvota esa behuda sarflanadi.
 * └────────────────────────────────────────────────────────────────────┘
 *
 * @returns yuborishga tayyor to'rtburchak yoki `null` (so'ramang).
 */
export function clampBBox(bounds: BoundsLike, plan: PlanName = "free"): BBox | null {
  const span = BBOX_SPAN[plan];

  if (bounds.getEast() - bounds.getWest() > span) return null;
  if (bounds.getNorth() - bounds.getSouth() > span) return null;

  const west = qirq(bounds.getWest(), SERVICE_AREA.minLng, SERVICE_AREA.maxLng);
  const east = qirq(bounds.getEast(), SERVICE_AREA.minLng, SERVICE_AREA.maxLng);
  const south = qirq(bounds.getSouth(), SERVICE_AREA.minLat, SERVICE_AREA.maxLat);
  const north = qirq(bounds.getNorth(), SERVICE_AREA.minLat, SERVICE_AREA.maxLat);

  // Qirqilgandan keyin to'rtburchak yo'qolsa — ekran butunlay hudud
  // tashqarisida. Server buni ham rad etadi (`west >= east`).
  if (west >= east || south >= north) return null;

  return { west, south, east, north };
}

/** `bbox` so'rov parametri: `g'arb,janub,sharq,shimol`. */
export const bboxParam = (b: BBox): string =>
  [b.west, b.south, b.east, b.north].map((n) => n.toFixed(6)).join(",");
