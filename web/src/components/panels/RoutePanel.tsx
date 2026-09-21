"use client";

/**
 * Marshrut paneli — Yandex `MatrixSidebar.png` bilan bir xil tuzilishda.
 *
 * ┌─ NIMA HAQIQIY, NIMA YO'Q ──────────────────────────────────────────
 * Rasmda bor, lekin bizda ISHLAMAYDIGAN narsalar (jamoat transporti,
 * velosiped, taksi, oraliq nuqta, jo'nash vaqti, "telefonga yuborish")
 * chizilmaydi yoki o'chirilgan holda ko'rsatiladi. Ishlamaydigan tugma
 * soxta imkoniyat va'da qiladi.
 *
 * Haqiqatan ishlaydigan: avtomobil marshruti (OSRM), A/B ni xaritadan
 * tanlash, almashtirish, tozalash, masofa, vaqt va yetib borish soati.
 * └──────────────────────────────────────────────────────────────────
 *
 * A/B maydonlari MATN KIRITISH emas, xaritadan tanlash tugmasi: qidiruv
 * API'si (`/v1/search`) koordinata qaytarmaydi, ya'ni yozilgan manzildan
 * nuqta hosil qilib bo'lmaydi.
 */

import type { RouteInfo, RouteSlot, RouteState } from "@/components/map/useMapTools";
import { formatDistance, formatDuration, type LngLat } from "@/lib/geo";
import { BLUE } from "./controlStyles";

interface Props {
  state: RouteState;
  route: RouteInfo | null;
  onPick: (slot: RouteSlot) => void;
  onSwap: () => void;
  onClear: () => void;
}

const DOT = { a: "#ff4d3a", b: "#3f3f46" } as const;

/** `HH:MM` — mahalliy vaqt, mintaqaga bog'liq format qoidalarisiz. */
function clock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function RoutePanel({ state, route, onPick, onSwap, onClear }: Props) {
  const hasAny = state.a !== null || state.b !== null;
  const both = state.a !== null && state.b !== null;

  return (
    <div className="flex flex-col text-zinc-900 dark:text-white">
      <TransportRow />

      {/* ── A / B maydonlari ───────────────────────────────────────── */}
      <div className="px-5 pb-1">
        <div className="grid grid-cols-[14px_1fr_32px] items-center gap-x-3 gap-y-2.5">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: DOT.a }} />
          <Field
            slot="a"
            active={state.slot === "a"}
            point={state.a}
            label={state.labelA}
            placeholder="A nuqtani xaritadan tanlang"
            onPick={onPick}
          />
          <button
            type="button"
            onClick={onSwap}
            disabled={!hasAny}
            aria-label="A va B ni almashtirish"
            title="A va B ni almashtirish"
            className="row-span-2 flex h-9 w-8 items-center justify-center self-center rounded-lg text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <SwapIcon />
          </button>

          <span className="h-3.5 w-3.5 rounded-full" style={{ background: DOT.b }} />
          <Field
            slot="b"
            active={state.slot === "b"}
            point={state.b}
            label={state.labelB}
            placeholder="B nuqtani xaritadan tanlang"
            onPick={onPick}
          />
        </div>

        <div className="flex h-10 items-center justify-end">
          {hasAny && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg px-1 py-1 text-[15px] text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-white"
            >
              Tozalash
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-white/10" />

      {/* ── Natija ─────────────────────────────────────────────────── */}
      {both && route ? <Result route={route} /> : <Hint state={state} both={both} />}
    </div>
  );
}

/** Transport turlari qatori. Faqat avtomobil ishlaydi (OSRM `car` profili). */
function TransportRow() {
  const items: { key: string; label: string; icon: React.ReactNode; on?: boolean }[] = [
    { key: "car", label: "Avtomobil", icon: <CarIcon />, on: true },
    { key: "bus", label: "Jamoat transporti", icon: <BusIcon /> },
    { key: "walk", label: "Piyoda", icon: <WalkIcon /> },
    { key: "bike", label: "Velosiped", icon: <BikeIcon /> },
    { key: "scooter", label: "Samokat", icon: <ScooterIcon /> },
    { key: "taxi", label: "Taksi", icon: <TaxiIcon /> },
  ];
  return (
    <div className="flex items-center justify-between px-5 pb-4 pt-1">
      {items.map((t) =>
        t.on ? (
          <span
            key={t.key}
            role="img"
            aria-label={`${t.label} (tanlangan)`}
            title={t.label}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{ background: BLUE }}
          >
            {t.icon}
          </span>
        ) : (
          // O'chirilgan: manba yo'q. `disabled` + izoh — bosilmaydi va
          // nega bosilmasligi ko'rinib turadi.
          <button
            key={t.key}
            type="button"
            disabled
            aria-label={`${t.label} — tez orada`}
            title={`${t.label} — tez orada`}
            className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full text-zinc-800 dark:text-zinc-200 opacity-35"
          >
            {t.icon}
          </button>
        ),
      )}
    </div>
  );
}

function Field({
  slot,
  active,
  point,
  label,
  placeholder,
  onPick,
}: {
  slot: RouteSlot;
  active: boolean;
  point: LngLat | null;
  label: string | null;
  placeholder: string;
  onPick: (s: RouteSlot) => void;
}) {
  // Uch holat: nuqta yo'q → maslahat; nuqta bor, manzil hali yo'q →
  // "aniqlanmoqda"; ikkalasi ham bor → manzil.
  const text = !point ? placeholder : (label ?? "Manzil aniqlanmoqda…");
  const filled = point !== null && label !== null;

  return (
    <button
      type="button"
      onClick={() => onPick(slot)}
      aria-label={slot === "a" ? "A nuqtani tanlash" : "B nuqtani tanlash"}
      aria-pressed={active}
      className={`flex h-[46px] w-full min-w-0 flex-col justify-center rounded-xl px-4 text-left transition ${
        active
          ? "bg-white shadow-[inset_0_0_0_2px_#2f6bff] dark:bg-[#1c1d24]"
          : "bg-zinc-100 dark:bg-[#2b2c35] hover:bg-zinc-200/70 dark:hover:bg-[#33343e]"
      }`}
    >
      <span
        className={`block truncate text-[15px] leading-tight ${
          filled ? "font-semibold text-zinc-900 dark:text-white" : "font-normal text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {text}
      </span>
      {/* Koordinata ikkinchi qatorda: server hozircha ko'cha o'rniga
          mahalla nomini qaytaradi (ko'cha bazasi to'ldirilmagan), ya'ni
          A va B ikkalasi ham «Serob» bo'lib qolishi mumkin. Koordinata
          ularni ajratib turadi. */}
      {filled && point && (
        <span className="block truncate text-[11.5px] font-normal leading-tight text-zinc-400">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </span>
      )}
    </button>
  );
}

/** Marshrut tayyor emas — nima qilish kerakligini aytadi. */
function Hint({ state, both }: { state: RouteState; both: boolean }) {
  let text: string;
  if (both) text = "Marshrut hisoblanmoqda…";
  else if (state.a === null && state.b === null) text = "Boshlang'ich nuqtani xaritadan tanlang";
  else if (state.a === null) text = "A nuqtani xaritadan tanlang";
  else text = "B nuqtani xaritadan tanlang";

  return (
    <p className="px-5 py-5 text-[15px] leading-snug text-zinc-500 dark:text-zinc-400" role="status">
      {text}
    </p>
  );
}

function Result({ route }: { route: RouteInfo }) {
  return (
    <>
      <div className="relative bg-zinc-50 dark:bg-white/5 px-5 py-4">
        {/* Chapdagi ko'k chiziq — tanlangan marshrut belgisi. */}
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: route.onRoad ? BLUE : "#a1a1aa" }}
        />
        {route.onRoad ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-lg font-semibold">
                {formatDuration(route.durationS)}
              </span>
              <span className="text-[15px] text-zinc-500 dark:text-zinc-400">
                Yetib borish: {clock(route.etaMs)}
              </span>
            </div>
            <p className="mt-1.5 text-[15px] text-zinc-500 dark:text-zinc-400">
              {formatDistance(route.distanceM)}
            </p>
          </>
        ) : (
          // Soxta marshrut chizilmaydi: taxminiy to'g'ri chiziq buni
          // ochiq aytadi, foydalanuvchi uni yo'l masofasi deb o'ylamasin.
          <>
            <p className="text-lg font-semibold">{formatDistance(route.distanceM)}</p>
            <p className="mt-1.5 text-[15px] text-zinc-500 dark:text-zinc-400">
              To&apos;g&apos;ri chiziq bo&apos;ylab — yo&apos;l bo&apos;ylab marshrut
              hisoblanmadi
            </p>
          </>
        )}
      </div>
      <div className="border-t border-zinc-200 dark:border-white/10" />
    </>
  );
}

/* ── Belgilar ─────────────────────────────────────────────────────── */

function Ico({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function CarIcon() {
  return (
    <Ico>
      <path d="M5 16.5V13l1.6-4.2A2 2 0 0 1 8.5 7.5h7a2 2 0 0 1 1.9 1.3L19 13v3.5" />
      <path d="M3.5 13h17v3.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M6.5 17.5V19M17.5 17.5V19" />
      <circle cx="7.5" cy="14.8" r=".6" fill="currentColor" />
      <circle cx="16.5" cy="14.8" r=".6" fill="currentColor" />
    </Ico>
  );
}
function BusIcon() {
  return (
    <Ico>
      <rect x="5" y="4" width="14" height="14" rx="2.5" />
      <path d="M5 11h14M9 20v-2M15 20v-2" />
      <circle cx="8.5" cy="14.5" r=".7" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r=".7" fill="currentColor" />
    </Ico>
  );
}
function WalkIcon() {
  return (
    <Ico>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="M10 21l2-6-2.5-2.5 1-4.5L14 8l2.5 3M9.5 8.5L7 11M12 15l3 2 .5 4" />
    </Ico>
  );
}
function BikeIcon() {
  return (
    <Ico>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l3.5-7H14l4 7M9.5 9L12 16M14 9l-1-2h-2" />
    </Ico>
  );
}
function ScooterIcon() {
  return (
    <Ico>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 18H16l-2.5-12H11M12 6h4" />
    </Ico>
  );
}
function TaxiIcon() {
  return (
    <Ico>
      <path d="M10 4h4M12 4v2" />
      <path d="M5 17v-4l1.6-4.2A2 2 0 0 1 8.5 7.5h7a2 2 0 0 1 1.9 1.3L19 13v4" />
      <path d="M3.5 13h17v4.5h-17zM6.5 17.5V19M17.5 17.5V19" />
    </Ico>
  );
}
function SwapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 20V5M8 5L4.5 8.5M8 5l3.5 3.5" />
      <path d="M16 4v15M16 19l-3.5-3.5M16 19l3.5-3.5" />
    </svg>
  );
}
