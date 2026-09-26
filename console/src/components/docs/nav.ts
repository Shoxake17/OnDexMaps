/** Hujjatlar bo'limining chap menyusi — BITTA joyda (sahifalar ko'paysa shu yerga qo'shiladi). */

export interface DocsItem {
  href: string;
  label: string;
  /** Ichki sahifalar (uchinchi daraja, masalan «Ulash» ostidagi framework sahifalari). */
  items?: DocsItem[];
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
      {
        href: "/docs/js/connect",
        label: "API'ni ulash",
        items: [
          { href: "/docs/js/connect", label: "JavaScript'da" },
          { href: "/docs/js/connect/typescript", label: "TypeScript'da" },
          { href: "/docs/js/connect/react", label: "React" },
          { href: "/docs/js/connect/vue", label: "Vue" },
          { href: "/docs/js/connect/csp", label: "CSP bilan ulash" },
        ],
      },
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
      { href: "/docs/api/reference", label: "OpenAPI ma'lumotnoma" },
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
  { href: "/docs/js/connect", label: "API'ni ulash: JavaScript" },
  { href: "/docs/js/connect/typescript", label: "API'ni ulash: TypeScript" },
  { href: "/docs/js/connect/react", label: "API'ni ulash: React" },
  { href: "/docs/js/connect/vue", label: "API'ni ulash: Vue" },
  { href: "/docs/js/connect/csp", label: "API'ni ulash: CSP bilan" },
  { href: "/docs/api", label: "REST API" },
  { href: "/docs/api/reference", label: "OpenAPI ma'lumotnoma" },
];
