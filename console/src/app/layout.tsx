import type { Metadata } from "next";
import "./globals.css";

// ⚠️ MAJBURIY: sahifalar sof client komponent (hech biri `headers()`/cookie/
// `searchParams` ishlatmaydi), shuning uchun Next.js ularni STATIK deb topib
// BUILD VAQTIDA oldindan render qilardi. `middleware.ts` esa har SO'ROVDA
// yangi nonce generatsiya qiladi (CSP sarlavhasida) — statik HTML'ga esa
// build vaqtidagi (yoki umuman yo'q) nonce qotib qolgan bo'lardi. Ikkalasi
// mos kelmay, brauzer BARCHA inline va hatto tashqi skriptlarni bloklaydi
// ("strict-dynamic" nonce'ga ishonadi, nonce mos kelmasa ishonch yo'q).
// `force-dynamic` bilan har so'rov QAYTADAN render qilinadi — shu so'rovning
// O'ZI uchun nonce header va HTML'dagi skriptlar doim bir xil bo'ladi.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OnDex Console",
  description: "OnDexMap dasturchi platformasi: API kalitlar, foydalanish, hisob-faktura.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
