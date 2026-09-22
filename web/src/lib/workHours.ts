/**
 * Ish vaqti: tanlagichlar holati ⇄ saqlanadigan matn.
 *
 * Forma (Yandex «Время работы»): uchta tanlagich —
 *   1) KUNLAR       «Har kuni ▾»
 *   2) SOATLAR      «Kun bo'yi ▾» (24 soat) yoki aniq vaqt
 *   3) TANAFFUS     «Tanaffussiz ▾» yoki aniq vaqt
 * Natija BIR XIL ko'rinishdagi matn bo'ladi (server uni oddiy matn sifatida
 * saqlaydi, ≤80 belgi), masalan:
 *   «Har kuni, kun bo'yi»
 *   «Du–Ju, 09:00–18:00»
 *   «Du–Sh, 09:00–18:00, tanaffus 13:00–14:00»
 *
 * Matn odamga o'qishga qulay (xarita tafsilotida shundoq ko'rsatiladi), shuning
 * uchun server tomonda maxsus format talab qilinmaydi: o'zi tozalaydi va
 * uzunligini cheklaydi. Bu fayl faqat sof mantiq (React yo'q) — osongina sinaladi.
 */

/** Hafta kunlari, dushanbadan boshlab (O'zbekiston/Yevropa tartibi). */
export const DAY_SHORT = ["Du", "Se", "Chor", "Pay", "Ju", "Sh", "Yak"] as const;

/** Kunlar tanlagichi: `none` — ish vaqti ko'rsatilmaydi (ixtiyoriy maydon). */
export type DaysMode = "none" | "daily" | "weekdays" | "sixdays" | "weekend" | "custom";

export const DAYS_OPTIONS: { value: DaysMode; label: string }[] = [
  { value: "none", label: "Ko'rsatilmagan" },
  { value: "daily", label: "Har kuni" },
  { value: "weekdays", label: "Du–Ju" },
  { value: "sixdays", label: "Du–Sh" },
  { value: "weekend", label: "Sh–Yak" },
  { value: "custom", label: "Kunlarni tanlash" },
];

export type TimeMode = "allday" | "range";
export type BreakMode = "none" | "range";

export interface HoursState {
  days: DaysMode;
  /** `custom` rejimida: 7 ta kun (Du … Yak) belgilanganmi. */
  custom: boolean[];
  time: TimeMode;
  from: string;
  to: string;
  brk: BreakMode;
  breakFrom: string;
  breakTo: string;
}

export const DEFAULT_HOURS: HoursState = {
  days: "none",
  custom: [true, true, true, true, true, false, false],
  time: "allday",
  from: "09:00",
  to: "18:00",
  brk: "none",
  breakFrom: "13:00",
  breakTo: "14:00",
};

const PRESET_DAYS: Record<Exclude<DaysMode, "none" | "custom">, boolean[]> = {
  daily: [true, true, true, true, true, true, true],
  weekdays: [true, true, true, true, true, false, false],
  sixdays: [true, true, true, true, true, true, false],
  weekend: [false, false, false, false, false, true, true],
};

/** «HH:MM» (00:00–23:59). */
export function isTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Daqiqaga: «09:30» → 570. */
function minutes(v: string): number {
  return Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
}

/** Tanlangan kunlarni ixcham yozadi: [Du..Ju] → «Du–Ju», [Du, Chor, Yak] → «Du, Chor, Yak». */
export function formatDays(flags: boolean[]): string {
  const on = flags.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  if (on.length === 7) return "Har kuni";
  const parts: string[] = [];
  let i = 0;
  while (i < on.length) {
    let j = i;
    while (j + 1 < on.length && on[j + 1] === on[j] + 1) j++;
    // Ketma-ket 3 va undan ko'p kun — oraliq; 1–2 tasi alohida.
    if (j - i >= 2) parts.push(`${DAY_SHORT[on[i]]}–${DAY_SHORT[on[j]]}`);
    else for (let k = i; k <= j; k++) parts.push(DAY_SHORT[on[k]]);
    i = j + 1;
  }
  return parts.join(", ");
}

function daysFlags(s: HoursState): boolean[] {
  if (s.days === "none") return [];
  return s.days === "custom" ? s.custom : PRESET_DAYS[s.days];
}

/**
 * Tanlagichlar holatidagi xato (foydalanuvchiga ko'rsatiladi) yoki `null`.
 * Ko'rsatilmagan (`none`) ish vaqti xato EMAS — maydon ixtiyoriy.
 */
export function hoursProblem(s: HoursState): string | null {
  if (s.days === "none") return null;
  if (!daysFlags(s).some(Boolean)) return "Ish vaqti: kamida bitta kunni tanlang";
  if (s.time === "allday") return null;
  if (!isTime(s.from) || !isTime(s.to)) return "Ish vaqti: vaqtni to'liq kiriting";
  if (minutes(s.from) === minutes(s.to)) {
    return "Ish vaqti: boshlanish va tugash bir xil (24 soat bo'lsa «Kun bo'yi» ni tanlang)";
  }
  if (s.brk === "range") {
    if (!isTime(s.breakFrom) || !isTime(s.breakTo)) return "Tanaffus: vaqtni to'liq kiriting";
    const [a, b] = [minutes(s.breakFrom), minutes(s.breakTo)];
    if (a >= b) return "Tanaffus: boshlanish tugashdan oldin bo'lishi kerak";
    // Tanaffus ish vaqti ichida. Tunga o'tadigan smenada (22:00–02:00) tekshirilmaydi:
    // u yerda «ichida» ma'nosi ikki tomonlama.
    const [f, t] = [minutes(s.from), minutes(s.to)];
    if (f < t && (a < f || b > t)) return "Tanaffus ish vaqti ichida bo'lishi kerak";
  }
  return null;
}

/** Saqlanadigan matn. Xato holatda (yoki ko'rsatilmagan bo'lsa) bo'sh qator. */
export function formatHours(s: HoursState): string {
  if (s.days === "none" || hoursProblem(s) !== null) return "";
  const parts = [formatDays(daysFlags(s))];
  if (s.time === "allday") {
    parts.push("kun bo'yi");
  } else {
    parts.push(`${s.from}–${s.to}`);
    if (s.brk === "range") parts.push(`tanaffus ${s.breakFrom}–${s.breakTo}`);
  }
  return parts.join(", ");
}
