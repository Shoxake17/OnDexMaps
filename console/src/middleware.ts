import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP — har so'rovga yangi `nonce` bilan (sabab: `web/src/middleware.ts`).
 * `/api/*` Next rewrite orqali SAME-ORIGIN bo'lgani uchun `connect-src 'self'`
 * yetarli — boshqa domen qo'shilmaydi.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // ⚠️ FAQAT DEV: Next.js Fast Refresh/debug uchun `eval()` ishlatadi
  // (React "eval() is not supported" xatosi — production'da BU YO'Q,
  // React o'zi ham aytadi). Production build'da bu qator YO'Q bo'ladi —
  // xavfsizlik faqat dev serverida yumshatiladi, jonli saytda emas.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
