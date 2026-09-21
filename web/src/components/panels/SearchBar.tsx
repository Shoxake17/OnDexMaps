"use client";

/**
 * Qidiruv paneli — sidebar'ning eng tepasidagi kapsula.
 *
 * ┌─ KO'RINISH ────────────────────────────────────────────────────────
 * Tuzilishi Yandex sidebar'idagi bilan bir xil: chapda belgi, o'rtada
 * maydon, o'ngda lupa, ingichka ajratgich va marshrut tugmasi.
 * FARQ ATAYLAB bitta: joylashuv ignasi o'rnida OnDex logotipi.
 * └──────────────────────────────────────────────────────────────────
 *
 * Qidiruv butun mamlakat bo'yicha: shahar, qishloq, mahalla, ko'cha, joy,
 * bino va uy manzili. Natija bosilganda xarita o'sha joyga uchadi va
 * belgi qo'yiladi.
 *
 * Har bosilgan harfda so'rov yuborilmaydi — serverda rate limit bor
 * va uni bekorga sarflash kerak emas. Eski so'rov yangisini bosib
 * ketmasligi uchun bekor qilinadi.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

import { useMap } from "@/components/map/MapProvider";
import { api, type SearchMatch } from "@/lib/api";
import { UZ_BOUNDS } from "@/lib/config";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

/** Natijaga uchganda yaqinlashtirish darajasi (bbox bo'lmaganda). */
const ZOOM_BY_TYPE: Record<string, number> = {
  region: 8,
  district: 10.5,
  city: 12,
  town: 13,
  village: 14,
  hamlet: 14.5,
  suburb: 15,
  mahalla: 15.5,
  qishloq: 14.5,
  daha: 14,
  locality: 14,
  water: 14,
  street: 16,
  poi: 17,
  building: 18,
  address: 18,
  // Foydalanuvchi qo'shgan (admin tasdiqlagan) ob'ekt.
  place: 18,
};

/** Chegarali obyekt (ko'cha, bino, maydon) — chegaraga sig'diriladi. */
const FIT_TYPES = new Set(["street", "water", "building", "poi", "address"]);

export default function SearchBar({
  onRoute,
  routeActive,
  onPick,
  variant = "bar",
  onFocusSearch,
}: {
  /**
   * `bar` — desktop: yuqoridagi kapsula, natijalar ustida suzuvchi ro'yxat.
   * `sheet` — mobil: pastki panel ichidagi qidiruv, natijalar shu panelda
   * (oqim ichida) — suzuvchi ro'yxat panel chegarasida kesilib qolardi.
   */
  variant?: "bar" | "sheet";
  /** Maydon fokus oldi (mobilda pastki panelni kengaytirish uchun). */
  onFocusSearch?: () => void;
  /** Natija tanlandi (tor ekranda yon panelni yopish uchun). */
  onPick?: () => void;
  /** Marshrut rejimini yoqadi (o'ngdagi tugma). */
  onRoute: () => void;
  /** Marshrut rejimi hozir yoqilganmi. */
  routeActive: boolean;
}) {
  const { map, selectArea } = useMap();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const sheet = variant === "sheet";
  const text = q.trim();
  const tooShort = text.length < MIN_CHARS;

  // ⚠️ Qisqa so'rovda natija HOLATI tozalanmaydi — u shunchaki
  // KO'RSATILMAYDI (`shown` pastda). Effekt ichida `setState`
  // chaqirish ortiqcha render bosqichini keltirib chiqaradi.
  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setBusy(true);
      setError(null);

      // Xarita markazi — teng natijalardan yaqini oldinda chiqishi uchun.
      // O'zbekiston tashqarisidagi markaz yuborilmaydi (server 400 berardi).
      const c = map?.getCenter();
      const [[minLng, minLat], [maxLng, maxLat]] = UZ_BOUNDS;
      const bias =
        c && c.lng >= minLng && c.lng <= maxLng && c.lat >= minLat && c.lat <= maxLat
          ? { lat: c.lat, lng: c.lng }
          : undefined;

      api
        .search(text, controller.signal, bias)
        .then((r) => {
          if (!controller.signal.aborted) {
            setResults(r.results ?? []);
            setActive(0);
          }
        })
        .catch((e: Error) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, tooShort, map]);

  // Belgi sahifadan chiqqanda olib tashlanadi.
  useEffect(
    () => () => {
      pending.current?.abort();
      marker.current?.remove();
    },
    [],
  );

  // Ko'rsatiladigan natija — holatdan HOSILA.
  const shown = tooShort ? [] : results;
  const dropdownOpen = focused && (busy || !!error || shown.length > 0 || !tooShort);

  const clearMarker = useCallback(() => {
    marker.current?.remove();
    marker.current = null;
  }, []);

  /** Natijani tanlash: xaritani uchirish, belgi qo'yish, mahallani belgilash. */
  const choose = useCallback(
    (m: SearchMatch) => {
      setQ(m.name);
      setFocused(false);
      input.current?.blur();
      onPick?.();
      if (!map || m.lat === undefined || m.lng === undefined) return;

      // Jamoa jadvalidagi mahalla/qishloq — chegarasi ham ko'rsatiladi.
      const isArea = m.type === "mahalla" || m.type === "qishloq" || m.type === "daha";
      selectArea(isArea ? m.id : null);

      // ⚠️ `fitBounds` chetdan (padding) katta bo'lgan tuvalga sig'dira olmaydi
      // va JIMGINA hech narsa qilmaydi. Tor tuvalda padding kichraytiriladi;
      // tuval umuman o'lchamsiz bo'lsa oddiy `flyTo` ga o'tiladi.
      const box = map.getContainer();
      const roomy = Math.min(box.clientWidth, box.clientHeight);
      if (m.bbox && FIT_TYPES.has(m.type) && roomy > 120) {
        const [w, s, e, n] = m.bbox;
        map.fitBounds(
          [
            [w, s],
            [e, n],
          ],
          {
            padding: Math.max(16, Math.min(96, Math.floor(roomy / 4))),
            maxZoom: m.type === "street" ? 17 : 18.5,
            duration: 900,
          },
        );
      } else {
        map.flyTo({
          center: [m.lng, m.lat],
          zoom: ZOOM_BY_TYPE[m.type] ?? 15,
          duration: 900,
        });
      }

      clearMarker();
      marker.current = new maplibregl.Marker({ element: pinElement(), anchor: "bottom" })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
    },
    [map, selectArea, clearMarker, onPick],
  );

  const clearAll = useCallback(() => {
    setQ("");
    setResults([]);
    clearMarker();
    selectArea(null);
    input.current?.focus();
  }, [clearMarker, selectArea]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && shown.length > 0) {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length > 0) {
      e.preventDefault();
      setActive((i) => (i - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter" && shown.length > 0) {
      e.preventDefault();
      choose(shown[Math.min(active, shown.length - 1)]);
    } else if (e.key === "Escape") {
      setFocused(false);
      input.current?.blur();
    }
  };

  return (
    <div className="relative">
      <div
        className={
          sheet
            ? "flex h-[52px] items-center rounded-2xl bg-zinc-100 pl-3.5 pr-2 dark:bg-[#2b2c35]"
            : "flex h-12 items-center rounded-xl bg-zinc-100 pl-3 pr-1.5"
        }
      >
        {/* OnDexMap logotipi — Yandex'dagi qizil igna o'rnida.
            `priority`: sahifaning eng tepasidagi belgi, kech yuklansa
            qidiruv paneli "chala" ko'rinib turardi. */}
        <Image
          src="/ondexmap-logo.png"
          alt="OnDexMap"
          width={22}
          height={30}
          priority
          className="h-[26px] w-auto shrink-0"
        />

        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFocused(true);
          }}
          onFocus={() => {
            setFocused(true);
            onFocusSearch?.();
          }}
          onKeyDown={onKeyDown}
          // Bosish natijaga tegishi uchun yopish KECHIKTIRILADI:
          // aks holda `blur` `click` dan oldin ishlaydi va ro'yxat
          // bosilgan payt yo'qolib, bosish bekorga ketardi.
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Joy qidirish va tanlash"
          aria-label="Qidiruv"
          autoComplete="off"
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-controls="search-results"
          className={`min-w-0 flex-1 bg-transparent px-3 text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-white dark:placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden ${
            sheet ? "text-[16px]" : "text-[15px]"
          }`}
        />

        {q !== "" && (
          <button
            type="button"
            aria-label="Qidiruvni tozalash"
            title="Tozalash"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearAll}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}

        {!sheet && (
          <>
        <button
          type="button"
          aria-label="Qidirish"
          onClick={() => {
            setFocused(true);
            input.current?.focus();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-200"
        >
          <MagnifierIcon />
        </button>

        <span className="mx-0.5 h-6 w-px shrink-0 bg-zinc-300" />

        {/* Marshrut rejimida bu tugma «✕» ga aylanadi (Yandex
            `MatrixSidebar.png` dagi kabi): marshrutni yopadi va oddiy
            yon panelga qaytaradi. Yoqilgan holatda ALOHIDA rang bilan
            ajratilmaydi — rejimni panelning o'zi ko'rsatib turadi. */}
        <button
          type="button"
          aria-label={routeActive ? "Marshrutni yopish" : "Marshrut"}
          title={routeActive ? "Marshrutni yopish" : "Marshrut"}
          onClick={onRoute}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-200"
        >
          {routeActive ? <CloseIcon /> : <RouteIcon />}
        </button>
          </>
        )}
      </div>

      {dropdownOpen && (
        <div
          id="search-results"
          role="listbox"
          className={
            sheet
              ? "mt-2 rounded-2xl py-1"
              : "absolute left-0 right-0 top-[54px] z-20 max-h-[min(70vh,520px)] overflow-auto rounded-2xl bg-white py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.18)]"
          }
        >
          {busy && shown.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">qidirilmoqda…</p>
          )}
          {error && <p className="px-4 py-3 text-sm text-red-700">{error}</p>}

          {shown.map((r, i) => (
            <button
              key={`${r.id}`}
              type="button"
              role="option"
              aria-selected={i === active}
              // `mousedown` FAQAT fokus input'dan ketmasligi uchun to'xtatiladi;
              // tanlash `click` da. Tanlash `mousedown` da bo'lsa ro'yxat
              // `mouseup` dan OLDIN yo'qoladi va `click` xaritaga tushib qolardi
              // (mahalla tanlovini bekor qilib, manzil so'rab yuborardi).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                i === active ? "bg-zinc-100 dark:bg-white/10" : ""
              }`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: colorFor(r.type) }}
                aria-hidden="true"
              >
                <KindIcon type={r.type} />
              </span>
              <span className="min-w-0 flex-1">
                {/* Matn React orqali chiqadi — HTML sifatida talqin
                    qilinmaydi. Nomlar OSM va JAMOA TAKLIFLARIDAN kelishi
                    mumkin, shuning uchun bu muhim. */}
                <span className="block truncate text-[15px] font-medium text-zinc-900 dark:text-white">
                  {r.name}
                </span>
                <span className="block truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                  {[r.label, r.near].filter(Boolean).join(" · ")}
                  {r.matched_via ? ` · «${r.matched_via}»` : ""}
                </span>
              </span>
            </button>
          ))}

          {!busy && !error && shown.length === 0 && !tooShort && (
            <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              «{text}» bo&apos;yicha hech narsa topilmadi
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Xarita belgisi — natija qo'yilgan joy. */
function pinElement(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.4 15 40 15 40s15-14.6 15-25.2C30 6.6 23.3 0 15 0z" fill="#ff4d3a"/>' +
    '<circle cx="15" cy="14.5" r="5.5" fill="#fff"/></svg>';
  el.style.cssText = "filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); cursor: default;";
  return el;
}

/** Tur guruhi bo'yicha rang. */
function colorFor(type: string): string {
  switch (type) {
    case "region":
    case "district":
    case "city":
    case "town":
    case "village":
    case "hamlet":
    case "locality":
      return "#f59e42";
    case "suburb":
    case "mahalla":
    case "qishloq":
    case "daha":
      return "#e8794a";
    case "street":
      return "#71717a";
    case "water":
      return "#3b9be8";
    case "building":
    case "address":
      return "#4cc15f";
    default:
      return "#8b7cf6"; // poi
  }
}

function KindIcon({ type }: { type: string }) {
  const p = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "street":
      return (
        <svg {...p}>
          <path d="M9 3L6 21M15 3l3 18M12 5v3M12 11v3M12 17v3" />
        </svg>
      );
    case "water":
      return (
        <svg {...p}>
          <path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11z" />
        </svg>
      );
    case "building":
    case "address":
      return (
        <svg {...p}>
          <path d="M4 21V9l8-6 8 6v12M9 21v-6h6v6" />
        </svg>
      );
    case "region":
    case "district":
    case "city":
    case "town":
    case "village":
    case "hamlet":
    case "locality":
    case "suburb":
    case "mahalla":
    case "qishloq":
    case "daha":
      return (
        <svg {...p}>
          <path d="M3 21h18M5 21V10l4-3v14M13 21V4l6 3v14" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
  }
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function MagnifierIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Marshrut belgisi.
 *
 * ⚠️ Bu — xaritaning o'ng ustunidagi belgi bilan AYNAN bir xil, va u
 * yerdan OLIB TASHLANDI: ilgari A→B ni boshlaydigan ikkita tugma bor
 * edi (biri shu yerda, biri xarita ustida) va qaysi biri nima qilishi
 * tushunarsiz edi. Bitta amal — bitta tugma.
 */
function RouteIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19h6a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h6" />
    </svg>
  );
}
