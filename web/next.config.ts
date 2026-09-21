import type { NextConfig } from "next";

/**
 * Xavfsizlik sarlavhalari.
 *
 * ⚠️ CSP bu yerda EMAS — u `src/middleware.ts` da, chunki har
 * so'rovga yangi `nonce` kerak (Next.js o'zining inline skriptlarini
 * shu nonce bilan belgilaydi). Ikkala joyda ham berilsa, brauzer
 * ikkalasini birdan qo'llaydi va qat'iyrog'i baribir bloklab
 * qo'yadi.
 *
 * Qolgan sarlavhalar so'rovga bog'liq emas, shuning uchun shu yerda.
 */
const nextConfig: NextConfig = {
  // Server versiyasi javob sarlavhasida oshkor qilinmaydi: bu
  // hujumchiga qaysi zaifliklarni sinashni aytib qo'yadi.
  poweredByHeader: false,

  // React qat'iy rejimi — effektlar ikki marta ishlaydi va
  // tozalanmagan obunalar dev'da darhol ko'rinadi.
  reactStrictMode: true,

  // Manzillar `/maps/10335/tashkent/` ko'rinishida (oxirida `/`) —
  // `/…/tashkent` ham shunga 308 yo'naltiriladi. Bitta sahifaga ikki
  // xil manzil bo'lmasin (indekslashda dublikat).
  trailingSlash: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // MIME turini brauzer "taxmin qilmasin": yuklangan fayl
          // skript sifatida bajarilib ketmasin.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sahifa boshqa saytning ramkasiga joylanmasin (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Tashqi manbaga qaysi sahifadan kelganimiz yuborilmasin —
          // manzilda koordinata bo'lishi mumkin.
          { key: "Referrer-Policy", value: "no-referrer" },
          // Kerak bo'lmagan brauzer imkoniyatlari o'chiriladi.
          // Geolokatsiya QOLDIRILADI: "mening joyim" tugmasi shunga
          // tayanadi.
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
