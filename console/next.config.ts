import type { NextConfig } from "next";

/**
 * console.ondex.uz — Next.js FAQAT sahifa beradi va `/api/*` ni backend'ga
 * (`cmd/console`, :8093) ULAYDI (`rewrites`). Shu tufayli brauzer uchun
 * bittagina origin bor: sessiya cookie'si (`__Host-...`), CSRF va CORS
 * hech qachon ikki domen orasida bo'linmaydi.
 *
 * ⚠️ CSP `src/middleware.ts` da (nonce har so'rovda yangi — `web/`dagi bilan
 * bir xil sabab: Next.js o'z inline skriptlari uchun nonce talab qiladi).
 */
const CONSOLE_API_INTERNAL_URL = (
  process.env.CONSOLE_API_INTERNAL_URL ?? "http://localhost:8093"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${CONSOLE_API_INTERNAL_URL}/api/:path*` },
      { source: "/healthz", destination: `${CONSOLE_API_INTERNAL_URL}/healthz` },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
