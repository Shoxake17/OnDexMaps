"use client";

/**
 * Ob'ekt turlarining ko'rinishi: belgi (yon panel va xarita), rang.
 *
 * ┌─ BELGILAR — LUCIDE ────────────────────────────────────────────────
 * Belgilar `lucide-react` kutubxonasidan; qo'lda chizilgan yo'l YO'Q.
 * Yon paneldagi belgi React komponenti, xaritadagi belgi esa AYNAN SHU
 * belgining ma'lumotidan tuvalda chiziladi (`lib/lucideCanvas.ts`) — ikki xil
 * «avtoturargoh» bo'lib qolmaydi. Yangi belgi kerak bo'lsa: Lucide'dan nomini
 * toping (https://lucide.dev/icons) va `KIND_UI` ga qo'shing.
 *
 * YAGONA ISTISNO — SHLAGBAUM: u `image/shlagboun.png` ga BIRGA BIR o'xshash bo'lishi
 * kerak (poydevorli ustun + uch bo'lakli to'sin), Lucide'da esa bunday belgi yo'q.
 * Shuning uchun u `BarrierArt` da chiziladi; yon panel (SVG) ham, xarita (tuvali)
 * ham BIR XIL o'lchamlardan (`BARRIER`) foydalanadi.
 * └────────────────────────────────────────────────────────────────────
 *
 * ┌─ O'LCHAM ──────────────────────────────────────────────────────────
 * Barcha ob'ekt belgilari xaritadagi OSM/POI belgilar bilan AYNAN TENG va bir xil
 * chizuvchidan (`components/map/markerBadge.ts`): 20 px doira, oq halqa, 12 px oq belgi.
 * Faqat bino kirishi ataylab o'ta kichik (`image/kirish.png`, talab).
 * └────────────────────────────────────────────────────────────────────
 *
 * Tur KALITLARI serverdan (`internal/places/kinds.go`); bu yerda faqat
 * ularning KO'RINISHI. Serverda yangi tur paydo bo'lib bu yerda yo'q bo'lsa,
 * u `other` belgisi bilan chiziladi (yiqilmaydi).
 */

import type { LucideIcon, LucideIconData } from "lucide-react";
// `building-2` — eski nom (taxallus), haqiqiy modul `building-complex`.
import BuildingIcon, { __iconData as buildingData } from "lucide-react/dist/esm/icons/building-complex.mjs";
import BusIcon, { __iconData as busData } from "lucide-react/dist/esm/icons/bus-front.mjs";
import DoorIcon, { __iconData as doorData } from "lucide-react/dist/esm/icons/door-closed.mjs";
import EllipsisIcon, { __iconData as ellipsisData } from "lucide-react/dist/esm/icons/ellipsis.mjs";
import FenceIcon, { __iconData as fenceData } from "lucide-react/dist/esm/icons/fence.mjs";
import FootprintsIcon, { __iconData as footprintsData } from "lucide-react/dist/esm/icons/footprints.mjs";
import LogInIcon, { __iconData as logInData } from "lucide-react/dist/esm/icons/log-in.mjs";
import PinHouseIcon, { __iconData as pinHouseData } from "lucide-react/dist/esm/icons/map-pin-house.mjs";
import SignpostIcon, { __iconData as signpostData } from "lucide-react/dist/esm/icons/signpost.mjs";
import ParkingIcon, { __iconData as parkingData } from "lucide-react/dist/esm/icons/square-parking.mjs";

import {
  BADGE_RATIO,
  BADGE_SIZE,
  LABEL_DARKEN,
  darken,
  iconCanvas,
  loadPngPin,
  makeBadge,
  readIcon,
  strokeGlyph,
  type IconImage,
} from "@/components/map/markerBadge";

export interface KindUi {
  /** Xaritadagi doira rangi. */
  color: string;
  /** Lucide komponenti (yon panel). */
  Icon: LucideIcon;
  /** Xuddi shu belgining ma'lumoti (xarita tuvali). */
  data: LucideIconData;
  /**
   * Xaritada belgi o'rniga bitta HARF chiziladi (avtoturargoh — «P»): xaritalarda
   * odatiy belgi, va u boshqa belgilar kabi doira ichida ixcham turadi.
   */
  letter?: string;
}

const KIND_UI: Record<string, KindUi> = {
  organization: { color: "#2f6bff", Icon: BuildingIcon, data: buildingData },
  address: { color: "#6b7280", Icon: PinHouseIcon, data: pinHouseData },
  entrance: { color: "#6b7280", Icon: LogInIcon, data: logInData },
  road: { color: "#64748b", Icon: SignpostIcon, data: signpostData },
  // Shlagbaum: xaritada va panelda `BarrierArt` (Lucide emas — yuqoridagi izohga qarang).
  barrier: { color: "#8f8a85", Icon: SignpostIcon, data: signpostData },
  stop: { color: "#3178e2", Icon: BusIcon, data: busData },
  // Avtoturargoh: xaritada «P» harfi (`image/p.png`), panelda Lucide «square-parking».
  parking: { color: "#3b82f6", Icon: ParkingIcon, data: parkingData, letter: "P" },
  // Piyodalar o'tish joyi xaritada ZEBRA bo'lib chiziladi (`usePlacesLayer`); bu belgi
  // yon panel va eski nuqtali yozuvlar uchun.
  crossing: { color: "#64748b", Icon: FootprintsIcon, data: footprintsData },
  fence: { color: "#8b7355", Icon: FenceIcon, data: fenceData },
  // Darvoza (ilgari «Kalitka»).
  gate: { color: "#8b7355", Icon: DoorIcon, data: doorData },
  other: { color: "#94a3b8", Icon: EllipsisIcon, data: ellipsisData },
};

export function kindUi(kind: string): KindUi {
  return KIND_UI[kind] ?? KIND_UI.other;
}

// ── «Tashkilot» turkumi bo'yicha PNG belgi (foydalanuvchi bergan, `image/geologo/`) ──
//
// ┌─ NEGA LUCIDE EMAS ────────────────────────────────────────────────────
// Yuqoridagi qoida («Belgilar = LUCIDE») organization uchun BITTA generik
// bino belgisini beradi — Restoran, Bank, Masjid xaritada BIR XIL ko'k
// bino bo'lib ko'rinardi. Foydalanuvchi buni Yandex/Google kabi HAR
// TURKUM O'Z belgisi bilan ko'rinsin, deb PNG pin-belgilar berdi. Hozircha
// FAQAT quyidagi turkumlar uchun rasm bor; qolganlari generik bino
// belgisida qoladi (`Object.keys(ORG_CATEGORY_ICON)` — to'liq ro'yxat).
//
// ⚠️ YANGI RASM QO'SHISHDA: manba rasmlarning oq chekkasi (halqa) HAR
// XIL QALINLIKDA keladi (turli partiyada yaratilgan) — restoran/kafe
// qalin, ba'zilari (2026-09-22: dorixona/shifokor/stomatolog/mehmonxona)
// juda ingichka edi, 30 px pinda deyarli yo'qolib ketardi. Shuning uchun
// HAR yangi rasm `web/public/org-icons/`ga qo'yishdan OLDIN bir xil
// qalinlikdagi halqa bilan me'yorlashtiriladi (kengaytirish/dilate
// algoritmi, ~4.5% o'lchamdan — vaqtinchalik skript, qayta ishlatiladi).
// └─────────────────────────────────────────────────────────────────────
interface OrgIconDef {
  src: string;
  /** Yorliq matni shu rangda (to'qroq, `LABEL_DARKEN`) — pinning o'z rangiga mos. */
  accent: string;
}

const ORG_CATEGORY_ICON: Record<string, OrgIconDef> = {
  "Restoran": { src: "/org-icons/restaurant.png", accent: "#f2611d" },
  "Kafe": { src: "/org-icons/cafe.png", accent: "#f2611d" },
  "Oziq-ovqat do'koni": { src: "/org-icons/grocery.png", accent: "#f2611d" },
  // `image/geologo/kasalxona.png` / `dorixona.png` — alohida rasmlar
  // (avval `hospitals.png` 20 talik jadvalidan qo'lda kesib olingan edi,
  // endi foydalanuvchi to'g'ridan-to'g'ri alohida fayl bergan — sifatliroq,
  // oq halqasi ham bor).
  "Shifoxona / Klinika": { src: "/org-icons/hospital.png", accent: "#e2231f" },
  "Dorixona": { src: "/org-icons/pharmacy.png", accent: "#e2231f" },
  "Mehmonxona": { src: "/org-icons/hotel.png", accent: "#3c434e" },
  // `library` (kutubxona) uchun OnDexMap'da alohida turkum YO'Q (faqat
  // OSM POI'da) — shuning uchun bu yerda yo'q, `poiIcons.ts`da bor.
  "Maktab": { src: "/org-icons/school.png", accent: "#e6a700" },
  "Kollej / Universitet": { src: "/org-icons/college.png", accent: "#e6a700" },
};

export function hasOrgCategoryIcon(category: string): boolean {
  return category in ORG_CATEGORY_ICON;
}

/**
 * PNG pin belgisini yuklab, tuvalga chizadi (yuklovchi — `markerBadge.ts`,
 * OSM tomoni — `poiIcons.ts` — bilan BIR XIL, bitta umumiy kesh). Turkum
 * uchun rasm yo'q bo'lsa `null` — chaqiruvchi generik bino belgisiga
 * tushadi (`makePlaceIcon`).
 */
export function loadOrgCategoryIcon(category: string): Promise<IconImage | null> | null {
  const def = ORG_CATEGORY_ICON[category];
  return def ? loadPngPin(def.src) : null;
}

/**
 * `icon-image` ifodasi: organization + PNG bor turkum → `org:<turkum>`
 * (`usePlacesLayer`dagi `styleimagemissing` shuni yuklaydi), aks holda
 * oddiy `<tur>` (mavjud yo'l — `makePlaceIcon`).
 */
export function placeIconImageExpr(): unknown[] {
  return [
    "case",
    ["==", ["get", "kind"], "organization"],
    ["concat", PLACE_ICON_PREFIX, "org:", ["coalesce", ["get", "category"], "Boshqa"]],
    ["concat", PLACE_ICON_PREFIX, ["get", "kind"]],
  ];
}

/**
 * PNG pin — pastki uchi bilan nuqtaga tegib turadi (haqiqiy xarita belgisi
 * kabi); qolgan hamma belgi (doira) markazdan joylashadi, o'zgarishsiz.
 */
export function orgIconAnchorExpr(): unknown[] {
  return [
    "case",
    [
      "all",
      ["==", ["get", "kind"], "organization"],
      ["in", ["get", "category"], ["literal", Object.keys(ORG_CATEGORY_ICON)]],
    ],
    "bottom",
    "center",
  ];
}

// ── Shlagbaum (`image/shlagboun.png`) ────────────────────────────────

/**
 * 24×24 tarmoqdagi shakllar: poydevorli ustun (ustki qismi yumaloq), unga
 * o'rnatilgan ko'ndalang to'sin va undagi uchta qorong'i bo'lak, ustunda kichik «oyna».
 * SVG (yon panel) ham, tuval (xarita) ham SHU o'lchamlardan chiziladi.
 */
const BARRIER = {
  post: "M5 18V5.6a2.3 2.3 0 0 1 4.6 0V18z",
  base: { x: 3.2, y: 17.4, w: 8.2, h: 2.8, r: 0.8 },
  arm: { x: 9.6, y: 5.6, w: 11.4, h: 4.4, r: 0.6 },
  blocks: [11.2, 14.4, 17.6].map((x) => ({ x, y: 6.9, w: 2.2, h: 1.8 })),
  window: { x: 6.3, y: 4.6, w: 2, h: 1.3 },
} as const;

/** Yon paneldagi shlagbaum (SVG, `currentColor`). */
function BarrierArt({ size, className }: { size: number; className?: string }) {
  const { base, arm, blocks, window: win } = BARRIER;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d={BARRIER.post} />
      <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={base.r} />
      <rect
        x={arm.x}
        y={arm.y}
        width={arm.w}
        height={arm.h}
        rx={arm.r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      {blocks.map((b) => (
        <rect key={b.x} x={b.x} y={b.y} width={b.w} height={b.h} />
      ))}
      <rect x={win.x} y={win.y} width={win.w} height={win.h} fill="#fff" />
    </svg>
  );
}

/** Yon paneldagi / ro'yxatdagi belgi (rangi `currentColor`). */
export function KindIcon({
  kind,
  size = 24,
  className,
}: {
  kind: string;
  size?: number;
  className?: string;
}) {
  if (kind === "barrier") return <BarrierArt size={size} className={className} />;
  const { Icon } = kindUi(kind);
  return (
    <Icon
      size={size}
      strokeWidth={kind === "other" ? 3 : 1.9}
      aria-hidden="true"
      className={className}
    />
  );
}

// ── Xaritadagi belgi ─────────────────────────────────────────────────

export const PLACE_ICON_PREFIX = "ondex-place-";
export const PLACE_ICON_PIXEL_RATIO = BADGE_RATIO;

/**
 * MapLibre `text-color` ifodasi: har tur nomi o'z belgisi rangida (to'qroq), aynan
 * `image/image.png` dagi «Кафе» kabi (belgi to'q sariq — yozuv to'q sariq-jigarrang).
 */
export function placeLabelColor(): unknown[] {
  const expr: unknown[] = ["match", ["get", "kind"]];
  for (const [kind, ui] of Object.entries(KIND_UI)) {
    if (kind === "organization") continue; // pastda — turkum bo'yicha alohida
    expr.push(kind, darken(ui.color, LABEL_DARKEN));
  }
  expr.push("organization", orgLabelColorExpr());
  expr.push(darken(KIND_UI.other.color, LABEL_DARKEN));
  return expr;
}

/** PNG pin bor turkumlarda yorliq shu belgi rangida (to'qroq), qolganida — generik ko'k. */
function orgLabelColorExpr(): unknown[] {
  const expr: unknown[] = ["match", ["get", "category"]];
  for (const [cat, def] of Object.entries(ORG_CATEGORY_ICON)) expr.push(cat, darken(def.accent, LABEL_DARKEN));
  expr.push(darken(KIND_UI.organization.color, LABEL_DARKEN));
  return expr;
}

/**
 * Xarita belgisi. `null` — tuval mavjud emas (test muhiti). Oddiy turlar OSM
 * joylari (`poiIcons.ts`) bilan BIR XIL chizuvchidan (`makeBadge`) chiziladi.
 */
export function makePlaceIcon(kind: string): IconImage | null {
  if (kind === "entrance") return makeEntranceIcon();
  if (kind === "barrier") return makeBarrierIcon();
  const ui = kindUi(kind);
  return makeBadge({
    color: ui.color,
    data: ui.data,
    letter: ui.letter,
    stroke: kind === "other" ? 3.4 : undefined,
  });
}

/**
 * Shlagbaum — `image/shlagboun.png` ga o'xshash: kulrang ustun, poydevor va uch
 * bo'lakli to'sin, atrofida oq halqa. Balandligi boshqa belgilar bilan teng.
 */
function makeBarrierIcon(): IconImage | null {
  // Shakli siyrak (doira emas), shuning uchun teng ko'rinishi uchun tuval 3 px kattaroq.
  const S = BADGE_SIZE + 3;
  const ctx = iconCanvas(S, S);
  if (!ctx) return null;
  const grey = kindUi("barrier").color;
  const { base, arm, blocks, window: win } = BARRIER;

  ctx.save();
  ctx.scale(S / 24, S / 24);
  const post = new Path2D(BARRIER.post);
  const baseP = new Path2D();
  baseP.roundRect(base.x, base.y, base.w, base.h, base.r);
  const armP = new Path2D();
  armP.roundRect(arm.x, arm.y, arm.w, arm.h, arm.r);

  // 1) oq halqa
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  for (const p of [post, baseP, armP]) {
    ctx.stroke(p);
    ctx.fill(p);
  }
  // 2) ustun va poydevor
  ctx.fillStyle = grey;
  ctx.fill(post);
  ctx.fill(baseP);
  // 3) to'sin: oq maydon, kulrang hoshiya, uch qorong'i bo'lak
  ctx.fillStyle = "#ffffff";
  ctx.fill(armP);
  ctx.strokeStyle = grey;
  ctx.lineWidth = 1.1;
  ctx.stroke(armP);
  ctx.fillStyle = grey;
  for (const b of blocks) ctx.fillRect(b.x, b.y, b.w, b.h);
  // 4) ustundagi oq «oyna»
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(win.x, win.y, win.w, win.h);
  ctx.restore();

  return readIcon(ctx, S, S);
}

/** Bino kirishi belgisi o'lchami (CSS px): o'ta kichik, boshqa belgilardan ham kichik. */
export const ENTRANCE_ICON_SIZE = 13;

/**
 * Bino kirishi — O'TA KICHIK belgi (`image/kirish.png` kabi): kulrang «kirish»
 * belgisi (Lucide `log-in`), atrofida yupqa oq halqa. Doira va yozuv yo'q —
 * xaritada bino devorini bosib ketmasin.
 */
function makeEntranceIcon(): IconImage | null {
  const S = ENTRANCE_ICON_SIZE;
  const ctx = iconCanvas(S, S);
  if (!ctx) return null;
  const ui = kindUi("entrance");
  strokeGlyph(ctx, ui.data, 0.5, 0.5, S - 1, "#ffffff", 5.6);
  strokeGlyph(ctx, ui.data, 0.5, 0.5, S - 1, "#7b7671", 2.8);
  return readIcon(ctx, S, S);
}