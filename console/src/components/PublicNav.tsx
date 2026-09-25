"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * PublicNav — ochiq sahifalar (hujjatlar) uchun navbar.
 *
 * Tuzilma Yandex Xaritalar API sahifasidan (`image/Developer.png`,
 * `image/ProductsBlock.png`): Mahsulotlar/Dasturchilar/Tariflar/FAQ + mega-panel.
 * Mazmun — FAQAT bizda bor narsalar; ikkita nom (`MapKit SDK`, `Static API`)
 * hali YO'Q — ular "Tez orada" belgisi bilan, havolasiz, bosilmaydigan holatda
 * (soxta imkoniyat va'da qilinmaydi, lekin reja sifatida ko'rsatiladi).
 */

type Menu = "products" | "developer" | null;

const MAPS_ITEMS: { label: string; desc: string; href?: string }[] = [
  { label: "JavaScript API", desc: "Saytingizga interaktiv xarita", href: "/docs" },
  { label: "Tiles API", desc: "Xaritaning o'zi (tile qatlami)", href: "/docs" },
  { label: "MapKit SDK", desc: "Mobil ilova uchun — tez orada" },
  { label: "Static API", desc: "Statik xarita rasmi — tez orada" },
];

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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
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

function NavButton({ label, menu, current, onToggle }: { label: string; menu: Menu; current: Menu; onToggle: (m: Menu) => void }) {
  const open = current === menu;
  return (
    <button
      type="button"
      onClick={() => onToggle(open ? null : menu)}
      aria-expanded={open}
      className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors ${
        open ? "bg-zinc-800 text-white" : "text-zinc-300 hover:text-white"
      }`}
    >
      {label}
      <ChevronIcon open={open} />
    </button>
  );
}

export function PublicNav() {
  const [menu, setMenu] = useState<Menu>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-40 bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/docs" className="flex shrink-0 items-center gap-2" onClick={() => setMenu(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- kichik statik belgi, Image optimizatsiyasi ortiqcha */}
          <img src="/logo.png" alt="" width={30} height={30} className="shrink-0" />
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-zinc-300">API</span>
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-brand">On</span>Dex <span className="font-normal text-zinc-400">Maps</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <NavButton label="Mahsulotlar" menu="products" current={menu} onToggle={setMenu} />
          <NavButton label="Dasturchilar" menu="developer" current={menu} onToggle={setMenu} />
          <a href="/docs#pricing" onClick={() => setMenu(null)} className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:text-white">
            Tariflar
          </a>
          <a href="/docs#faq" onClick={() => setMenu(null)} className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:text-white">
            FAQ
          </a>
        </nav>

        <div className="ml-auto">
          <Link
            href="/login"
            className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-zinc-200"
          >
            Kirish
          </Link>
        </div>
      </div>

      {menu === "products" && (
        <div className="absolute inset-x-0 top-full border-t border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Xaritalar</div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              {MAPS_ITEMS.map((it) =>
                it.href ? (
                  <a
                    key={it.label}
                    href={it.href}
                    onClick={() => setMenu(null)}
                    className="-mx-2 block rounded-md px-2 py-2.5 hover:bg-zinc-800"
                  >
                    <div className="text-sm text-zinc-100">{it.label}</div>
                    <div className="text-xs text-zinc-500">{it.desc}</div>
                  </a>
                ) : (
                  <div key={it.label} className="-mx-2 flex items-start gap-2 rounded-md px-2 py-2.5 opacity-60">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        {it.label}
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                          Tez orada
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">{it.desc}</div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {menu === "developer" && (
        <div className="absolute inset-x-0 top-full border-t border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:grid-cols-2">
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Hujjatlar</div>
              <ul className="space-y-1">
                {DOCS_LINKS.map((d) => (
                  <li key={d.href}>
                    <a
                      href={d.href}
                      onClick={() => setMenu(null)}
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
                      onClick={() => setMenu(null)}
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
