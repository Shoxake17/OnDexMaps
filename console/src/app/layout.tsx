import type { Metadata } from "next";
import "./globals.css";

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
