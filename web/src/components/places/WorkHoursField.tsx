"use client";

/**
 * «Ish vaqti» — Yandex uslubidagi tanlagichlar (`image/ish.png`):
 *
 *   Ish vaqti
 *   [ Har kuni ▾ ]
 *   [ Kun bo'yi ▾ ] [ Tanaffussiz ▾ ]
 *
 * Har biri oddiy `<select>`: klaviatura, ekran o'qish dasturlari va telefonning
 * o'z tanlagichi bilan ishlaydi (maxsus ochiladigan ro'yxat yozilmagan — u
 * murakkab va xatoga moyil). Aniq vaqt kerak bo'lganda `<input type="time">`
 * qatori ochiladi. Natija matni `lib/workHours.ts` da yasaladi.
 *
 * Maydon IXTIYORIY: «Ko'rsatilmagan» tanlangan bo'lsa qolgan tanlagichlar
 * o'chiq turadi va hech qanday ish vaqti yuborilmaydi (24 soat degan soxta
 * ma'lumot yozilib qolmasin).
 */

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import {
  DAY_SHORT,
  DAYS_OPTIONS,
  formatHours,
  hoursProblem,
  type BreakMode,
  type DaysMode,
  type HoursState,
  type TimeMode,
} from "@/lib/workHours";

const TIME_OPTIONS: { value: TimeMode; label: string }[] = [
  { value: "allday", label: "Kun bo'yi" },
  { value: "range", label: "Vaqt tanlash" },
];

const BREAK_OPTIONS: { value: BreakMode; label: string }[] = [
  { value: "none", label: "Tanaffussiz" },
  { value: "range", label: "Tanaffus bor" },
];

export default function WorkHoursField({
  value,
  onChange,
}: {
  value: HoursState;
  onChange: (next: HoursState) => void;
}) {
  const set = (patch: Partial<HoursState>) => onChange({ ...value, ...patch });
  const enabled = value.days !== "none";
  const timed = enabled && value.time === "range";
  const problem = hoursProblem(value);
  const summary = formatHours(value);

  return (
    <div data-testid="work-hours" role="group" aria-label="Ish vaqti">
      <div className="mb-1 text-[13px] font-semibold text-zinc-900">Ish vaqti</div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill
          label="Ish kunlari"
          testId="hours-days"
          value={value.days}
          options={DAYS_OPTIONS}
          onChange={(v) => set({ days: v as DaysMode })}
        />
        <Pill
          label="Ish soatlari"
          testId="hours-time"
          value={value.time}
          options={TIME_OPTIONS}
          disabled={!enabled}
          onChange={(v) => set({ time: v as TimeMode })}
        />
        <Pill
          label="Tanaffus"
          testId="hours-break"
          value={value.brk}
          options={BREAK_OPTIONS}
          disabled={!timed}
          onChange={(v) => set({ brk: v as BreakMode })}
        />
      </div>

      {value.days === "custom" && (
        <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Hafta kunlari">
          {DAY_SHORT.map((d, i) => (
            <button
              key={d}
              type="button"
              aria-pressed={value.custom[i]}
              onClick={() =>
                set({ custom: value.custom.map((on, j) => (j === i ? !on : on)) })
              }
              className={`h-7 min-w-9 rounded-lg px-2 text-[13px] font-medium transition ${
                value.custom[i]
                  ? "bg-[#2f6bff] text-white"
                  : "bg-[#f3f3f5] text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {timed && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <TimeRange
            label="Ish vaqti"
            testId="hours-range"
            from={value.from}
            to={value.to}
            onFrom={(v) => set({ from: v })}
            onTo={(v) => set({ to: v })}
          />
          {value.brk === "range" && (
            <TimeRange
              label="Tanaffus"
              testId="hours-break-range"
              from={value.breakFrom}
              to={value.breakTo}
              onFrom={(v) => set({ breakFrom: v })}
              onTo={(v) => set({ breakTo: v })}
            />
          )}
        </div>
      )}
      {problem ? (
        <p role="alert" className="mt-1 text-xs text-red-600" data-testid="hours-problem">
          {problem}
        </p>
      ) : (
        summary && (
          <p className="mt-1 text-xs text-zinc-500" data-testid="hours-summary">
            Xaritada: {summary}
          </p>
        )
      )}
    </div>
  );
}

/** Kulrang yumaloq tanlagich, o'ngida kichik «▼» (Yandex uslubi). */
function Pill({
  label,
  value,
  options,
  onChange,
  disabled = false,
  testId,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer appearance-none rounded-lg bg-[#f3f3f5] pl-2.5 pr-7 text-[13px] font-medium text-zinc-600 outline-none transition hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-[#2f6bff]/40 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Triangle />
    </label>
  );
}

function Triangle(): ReactNode {
  return (
    <ChevronDown
      size={15}
      strokeWidth={2.4}
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600"
    />
  );
}

/** «Dan … Gacha» — ikki vaqt maydoni (24 soatlik `HH:MM`). */
function TimeRange({
  label,
  from,
  to,
  onFrom,
  onTo,
  testId,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  testId: string;
}) {
  const box =
    "h-8 w-[6.6rem] rounded-lg bg-[#f3f3f5] px-2 text-[13px] font-medium text-zinc-700 outline-none transition focus-visible:ring-2 focus-visible:ring-[#2f6bff]/40";
  return (
    <div className="flex items-center gap-1" data-testid={testId}>
      <input
        type="time"
        step={60}
        aria-label={`${label}: boshlanishi`}
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        className={box}
      />
      <span className="text-zinc-400" aria-hidden="true">
        –
      </span>
      <input
        type="time"
        step={60}
        aria-label={`${label}: tugashi`}
        value={to}
        onChange={(e) => onTo(e.target.value)}
        className={box}
      />
    </div>
  );
}
