/**
 * Console API mijozi.
 *
 * Barcha so'rovlar SAME-ORIGIN (`next.config.ts` `/api/*` ni backend'ga
 * proksilaydi), shuning uchun sessiya `credentials: "include"` bilan
 * avtomatik boradi. CSRF tokeni bazada emas — `/me` javobida keladi va
 * shu modulda xotirada saqlanadi (sahifa yangilanganda qayta so'raladi).
 */

export type PlanID = "free" | "paid" | "ecosystem";

export interface Plan {
  id: PlanID;
  rps: number;
  burst: number;
  monthly_cap: number | null;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  suspended: boolean;
  subscription: boolean;
  ecosystem: boolean;
  overdue: boolean;
  created_at: string;
}

export interface Me {
  account: Account;
  plan: Plan;
  csrf: string;
}

export interface ApiKey {
  id: string;
  name: string;
  kind: "server" | "browser";
  prefix: string;
  apis: string[];
  origins: string[];
  ips: string[];
  status: "active" | "revoked";
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  period_start: string;
  period_end: string;
  amount_uzs: number;
  status: "open" | "paid" | "void";
  issued_at: string;
  due_at: string;
  paid_at: string | null;
}

export interface UsageDaily {
  day: string;
  requests: number;
  errors: number;
}
export interface UsageByAPI {
  api: string;
  requests: number;
  errors: number;
}
export interface UsageByKey {
  key_id: string;
  name: string;
  prefix: string;
  status: string;
  requests: number;
  errors: number;
}
export interface UsageResponse {
  range: { from: string; to: string };
  month: { start: string; requests: number; errors: number; cap: number | null; plan: PlanID };
  daily: UsageDaily[];
  by_api: UsageByAPI[];
  by_key: UsageByKey[];
}

export interface BillingResponse {
  plan: PlanID;
  subscription: boolean;
  ecosystem: boolean;
  overdue: boolean;
  price_uzs: number;
  subscription_request_open: boolean;
  instructions: string;
  invoices: Invoice[];
}

/** ApiError — backend `{error:{code,message}}` shaklini o'raydi. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let csrfToken = "";
export function setCsrf(token: string) {
  csrfToken = token;
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const method = init?.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRF-Token", csrfToken);
  }
  const res = await fetch(path, { ...init, method, headers, body, credentials: "include" });
  if (res.status === 204) return undefined as T;
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // bo'sh javob
  }
  if (!res.ok) {
    const p = payload as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(res.status, p?.error?.code ?? "unknown", p?.error?.message ?? res.statusText);
  }
  return payload as T;
}

export const api = {
  requestCode: (email: string) =>
    request<{ status: string; expires_in: number }>("/api/auth/request-code", {
      method: "POST",
      json: { email },
    }),
  verify: (email: string, code: string) => request<Me>("/api/auth/verify", { method: "POST", json: { email, code } }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<Me>("/api/me"),
  updateMe: (name: string) => request<Me>("/api/me", { method: "PATCH", json: { name } }),

  listKeys: () => request<{ keys: ApiKey[]; max_active: number; apis: string[] }>("/api/keys"),
  createKey: (spec: { name: string; kind: string; apis: string[]; origins?: string[]; ips?: string[] }) =>
    request<{ key: ApiKey; secret: string }>("/api/keys", { method: "POST", json: spec }),
  updateKey: (id: string, spec: { name: string; apis: string[]; origins?: string[]; ips?: string[] }) =>
    request<{ key: ApiKey }>(`/api/keys/${id}`, { method: "PATCH", json: spec }),
  rotateKey: (id: string) =>
    request<{ key: ApiKey; secret: string; old_key_expires_at: string }>(`/api/keys/${id}/rotate`, { method: "POST" }),
  revokeKey: (id: string) => request<void>(`/api/keys/${id}`, { method: "DELETE" }),

  usage: (days: number) => request<UsageResponse>(`/api/usage?days=${days}`),
  billing: () => request<BillingResponse>("/api/billing"),
  subscribeRequest: (note: string) =>
    request<{ status: string }>("/api/billing/subscribe-request", { method: "POST", json: { note } }),
};
