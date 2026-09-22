/**
 * Foydalanuvchi qo'shadigan ob'ektlar (tashkilot, manzil, bekat, ...) uchun
 * API mijozi.
 *
 * ┌─ QOIDALAR QAYERDA ─────────────────────────────────────────────────
 * Qaysi tur qaysi maydonni talab qilishi, turkumlar ro'yxati va uzunlik
 * chegaralari SERVERDA (`internal/places`) va bu yerga `/v1/places/meta`
 * orqali keladi. Ikki joyda yozilgan qoida vaqt o'tib bir-biridan farq qilib
 * qoladi: forma "yuborish" desa, server rad etadi. Mijoz tekshiruvi —
 * faqat qulaylik (darrov ko'rsatish), HAQIQIY tekshiruv serverda.
 * └────────────────────────────────────────────────────────────────────
 *
 * ┌─ MODERATSIYA ──────────────────────────────────────────────────────
 * Yuborilgan ob'ekt xaritaga TO'G'RIDAN-TO'G'RI tushmaydi: server uni
 * karantinga yozadi va admin tasdiqlagach hamma uchun ko'rinadi.
 * └────────────────────────────────────────────────────────────────────
 */
import { API_BASE } from "./config";
import { get } from "./api";

export type PlaceField =
  | "name"
  | "category"
  | "description"
  | "phone"
  | "site"
  | "social"
  | "hours"
  | "street"
  | "house";

/**
 * Ob'ekt shakli: "point" — bitta belgi, "line" — xaritada CHIZILADIGAN chiziq
 * (yo'l, piyodalar o'tish joyi, to'siq).
 */
export type PlaceGeometry = "point" | "line";

/** Chiziq turining chegaralari (server qoidasi; har tur o'ziniki). */
export interface LineRule {
  min_m: number;
  max_m: number;
  max_points: number;
}

export interface KindMeta {
  key: string;
  label: string;
  /** Shakl. Chiziq turida foydalanuvchi joyni belgi bilan emas, nuqtalar bilan CHIZADI. */
  geometry: PlaceGeometry;
  /** Chiziq chegaralari — faqat `geometry === "line"` da bor. */
  line?: LineRule;
  /** Shu turda bo'lishi MUMKIN maydonlar. */
  allowed: PlaceField[];
  /** Har doim to'ldirilishi shart. */
  required: PlaceField[];
  /** Ro'yxatdan kamida bittasi to'ldirilishi shart (bo'sh bo'lsa — talab yo'q). */
  any_of: PlaceField[];
}

export interface PlacesMeta {
  /** Server ob'ekt qabul qilyaptimi (yozish yo'li yoqilganmi). */
  enabled: boolean;
  kinds: KindMeta[];
  categories: string[];
  /** Ijtimoiy tarmoq akkaunti faqat shu domenlardan bo'lishi mumkin. */
  social_hosts: string[];
  max_photos: number;
  limits: Record<
    "name" | "description" | "hours" | "street" | "house" | "site" | "social",
    number
  > &
    /** Yo'l chegaralari (eski mijozlar uchun). Har turning o'zi: `kinds[].line`. */
    Record<"line_points" | "line_min_m" | "line_max_m", number>;
}

/** Xaritadagi tasdiqlangan ob'ekt (yengil: faqat belgi uchun). */
export interface PlaceSummary {
  id: string;
  kind: string;
  name: string;
  category: string;
}

export interface PlaceDetail {
  id: string;
  kind: string;
  kind_label: string;
  name?: string;
  category?: string;
  description?: string;
  phone?: string;
  /** Veb-sayt va ijtimoiy tarmoq manzili (server tekshirgan http/https URL). */
  site?: string;
  social?: string;
  hours?: string;
  street?: string;
  house?: string;
  /** Nuqta uchun o'zi; chiziq uchun chiziq USTIDAGI bitta nuqta. */
  lat: number;
  lng: number;
  photos: number;
  /** GeoJSON: Point yoki LineString (yo'l). */
  geometry?: GeoJSON.Point | GeoJSON.LineString;
  /** Chiziq uzunligi (metr); nuqtada yo'q. */
  length_m?: number;
  created_at: string;
}

/** Yuboriladigan ob'ekt. `website` — asalari (odamga ko'rinmaydi, DOIM bo'sh). */
export interface PlaceInput {
  kind: string;
  /** Nuqta turlari uchun. Chiziq turlarida YUBORILMAYDI. */
  lat?: number;
  lng?: number;
  /** Chiziq (yo'l) turlari uchun: har nuqta [uzunlik, kenglik] (GeoJSON tartibi). */
  line?: [number, number][];
  name: string;
  category: string;
  description: string;
  phone: string;
  site: string;
  social: string;
  hours: string;
  street: string;
  house: string;
  website: string;
}

export type PlacesCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point | GeoJSON.LineString,
  PlaceSummary
>;

// Koordinatani 6 xonaga yaxlitlash `lib/geo.ts` da (yagona nusxa).
export { round6 } from "./geo";

/** Ob'ekt rasmining manzili (server tozalagan JPEG). */
export function placePhotoUrl(id: string, n: number): string {
  return `${API_BASE}/v1/places/${encodeURIComponent(id)}/photos/${n}`;
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // JSON emas — status matni yetarli.
  }
  return res.statusText || `xato ${res.status}`;
}

export const placesApi = {
  meta: (signal?: AbortSignal) => get<PlacesMeta>("/v1/places/meta", { signal }),

  /** Ko'rinishdagi tasdiqlangan ob'ektlar. `bbox` = [g'arb, janub, sharq, shimol]. */
  inView: (bbox: [number, number, number, number], signal?: AbortSignal) =>
    get<PlacesCollection>(
      `/v1/places?bbox=${bbox.map((v) => v.toFixed(5)).join(",")}`,
      { signal },
    ),

  detail: (id: string, signal?: AbortSignal) =>
    get<PlaceDetail>(`/v1/places/${encodeURIComponent(id)}`, { signal }),

  /**
   * Ob'ektni KARANTINGA yuboradi (multipart: JSON + rasmlar).
   *
   * `Content-Type` qo'lda qo'yilmaydi: brauzer `boundary` ni o'zi qo'shadi.
   * Xato (4xx/5xx) — server matni bilan istisno: u bizning o'z xabarimiz
   * («telefon raqami noto'g'ri»), foydalanuvchiga ko'rsatish xavfsiz.
   */
  submit: async (
    input: PlaceInput,
    photos: Blob[],
    signal?: AbortSignal,
  ): Promise<void> => {
    const form = new FormData();
    form.append("data", JSON.stringify(input));
    photos.forEach((b, i) => form.append("photos", b, `photo-${i}.jpg`));
    const res = await fetch(`${API_BASE}/v1/places`, {
      method: "POST",
      body: form,
      signal,
    });
    if (!res.ok) throw new Error(await errorText(res));
  },
};
