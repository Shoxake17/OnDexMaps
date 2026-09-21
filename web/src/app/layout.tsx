import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Nisbiy manzillar (`canonical`, `og:image`) shundan mutlaq bo'ladi.
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — O'zbekiston xaritasi`,
  description:
    "O'zbekiston shaharlarining xaritasi va sun'iy yo'ldosh tasviri: " +
    "ko'chalar, binolar, mahallalar, masofa o'lchash va marshrut.",
  applicationName: SITE_NAME,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uz"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
