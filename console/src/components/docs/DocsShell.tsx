"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "./nav";

/**
 * DocsShell — hujjatlarning uch ustunli tuzilmasi (image/console/*.png dagi kabi):
 * chapda bo'limlar daraxti, o'rtada maqola, o'ngda "Ushbu maqolada" (TOC).
 *
 * TOC maqola DOM'idan O'ZI yig'iladi (`h2[id]`, `h3[id]`) — har sahifada qo'lda
 * ro'yxat yozish shart emas, ya'ni sarlavha o'zgarsa TOC ham o'zgaradi (ikki
 * nusxa bo'lmaydi). Faol band IntersectionObserver bilan belgilanadi.
 */

interface Heading {
  id: string;
  text: string;
  level: number;
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="text-sm">
      <div className="mb-4 font-bold">Hujjatlar</div>
      <ul className="space-y-0.5">
        {DOCS_NAV.map((s) => {
          const base = s.href?.split("#")[0];
          const isCurrent = base === pathname;
          const sectionOpen = Boolean(s.items && base && pathname.startsWith(base));
          return (
            <li key={s.label}>
              {s.href ? (
                <Link
                  href={s.href}
                  className={`block rounded-md px-3 py-1.5 ${
                    isCurrent ? "bg-brand/10 font-medium text-brand" : "text-muted hover:text-foreground"
                  }`}
                >
                  {s.label}
                </Link>
              ) : (
                <span className="block px-3 py-1.5 font-medium">{s.label}</span>
              )}
              {s.items && sectionOpen && (
                <ul className="mt-0.5 space-y-0.5 border-l border-border pl-3 ml-3">
                  {s.items.map((it) => {
                    const itBase = it.href.split("#")[0];
                    const active = itBase === pathname && !it.items;
                    // Uchinchi daraja faqat shu shox ichida bo'lganda ochiladi.
                    const childOpen = Boolean(it.items && pathname.startsWith(itBase));
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          className={`block rounded-md px-3 py-1.5 ${
                            active || (it.items && pathname === itBase)
                              ? "bg-brand/10 font-medium text-brand"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          {it.label}
                        </Link>
                        {it.items && childOpen && (
                          <ul className="mt-0.5 space-y-0.5 border-l border-border pl-3 ml-3">
                            {it.items.map((sub) => (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href}
                                  className={`block rounded-md px-3 py-1.5 ${
                                    sub.href === pathname
                                      ? "bg-brand/10 font-medium text-brand"
                                      : "text-muted hover:text-foreground"
                                  }`}
                                >
                                  {sub.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Toc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("article h2[id], article h3[id]"));
    setHeadings(nodes.map((n) => ({ id: n.id, text: n.textContent ?? "", level: Number(n.tagName[1]) })));

    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [pathname]);

  if (headings.length === 0) return null;

  return (
    <div className="text-sm">
      <div className="mb-3 text-muted">Ushbu maqolada:</div>
      <ul className="space-y-1">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block border-l-2 py-1 ${h.level === 3 ? "pl-6" : "pl-3"} ${
                active === h.id
                  ? "border-brand font-medium text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4">
      <aside className="hidden w-60 shrink-0 py-8 lg:block">
        <div className="sticky top-24">
          <SidebarNav />
        </div>
      </aside>

      <article className="min-w-0 flex-1 py-8">{children}</article>

      <aside className="hidden w-56 shrink-0 py-8 xl:block">
        <div className="sticky top-24">
          <Toc />
        </div>
      </aside>
    </div>
  );
}
