"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * CSS media so'rovining hozirgi qiymati (`(max-width: 767px)` kabi).
 *
 * `useSyncExternalStore`: brauzer o'z holatini xabar qilganda (oyna kengligi
 * o'zgardi, qurilma qorong'i rejimga o'tdi) React'ni to'g'ri va tirjamasiz
 * yangilaydi. Serverda (`getServerSnapshot`) `false` — bu komponentlar
 * baribir faqat brauzerda ishlaydi (`ssr:false`).
 */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Telefon o'lchami (Tailwind `md` dan kichik): mobil ko'rinish. */
export const MOBILE_QUERY = "(max-width: 767px)";
/** Qurilma qorong'i rejimda. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";
