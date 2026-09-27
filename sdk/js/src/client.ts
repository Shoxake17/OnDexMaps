import type { components, operations } from "./generated/openapi.js";
import { OnDexMapError } from "./errors.js";
import { bboxParam, clampBBox, type BoundsLike } from "./bbox.js";
import {
  DEFAULT_API_BASE,
  GEOCODE_MAX_LIMIT,
  REVERSE_AREA,
  type PlanName,
} from "./limits.js";

/* ── Kontraktdan kelgan tiplar ─────────────────────────────────────── */
/* Bular QO'LDA yozilmaydi: `npm run generate` ularni `openapi.yaml`
   dan chiqaradi, `generate:check` esa eskirganini CI'da ushlaydi. */

export type GeocodeResponse = operations["geocode"]["responses"][200]["content"]["application/json"];
export type GeocodeMatch = components["schemas"]["Match"];
export type ReverseResponse = operations["reverseGeocode"]["responses"][200]["content"]["application/json"];
export type DirectionsResponse = operations["directions"]["responses"][200]["content"]["application/json"];
export type PlacesResponse = operations["listPlaces"]["responses"][200]["content"]["application/json"];
export type PlaceDetail = components["schemas"]["PlaceDetail"];

export interface ClientOptions {
  /** API kalit. Brauzerda `omk_b_…`, serverda `omk_s_…`. */
  key: string;
  /** Standart: `https://maps.ondex.uz/v2`. */
  baseUrl?: string;
  /**
   * Tarif — `/v2/places` to'rtburchak chegarasini belgilaydi.
   * Standart `free` (eng tor): noto'g'ri taxmin qilgandan ko'ra
   * ortiqcha so'rov yubormagan yaxshi.
   */
  plan?: PlanName;
  /**
   * `429` va `503` da avtomatik qayta urinishlar soni.
   * `Retry-After` sarlavhasi hurmat qilinadi. `0` — o'chiq.
   */
  retries?: number;
  /** Sinov uchun almashtiriladi. */
  fetch?: typeof globalThis.fetch;
}

/** Oxirgi javobdagi kvota holati — foydalanishni kuzatish uchun. */
export interface QuotaInfo {
  plan?: string;
  limit?: number;
  used?: number;
}

export class OnDexMapClient {
  readonly #key: string;
  readonly #base: string;
  readonly #plan: PlanName;
  readonly #retries: number;
  readonly #fetch: typeof globalThis.fetch;

  /** Oxirgi so'rovdagi kvota sarlavhalari. */
  quota: QuotaInfo = {};

  constructor(opts: ClientOptions) {
    if (!opts.key) throw new Error("OnDexMap: `key` berilmagan");
    this.#key = opts.key;
    this.#base = (opts.baseUrl ?? DEFAULT_API_BASE).replace(/\/+$/, "");
    this.#plan = opts.plan ?? "free";
    this.#retries = opts.retries ?? 2;
    this.#fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /* ── ichki ─────────────────────────────────────────────────────── */

  async #get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(this.#base + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    // ⚠️ Kalit SARLAVHADA yuboriladi, so'rov qatorida EMAS: manzil
    // brauzer tarixiga, proksi va server jurnallariga tushadi.
    const headers = { "X-API-Key": this.#key };

    for (let urinish = 0; ; urinish++) {
      const res = await this.#fetch(url, { headers });

      this.quota = {
        plan: res.headers.get("X-Plan") ?? undefined,
        limit: sonYoki(res.headers.get("X-Quota-Limit")),
        used: sonYoki(res.headers.get("X-Quota-Used")),
      };

      if (res.ok) return (await res.json()) as T;

      const body = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      const retryAfter = sonYoki(res.headers.get("Retry-After"));
      const err = new OnDexMapError(
        res.status,
        body.error?.code ?? String(res.status),
        body.error?.message ?? res.statusText,
        retryAfter,
      );

      if (!err.retryable || urinish >= this.#retries) throw err;

      // `Retry-After` bo'lsa unga bo'ysunamiz, bo'lmasa eksponensial.
      const kutish = retryAfter != null ? retryAfter * 1000 : 2 ** urinish * 500;
      await new Promise((r) => setTimeout(r, kutish));
    }
  }

  /* ── ommaviy metodlar ──────────────────────────────────────────── */

  /**
   * Nom bo'yicha qidirish. Qamrov — butun O'zbekiston.
   *
   * `limit` server chegarasiga (25) qirqiladi: kattaroq son so'ralsa
   * server `400` qaytarardi.
   */
  async geocode(q: string, opts: { limit?: number; near?: [number, number] } = {}) {
    const params: Record<string, string> = { q };
    if (opts.limit != null) {
      params.limit = String(Math.min(Math.max(1, Math.trunc(opts.limit)), GEOCODE_MAX_LIMIT));
    }
    if (opts.near) {
      params.lng = String(opts.near[0]);
      params.lat = String(opts.near[1]);
    }
    return this.#get<GeocodeResponse>("/geocode", params);
  }

  /**
   * Koordinatadan manzil.
   *
   * ⚠️ Bu endpoint butun mamlakatni QAMRAMAYDI — faqat
   * {@link REVERSE_AREA} ichida ishlaydi. Tashqarisi uchun `null`
   * qaytariladi va so'rov yuborilmaydi (server baribir `400` berardi).
   */
  async reverse(lat: number, lng: number): Promise<ReverseResponse | null> {
    if (
      lng < REVERSE_AREA.minLng || lng > REVERSE_AREA.maxLng ||
      lat < REVERSE_AREA.minLat || lat > REVERSE_AREA.maxLat
    ) {
      return null;
    }
    return this.#get<ReverseResponse>("/reverse", { lat: String(lat), lng: String(lng) });
  }

  /** A nuqtadan B nuqtaga marshrut. */
  async directions(from: [number, number], to: [number, number]) {
    return this.#get<DirectionsResponse>("/directions", {
      origin: `${from[1]},${from[0]}`,
      destination: `${to[1]},${to[0]}`,
    });
  }

  /**
   * Ko'rinayotgan hududdagi ob'ektlar.
   *
   * To'rtburchak avtomatik qirqiladi; juda keng bo'lsa `null`
   * qaytariladi va so'rov YUBORILMAYDI (kvota tejaladi).
   */
  async places(bounds: BoundsLike): Promise<PlacesResponse | null> {
    const b = clampBBox(bounds, this.#plan);
    if (!b) return null;
    return this.#get<PlacesResponse>("/places", { bbox: bboxParam(b) });
  }

  /**
   * Bitta ob'ekt tafsiloti.
   *
   * ⚠️ `geocode` natijasining `id` si `p` bilan boshlanadi
   * (`type === "place"`), bu endpoint esa TOZA UUID kutadi. SDK
   * prefiksni o'zi olib tashlaydi — bu hujjatda ham eng ko'p
   * adashtirgan joy edi.
   */
  async place(id: string) {
    const toza = id.startsWith("p") && id.length === 37 ? id.slice(1) : id;
    return this.#get<{ status: string; result?: PlaceDetail }>(
      `/places/${encodeURIComponent(toza)}`,
      {},
    );
  }
}

const sonYoki = (v: string | null): number | undefined => {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Klient yaratish. */
export const createClient = (opts: ClientOptions) => new OnDexMapClient(opts);
