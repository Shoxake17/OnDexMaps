"use client";

/**
 * Mobil ko'rinish (Yandex `mobilemap.png`): to'liq ekran xarita, ustida
 * suzuvchi yumaloq tugmalar va pastdan tortiladigan panel.
 *
 * ┌─ JOYLASHUV (rasmdagi kabi) ─────────────────────────────────────────
 *  yuqori-chap : menyu (panelni to'liq ochadi)
 *  yuqori-o'ng : qatlam (sun'iy yo'ldosh) · 3D/2D · ob-havo
 *  o'ng-o'rta  : + / −
 *  chap-o'rta  : vertikal masshtab (qizil belgi bilan)
 *  pastki panel: tutqich · qidiruv · lineyka · turkumlar
 *  panel USTIDA: marshrut (chap) · joylashuv (o'ng)
 * └──────────────────────────────────────────────────────────────────
 *
 * ⚠️ HALOLLIK: rasmdagi lekin bizda YO'Q narsalar (Alisa, saqlangan joylar,
 * ilovalar) chizilmaydi. Har bir tugma haqiqiy amal bajaradi: rasmdagi
 * «saqlanganlar» tugmasi o'rnida — lineyka, «Alisa» o'rnida — OnDexMap belgisi.
 *
 * Panelning uch holati: `peek` (qidiruv + turkumlar cheti), `half` (marshrut
 * paytida xarita ustida ko'rinib turishi uchun), `full` (qidiruv/menyu).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useMap } from "@/components/map/MapProvider";
import { useGeolocate } from "@/components/map/useGeolocate";
import type { ToolMode } from "@/components/map/useMapTools";
import { useWeather, WeatherIcon } from "@/components/panels/CityHeader";

export type SheetState = "peek" | "half" | "full";

/** Panelning yig'ilgan balandligi (px): tutqich + qidiruv qatori + turkumlar cheti. */
const PEEK_PX = 156;
/** `full` da tepada qoladigan bo'shliq (px): xarita chetini ko'rsatib turadi. */
const FULL_GAP_PX = 64;

/** Suzuvchi tugma: yorug' mavzuda oq, qorong'i mavzuda to'q (rasmdagi kabi). */
const FAB =
  "flex items-center justify-center rounded-2xl bg-white text-zinc-800 shadow-[0_2px_10px_rgba(0,0,0,0.22)] transition active:scale-95 dark:bg-[#22242c]/95 dark:text-white dark:shadow-[0_2px_12px_rgba(0,0,0,0.55)]";
const FAB_ON = "!bg-blue-50 !text-[#2f6bff] dark:!bg-[#2f6bff] dark:!text-white";

interface Props {
  mode: ToolMode;
  onMode: (m: ToolMode) => void;
  sheet: SheetState;
  onSheet: (s: SheetState) => void;
  /** Qidiruv maydoni (pastki panelda). */
  search: ReactNode;
  /** Panel tarkibi: turkumlar, ma'lumot yoki marshrut. */
  content: ReactNode;
  /** Lineyka natijasi (o'lchash rejimida tepada ko'rinadi). */
  measure: { text: string; points: number; onClear: () => void };
  /** Marshrut rejimini yoqish/o'chirish. */
  onRoute: () => void;
}

export default function MobileChrome({
  mode,
  onMode,
  sheet,
  onSheet,
  search,
  content,
  measure,
  onRoute,
}: Props) {
  const { map, satelliteAvailable, satellite, toggleSatellite, is3D, toggle3D } = useMap();
  const { locate, tracking, toast } = useGeolocate();
  const weather = useWeather();

  // Panel balandligi: px (holatga qarab) — sudralayotganda oraliq qiymat.
  const [vh, setVh] = useState(() => window.innerHeight);
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const heights: Record<SheetState, number> = {
    peek: PEEK_PX,
    half: Math.round(vh * 0.5),
    full: vh - FULL_GAP_PX,
  };
  const h = dragH ?? heights[sheet];

  const nearest = useCallback(
    (px: number): SheetState => {
      let best: SheetState = "peek";
      let bestD = Infinity;
      for (const s of ["peek", "half", "full"] as const) {
        const d = Math.abs(px - heights[s]);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vh],
  );

  // Tutqichdan tortish: barmoq bilan panel balandligini o'zgartiradi, qo'yib
  // yuborilganda eng yaqin holatga "yopishadi". Qisqa bosish — ochish/yopish.
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h, moved: false };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 5) d.moved = true;
    if (d.moved) setDragH(Math.max(PEEK_PX, Math.min(heights.full, d.h + dy)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) onSheet(nearest(dragH ?? d.h));
    else onSheet(sheet === "peek" ? "full" : "peek");
    setDragH(null);
  };

  const measuring = mode === "measure";
  const routing = mode === "route";
  const expanded = sheet === "full";

  return (
    <>
      {/* ── Yuqori-chap: menyu ────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Menyu"
        onClick={() => onSheet(expanded ? "peek" : "full")}
        className={`${FAB} absolute left-3 top-3 z-20 h-12 w-12`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* ── Yuqori-o'ng: qatlam · 3D/2D · ob-havo ──────────────────── */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-3">
        {satelliteAvailable && (
          <button
            type="button"
            aria-label="Sun'iy yo'ldosh"
            aria-pressed={satellite}
            onClick={toggleSatellite}
            className={`${FAB} h-12 w-12 ${satellite ? FAB_ON : ""}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
              <rect x="8" y="3" width="13" height="13" rx="2.5" />
              <path d="M16 16v2.5a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 18.5v-8A2.5 2.5 0 0 1 5.5 8H8" />
            </svg>
          </button>
        )}
        {/* Yozuv HOLATNI ko'rsatadi («3D» yoki «2D»), maqsadni emas. */}
        <button
          type="button"
          aria-label={is3D ? "3D ko'rinish (2D ga o'tish)" : "2D ko'rinish (3D ga o'tish)"}
          onClick={toggle3D}
          className={`${FAB} h-12 w-12 text-[15px] font-bold`}
        >
          {is3D ? "3D" : "2D"}
        </button>
        {weather && (
          <div
            className={`${FAB} h-[52px] w-12 flex-col gap-0.5 text-[13px] font-semibold leading-none`}
            aria-label={`Harorat ${Math.round(weather.tempC)} daraja`}
          >
            <WeatherIcon code={weather.code} />
            {Math.round(weather.tempC)}°
          </div>
        )}
      </div>

      {/* ── O'ng-o'rta: + / − ─────────────────────────────────────── */}
      {/* Faqat yig'ilgan panelda: yarim ochiq panel ularning pastki qismini yopardi. */}
      {sheet === "peek" && (
        <div className="absolute right-3 top-[46%] z-20 flex -translate-y-1/2 flex-col gap-2.5">
          <button type="button" aria-label="Yaqinlashtirish" onClick={() => map?.zoomIn({ duration: 250 })} className={`${FAB} h-12 w-12`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button type="button" aria-label="Uzoqlashtirish" onClick={() => map?.zoomOut({ duration: 250 })} className={`${FAB} h-12 w-12`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      )}

      {sheet === "peek" && <MobileScale />}

      {/* ── Lineyka natijasi (o'lchash rejimida) ───────────────────── */}
      {measuring && (
        <div className={`${FAB} absolute left-1/2 top-3 z-20 h-12 -translate-x-1/2 gap-3 px-4 text-[15px] font-semibold`}>
          <span>{measure.points < 2 ? "Nuqtalarni bosing" : measure.text}</span>
          {measure.points > 0 && (
            <button type="button" aria-label="Chizmani tozalash" onClick={measure.onClear} className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 dark:text-zinc-300">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Pastki panel ──────────────────────────────────────────── */}
      <section
        aria-label="Qidiruv va joylar"
        style={{
          height: h,
          transition: dragH === null ? "height 220ms cubic-bezier(.2,.8,.2,1)" : "none",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[22px] bg-white shadow-[0_-4px_18px_rgba(0,0,0,0.18)] dark:bg-[#1c1d24] dark:shadow-[0_-4px_22px_rgba(0,0,0,0.6)]"
      >
        {/* Panel USTIDAGI tugmalar: panel bilan birga siljiydi. */}
        <div
          className={`pointer-events-none absolute inset-x-3 -top-[64px] flex items-end justify-between transition-opacity ${
            expanded ? "opacity-0" : "opacity-100"
          }`}
        >
          <button
            type="button"
            aria-label={routing ? "Marshrutni yopish" : "Marshrut"}
            aria-pressed={routing}
            onClick={onRoute}
            className={`${FAB} pointer-events-auto h-12 w-12 ${routing ? FAB_ON : ""} ${expanded ? "invisible" : ""}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <circle cx="6" cy="19" r="2.5" />
              <circle cx="18" cy="5" r="2.5" />
              <path d="M8.5 19h6a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Mening joylashuvim"
            aria-pressed={tracking}
            onClick={locate}
            className={`${FAB} pointer-events-auto h-[54px] w-[54px] !rounded-full ${tracking ? FAB_ON : ""} ${expanded ? "invisible" : ""}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3.5 11.2 20.5 3.5l-7.7 17-1.9-7.4z" />
            </svg>
          </button>
        </div>

        {toast && (
          <p
            role="status"
            className="absolute -top-[120px] left-1/2 max-w-[80%] -translate-x-1/2 rounded-xl bg-zinc-900/90 px-3 py-2 text-center text-[13px] leading-snug text-white shadow-lg"
          >
            {toast}
          </p>
        )}

        {/* Tutqich: bosilsa ochadi/yopadi, tortilsa balandlikni o'zgartiradi. */}
        <div
          role="button"
          tabIndex={0}
          aria-label={sheet === "peek" ? "Panelni ochish" : "Panelni yopish"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSheet(sheet === "peek" ? "full" : "peek");
          }}
          className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center"
        >
          {/* To'g'ri gorizontal chiziq (Yandex `image.png`): chevron emas.
              Holatga qarab shakli o'zgarmaydi — tortish/bosish ishora qiladi. */}
          <span className="h-[5px] w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />
        </div>

        {/* Aylantirish chizig'i yashirin: u qorong'i mavzuda oq va qidiruv paytida
            tarkibni chapga surib qo'yardi. Barmoq bilan aylantirish ishlayveradi. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {routing ? (
            // Marshrut rejimi: qidiruv o'rniga sarlavha va yopish tugmasi.
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <h2 className="text-[19px] font-bold text-zinc-900 dark:text-white">Marshrut</h2>
              <button type="button" aria-label="Marshrutni yopish" onClick={onRoute} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-[#2b2c35] dark:text-zinc-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">{search}</div>
              {/* Rasmdagi «saqlanganlar» tugmasi o'rnida — lineyka (haqiqiy amal). */}
              <button
                type="button"
                aria-label="Masofa o'lchash"
                aria-pressed={measuring}
                onClick={() => onMode(measuring ? "idle" : "measure")}
                className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-800 dark:bg-[#2b2c35] dark:text-white ${measuring ? FAB_ON : ""}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <g transform="rotate(-45 12 12)">
                    <rect x="1.5" y="8" width="21" height="8" rx="1.8" />
                    <path d="M6 8v3.2M10 8v2M14 8v3.2M18 8v2" />
                  </g>
                </svg>
              </button>
            </div>
          )}

          <div className="mt-3">{content}</div>
        </div>
      </section>
    </>
  );
}

/**
 * Vertikal masshtab (rasmdagi «2,3 км»): chiziq balandligi masofani aniq
 * ko'rsatadi, pastida qizil belgi. Hisob MapLibre'nikidek: bir piksel necha
 * metr — kenglik va zoomdan (512 px dunyo).
 */
function MobileScale() {
  const { map } = useMap();
  const [s, setS] = useState<{ px: number; label: string } | null>(null);

  useEffect(() => {
    if (!map) return;
    const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
    const MAX_PX = 110;
    const update = () => {
      const lat = map.getCenter().lat;
      const mpp = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      let d = NICE[0];
      for (const n of NICE) if (n / mpp <= MAX_PX) d = n;
      const px = Math.round(d / mpp);
      const label = d >= 1000 ? `${d / 1000} km` : `${d} m`;
      setS((prev) => (prev && prev.px === px && prev.label === label ? prev : { px, label }));
    };
    update();
    map.on("move", update);
    return () => {
      map.off("move", update);
    };
  }, [map]);

  if (!s) return null;
  return (
    <div className="pointer-events-none absolute left-3 top-[46%] z-10 flex -translate-y-1/2 items-center gap-2">
      <div className="relative w-[3px] rounded-full bg-zinc-800 dark:bg-zinc-100" style={{ height: s.px }}>
        <span className="absolute -bottom-2 -left-[6px] flex h-[15px] w-[15px] items-center justify-center rounded-md bg-red-500">
          <span className="h-[2px] w-[7px] rounded bg-white" />
        </span>
      </div>
      <span className="text-[13px] font-semibold text-zinc-800 [text-shadow:0_0_3px_#fff,0_0_3px_#fff] dark:text-white dark:[text-shadow:0_0_3px_#000,0_0_3px_#000]">
        {s.label}
      </span>
    </div>
  );
}
