"use client";

import { useEffect, useState } from "react";

import { placesApi, type PlacesMeta } from "@/lib/places";

/**
 * Ob'ekt qo'shish qoidalari (serverdan). `null` — hali yuklanmagan yoki server
 * javob bermadi: shunda «Ob'ekt qo'shish» ko'rsatilmaydi (fail-closed —
 * ishlamaydigan imkoniyat va'da qilinmaydi). `enabled === false` — server
 * qabul qilishni yoqmagan: xuddi shunday.
 */
export function usePlacesMeta(): PlacesMeta | null {
  const [meta, setMeta] = useState<PlacesMeta | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    placesApi
      .meta(ctl.signal)
      .then((m) => {
        // Kutilmagan shakl (eski/buzuq server) — jimgina o'chiriladi.
        if (m && m.enabled && Array.isArray(m.kinds) && m.kinds.length > 0) {
          setMeta(m);
        }
      })
      .catch(() => {
        // Tarmoq xatosi: xarita ishlayveradi, faqat qo'shish yo'q.
      });
    return () => ctl.abort();
  }, []);

  return meta;
}
