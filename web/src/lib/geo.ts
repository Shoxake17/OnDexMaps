/**
 * Geometrik yordamchilar.
 *
 * ⚠️ Bu yerdagi masofa — YER SIRTI bo'ylab to'g'ri chiziq (Haversine),
 * YO'L bo'ylab emas. Yo'l masofasi `/v1/route` dan keladi (OSRM).
 * Ikkalasi interfeysda ham ATAYLAB boshqacha ko'rsatiladi: foydalanuvchi
 * taxminni haqiqat deb o'ylamasligi kerak.
 */

export interface LngLat {
  lng: number;
  lat: number;
}

const EARTH_RADIUS_M = 6371000;

/** Ikki nuqta orasidagi masofa, metrda (Haversine). */
export function metersBetween(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Ketma-ket nuqtalar bo'ylab umumiy uzunlik (o'lchash vositasi uchun). */
export function pathLengthMeters(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += metersBetween(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Masofani o'qishga qulay ko'rinishda.
 *
 * 1 km dan kichigi metrda (butun son) — 847.3 m degan aniqlik xaritada
 * ma'nosiz. Kattasi kilometrda, ikki kasr bilan.
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/** Davomiylik: soniyadan "12 daqiqa" / "1 soat 5 daqiqa". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(1, mins)} daqiqa`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} soat ${m} daqiqa` : `${h} soat`;
}
