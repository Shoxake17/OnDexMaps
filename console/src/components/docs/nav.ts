/** Hujjatlar bo'limining chap menyusi — BITTA joyda (sahifalar ko'paysa shu yerga qo'shiladi). */

export interface DocsItem {
  href: string;
  label: string;
}

export interface DocsSection {
  /** Bo'lim sarlavhasi; `href` bo'lsa bosiladigan bo'ladi. */
  label: string;
  href?: string;
  items?: DocsItem[];
}

export const DOCS_NAV: DocsSection[] = [
  { label: "Bosh sahifa", href: "/docs" },
  {
    label: "JavaScript API",
    href: "/docs/js",
    items: [
      { href: "/docs/js/general", label: "Umumiy ma'lumot" },
      { href: "/docs/js/quickstart", label: "Tezkor start" },
    ],
  },
  {
    label: "REST API",
    href: "/docs/api",
    items: [
      { href: "/docs/api#geocode", label: "Geocode" },
      { href: "/docs/api#reverse", label: "Reverse Geocode" },
      { href: "/docs/api#directions", label: "Directions" },
      { href: "/docs/api#places", label: "Places" },
      { href: "/docs/api#errors", label: "Xatolar" },
    ],
  },
  { label: "Tariflar", href: "/docs/api#pricing" },
  { label: "Ko'p so'raladigan savollar", href: "/docs/api#faq" },
];

/** Oldingi/keyingi sahifa uchun tartib (maqola oxiridagi navigatsiya). */
export const DOCS_ORDER: DocsItem[] = [
  { href: "/docs", label: "Bosh sahifa" },
  { href: "/docs/js", label: "JavaScript API" },
  { href: "/docs/js/general", label: "Umumiy ma'lumot" },
  { href: "/docs/js/quickstart", label: "Tezkor start" },
  { href: "/docs/api", label: "REST API" },
];
