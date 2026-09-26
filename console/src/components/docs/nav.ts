import type { NavIconName } from "./icons";

/**
 * Hujjatlar bo'limining chap menyusi — BITTA joyda (sahifalar ko'paysa shu yerga qo'shiladi).
 *
 * Tuzilma `image/ondexmapsdocsfull.png` dagi sahifa daraxtiga mos: har mavzu —
 * alohida sahifa, bo'lim boshi esa shu sahifalar ro'yxatini beradi.
 */

export interface DocsItem {
  href: string;
  label: string;
}

export interface DocsSection {
  label: string;
  href: string;
  icon: NavIconName;
  items?: DocsItem[];
}

export const DOCS_NAV: DocsSection[] = [
  { label: "Bosh sahifa", href: "/docs", icon: "home" },
  {
    label: "JavaScript API",
    href: "/docs/js",
    icon: "code",
    items: [
      { href: "/docs/js/general", label: "Umumiy ma'lumot" },
      { href: "/docs/js/quickstart", label: "Quick Start" },
    ],
  },
  {
    label: "Integratsiya",
    href: "/docs/integration",
    icon: "plug",
    items: [
      { href: "/docs/integration/cdn", label: "CDN" },
      { href: "/docs/integration/npm", label: "NPM" },
      { href: "/docs/integration/react", label: "React" },
      { href: "/docs/integration/vue", label: "Vue" },
      { href: "/docs/integration/typescript", label: "TypeScript" },
      { href: "/docs/integration/nextjs", label: "Next.js" },
      { href: "/docs/security/csp", label: "CSP" },
    ],
  },
  {
    label: "REST API",
    href: "/docs/api",
    icon: "server",
    items: [
      { href: "/docs/api/geocode", label: "Geocode" },
      { href: "/docs/api/reverse", label: "Reverse Geocode" },
      { href: "/docs/api/directions", label: "Directions" },
      { href: "/docs/api/places", label: "Places" },
      { href: "/docs/api/places-by-id", label: "Place by ID" },
      { href: "/docs/api/errors", label: "Errors" },
    ],
  },
  { label: "API Reference", href: "/docs/api/reference", icon: "book" },
  {
    label: "Security & Limits",
    href: "/docs/security",
    icon: "shield",
    items: [
      { href: "/docs/security/keys", label: "API kalitlar" },
      { href: "/docs/security/domains", label: "Domain restrictions" },
      { href: "/docs/security/ips", label: "IP restrictions" },
      { href: "/docs/security/csp", label: "CSP va HTTPS" },
    ],
  },
  {
    label: "Usage & Billing",
    href: "/docs/billing",
    icon: "card",
    items: [
      { href: "/docs/billing/usage", label: "Statistika" },
      { href: "/docs/billing/plans", label: "Tariflar" },
      { href: "/docs/billing/invoices", label: "Hisob-fakturalar" },
    ],
  },
  { label: "FAQ", href: "/docs/faq", icon: "help" },
  { label: "Boshqaruv paneli", href: "/dashboard", icon: "monitor" },
  { label: "API Keys", href: "/keys", icon: "key" },
  { label: "Usage", href: "/usage", icon: "chart" },
  { label: "Billing", href: "/billing", icon: "card" },
];

/** Oldingi/keyingi sahifa uchun tartib (maqola oxiridagi navigatsiya). */
export const DOCS_ORDER: DocsItem[] = [
  { href: "/docs", label: "Bosh sahifa" },
  { href: "/docs/js", label: "JavaScript API" },
  { href: "/docs/js/general", label: "Umumiy ma'lumot" },
  { href: "/docs/js/quickstart", label: "Quick Start" },
  { href: "/docs/integration", label: "Integratsiya" },
  { href: "/docs/integration/cdn", label: "CDN" },
  { href: "/docs/integration/npm", label: "NPM" },
  { href: "/docs/integration/react", label: "React" },
  { href: "/docs/integration/vue", label: "Vue" },
  { href: "/docs/integration/typescript", label: "TypeScript" },
  { href: "/docs/integration/nextjs", label: "Next.js" },
  { href: "/docs/api", label: "REST API" },
  { href: "/docs/api/geocode", label: "Geocode" },
  { href: "/docs/api/reverse", label: "Reverse Geocode" },
  { href: "/docs/api/directions", label: "Directions" },
  { href: "/docs/api/places", label: "Places" },
  { href: "/docs/api/places-by-id", label: "Place by ID" },
  { href: "/docs/api/errors", label: "Errors" },
  { href: "/docs/api/reference", label: "API Reference" },
  { href: "/docs/security", label: "Security & Limits" },
  { href: "/docs/security/keys", label: "API kalitlar" },
  { href: "/docs/security/domains", label: "Domain restrictions" },
  { href: "/docs/security/ips", label: "IP restrictions" },
  { href: "/docs/security/csp", label: "CSP va HTTPS" },
  { href: "/docs/billing", label: "Usage & Billing" },
  { href: "/docs/billing/usage", label: "Statistika" },
  { href: "/docs/billing/plans", label: "Tariflar" },
  { href: "/docs/billing/invoices", label: "Hisob-fakturalar" },
  { href: "/docs/faq", label: "FAQ" },
];

/** `⌘K` qidiruvi uchun yassi indeks — menyudan o'zi yig'iladi. */
export const DOCS_INDEX: { href: string; label: string; section: string }[] = DOCS_NAV.flatMap((s) => [
  { href: s.href, label: s.label, section: "Documentation" },
  ...(s.items ?? []).map((it) => ({ href: it.href, label: it.label, section: s.label })),
]);

/**
 * Sahifa yo'li bo'yicha uning bo'limini topadi (breadcrumb va chap menyuning
 * faol bandi uchun).
 *
 * `/docs` FAQAT aniq mos kelganda hisoblanadi: aks holda u barcha ichki
 * sahifalarga ham mos kelib, «Bosh sahifa» doim yonib turardi.
 */
export function sectionFor(pathname: string): DocsSection | undefined {
  return DOCS_NAV.filter(
    (s) => pathname === s.href || (s.href !== "/docs" && pathname.startsWith(`${s.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

/** Breadcrumb uchun sahifaning o'z nomi (bo'lim boshi bo'lmasa). */
export function pageLabel(pathname: string): string | undefined {
  for (const s of DOCS_NAV) {
    const hit = s.items?.find((it) => it.href === pathname);
    if (hit) return hit.label;
  }
  return undefined;
}
