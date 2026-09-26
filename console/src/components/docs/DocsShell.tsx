"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV, pageLabel, sectionFor, type DocsSection } from "./nav";
import { ChevronIcon, HomeIcon, NAV_ICON } from "./icons";

/**
 * DocsShell — hujjatlarning uch ustunli tuzilmasi (`image/ondexmapsdocs.png`):
 * chapda belgili bo'limlar daraxti, o'rtada breadcrumb + maqola, o'ngda
 * "Ushbu sahifada" (TOC).
 *
 * TOC maqola DOM'idan O'ZI yig'iladi (`h2[id]`, `h3[id]`) — har sahifada qo'lda
 * ro'yxat yozish shart emas. Faol sarlavha bitta IntersectionObserver bilan
 * aniqlanadi va HAM o'ng TOC'ga, HAM chap menyuning ichki bandlariga beriladi
 * (ikkita kuzatuvchi bo'lsa ular bir-biridan chetga chiqib qolardi).
 */

interface Heading {
  id: string;
  text: string;
  level: number;
}

function useHeadings(pathname: string) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("article h2[id], article h3[id]"));
    setHeadings(nodes.map((n) => ({ id: n.id, text: n.textContent ?? "", level: Number(n.tagName[1]) })));
    setActive(nodes[0]?.id ?? "");

    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -68% 0px" },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [pathname]);

  return { headings, active };
}

function SectionRow({
  section,
  pathname,
  activeHref,
  activeId,
  open,
  onToggle,
}: {
  section: DocsSection;
  pathname: string;
  /** Faol bo'lim — `sectionFor` topgani (eng uzun moslik). */
  activeHref?: string;
  activeId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = NAV_ICON[section.icon];
  // `startsWith` bilan tekshirilsa «/docs» BARCHA sahifalarga mos kelib qolardi,
  // shuning uchun faol bo'lim bitta joyda — `sectionFor` da — aniqlanadi.
  const current = section.href === activeHref;

  return (
    <li>
      <div className="flex items-center">
        <Link
          href={section.href}
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            current ? "bg-brand/10 font-semibold text-brand" : "text-foreground/80 hover:bg-border/50"
          }`}
        >
          <Icon size={17} className="shrink-0 opacity-80" />
          <span className="truncate">{section.label}</span>
        </Link>
        {section.items && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${section.label} bo'limini ochish`}
            className="ml-1 rounded p-1 text-muted hover:text-foreground"
          >
            <ChevronIcon open={open} />
          </button>
        )}
      </div>

      {section.items && open && (
        <ul className="mt-0.5 mb-1 space-y-px pl-[22px]">
          {section.items.map((it) => {
            const [base, hash] = it.href.split("#");
            // Band alohida sahifa bo'lsa — yo'l bo'yicha; anchor bo'lsa — skroll
            // holati bo'yicha (`activeId`).
            const active = hash ? pathname === base && hash === activeId : pathname === base;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    active ? "font-medium text-brand" : "text-muted hover:text-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-brand" : "bg-border"}`}
                  />
                  <span className="truncate">{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function SidebarNav({ pathname, activeId }: { pathname: string; activeId: string }) {
  // Joriy bo'lim doim ochiq; qolganlarini foydalanuvchi o'zi ochadi/yopadi.
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const activeHref = sectionFor(pathname)?.href;

  return (
    <nav aria-label="Hujjatlar">
      <div className="mb-3 px-3 text-[15px] font-bold">Documentation</div>
      <ul className="space-y-px">
        {DOCS_NAV.map((s) => {
          const open = manual[s.href] ?? s.href === activeHref;
          return (
            <SectionRow
              key={s.href}
              section={s}
              pathname={pathname}
              activeHref={activeHref}
              activeId={activeId}
              open={open}
              onToggle={() => setManual((m) => ({ ...m, [s.href]: !open }))}
            />
          );
        })}
      </ul>
    </nav>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const section = sectionFor(pathname);
  const page = pageLabel(pathname);
  return (
    <nav aria-label="Yo'l" className="mb-5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
      <Link href="/docs" className="text-muted transition-colors hover:text-foreground" aria-label="Bosh sahifa">
        <HomeIcon size={15} />
      </Link>
      <span className="text-border">/</span>
      <Link href="/docs" className="transition-colors hover:text-foreground">
        Documentation
      </Link>
      {section && section.href !== "/docs" && (
        <>
          <span className="text-border">/</span>
          {page ? (
            <Link href={section.href} className="transition-colors hover:text-foreground">
              {section.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{section.label}</span>
          )}
        </>
      )}
      {page && (
        <>
          <span className="text-border">/</span>
          <span className="font-medium text-foreground">{page}</span>
        </>
      )}
    </nav>
  );
}

function Toc({ headings, active }: { headings: Heading[]; active: string }) {
  if (headings.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-sm font-semibold">Ushbu sahifada</div>
      <ul className="space-y-px">
        {headings.map((h) => {
          const on = active === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={`flex items-start gap-2 rounded-md py-1 text-[13px] leading-snug transition-colors ${
                  h.level === 3 ? "pl-4" : ""
                } ${on ? "font-medium text-brand" : "text-muted hover:text-foreground"}`}
              >
                <span
                  className={`mt-1.5 shrink-0 rounded-full ${
                    h.level === 3 ? "h-1 w-1" : "h-1.5 w-1.5"
                  } ${on ? "bg-brand" : "bg-border"}`}
                />
                <span>{h.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Mobil ko'rinishda chap menyu ochiladigan panelga aylanadi. */
function MobileNav({ pathname, activeId }: { pathname: string; activeId: string }) {
  const [open, setOpen] = useState(false);
  const section = useMemo(() => sectionFor(pathname), [pathname]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="border-b border-border lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span>{section?.label ?? "Documentation"}</span>
        <ChevronIcon open={open} size={16} />
      </button>
      {open && (
        <div className="max-h-[70vh] overflow-y-auto px-2 pb-4">
          <SidebarNav pathname={pathname} activeId={activeId} />
        </div>
      )}
    </div>
  );
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { headings, active } = useHeadings(pathname);

  return (
    <>
      <MobileNav pathname={pathname} activeId={active} />

      <div className="mx-auto flex max-w-[1440px] gap-8 px-4 xl:px-6">
        <aside className="hidden w-60 shrink-0 border-r border-border py-8 pr-4 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
            <SidebarNav pathname={pathname} activeId={active} />
          </div>
        </aside>

        <article className="min-w-0 flex-1 py-8">
          <Breadcrumb pathname={pathname} />
          {children}
        </article>

        <aside className="hidden w-64 shrink-0 py-8 xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <Toc headings={headings} active={active} />
          </div>
        </aside>
      </div>
    </>
  );
}
