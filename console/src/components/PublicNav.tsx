"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DOCS_INDEX } from "./docs/nav";
import { SearchIcon, GlobeIcon } from "./docs/icons";

/**
 * PublicNav — ochiq sahifalar (hujjatlar) uchun yuqori panel.
 *
 * Tuzilma `image/ondexmapsdocs.png` dagi kabi: chapda belgi va nom, o'rtada
 * bo'limlar, o'ngda qidiruv (⌘K), til va «Kirish».
 *
 * Qidiruv HAQIQIY ishlaydi: indeks `docs/nav.ts` dagi menyudan yig'iladi, ya'ni
 * yangi sahifa qo'shilganda qidiruvga ham o'zi tushadi.
 */

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/api", label: "API" },
  { href: "/dashboard", label: "Console" },
  { href: "/docs/billing/plans", label: "Pricing" },
  { href: "/docs/faq", label: "FAQ" },
];

/**
 * Faol band — BITTA joyda aniqlanadi va faqat bittasi yonadi.
 * Tartib muhim: `/docs` hammasiga mos kelgani uchun u oxirida turadi.
 */
function activeLink(pathname: string): string | null {
  if (pathname.startsWith("/docs/api")) return "/docs/api";
  if (pathname.startsWith("/docs/billing")) return "/docs/billing/plans";
  if (pathname.startsWith("/docs/faq")) return "/docs/faq";
  if (["/dashboard", "/keys", "/usage", "/billing"].some((p) => pathname.startsWith(p))) return "/dashboard";
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return "/docs";
  return null;
}

function Search() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const seen = new Set<string>();
    return DOCS_INDEX.filter((d) => {
      if (seen.has(d.href) || !d.label.toLowerCase().includes(needle)) return false;
      seen.add(d.href);
      return true;
    }).slice(0, 8);
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        input.current?.blur();
      }
    }
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(href);
  }

  return (
    <div ref={box} className="relative hidden md:block">
      <div className="flex w-64 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 focus-within:border-white/35">
        <span className="text-slate-400">
          <SearchIcon size={15} />
        </span>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].href);
          }}
          placeholder="Hujjatlardan qidirish…"
          aria-label="Hujjatlardan qidirish"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-slate-500 focus:outline-none"
        />
        <kbd className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">⌘K</kbd>
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-muted">Natija topilmadi</div>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.href}>
                  <button
                    type="button"
                    onClick={() => go(r.href)}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left hover:bg-border/50"
                  >
                    <span className="text-[13px] font-medium">{r.label}</span>
                    <span className="shrink-0 text-[11px] text-muted">{r.section}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function PublicNav() {
  const pathname = usePathname();
  const active = activeLink(pathname);

  return (
    <header className="sticky top-0 z-40 bg-nav text-slate-100">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 xl:px-6">
        <Link href="/docs" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- kichik statik belgi, Image optimizatsiyasi ortiqcha */}
          <img src="/logo.png" alt="" width={26} height={26} className="shrink-0" />
          <span className="text-[19px] font-bold tracking-tight">OnDexMap</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => {
            const on = l.href === active;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-md px-3 py-2 text-sm transition-colors ${
                  on ? "font-semibold text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                {l.label}
                {on && <span className="absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Search />
          <span
            className="hidden items-center gap-1.5 text-[13px] text-slate-300 lg:flex"
            title="Hujjatlar o'zbek tilida"
          >
            <GlobeIcon size={15} />
            UZ
          </span>
          <Link
            href="/login"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Kirish
          </Link>
        </div>
      </div>
    </header>
  );
}
