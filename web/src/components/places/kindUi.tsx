"use client";

/**
 * Ob'ekt turlarining ko'rinishi: belgi (yon panel va xarita), rang.
 *
 * Belgi yo'llari BITTA joyda: yon paneldagi SVG ham, xaritadagi belgi ham
 * (tuvalda `Path2D` bilan) shu yo'llardan chiziladi — ikki xil "avtoturargoh"
 * bo'lib qolmaydi.
 *
 * Tur KALITLARI serverdan (`internal/places/kinds.go`); bu yerda faqat
 * ularning KO'RINISHI. Serverda yangi tur paydo bo'lib bu yerda yo'q bo'lsa,
 * u `other` belgisi bilan chiziladi (yiqilmaydi).
 */

export interface KindUi {
  /** Xaritadagi doira rangi. */
  color: string;
  /** 24×24 koordinatalarida SVG yo'li (chiziq belgisi). */
  d: string;
}

const KIND_UI: Record<string, KindUi> = {
  organization: {
    color: "#2f6bff",
    d: "M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  },
  address: {
    color: "#6b7280",
    d: "M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10zM12 8v5M9.5 10.5h5",
  },
  entrance: {
    color: "#6b7280",
    d: "M14 3H8a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6M14 3l4 1.5v15L14 21M14 3v18M11.5 12h.01",
  },
  road: {
    color: "#64748b",
    d: "M12 3v18M4 6h11l3 2.5-3 2.5H4zM20 14H9l-3 2.5L9 19h11z",
  },
  barrier: {
    color: "#ef4444",
    d: "M4 20V9M4 11l16-3M8 10V6.5M12 9V5.5M16 8V4.5M2.5 20h5",
  },
  stop: {
    color: "#0ea5e9",
    d: "M5 5h14v10H5zM5 15v3M19 15v3M5 9h14M8 12h.01M16 12h.01",
  },
  parking: {
    color: "#3b82f6",
    d: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10 17V8h3.5a2.5 2.5 0 0 1 0 5H10",
  },
  crossing: {
    color: "#f59e42",
    d: "M13.5 4.5a1 1 0 1 0 0-.01M11 21l1.7-6.2-2.7-2.6 1-4.7 3.2 2 2.8.5M9 9.5l-3 1.8M12.7 14.8l3 3.2V21",
  },
  fence: {
    color: "#8b7355",
    d: "M4 21V7l2-3 2 3v14M10 21V7l2-3 2 3v14M16 21V7l2-3 2 3v14M3 12h18M3 17h18",
  },
  gate: {
    color: "#8b7355",
    d: "M5 21V5M19 21V5M5 5h14M5 21h14M12 5v16M9.5 13h.01M14.5 13h.01",
  },
  other: {
    color: "#94a3b8",
    d: "M6 12h.01M12 12h.01M18 12h.01",
  },
};

export function kindUi(kind: string): KindUi {
  return KIND_UI[kind] ?? KIND_UI.other;
}

/** Yon paneldagi / ro'yxatdagi chiziq belgisi. */
export function KindIcon({
  kind,
  size = 24,
  className,
}: {
  kind: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={kind === "other" ? 3 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={kindUi(kind).d} />
    </svg>
  );
}

// ── Xaritadagi belgi ─────────────────────────────────────────────────

export const PLACE_ICON_PREFIX = "ondex-place-";
const SIZE = 26;
const RATIO = 2;
export const PLACE_ICON_PIXEL_RATIO = RATIO;

/**
 * Xarita belgisi: oq halqa + turning rangidagi doira + oq belgi.
 * (`poiIcons.ts` bilan bir xil uslub: oq halqa har qanday fonda ajratib turadi.)
 * `null` — tuval mavjud emas (test muhiti).
 */
export function makePlaceIcon(
  kind: string,
): { width: number; height: number; data: Uint8ClampedArray } | null {
  const ui = kindUi(kind);
  const px = SIZE * RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const c = px / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, c - 3.2, 0, Math.PI * 2);
  ctx.fillStyle = ui.color;
  ctx.fill();

  const glyph = 15 * RATIO;
  ctx.save();
  ctx.translate(c - glyph / 2, c - glyph / 2);
  ctx.scale(glyph / 24, glyph / 24);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = kind === "other" ? 3.2 : 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(ui.d));
  ctx.restore();

  return ctx.getImageData(0, 0, px, px);
}
