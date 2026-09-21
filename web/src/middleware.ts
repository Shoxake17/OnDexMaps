import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP — har so'rovga yangi `nonce` bilan.
 *
 * ┌─ NEGA NONCE, `'unsafe-inline'` EMAS ───────────────────────────────┐
 * Next.js sahifaga O'ZINING inline skriptlarini qo'yadi (hydration va
 * oqim ma'lumoti). Qat'iy `script-src 'self'` ularni bloklaydi —
 * natijada hydration yiqiladi (React #412) va sahifa "yuklanmoqda"
 * holatida qotib qoladi. AYNAN SHU nosozlik ko'rilgan.
 *
 * Eng oson "yechim" — `'unsafe-inline'` qo'shish, lekin u XSS
 * himoyasini deyarli butunlay bekor qiladi: hujumchi kiritgan skript
 * ham inline bo'ladi va bemalol ishlaydi.
 *
 * To'g'ri yo'l — nonce: har so'rovda tasodifiy qiymat beriladi,
 * Next.js uni o'z skriptlariga qo'yadi, hujumchi esa uni oldindan
 * bila olmaydi.
 * └──────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ CSP FAQAT shu yerda beriladi. `next.config.ts` da ham berilsa,
 * brauzer IKKALASINI ham qo'llaydi (kesishma sifatida) va qat'iyroq
 * bo'lgani baribir bloklab qo'yardi.
 */

/** Xarita ma'lumoti va API manbalari. */
const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090"
).replace(/\/$/, "");
const TILE_ORIGIN = "https://tiles.ondex.uz";

/**
 * Qo'shimcha ruxsat etilgan manbalar (vergul bilan), masalan sun'iy
 * yo'ldosh provayderi.
 *
 * ⚠️ NEGA ALOHIDA SOZLAMA: CSP'ni BRAUZER tekshiradi va u sahifa bilan
 * birga yuboriladi — ya'ni Go tomonidagi `SATELLITE_URL` ni bu yerda
 * o'z-o'zidan bilib bo'lmaydi. Provayder almashtirilsa, IKKI joy
 * yangilanishi kerak: Go `.env` dagi `SATELLITE_URL` va shu yerdagi
 * origin. Aks holda tile'lar jimgina bloklanadi va xarita "ishlamayapti"
 * bo'lib ko'rinadi — AYNAN shu nosozlik ro'y bergan.
 *
 * Bu qiymat ish vaqtida o'qiladi (`NEXT_PUBLIC_` emas), shuning uchun
 * o'zgartirish uchun qayta qurish SHART EMAS — serverni qayta yoqish
 * kifoya.
 */
const EXTRA_CONNECT = (process.env.CSP_CONNECT_EXTRA ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    // `'strict-dynamic'` — nonce bilan ishga tushgan skript o'zi
    // yuklagan bo'laklar ham ruxsat oladi. Usiz Next.js o'zining
    // `/_next/static/...` chunk'larini yuklay olmasdi.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // MapLibre va Next.js elementlarga inline uslub qo'yadi —
    // usiz interfeys buziladi. Uslub skriptdan farqli: u kod
    // bajarmaydi, shuning uchun xavfi tubdan past.
    "style-src 'self' 'unsafe-inline'",
    [
      "connect-src 'self'",
      API_ORIGIN,
      TILE_ORIGIN,
      "https://api.open-meteo.com",
      ...EXTRA_CONNECT,
    ].join(" "),
    // ⚠️ Rastr (sun'iy yo'ldosh) tile'lari uchun `img-src` ham kerak,
    // `connect-src` yetarli EMAS. Xarita kutubxonasi ayrim yo'llarda
    // tasvirni `<img>` orqali dekodlaydi va u boshqa direktivaga
    // bo'ysunadi — natijada konsolda "The source image could not be
    // decoded" chiqib, tile chizilmay qolardi.
    //
    // ⚠️ `API_ORIGIN` SHU YERDA HAM: tile'lar endi provayderdan emas,
    // o'z proksimizdan (`/tiles/satellite/...`) keladi — lekin dev'da
    // API 8090 da, sahifa 3100 da, ya'ni ular brauzer uchun BOSHQA
    // origin va `'self'` ularni QAMRAMAYDI.
    ["img-src 'self' data: blob:", API_ORIGIN, ...EXTRA_CONNECT].join(" "),
    "worker-src 'self' blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  // Next.js nonce'ni SO'ROV sarlavhasidan o'qiydi va o'z skriptlariga
  // qo'yadi — shuning uchun u ikkala tomonga ham yoziladi.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Statik fayllarga CSP kerak emas — ular HTML emas va middleware
    // ularga bekorga ishlamasligi kerak.
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
