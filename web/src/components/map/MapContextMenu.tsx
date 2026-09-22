"use client";

/**
 * Xaritada sichqonchaning O'NG tugmasi bosilganda chiqadigan menyu
 * (Yandex namunasi, `image/image.png`): «Bu yerda nima bor?», marshrut
 * («bu yerga» / «bu yerdan»), lineyka va koordinatani nusxalash.
 *
 * ┌─ QAYSI BANDLAR ATAYLAB YO'Q ───────────────────────────────────────
 * Namunada «Saqlash» va «Xaritani tahrirlash» ham bor. Ular chizilmadi:
 * saqlash uchun foydalanuvchi akkaunti, tahrirlash uchun mavjud ob'ektni
 * o'zgartirish jarayoni kerak — ikkalasi ham hali YO'Q. Ishlamaydigan
 * tugma soxta imkoniyat va'da qiladi.
 *
 * «Ob'ekt qo'shish» FAQAT server qabul qilishni yoqqan bo'lsa chiqadi
 * (`onAddObject` berilganda) — o'chiq bo'lsa band umuman ko'rinmaydi.
 * └──────────────────────────────────────────────────────────────────
 *
 * ┌─ XAVFSIZLIK ───────────────────────────────────────────────────────
 * • Menyudagi HAR BIR matn — o'zimizning doimiy satrlar yoki xarita
 *   hodisasidan kelgan SONLAR. Foydalanuvchi/server matni bu yerda
 *   chizilmaydi (`dangerouslySetInnerHTML` yo'q).
 * • Yangi tarmoq so'rovi qo'shilmaydi: amallar mavjud vositalarni
 *   (`useMapTools`) chaqiradi, ular hudud tekshiruvini o'zi qiladi.
 * • Nusxalash faqat koordinatani yozadi; ruxsat berilmasa jimgina
 *   «nusxalab bo'lmadi» deydi.
 * └──────────────────────────────────────────────────────────────────
 */

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleQuestionMark,
  Copy,
  MapPinPlus,
  Ruler,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MLMap, MapMouseEvent } from "maplibre-gl";

import type { LngLat } from "@/lib/geo";
import { fmtCoord } from "./useMapTools";

/** Menyu o'lchami (piksel). Joylashuvni hisoblash uchun DOIMIY: qarang `place`. */
const MENU_W = 288;
/** Bandlar: har biri 48 px, nusxalash bandi 56 px, tepa-past 8 px dan. */
const ITEM_H = 48;
const COPY_H = 56;
const PAD = 16;
/** 4 band (nima bor, bu yerga, bu yerdan, lineyka) + «Ob'ekt qo'shish» bo'lsa 5 + nusxalash. */
function menuHeight(hasAdd: boolean): number {
  return PAD + ITEM_H * (hasAdd ? 5 : 4) + COPY_H;
}
/** Menyu xarita chetidan shuncha piksel narida qoladi. */
const EDGE = 8;
/** O'ng tugma bilan shuncha pikseldan ko'p surilsa — bu burish, menyu emas. */
const DRAG_TOLERANCE = 5;

interface OpenMenu {
  /** Menyu chap-yuqori burchagi (xarita tuvaliga nisbatan). */
  x: number;
  y: number;
  /** Bosilgan joyning koordinatasi. */
  p: LngLat;
  /** Bosilgan joyning ekrandagi nuqtasi (obyekt nomini topish uchun). */
  screen: { x: number; y: number };
}

interface Props {
  map: MLMap | null;
  onWhatsHere: (p: LngLat, screen: { x: number; y: number }) => void;
  onRouteTo: (p: LngLat, screen: { x: number; y: number }) => void;
  onRouteFrom: (p: LngLat, screen: { x: number; y: number }) => void;
  onMeasure: (p: LngLat) => void;
  /**
   * «Ob'ekt qo'shish». Berilmasa band CHIQMAYDI: server qabul qilishni
   * yoqmagan bo'lsa ishlamaydigan tugma ko'rsatilmaydi.
   */
  onAddObject?: (p: LngLat) => void;
}

/**
 * Menyu o'ng-pastga ochiladi; chetga sig'masa KURSORNING boshqa tomoniga
 * o'tadi (Yandex kabi) — shunda u bosilgan nuqtani yopib qo'ymaydi.
 */
function place(x: number, y: number, w: number, h: number, menuH: number) {
  const left = x + MENU_W + EDGE > w ? x - MENU_W : x;
  const top = y + menuH + EDGE > h ? y - menuH : y;
  return {
    x: Math.max(EDGE, left),
    y: Math.max(EDGE, top),
  };
}

/** Menyu bandlarining Lucide belgi sozlamalari. */
const ICON = { size: 24, strokeWidth: 2, className: "shrink-0" } as const;

const ITEM =
  "flex w-full items-center gap-4 px-5 text-left text-[16px] text-zinc-900 outline-none transition hover:bg-zinc-100 focus-visible:bg-zinc-100 active:bg-zinc-200";

export default function MapContextMenu({
  map,
  onWhatsHere,
  onRouteTo,
  onRouteFrom,
  onMeasure,
  onAddObject,
}: Props) {
  const hasAdd = onAddObject !== undefined;
  const menuH = menuHeight(hasAdd);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  // Nusxalash natijasi: menyu yopilishidan oldin bir lahza ko'rsatiladi.
  const [note, setNote] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setMenu(null);
    setNote(null);
  }, []);

  // Xaritaning o'ng tugma hodisasi.
  useEffect(() => {
    if (!map) return;

    // O'ng tugma bilan SURISH xaritani buradi (MapLibre). Windows'da
    // brauzer `contextmenu` ni surishdan keyin ham yuboradi — shuning uchun
    // tugma bosilgan joy eslab qolinadi va surilgan bo'lsa menyu ochilmaydi.
    let down: { x: number; y: number } | null = null;

    const onDown = (e: MapMouseEvent) => {
      down =
        e.originalEvent.button === 2
          ? { x: e.originalEvent.clientX, y: e.originalEvent.clientY }
          : null;
    };

    const onContext = (e: MapMouseEvent) => {
      // Brauzerning o'z menyusi chiqmasin.
      e.originalEvent.preventDefault();

      const moved =
        down !== null &&
        Math.hypot(
          e.originalEvent.clientX - down.x,
          e.originalEvent.clientY - down.y,
        ) > DRAG_TOLERANCE;
      down = null;
      if (moved) return;

      const { lat, lng } = e.lngLat;
      // Sonlar chekli bo'lmasa (xarita ichki xatosi) menyu ochilmaydi.
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const c = map.getContainer();
      const at = place(e.point.x, e.point.y, c.clientWidth, c.clientHeight, menuH);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setNote(null);
      setMenu({
        ...at,
        p: { lat, lng },
        screen: { x: e.point.x, y: e.point.y },
      });
    };

    map.on("mousedown", onDown);
    map.on("contextmenu", onContext);
    // Xarita surilsa, masshtab o'zgarsa yoki chap tugma bosilsa — yopiladi
    // (menyu ko'rsatayotgan nuqta endi joyida emas).
    map.on("movestart", close);
    map.on("click", close);
    map.on("resize", close);
    return () => {
      map.off("mousedown", onDown);
      map.off("contextmenu", onContext);
      map.off("movestart", close);
      map.off("click", close);
      map.off("resize", close);
    };
  }, [map, close, menuH]);

  // Menyu ochiq turganda: Escape, tashqariga bosish, oyna o'zgarishi.
  useEffect(() => {
    if (!menu) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
      map?.getCanvas().focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) {
        return;
      }
      close();
    };

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    // Klaviatura (↑ ↓ Enter) darhol ishlashi uchun fokus menyuga o'tadi.
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [menu, map, close]);

  // Kutilayotgan taymer komponent o'chganda tozalanadi.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!menu) return null;

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  const copy = async () => {
    let text = "";
    try {
      await navigator.clipboard.writeText(fmtCoord(menu.p));
      text = "Nusxalandi";
    } catch {
      // Ruxsat berilmagan yoki xavfsiz bo'lmagan sahifa (http) — jimgina rad.
      text = "Nusxalab bo'lmadi";
    }
    setNote(text);
    timer.current = setTimeout(close, 1100);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (e.key === "ArrowDown") next = i < 0 ? 0 : (i + 1) % items.length;
    else if (e.key === "ArrowUp") next = i <= 0 ? items.length - 1 : i - 1;
    else if (e.key === "End") next = items.length - 1;
    items[next].focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Xarita amallari"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      // Menyu ustida brauzerning o'z o'ng tugma menyusi chiqmasin.
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: menu.x, top: menu.y, width: MENU_W }}
      className="absolute z-40 overflow-hidden rounded-xl bg-white py-2 shadow-[0_4px_24px_rgba(0,0,0,0.22)] outline-none"
    >
      <button
        type="button"
        role="menuitem"
        className={`${ITEM} h-12`}
        onClick={run(() => onWhatsHere(menu.p, menu.screen))}
      >
        <CircleQuestionMark {...ICON} />
        Bu yerda nima bor?
      </button>

      <button
        type="button"
        role="menuitem"
        className={`${ITEM} h-12`}
        onClick={run(() => onRouteTo(menu.p, menu.screen))}
      >
        <ArrowDownToLine {...ICON} />
        Bu yerga marshrut
      </button>

      <button
        type="button"
        role="menuitem"
        className={`${ITEM} h-12`}
        onClick={run(() => onRouteFrom(menu.p, menu.screen))}
      >
        <ArrowUpFromLine {...ICON} />
        Bu yerdan marshrut
      </button>

      {onAddObject && (
        <button
          type="button"
          role="menuitem"
          className={`${ITEM} h-12`}
          onClick={run(() => onAddObject(menu.p))}
        >
          <MapPinPlus {...ICON} />
          Ob&apos;ekt qo&apos;shish
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        className={`${ITEM} h-12`}
        onClick={run(() => onMeasure(menu.p))}
      >
        <Ruler {...ICON} />
        Lineyka
      </button>

      <button
        type="button"
        role="menuitem"
        className={`${ITEM} h-14`}
        onClick={() => void copy()}
      >
        <Copy {...ICON} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{note ?? "Koordinatani nusxalash"}</span>
          <span className="truncate text-xs text-zinc-500">
            {fmtCoord(menu.p)}
          </span>
        </span>
      </button>
    </div>
  );
}
