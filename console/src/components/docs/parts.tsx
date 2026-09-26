"use client";
import { useState } from "react";
import Link from "next/link";
import { DOCS_ORDER } from "./nav";
import { highlight } from "./highlight";
import { CheckIcon, CopyIcon } from "./icons";

/** Maqola elementlari — `image/ondexmapsdocs.png` dagi uslubda. */

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-4 text-[34px] font-bold leading-tight tracking-tight">{children}</h1>;
}

/** H2/H3 — `id` TOC uchun MAJBURIY (DocsShell shu id'lardan TOC yig'adi). */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-12 mb-3 scroll-mt-24 text-[22px] font-bold tracking-tight">
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mt-8 mb-2 scroll-mt-24 text-base font-semibold">
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[15px] leading-relaxed text-muted">{children}</p>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mb-6 max-w-xl text-[15px] leading-relaxed text-muted">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[15px] text-muted">{children}</ul>;
}

/** C — matn ichidagi kod bo'lagi. */
export function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-border/70 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
  );
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="font-medium text-brand hover:underline"
    >
      {children}
    </Link>
  );
}

/* ── Sahifa boshi ─────────────────────────────────────────────────────── */

/** PageHead — sarlavha, tavsif, qisqa havola tugmalari va o'ngdagi rasm. */
export function PageHead({
  title,
  desc,
  pills,
  art,
}: {
  title: string;
  desc: string;
  pills?: { href: string; label: string; icon: React.ReactNode }[];
  art?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex items-start gap-8">
      <div className="min-w-0 flex-1">
        <H1>{title}</H1>
        <Lead>{desc}</Lead>
        {pills && (
          <div className="flex flex-wrap gap-2.5">
            {pills.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium transition hover:border-brand/50 hover:shadow-sm"
              >
                <span className="text-brand">{p.icon}</span>
                {p.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      {art && <div className="hidden w-[38%] shrink-0 lg:block">{art}</div>}
    </div>
  );
}

const CALLOUT_STYLE = {
  tip: "border-emerald-500/40 bg-emerald-500/5",
  note: "border-sky-500/40 bg-sky-500/5",
  warn: "border-amber-500/50 bg-amber-500/5",
} as const;

const CALLOUT_TITLE = { tip: "Maslahat", note: "Eslatma", warn: "Diqqat" } as const;

export function Callout({
  kind = "note",
  children,
}: {
  kind?: keyof typeof CALLOUT_STYLE;
  children: React.ReactNode;
}) {
  return (
    <div className={`my-4 rounded-lg border-l-4 px-4 py-3 ${CALLOUT_STYLE[kind]}`}>
      <div className="mb-1 text-sm font-semibold">{CALLOUT_TITLE[kind]}</div>
      <div className="text-sm text-muted [&_p]:mb-2 [&_p:last-child]:mb-0">{children}</div>
    </div>
  );
}

/* ── Kod ──────────────────────────────────────────────────────────────── */

function CopyButton({ text, light }: { text: string; light?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard yopiq bo'lsa jimgina o'tkazib yuboramiz */
        }
      }}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition ${
        light ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-border/60 hover:text-foreground"
      }`}
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? "Nusxalandi" : "Copy"}
    </button>
  );
}

function CodeBody({ code, lang }: { code: string; lang?: string }) {
  return (
    <pre className="overflow-x-auto bg-code px-4 py-4 text-[13px] leading-[1.65] text-slate-100">
      <code className="font-mono">{highlight(code, lang)}</code>
    </pre>
  );
}

/**
 * Code — bitta kod bloki: tepasida til yorlig'i va «Copy», ichida bo'yalgan matn.
 * `Tabs` bir necha fayl uchun xuddi shu ramkani ishlatadi.
 */
export function Code({ children, lang }: { children: string; lang?: string }) {
  return <Tabs files={[{ name: lang ?? "code", code: children, lang }]} />;
}

export function Tabs({
  files,
}: {
  files: { name: string; code: string; lang?: string }[];
}) {
  const [active, setActive] = useState(0);
  const current = files[active];

  return (
    <div className="my-5 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border pl-2 pr-1">
        <div className="flex">
          {files.map((f, i) => (
            <button
              key={f.name}
              type="button"
              onClick={() => setActive(i)}
              className={`-mb-px border-b-2 px-3 py-2.5 font-mono text-xs transition-colors ${
                i === active
                  ? "border-brand font-semibold text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <CopyButton text={current.code} />
      </div>
      <CodeBody code={current.code} lang={current.lang ?? current.name} />
    </div>
  );
}

/** Terminal — buyruq qatori uchun to'liq to'q blok. */
export function Terminal({ children, label = "Terminal" }: { children: string; label?: string }) {
  return (
    <div className="my-5 overflow-hidden rounded-xl bg-code">
      <div className="flex items-center justify-between border-b border-white/10 pl-3 pr-1">
        <span className="py-2.5 font-mono text-xs text-slate-400">{label}</span>
        <CopyButton text={children} light />
      </div>
      <CodeBody code={children} lang="terminal" />
    </div>
  );
}

/* ── Tuzilma bloklari ─────────────────────────────────────────────────── */

/** Split — chapda kod, o'ngda natija/talablar (rasmning ikki ustunli qismi). */
export function Split({ children }: { children: React.ReactNode }) {
  return <div className="my-5 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">{children}</div>;
}

/** Panel — o'ng ustundagi ramkali blok («Natija», «Kerakli talablar»). */
export function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 text-xs font-semibold text-muted">{label}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** CheckList — yashil belgili talablar ro'yxati. */
export function CheckList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-600">
            <CheckIcon size={11} />
          </span>
          <span className="text-muted">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Success — «Tayyor!» xabari (kod bloki natijasining ostida). */
export function Success({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckIcon size={12} />
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  );
}

/** ChoiceCards — «Tez boshlash» qatoridagi usul kartalari (CDN, NPM, React …). */
export function ChoiceCards({
  cards,
}: {
  cards: { href: string; title: string; desc: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <a
          key={c.href}
          href={c.href}
          className="rounded-xl border border-border bg-card p-4 transition hover:border-brand/50 hover:shadow-sm"
        >
          <div className="mb-2.5">{c.icon}</div>
          <div className="text-sm font-semibold">{c.title}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted">{c.desc}</div>
        </a>
      ))}
    </div>
  );
}

/** ParamTable — parametrlar jadvali. */
export function ParamTable({
  rows,
}: {
  rows: { name: string; required?: boolean; children: React.ReactNode }[];
}) {
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-border bg-card">
      {rows.map((r, i) => (
        <div
          key={r.name}
          className={`grid grid-cols-1 gap-2 p-4 sm:grid-cols-[150px_1fr] ${i > 0 ? "border-t border-border" : ""}`}
        >
          <div>
            <code className="font-mono text-sm font-semibold text-brand">{r.name}</code>
          </div>
          <div className="text-sm text-muted">
            <div className="mb-1 text-xs uppercase tracking-wide">
              {r.required ? "Majburiy" : "Ixtiyoriy"}
            </div>
            {r.children}
          </div>
        </div>
      ))}
    </div>
  );
}

/** CardGrid — bo'lim sahifalaridagi kartalar to'ri. */
export function CardGrid({
  cards,
}: {
  cards: { href: string; title: string; desc: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="rounded-xl border border-border bg-card p-5 transition hover:border-brand/50 hover:shadow-sm"
        >
          {c.icon && <div className="mb-3 text-brand">{c.icon}</div>}
          <div className="mb-1.5 font-semibold">{c.title}</div>
          <div className="text-sm leading-relaxed text-muted">{c.desc}</div>
        </Link>
      ))}
    </div>
  );
}

/** Table — oddiy ma'lumot jadvali. */
export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 align-top last:border-0">
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-muted">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className="mt-14 flex items-start justify-between gap-4 border-t border-border pt-6 text-sm">
      {prev ? (
        <Link href={prev.href} className="group">
          <div className="text-xs text-muted">Oldingi</div>
          <div className="font-medium text-brand group-hover:underline">← {prev.label}</div>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="group text-right">
          <div className="text-xs text-muted">Keyingi</div>
          <div className="font-medium text-brand group-hover:underline">{next.label} →</div>
        </Link>
      )}
    </div>
  );
}
