/**
 * Xarita holati ↔ URL (`?ll=uzunlik,kenglik&z=zoom`).
 *
 * Qiymatlar URL'dan keladi, ya'ni ISTALGAN odam yozishi mumkin. Shu sabab
 * har biri son sifatida tekshiriladi va chegaralanadi; yaroqsiz qiymat
 * JIMGINA tashlanadi va shahar markaziga tushiladi — sahifa hech qachon
 * noto'g'ri havola tufayli buzilmasligi kerak.
 */

import { cityPath, type City } from "./cities";
import { UZ_BOUNDS } from "./config";

/** Xarita ochiladigan boshlang'ich holat — serverdan mijozga beriladi. */
export interface MapInit {
  cityId: number;
  slug: string;
  name: string;
  /** Xaritaning BOSHLANG'ICH markazi (`?ll=` bo'lsa — o'sha). */
  center: [number, number];
  zoom: number;
  /**
   * Sun'iy yo'ldosh rejimi URL'dan:
   *   `true`  — `/sputnik/` havolasi;
   *   `false` — oddiy havola (foydalanuvchining eski tanlovi UNI bosmaydi);
   *   `null`  — URL hal qilmaydi (bosh sahifa) — saqlangan tanlov ishlatiladi.
   */
  satellite: boolean | null;
}

export const MIN_ZOOM = 5.5;
export const MAX_ZOOM = 22;

type Query = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Serverda: shahar + URL holatidan mijozga beriladigan boshlang'ich holat. */
export function makeInit(
  city: City,
  satellite: boolean | null,
  query: Query,
): MapInit {
  const view = parseView(query, city);
  return {
    cityId: city.id,
    slug: city.slug,
    name: city.name,
    center: view.center,
    zoom: view.zoom,
    satellite,
  };
}

/**
 * `ll` va `z` ni o'qiydi. Yaroqsiz bo'lsa — shahar markazi/zoomi.
 *
 * `ll` tartibi: UZUNLIK, KENGLIK (`69.33,41.22`) — Yandex bilan bir xil,
 * ya'ni `[lng, lat]`. Kenglik birinchi yozilsa nuqta okeanga tushardi.
 */
export function parseView(
  query: Query,
  city: City,
): { center: [number, number]; zoom: number } {
  let center = city.center;

  const ll = first(query.ll)?.split(",");
  if (ll?.length === 2 && ll[0].trim() !== "" && ll[1].trim() !== "") {
    const lng = Number(ll[0]);
    const lat = Number(ll[1]);
    const [[minLng, minLat], [maxLng, maxLat]] = UZ_BOUNDS;
    if (
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      lng >= minLng && lng <= maxLng &&
      lat >= minLat && lat <= maxLat
    ) {
      center = [lng, lat];
    }
  }

  let zoom = city.zoom;
  const rawZ = first(query.z);
  if (rawZ !== undefined && rawZ.trim() !== "") {
    const z = Number(rawZ);
    if (Number.isFinite(z)) zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  return { center, zoom };
}

/**
 * `?ll=…&z=…` qatori. Vergul `%2C` bo'lib yoziladi (`URLSearchParams`),
 * ya'ni `ll=69.338672%2C41.229654&z=11`.
 */
export function viewQuery(lng: number, lat: number, zoom: number): string {
  const q = new URLSearchParams();
  q.set("ll", `${lng.toFixed(6)},${lat.toFixed(6)}`);
  // 2 kasr yetarli (~1% masshtab); ortiqcha nol qoldirilmaydi: `z=11`, `z=15.4`.
  q.set("z", String(Number(zoom.toFixed(2))));
  return q.toString();
}

/** Yo'naltirishda saqlanadigan qidiruv parametrlari (faqat `ll` va `z`). */
export function preservedQuery(query: Query): string {
  const q = new URLSearchParams();
  const ll = first(query.ll);
  const z = first(query.z);
  if (ll !== undefined) q.set("ll", ll);
  if (z !== undefined) q.set("z", z);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function pathWithView(
  city: Pick<City, "id" | "slug">,
  sputnik: boolean,
  lng: number,
  lat: number,
  zoom: number,
): string {
  return `${cityPath(city, sputnik)}?${viewQuery(lng, lat, zoom)}`;
}
