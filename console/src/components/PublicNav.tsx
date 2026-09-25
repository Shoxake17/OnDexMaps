"use client";
import { useRef } from "react";
import Link from "next/link";

/**
 * PublicNav — ochiq sahifalar (hujjatlar) uchun navbar.
 *
 * Uslub `image/OnDexNavbar.png`dan (OnDex ilovasining haqiqiy navbari): qora fon,
 * chegarali (bordered) pastki chip qatori, birinchisi to'ldirilgan-orange "faol"
 * holatda. Mazmun FAQAT bizda haqiqatan bor narsalar — 4 ta `/v2` endpoint va
 * konsolning haqiqiy sahifalari; qidiruv/manzil kabi bu yerga tegishli bo'lmagan
 * elementlar OLIB TASHLANGAN (ular restoran ilovasiga xos, konsolda mazmunsiz).
 */

const CHIPS = [
  { href: "/docs", label: "Hujjatlar", active: true },
  { href: "/docs#geocode", label: "Geocode" },
  { href: "/docs#reverse", label: "Reverse Geocode" },
  { href: "/docs#directions", label: "Directions" },
  { href: "/docs#places", label: "Places" },
  { href: "/docs#pricing", label: "Tariflar" },
  { href: "/dashboard", label: "Boshqaruv paneli" },
  { href: "/keys", label: "API kalitlar" },
  { href: "/usage", label: "Foydalanish" },
  { href: "/billing", label: "Hisob-faktura" },
];

export function PublicNav() {
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="sticky top-0 z-40 bg-black text-zinc-100">
      {/* ── Yuqori qator: logotip + kirish ─────────────────────────── */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/docs" className="flex shrink-0 items-center">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">On</span>
            <span className="text-brand">Dex</span>
          </span>
        </Link>

        <Link
          href="/login"
          className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-zinc-200"
        >
          Kirish
        </Link>
      </div>

      {/* ── Pastki qator: chegarali chip'lar (haqiqiy sahifalar) ────── */}
      <div className="relative border-t border-zinc-800">
        <div
          ref={scroller}
          className="mx-auto flex max-w-6xl items-center gap-2.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CHIPS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                c.active
                  ? "border-brand bg-brand text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
              }`}
            >
              {c.label}
            </a>
          ))}
        </div>
        <button
          type="button"
          aria-label="Ko'proq ko'rsatish"
          onClick={() => scroller.current?.scrollBy({ left: 240, behavior: "smooth" })}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center bg-gradient-to-l from-black via-black/90 to-transparent text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
