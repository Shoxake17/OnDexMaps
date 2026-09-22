"use client";

/**
 * Xarita belgisi (doira) — OnDexMap ob'ektlari (`kindUi.tsx`) VA OSM'dan kelgan
 * joylar (`poiIcons.ts`) uchun YAGONA chizuvchi. Ikkalasi bir xil o'lcham, bir xil
 * halqa va bir xil chiziq qalinligida chiziladi — xaritada «OnDexMap belgisi» va
 * «OSM belgisi» degan farq qolmaydi (foydalanuvchi talabi).
 *
 * O'lcham `image/image.png` (Yandex «Кафе») bo'yicha: doira 20 px, ichida 12 px belgi.
 * Belgi shakli — Lucide (`lib/lucideCanvas.ts`) yoki bitta harf (avtoturargoh «P»).
 */

import type { LucideIconData } from "lucide-react";

import { lucidePath } from "@/lib/lucideCanvas";

/** Doira diametri (CSS px). */
export const BADGE_SIZE = 20;
/** Doira ichidagi belgi (CSS px) va uning chizig'i (24 birlikli tarmoqda). */
export const BADGE_GLYPH = 12;
export const BADGE_STROKE = 2.3;
/** Tuvalni shuncha marta zich chizamiz (MapLibre'ga `pixelRatio` sifatida beriladi). */
export const BADGE_RATIO = 2;

export type IconImage = { width: number; height: number; data: Uint8ClampedArray };

/** `w`×`h` CSS px li tuval (RATIO baravar zich). `null` — tuval yo'q (test muhiti). */
export function iconCanvas(w: number, h: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement("canvas");
  canvas.width = w * BADGE_RATIO;
  canvas.height = h * BADGE_RATIO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(BADGE_RATIO, BADGE_RATIO);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  return ctx;
}

export const readIcon = (ctx: CanvasRenderingContext2D, w: number, h: number): IconImage =>
  ctx.getImageData(0, 0, w * BADGE_RATIO, h * BADGE_RATIO);

/** Lucide belgisini (24×24) `box`×`box` CSS px ga, (`x`,`y`) burchagidan boshlab chizadi. */
export function strokeGlyph(
  ctx: CanvasRenderingContext2D,
  data: LucideIconData,
  x: number,
  y: number,
  box: number,
  color: string,
  width: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(box / 24, box / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(lucidePath(data));
  ctx.restore();
}

export interface BadgeSpec {
  /** Doira rangi. */
  color: string;
  /** Lucide belgisi. */
  data?: LucideIconData;
  /** Belgi o'rniga bitta harf (avtoturargoh — «P»). */
  letter?: string;
  /** Belgi chizig'i qalinligi (standart `BADGE_STROKE`). */
  stroke?: number;
}

/** Oq halqali, rangli doira ichida oq belgi (yoki harf). */
export function makeBadge(spec: BadgeSpec): IconImage | null {
  const S = BADGE_SIZE;
  const ctx = iconCanvas(S, S);
  if (!ctx) return null;
  const c = S / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, c - 1.25, 0, Math.PI * 2);
  ctx.fillStyle = spec.color;
  ctx.fill();

  if (spec.letter) {
    const font = Math.round(S * 0.66);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${font}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // Bosh harf balandligi ≈ 0.72 × shrift: vertikal markazga qo'yish.
    ctx.fillText(spec.letter, c, c + font * 0.36);
  } else if (spec.data) {
    strokeGlyph(ctx, spec.data, c - BADGE_GLYPH / 2, c - BADGE_GLYPH / 2, BADGE_GLYPH, "#ffffff", spec.stroke ?? BADGE_STROKE);
  }
  return readIcon(ctx, S, S);
}

/** `#rrggbb` rangni `f` (0..1) ulushga qoraytiradi — nom yozuvi belgi rangida, lekin to'qroq. */
export function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - f));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Nom yozuvi: belgi rangining to'qroq varianti (`image/image.png` dagi «Кафе» kabi). */
export const LABEL_DARKEN = 0.32;

// ── PNG pin (foydalanuvchi bergan, `image/geologo/`) ───────────────────
//
// ┌─ NEGA ALOHIDA YO'L ────────────────────────────────────────────────
// Ba'zi turkumlar uchun Lucide o'rniga HAQIQIY PNG rasm ishlatiladi
// (Yandex/Google kabi rangli pin). OnDexMap ob'ektlari (`kindUi.tsx`) VA
// OSM joylari (`poiIcons.ts`) BIR XIL rasmdan foydalanadi — shuning uchun
// yuklovchi shu yerda, ikkalasi ham shu funksiyani chaqiradi (manbasidan
// qat'i nazar bitta pin, bitta kesh).
// └────────────────────────────────────────────────────────────────────

/** Tuvalga chiziladigan pin o'lchami (CSS px) — doira belgilardan kattaroq: rasmda tafsilot ko'p. */
export const PIN_SIZE = 30;

const pinCache = new Map<string, Promise<IconImage | null>>();

/**
 * PNG pin belgisini (`/org-icons/<nom>.png`) yuklab, tuvalga chizadi.
 * Natija KESHLANADI — bir manba faqat bir marta yuklanadi (ikkala
 * chaqiruvchi ham shu keshni bo'lishadi). Yuklanmasa (404, tarmoq) —
 * `null`, chaqiruvchi Lucide belgisiga tushadi.
 *
 * ┌─ NISBAT SAQLANADI (cho'zilish TUZATILDI) ──────────────────────────
 * `image/geologo/`dagi rasmlar HAR XIL o'lchamda keladi (masalan cafe.png
 * 142×156 — tik, kasalxona.png 131×110 — yotiq). Ilgari hammasi kvadrat
 * tuvalga TENGLAB (cho'zib) chizilardi — shuning uchun yotiqroq rasmlar
 * (shifoxona, dorixona) tikka "cho'zilgan" bo'lib ko'rinardi, kvadratga
 * mahkam sig'dirilgani uchun. Endi rasm o'z nisbatini SAQLAYDI («contain»
 * — CSS'dagi kabi): kattaroq tomoni to'liq tuvalga sig'adi, kichikroq
 * tomoni MARKAZLASHTIRILADI (shaffof bo'shliq bilan) — hech qanday
 * buzilish yo'q, hamma pin BIR XIL ramkada (`PIN_SIZE`×`PIN_SIZE`).
 * └────────────────────────────────────────────────────────────────────
 */
export function loadPngPin(src: string): Promise<IconImage | null> {
  let p = pinCache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ctx = iconCanvas(PIN_SIZE, PIN_SIZE);
        if (!ctx) return resolve(null);
        const scale = Math.min(PIN_SIZE / img.width, PIN_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (PIN_SIZE - w) / 2;
        const y = (PIN_SIZE - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        resolve(readIcon(ctx, PIN_SIZE, PIN_SIZE));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    pinCache.set(src, p);
  }
  return p;
}
