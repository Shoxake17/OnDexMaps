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

/**
 * ONDEXMAP_API_URL — ommaviy xarita API'si (`cmd/api`). OpenAPI kontrakti
 * SHU YERDAN olinadi va konsolning O'Z domenida (`/openapi.yaml`) beriladi.
 *
 * Nega proksi: kontraktni to'g'ridan-to'g'ri `maps.ondex.uz` dan yuklash
 * konsolning qat'iy CSP'siga (`connect-src 'self'`) urilib qolardi va
 * yana bitta domen ruxsati talab qilinardi. Proksi bilan brauzer uchun
 * hammasi bitta origin bo'lib qoladi.
 */
const ONDEXMAP_API_URL = (process.env.ONDEXMAP_API_URL ?? "https://maps.ondex.uz").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${CONSOLE_API_INTERNAL_URL}/api/:path*` },
      { source: "/healthz", destination: `${CONSOLE_API_INTERNAL_URL}/healthz` },
      // OpenAPI kontrakti — `cmd/api` dan, lekin konsol domenida ko'rinadi.
      { source: "/openapi.yaml", destination: `${ONDEXMAP_API_URL}/v2/openapi.yaml` },
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
