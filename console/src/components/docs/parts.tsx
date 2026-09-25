"use client";
import { useState } from "react";
import Link from "next/link";
import { DOCS_ORDER } from "./nav";

/** Maqola elementlari — image/console/*.png dagi uslubda. */

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-6 text-3xl font-bold">{children}</h1>;
}

/** H2/H3 — `id` TOC uchun MAJBURIY (DocsShell shu id'lardan TOC yig'adi). */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 mb-3 scroll-mt-24 text-xl font-semibold">
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mt-6 mb-2 scroll-mt-24 text-base font-semibold">
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-muted">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-muted">{children}</ul>;
}

/** C — matn ichidagi kod bo'lagi (`ymaps3` kabi). */
export function C({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-border/70 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="text-brand hover:underline"
    >
      {children}
    </Link>
  );
}

const CALLOUT_STYLE = {
  tip: "border-emerald-500/40 bg-emerald-500/5",
  note: "border-sky-500/40 bg-sky-500/5",
  warn: "border-amber-500/50 bg-amber-500/5",
} as const;

const CALLOUT_TITLE = { tip: "Maslahat", note: "Eslatma", warn: "Diqqat" } as const;

export function Callout({ kind = "note", children }: { kind?: keyof typeof CALLOUT_STYLE; children: React.ReactNode }) {
  return (
    <div className={`my-4 rounded-lg border-l-4 px-4 py-3 ${CALLOUT_STYLE[kind]}`}>
      <div className="mb-1 text-sm font-semibold">{CALLOUT_TITLE[kind]}</div>
      <div className="text-sm text-muted [&_p]:mb-2 [&_p:last-child]:mb-0">{children}</div>
    </div>
  );
}

/** Code — nusxalash tugmasi bilan kod bloki. */
export function Code({ children, lang }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative my-4">
      <pre className="overflow-x-auto rounded-lg border border-border bg-border/40 p-4 text-[13px] leading-relaxed">
        <code className="font-mono">{children}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard yopiq bo'lsa jimgina o'tkazib yuboramiz */
          }
        }}
        className="absolute right-2 top-2 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted opacity-0 transition group-hover:opacity-100"
      >
        {copied ? "Nusxalandi ✓" : lang ?? "Nusxalash"}
      </button>
    </div>
  );
}

/** Tabs — bir nechta fayl uchun tabli kod bloklari (`index.html | index.js | package.json`). */
export function Tabs({ files }: { files: { name: string; code: string }[] }) {
  const [active, setActive] = useState(0);
  const current = files[active];
  return (
    <div className="my-4">
      <div className="flex gap-1 border-b border-border">
        {files.map((f, i) => (
          <button
            key={f.name}
            type="button"
            onClick={() => setActive(i)}
            className={`-mb-px border-b-2 px-3 py-2 font-mono text-xs transition-colors ${
              i === active
                ? "border-brand font-semibold text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>
      <Code>{current.code}</Code>
    </div>
  );
}

/** ParamTable — yuklash parametrlari jadvali (image/console/OnJavaScript1.png dagi kabi). */
export function ParamTable({
  rows,
}: {
  rows: { name: string; required?: boolean; children: React.ReactNode }[];
}) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      {rows.map((r, i) => (
        <div key={r.name} className={`grid grid-cols-1 gap-2 p-4 sm:grid-cols-[140px_1fr] ${i > 0 ? "border-t border-border" : ""}`}>
          <div>
            <code className="font-mono text-sm font-semibold text-brand">{r.name}</code>
          </div>
          <div className="text-sm text-muted">
            <div className="mb-1 italic">{r.required ? "Majburiy parametr" : "Ixtiyoriy parametr"}</div>
            {r.children}
          </div>
        </div>
      ))}
    </div>
  );
}

/** CardGrid — bo'lim sahifalaridagi kartalar to'ri (image/console/JavaScript.png dagi kabi). */
export function CardGrid({ cards }: { cards: { href: string; title: string; desc: string }[] }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="rounded-xl border border-border bg-card p-5 transition hover:border-brand/50 hover:shadow-sm"
        >
          <div className="mb-1.5 font-semibold text-brand">{c.title}</div>
          <div className="text-sm text-muted">{c.desc}</div>
        </Link>
      ))}
    </div>
  );
}

/** PrevNext — maqola oxiridagi navigatsiya (tartib `nav.ts` dagi DOCS_ORDER). */
export function PrevNext({ current }: { current: string }) {
  const i = DOCS_ORDER.findIndex((d) => d.href === current);
  if (i < 0) return null;
  const prev = i > 0 ? DOCS_ORDER[i - 1] : null;
  const next = i < DOCS_ORDER.length - 1 ? DOCS_ORDER[i + 1] : null;

  return (
    <div className="mt-12 flex items-start justify-between gap-4 border-t border-border pt-6 text-sm">
      {prev ? (
        <Link href={prev.href} className="group">
          <div className="text-xs text-muted">Oldingi</div>
          <div className="text-brand group-hover:underline">← {prev.label}</div>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="group text-right">
          <div className="text-xs text-muted">Keyingi</div>
          <div className="text-brand group-hover:underline">{next.label} →</div>
        </Link>
      )}
    </div>
  );
}
