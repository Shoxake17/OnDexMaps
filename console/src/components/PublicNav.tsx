"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * PublicNav — ochiq sahifalar (hujjatlar) uchun qorong'i mega-menyuli navbar.
 *
 * Uslub Yandex Xaritalar API sahifasidan olingan (image/OnDexNavbar.png), LEKIN
 * mazmun FAQAT bizda haqiqatan bor narsalar: 4 ta endpoint (`docs/developer-platform.md`
 * allowlist) va konsolning haqiqiy sahifalari. SDK, Isochrone, til almashtirgich,
 * Stack Overflow/GitHub kabi bizda YO'Q bo'limlar ATAYLAB qo'shilmagan.
 */

const DOCS_LINKS = [
  { href: "/docs#geocode", label: "Geocode API", desc: "Nom → koordinata" },
  { href: "/docs#reverse", label: "Reverse Geocode", desc: "Koordinata → manzil" },
  { href: "/docs#directions", label: "Directions API", desc: "A → B haqiqiy yo'l" },
  { href: "/docs#places", label: "Places API", desc: "Ob'ekt ma'lumoti" },
];

const CONSOLE_LINKS = [
  { href: "/dashboard", label: "Boshqaruv paneli" },
  { href: "/keys", label: "API kalitlar" },
  { href: "/usage", label: "Foydalanish statistikasi" },
  { href: "/billing", label: "Hisob-faktura" },
];

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 22s8-7.4 8-13a8 8 0 1 0-16 0c0 5.6 8 13 8 13Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-40 bg-zinc-900 text-zinc-100">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/docs" className="flex shrink-0 items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex items-center gap-1 rounded-full bg-zinc-800 py-1 pl-1.5 pr-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
              <PinIcon />
            </span>
            <span className="text-xs font-bold tracking-wide">API</span>
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-brand">On</span>Dex <span className="font-normal text-zinc-400">Maps</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm sm:flex">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`flex items-center gap-1 rounded-md px-3 py-2 transition-colors ${
              open ? "bg-zinc-800 text-white" : "text-zinc-300 hover:text-white"
            }`}
          >
            Dasturchilar
            <ChevronIcon open={open} />
          </button>
          <a href="/docs#pricing" className="rounded-md px-3 py-2 text-zinc-300 hover:text-white">
            Tariflar
          </a>
        </nav>

        <div className="ml-auto">
          <Link
            href="/dashboard"
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Kabinetga
          </Link>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full border-t border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:grid-cols-2">
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Hujjatlar</div>
              <ul className="space-y-1">
                {DOCS_LINKS.map((d) => (
                  <li key={d.href}>
                    <a
                      href={d.href}
                      onClick={() => setOpen(false)}
                      className="-mx-2 block rounded-md px-2 py-2 hover:bg-zinc-800"
                    >
                      <div className="text-sm text-zinc-100">{d.label}</div>
                      <div className="text-xs text-zinc-500">{d.desc}</div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Konsol</div>
              <ul className="space-y-1">
                {CONSOLE_LINKS.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href}
                      onClick={() => setOpen(false)}
                      className="-mx-2 block rounded-md px-2 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
                    >
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
