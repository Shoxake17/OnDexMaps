/**
 * OnDexMap API mijozi.
 *
 * Har bir endpoint uchun ANIQ tip: javob shakli o'zgarsa TypeScript
 * buni build paytida aytadi, foydalanuvchi oq ekran ko'rgandan keyin
 * emas.
 *
 * Bu qatlam ATAYLAB yupqa — mantiq yo'q, faqat so'rov va tiplar.
 * Xarita mantig'i komponentlarda, biznes qoidalari esa Go tomonida
 * qoladi (yagona haqiqat manbai).
 */
import { API_BASE } from "./config";

/** Aholi punkti turi — bazadagi CHECK bilan bir xil. */
export type SettlementKind = "mahalla" | "qishloq" | "daha";

export interface MahallaProperties {
  id: string;
  name: string;
  kind: SettlementKind;
  /** Yorliq (nom) qo'yiladigan nuqta — PostGIS hisoblagan markaz. */
  center: GeoJSON.Point;
}

export type MahallaCollection = GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon | GeoJSON.Polygon,
  MahallaProperties
>;

export interface ResolveResult {
  text: string;
  street_distance_m?: number;
}

export interface RouteResult {
  distance_m: number;
  duration_s: number;
  geometry: GeoJSON.LineString;
}

/**
 * Serverdan keladigan ochiq sozlamalar.
 *
 * ⚠️ Bu yerda SIR BO'LMAYDI. Manzillar brauzerga beriladi va ular
 * shunchaki "qayerdan o'qish kerak" degan ko'rsatkich. Kalitlar
 * (admin kaliti, baza paroli) API'ning ichida qoladi va bu endpoint
 * orqali hech qachon chiqmaydi.
 */
export interface PublicConfig {
  places_url?: string;
  weather_url?: string;
  /** Sun'iy yo'ldosh raster tile shabloni. Yo'q bo'lsa — tugma chiqmaydi. */
  satellite_url?: string;
  /** Sun'iy yo'ldosh manbasining krediti (litsenziya talabi). */
  satellite_attribution?: string;
  /** Provayderda haqiqiy tasvir bor eng katta zoom (satr, masalan "18"). */
  satellite_maxzoom?: string;
  /** Xizmat hududi: `minLng,minLat,maxLng,maxLat`. */
  service_bounds?: string;
}

/** ChustApp katalogidagi joy (restoran, kafe). */
export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags?: string;
  open?: boolean;
  logo_url?: string;
  cover_url?: string;
}

/** Joriy ob-havo (Open-Meteo `current` bo'limidan). */
export interface Weather {
  tempC: number;
  /** WMO kodi — belgini tanlash uchun. 0 = ochiq osmon. */
  code: number;
}

/**
 * Qidiruv natijasi.
 *
 * `type` — obyekt turi. Jamoa jadvalidan: mahalla | qishloq | daha | street.
 * OSM indeksidan: region | district | city | town | village | hamlet | suburb |
 * locality | street | water | poi | building | address.
 */
export interface SearchMatch {
  id: string;
  type: string;
  name: string;
  kind?: string;
  /** O'zbekcha tur: «Ko'cha», «Maktab», «Shahar». */
  label?: string;
  /** Eng yaqin aholi punkti: «Ko'cha · Serob». */
  near?: string;
  /** Natijaga uchish uchun. Koordinatasiz ko'cha yozuvida yo'q. */
  lat?: number;
  lng?: number;
  /** [g'arb, janub, sharq, shimol] — ko'cha, bino, maydon. */
  bbox?: [number, number, number, number];
  score: number;
  matched_via?: string;
}

/**
 * Umumiy so'rov.
 *
 * Xato javob (4xx/5xx) ISTISNO tashlaydi: chaqiruvchi uni ushlab,
 * foydalanuvchiga tushunarli xabar ko'rsatadi. Jimgina `null`
 * qaytarilsa, nosozlik sababi yo'qolib ketardi.
 */
export async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      // Javob JSON emas — status matni yetarli.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  /** Mahalla/qishloq chegaralari (GeoJSON). */
  mahallas: (signal?: AbortSignal) =>
    get<MahallaCollection>("/v1/mahallas", { signal }),

  /** Ochiq sozlamalar (joylar va ob-havo manbalari). */
  config: (signal?: AbortSignal) => get<PublicConfig>("/v1/config", { signal }),

  /** Koordinata → manzil (bizning bazamiz bo'yicha). */
  resolve: (lat: number, lng: number, signal?: AbortSignal) =>
    get<ResolveResult>(
      `/v1/resolve?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`,
      { signal },
    ),

  /**
   * Nom bo'yicha qidiruv: shahar, qishloq, mahalla, ko'cha, joy, bino, manzil.
   *
   * `bias` — xarita markazi: teng natijalardan yaqini oldinda chiqadi.
   */
  search: (
    q: string,
    signal?: AbortSignal,
    bias?: { lat: number; lng: number },
  ) =>
    get<{ results: SearchMatch[] }>(
      `/v1/search?q=${encodeURIComponent(q)}&limit=8` +
        (bias
          ? `&lat=${bias.lat.toFixed(5)}&lng=${bias.lng.toFixed(5)}`
          : ""),
      { signal },
    ),

  /**
   * Joylar ro'yxati (restoran, kafe) — ChustApp katalogidan.
   *
   * ⚠️ Manzil SOZLAMADAN keladi, shuning uchun sxemasi tekshiriladi:
   * faqat http/https. Tekshirilmasa `javascript:` kabi qiymat
   * sozlamaga tushib qolsa, u brauzerda bajarilishi mumkin edi.
   * Bu — kam ehtimolli, lekin arzon himoya.
   */
  places: async (url: string, signal?: AbortSignal): Promise<Place[]> => {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("joylar manbasi noto'g'ri");
    }
    const res = await fetch(parsed.toString(), { signal });
    if (!res.ok) throw new Error(`joylar olinmadi (${res.status})`);
    const body: unknown = await res.json();
    if (!Array.isArray(body)) return [];
    // Koordinatasi yo'q joy xaritada ko'rsatilmaydi.
    return (body as Place[]).filter(
      (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
  },

  /**
   * Joriy ob-havo — sidebar sarlavhasidagi harorat.
   *
   * Manba sozlamadan keladi (Open-Meteo, kalitsiz) va so'rovni
   * BRAUZER yuboradi, server emas: aks holda har bir sahifa ochilishi
   * bizning serverimizdan tashqi chaqiruvga aylanardi.
   *
   * ⚠️ `places` bilan bir xil qoida: sxema tekshiriladi.
   */
  weather: async (url: string, signal?: AbortSignal): Promise<Weather> => {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("ob-havo manbasi noto'g'ri");
    }
    const res = await fetch(parsed.toString(), { signal });
    if (!res.ok) throw new Error(`ob-havo olinmadi (${res.status})`);
    const body = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const t = body.current?.temperature_2m;
    if (typeof t !== "number" || !Number.isFinite(t)) {
      throw new Error("ob-havo javobi kutilgan shaklda emas");
    }
    return { tempC: t, code: body.current?.weather_code ?? 0 };
  },

  /**
   * A → B marshrut (haqiqiy yo'l bo'ylab, OSRM).
   *
   * Marshrut xizmati o'chiq bo'lsa API 503 qaytaradi va bu yerda
   * istisno bo'ladi — chaqiruvchi to'g'ri chiziqqa qaytishi va buni
   * foydalanuvchiga OCHIQ aytishi kerak. Soxta marshrut chizilmaydi.
   */
  route: (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    signal?: AbortSignal,
  ) =>
    get<RouteResult>(
      `/v1/route?from_lat=${from.lat.toFixed(6)}&from_lng=${from.lng.toFixed(6)}` +
        `&to_lat=${to.lat.toFixed(6)}&to_lng=${to.lng.toFixed(6)}`,
      { signal },
    ),
};
