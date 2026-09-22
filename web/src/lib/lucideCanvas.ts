/**
 * Lucide belgilarini TUVALDA (xarita belgilari) chizish uchun yo'lga aylantiradi.
 *
 * Interfeysdagi belgilar `lucide-react` komponentlari; xaritadagi belgilar esa
 * tuvalda chiziladi (MapLibre'ga `addImage` bilan beriladi). Ikkalasi BIR XIL
 * Lucide ma'lumotidan chiziladi — qo'lda yozilgan yo'l YO'Q, shuning uchun
 * yon paneldagi va xaritadagi belgi hech qachon farq qilmaydi.
 *
 * Lucide belgisi — 24×24 tarmoqda `stroke` bilan chiziladigan oddiy shakllar
 * (`path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `ellipse`); ularning
 * hammasi bitta SVG yo'l matniga (`Path2D`) keltiriladi.
 */
import type { LucideIconData } from "lucide-react";

const cache = new WeakMap<LucideIconData, Path2D>();

const n = (v: unknown, d = 0): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};

/** Bitta Lucide elementi → SVG yo'l matni (`d`). Noma'lum element — bo'sh. */
function elementPath(tag: string, a: Record<string, unknown>): string {
  switch (tag) {
    case "path":
      return String(a.d ?? "");
    case "line":
      return `M${n(a.x1)} ${n(a.y1)}L${n(a.x2)} ${n(a.y2)}`;
    case "polyline":
    case "polygon": {
      const pts = String(a.points ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (pts.length < 4 || pts.some((p) => !Number.isFinite(p))) return "";
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return tag === "polygon" ? `${d}Z` : d;
    }
    case "circle": {
      const [cx, cy, r] = [n(a.cx), n(a.cy), n(a.r)];
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = [n(a.cx), n(a.cy), n(a.rx), n(a.ry)];
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    }
    case "rect": {
      const [x, y, w, h] = [n(a.x), n(a.y), n(a.width), n(a.height)];
      const rx = Math.min(n(a.rx, n(a.ry)), w / 2);
      const ry = Math.min(n(a.ry, rx), h / 2);
      if (rx === 0 && ry === 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return (
        `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}` +
        `a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}` +
        `v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`
      );
    }
    default:
      return "";
  }
}

/** Belgining 24×24 tarmoqdagi yo'li (`ctx.stroke(...)` bilan chiziladi). */
export function lucidePath(icon: LucideIconData): Path2D {
  let p = cache.get(icon);
  if (!p) {
    let d = "";
    const walk = (nodes: LucideIconData["node"]) => {
      for (const [tag, attrs, children] of nodes) {
        d += elementPath(tag, attrs as Record<string, unknown>);
        if (children) walk(children);
      }
    };
    walk(icon.node);
    p = new Path2D(d);
    cache.set(icon, p);
  }
  return p;
}
