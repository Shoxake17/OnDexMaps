"use client";

/**
 * Xaritaning o'ng-o'rtasidagi boshqaruvlar (Yandex `LeftSide.png`):
 * kompas, zoom (+/−) va geolokatsiya.
 *
 * ┌─ NEGA MAPLIBRE'NING TAYYOR BOSHQARUVLARI EMAS ─────────────────────
 * `NavigationControl` va `GeolocateControl` o'z DOM'ini o'zi yaratadi:
 * ularning shakli, o'lchami va belgilarini to'liq o'zgartirib bo'lmaydi.
 * Shuning uchun tugmalar bu yerda o'zimizning dizaynda chiziladi, xarita
 * bilan esa faqat ularning API'si orqali gaplashadi (`zoomIn`, `easeTo`).
 *
 * Geolokatsiyaning murakkab qismi (ruxsat, kuzatish, ko'k nuqta, aniqlik
 * doirasi) MapLibre'da tayyor — shuning uchun `GeolocateControl` xaritaga
 * qo'shiladi, lekin KO'RINMAYDI (`globals.css`) va tugmamiz uni
 * dasturiy `trigger()` qiladi.
 * └──────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from "react";

import {
  BTN_LG,
  OFF,
  PILL,
  SQUARE,
  SQUARE_OFF,
  SQUARE_ON,
} from "@/components/panels/controlStyles";
import { useMap } from "./MapProvider";
import { useGeolocate } from "./useGeolocate";

/** Kompas ko'rinishi uchun eng kichik burilish (daraja). */
const COMPASS_MIN = 1;

export default function MapControls() {
  const { map } = useMap();
  const needle = useRef<SVGSVGElement>(null);
  const [showCompass, setShowCompass] = useState(false);

  // Kompas: igna har kadrda BEVOSITA DOM orqali buriladi (React holatisiz),
  // holat esa faqat ko'rinish chegarasi kesib o'tilganda o'zgaradi —
  // aks holda burilish paytida panel sekundiga 60 marta qayta chizilardi.
  useEffect(() => {
    if (!map) return;
    const sync = () => {
      const b = map.getBearing();
      if (needle.current) needle.current.style.transform = `rotate(${-b}deg)`;
      setShowCompass(Math.abs(b) >= COMPASS_MIN);
    };
    sync();
    map.on("rotate", sync);
    return () => {
      map.off("rotate", sync);
    };
  }, [map]);

  // Geolokatsiya (desktop va mobil tugmalar uchun umumiy hook).
  const { locate, tracking, toast } = useGeolocate();

  return (
    <div
      className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {showCompass && (
        <button
          type="button"
          title="Shimolga qaratish"
          aria-label="Shimolga qaratish"
          onClick={() => map?.easeTo({ bearing: 0, duration: 400 })}
          className={`${BTN_LG} ${SQUARE} ${SQUARE_OFF}`}
        >
          <svg ref={needle} width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5l4 9.5H8z" fill="#ef4444" />
            <path d="M12 21.5l-4-9.5h8z" fill="#a1a1aa" />
          </svg>
        </button>
      )}

      <div className={`${PILL} flex-col`}>
        <button
          type="button"
          title="Yaqinlashtirish"
          aria-label="Yaqinlashtirish"
          onClick={() => map?.zoomIn({ duration: 250 })}
          className={`${BTN_LG} ${OFF}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          title="Uzoqlashtirish"
          aria-label="Uzoqlashtirish"
          onClick={() => map?.zoomOut({ duration: 250 })}
          className={`${BTN_LG} ${OFF}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          title="Mening joylashuvim"
          aria-label="Mening joylashuvim"
          aria-pressed={tracking}
          onClick={locate}
          className={`${BTN_LG} ${SQUARE} ${tracking ? SQUARE_ON : SQUARE_OFF}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.5 11.2 20.5 3.5l-7.7 17-1.9-7.4z" />
          </svg>
        </button>
        {toast && (
          <p
            role="status"
            className="absolute right-14 top-1/2 w-max max-w-[220px] -translate-y-1/2 rounded-xl bg-zinc-900/90 px-3 py-2 text-[13px] leading-snug text-white shadow-lg"
          >
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}
