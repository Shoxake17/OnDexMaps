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
  | "hours"
  | "street"
  | "house";

export interface KindMeta {
  key: string;
  label: string;
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
  max_photos: number;
  limits: Record<"name" | "description" | "hours" | "street" | "house", number>;
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
  hours?: string;
  street?: string;
  house?: string;
  lat: number;
  lng: number;
  photos: number;
  created_at: string;
}

/** Yuboriladigan ob'ekt. `website` — asalari (odamga ko'rinmaydi, DOIM bo'sh). */
export interface PlaceInput {
  kind: string;
  lat: number;
  lng: number;
  name: string;
  category: string;
  description: string;
  phone: string;
  hours: string;
  street: string;
  house: string;
  website: string;
}

export type PlacesCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  PlaceSummary
>;

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
