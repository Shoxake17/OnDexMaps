/**
 * OnDexMap API xatosi.
 *
 * Server xatoni HAR DOIM bir xil shaklda qaytaradi
 * (`{ status, error: { code, message } }`), shuning uchun SDK uni
 * bitta tipga yig'adi: `catch` blokida `e.code` bo'yicha qaror qabul
 * qilish mumkin.
 */
export class OnDexMapError extends Error {
  /** HTTP holati. */
  readonly status: number;
  /** Mashina uchun kod: `invalid_key`, `rate_limited`, `quota_exceeded`… */
  readonly code: string;
  /** `429` bo'lganda — necha soniyadan keyin qayta urinish mumkin. */
  readonly retryAfter?: number;

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = "OnDexMapError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }

  /** Vaqtinchalik xato — qayta urinish MA'NOLI. */
  get retryable(): boolean {
    return this.status === 503 || this.code === "rate_limited";
  }
}

/** Kvota tugagan (oylik chegara). Qayta urinish YORDAM BERMAYDI. */
export const isQuotaExceeded = (e: unknown): e is OnDexMapError =>
  e instanceof OnDexMapError && e.code === "quota_exceeded";

/** Kalit muammosi: yo'q, noto'g'ri, cheklangan yoki API yoqilmagan. */
export const isKeyProblem = (e: unknown): e is OnDexMapError =>
  e instanceof OnDexMapError &&
  ["missing_key", "invalid_key", "key_restricted", "api_not_allowed"].includes(e.code);
