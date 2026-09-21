"use client";

/**
 * Xarita ustidagi yuqori-o'ng vositalar (Yandex `LeftSide.png` kabi):
 * sun'iy yo'ldosh, 3D/2D va lineyka — oq yumaloq kapsulalarda.
 *
 * Tugmalar xarita ustida turadi, shuning uchun ular bosilganda
 * xaritaning o'zi bosilib ketmasligi kerak — `stopPropagation`.
 *
 * Zoom (+/−), kompas va geolokatsiya alohida — `MapControls`.
 */

import type { ToolMode } from "@/components/map/useMapTools";
import { useMap } from "@/components/map/MapProvider";
import { BTN, OFF, ON, PILL } from "./controlStyles";

interface Props {
  mode: ToolMode;
  onMode: (m: ToolMode) => void;
  onClear: () => void;
  /** Lineyka chizmasi bormi (tozalash tugmasi shunga qarab chiqadi). */
  hasMeasure: boolean;
}

export default function ToolBar({ mode, onMode, onClear, hasMeasure }: Props) {
  const { satelliteAvailable, satellite, toggleSatellite, is3D, toggle3D } = useMap();
  const measuring = mode === "measure";

  return (
    <div
      // Tor ekranda qidiruv paneli (yuqori chap, deyarli butun kenglik) bilan
      // ustma-ust tushmasligi uchun uning OSTIDA turadi.
      className="absolute right-3 top-[68px] z-10 flex items-center gap-2 md:top-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`${PILL} gap-0.5 p-0.5`}>
        {satelliteAvailable && (
          <button
            type="button"
            title={satellite ? "Sun'iy yo'ldosh yoqilgan — oddiy xaritaga qaytish" : "Sun'iy yo'ldosh"}
            aria-label="Sun'iy yo'ldosh"
            aria-pressed={satellite}
            onClick={toggleSatellite}
            className={`${BTN} ${satellite ? ON : OFF}`}
          >
            <SatelliteIcon />
          </button>
        )}

        {/* ⚠️ Yozuv HOLATNI ko'rsatadi, maqsadni emas: 3D yoqilgan bo'lsa
            «3D», 2D ga o'tilgan bo'lsa «2D». Ilgari yozuv doim «3D» edi —
            bosilgach xarita 2D ga o'tsa ham tugmada o'zgarish ko'rinmasdi.
            Bosilganda nima bo'lishi `title` da yoziladi. */}
        <button
          type="button"
          title={is3D ? "3D yoqilgan — 2D ga o'tish" : "2D yoqilgan — 3D ga o'tish"}
          aria-label={is3D ? "3D ko'rinish (2D ga o'tish)" : "2D ko'rinish (3D ga o'tish)"}
          onClick={toggle3D}
          className={`${BTN} ${OFF} text-[14px] font-bold tracking-tight`}
        >
          {is3D ? "3D" : "2D"}
        </button>
      </div>

      <div className={`${PILL} gap-0.5 p-0.5`}>
        <button
          type="button"
          title="Masofa o'lchash"
          aria-label="Masofa o'lchash"
          aria-pressed={measuring}
          onClick={() => onMode(measuring ? "idle" : "measure")}
          className={`${BTN} ${measuring ? ON : OFF}`}
        >
          <RulerIcon />
        </button>
        {measuring && hasMeasure && (
          <button
            type="button"
            title="Tozalash"
            aria-label="Chizmani tozalash"
            onClick={onClear}
            className={`${BTN} ${OFF}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {/* ⚠️ Marshrut tugmasi BU YERDA EMAS — u qidiruv panelida.
          Ilgari ikkalasi ham bor edi va A→B ni ikki joydan boshlash
          mumkin bo'lgani foydalanuvchini chalkashtirardi. */}
    </div>
  );
}

function SatelliteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.4 9.5h17.2M3.4 14.5h17.2" />
      <path d="M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(-45 12 12)">
        <rect x="1.5" y="8" width="21" height="8" rx="1.8" />
        <path d="M6 8v3.2M10 8v2M14 8v3.2M18 8v2" />
      </g>
    </svg>
  );
}
