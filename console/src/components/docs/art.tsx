import { CloudIcon, CodeIcon, MonitorIcon, PinIcon, ServerIcon, UserIcon } from "./icons";

/**
 * Hujjatlardagi chizmalar.
 *
 * Hammasi inline SVG/CSS — tashqi rasm fayli yo'q, shuning uchun qorong'i mavzuda
 * ham, bosib chiqarishda ham buzilmaydi va sahifa og'irlashmaydi. Xarita
 * ko'rinishlari SHARTLI: ular haqiqiy tile emas, ma'no beruvchi sxema.
 */

/* ── Texnologiya belgilari ────────────────────────────────────────────── */

export function ReactMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.1" fill="#61DAFB" />
      <g stroke="#61DAFB" strokeWidth="1.1" fill="none">
        <ellipse cx="12" cy="12" rx="9.5" ry="3.7" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.7" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.7" transform="rotate(120 12 12)" />
      </g>
    </svg>
  );
}

export function VueMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 4h4l6 10 6-10h4L12 21 2 4Z" fill="#41B883" />
      <path d="M7 4h3l2 3.4L14 4h3l-5 8.4L7 4Z" fill="#35495E" />
    </svg>
  );
}

export function TsMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#3178C6" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="10"
        fontWeight="bold"
        fontFamily="ui-monospace, monospace"
      >
        TS
      </text>
    </svg>
  );
}

export function NextMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#0F172A" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="11"
        fontWeight="bold"
        fontFamily="ui-sans-serif, sans-serif"
      >
        N
      </text>
    </svg>
  );
}

export function NpmMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#CB3837" />
      <path d="M5 8h14v8h-4v-6h-2v6H5V8Z" fill="#fff" />
    </svg>
  );
}

export function CdnMark({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex text-sky-500">
      <CloudIcon size={size} />
    </span>
  );
}

/* ── Xarita sxemasi ───────────────────────────────────────────────────── */

/** MapSketch — shartli xarita ko'rinishi (haqiqiy tile emas). */
export function MapSketch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 200"
      // `slice` — ramka nisbati boshqacha bo'lsa ham maydon to'liq to'ladi;
      // `meet` bo'lsa yon tomonlarda bo'sh (qora) chiziq qolardi.
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label="Xarita ko'rinishi"
    >
      <rect width="320" height="200" fill="#EEF3EC" />
      <path d="M0 132 C60 120 90 150 150 142 C210 134 260 160 320 150 L320 200 L0 200 Z" fill="#DCEBF7" />
      {/* `fill="none"` SHART: fill'siz `path` qora bilan to'ldiriladi (standart qiymat). */}
      <g fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round">
        <path d="M-10 60 L120 44 L200 70 L330 52" />
        <path d="M40 -10 L64 90 L48 210" />
        <path d="M190 -10 L206 78 L250 210" />
        <path d="M-10 110 L150 100 L330 118" />
      </g>
      <g fill="none" stroke="#E7E2D8" strokeWidth="2.5">
        <path d="M100 -10 L112 210" />
        <path d="M260 -10 L272 210" />
        <path d="M-10 26 L330 14" />
      </g>
      <g fill="#E3E8DF">
        <rect x="118" y="52" width="26" height="18" rx="2" />
        <rect x="150" y="80" width="20" height="14" rx="2" />
        <rect x="216" y="30" width="30" height="16" rx="2" />
        <rect x="60" y="112" width="24" height="16" rx="2" />
      </g>
      <g>
        <ellipse cx="160" cy="104" rx="7" ry="2.6" fill="#0F172A" opacity="0.18" />
        <path d="M160 98 c0 0 9-7.6 9-14 a9 9 0 1 0-18 0 c0 6.4 9 14 9 14Z" fill="#F97316" />
        <circle cx="160" cy="84" r="3.4" fill="#fff" />
      </g>
    </svg>
  );
}

/** BrowserFrame — brauzer oynasi ramkasi (tepasida uch nuqta va manzil qatori). */
export function BrowserFrame({ children, url }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        {url && (
          <span className="ml-2 truncate rounded bg-border/60 px-2 py-0.5 font-mono text-[10px] text-muted">
            {url}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** HeroArt — sahifa boshidagi chizma: xarita oynasi + atrofida texnologiya belgilari. */
export function HeroArt() {
  const badges = [
    { mark: <ReactMark size={20} />, label: "React", top: "0%", right: "2%" },
    { mark: <VueMark size={20} />, label: "Vue", top: "30%", right: "-6%" },
    { mark: <TsMark size={20} />, label: "TS", top: "58%", right: "4%" },
    { mark: <CodeIcon size={20} />, label: "JS", top: "84%", right: "-2%" },
  ];

  return (
    <div className="relative pr-8">
      <BrowserFrame url="sizning-saytingiz.uz">
        <div className="flex">
          <div className="h-[168px] flex-1">
            <MapSketch />
          </div>
          <div className="w-[34%] space-y-2 border-l border-border p-2.5">
            <div className="h-2.5 w-4/5 rounded bg-border" />
            <div className="h-2 w-full rounded bg-border/70" />
            <div className="h-2 w-3/4 rounded bg-border/70" />
            <div className="mt-3 h-2.5 w-2/3 rounded bg-border" />
            <div className="h-2 w-full rounded bg-border/70" />
            <div className="h-2 w-5/6 rounded bg-border/70" />
          </div>
        </div>
      </BrowserFrame>

      {badges.map((b) => (
        <div
          key={b.label}
          style={{ top: b.top, right: b.right }}
          className="absolute flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 shadow-sm"
        >
          {b.mark}
          <span className="text-[11px] font-semibold">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Oqim sxemasi ─────────────────────────────────────────────────────── */

function FlowBox({
  icon,
  title,
  desc,
  tone = "card",
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  tone?: "card" | "brand";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
        tone === "brand" ? "border-brand/40 bg-brand/5" : "border-border bg-card"
      }`}
    >
      {icon && <span className="shrink-0 text-brand">{icon}</span>}
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold">{title}</div>
        {desc && <div className="truncate text-[11px] text-muted">{desc}</div>}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-border" aria-hidden="true">
      <svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M0 6h19" />
        <path d="m15 2 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** FlowDiagram — «Qanday ishlaydi?» sxemasi. */
export function FlowDiagram() {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-border bg-background p-5">
      <div className="flex min-w-[820px] items-center gap-3">
        <div className="w-[150px] shrink-0">
          <FlowBox icon={<UserIcon size={18} />} title="Foydalanuvchi" desc="Brauzer / ilova" />
        </div>
        <Arrow />
        <div className="w-[150px] shrink-0">
          <FlowBox icon={<MonitorIcon size={18} />} title="Sizning ilovangiz" desc="Web / mobil / backend" />
        </div>
        <Arrow />
        <div className="w-[190px] shrink-0 space-y-2">
          <FlowBox icon={<PinIcon size={18} />} title="JavaScript API" desc="Xarita + interaktiv" />
          <FlowBox icon={<ServerIcon size={18} />} title="REST API" desc="Geocode, Places, Directions" />
        </div>
        <Arrow />
        <div className="w-[160px] shrink-0">
          <FlowBox icon={<CloudIcon size={18} />} title="OnDexMap" desc="Ma'lumot va xizmatlar" tone="brand" />
        </div>
        <Arrow />
        <div className="w-[130px] shrink-0 space-y-1.5">
          {["Tile'lar", "Geo ma'lumot", "Marshrutlar"].map((t) => (
            <div
              key={t}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-center text-[12px] font-medium"
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
