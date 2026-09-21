"use client";

/**
 * Xarita holatini manzil qatoriga yozadi: `/maps/10335/tashkent/?ll=…&z=…`
 * va xarita markaziga eng yaqin SHAHARni aniqlaydi.
 *
 * ┌─ NEGA SHAHAR XARITAGA ERGASHADI ───────────────────────────────────
 * Ilgari shahar sahifa ochilganda BIR MARTA belgilanardi. `/` (Chust)
 * dan boshlab xarita Namangan yoki Toshkentga surilsa ham, sarlavha, tab
 * nomi, ob-havo va URL «Chust» bo'lib qolardi. Endi har surish tugagach
 * markazga eng yaqin shahar topiladi va hammasi shunga moslanadi.
 * └──────────────────────────────────────────────────────────────────
 *
 * ┌─ NEGA `history.replaceState`, `router.replace` EMAS ────────────────
 * Xarita har surilganda yangilanadi. `router.replace` serverga so'rov
 * yuborib sahifani qayta hisoblardi (sekin va xarita miltillaydi).
 * `replaceState` esa faqat manzil qatorini o'zgartiradi. Next.js uni
 * o'z router'i bilan avtomatik moslashtiradi (`usePathname` va
 * `useSearchParams` yangilanadi) — rasmiy hujjatda shunday tavsiya qilingan.
 *
 * `replaceState`, `pushState` EMAS: har surish tarix yozuvi qo'shsa,
 * «Orqaga» tugmasi sahifadan chiqmasdan xaritani bosqichma-bosqich
 * qaytarib turardi.
 * └──────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, type RefObject } from "react";
import type { Map as MLMap } from "maplibre-gl";

import {
  CITY_RADIUS_KM,
  cityTitle,
  nearestCity,
  type City,
} from "@/lib/cities";
import { pathWithView } from "@/lib/mapUrl";

/** Surish tugagach shuncha kutiladi — har kadrda emas, faqat to'xtaganda yoziladi. */
const DEBOUNCE_MS = 300;

/**
 * Xarita hozir qayerda.
 *
 * `city` — markazga ENG YAQIN shahar (URL uchun har doim kerak, shuning
 * uchun uzoqda ham to'ldiriladi). `inCity` — u haqiqatan YAQINmi
 * (`CITY_RADIUS_KM` ichida): cho'l o'rtasida sarlavha «Buxoro» demasligi
 * va uning ob-havosi ko'rsatilmasligi kerak.
 */
export interface Place {
  city: City;
  inCity: boolean;
}

/**
 * @param wantSatellite Sun'iy yo'ldosh rejimi HOZIR kerakmi (ref).
 *   Xarita holatidan (`satellite`) EMAS: sahifa `/sputnik/` bilan ochilganda
 *   qatlam bir necha yuz ms keyin qo'shiladi va shu oraliqda URL oddiy
 *   xaritaga qaytib ketardi.
 * @param onPlace Xarita boshqa shahar yaqiniga o'tganda chaqiriladi.
 * @returns qo'lda chaqiriladigan `sync` (rejim almashganda).
 */
export function useUrlSync(
  map: MLMap | null,
  wantSatellite: RefObject<boolean>,
  onPlace: (p: Place) => void,
): () => void {
  const sync = useCallback(() => {
    if (!map) return;
    const c = map.getCenter();
    const near = nearestCity(c.lng, c.lat);
    const sputnik = wantSatellite.current;

    const inCity = near.km <= CITY_RADIUS_KM;
    onPlace({ city: near.city, inCity });

    try {
      // `null` holat: Next.js o'zining ichki holatini o'zi qo'shadi.
      window.history.replaceState(
        null,
        "",
        pathWithView(near.city, sputnik, c.lng, c.lat, map.getZoom()),
      );
    } catch {
      // Ba'zi muhitlarda (masalan iframe sandbox) taqiqlangan — xarita ishlayveradi.
    }
    // Shahardan uzoqda tab nomi ham umumiy bo'ladi: sarlavha «O'zbekiston»
    // deb turgan joyda tab «Buxoro xaritasi» demasligi kerak. (URL' da esa
    // baribir eng yaqin shahar — unga shahar identifikatori shart.)
    document.title = inCity
      ? cityTitle(near.city, sputnik)
      : "O'zbekiston xaritasi — OnDex Map";
  }, [map, wantSatellite, onPlace]);

  useEffect(() => {
    if (!map) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMoveEnd = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, DEBOUNCE_MS);
    };
    map.on("moveend", onMoveEnd);
    // Bir marta darhol: bosh sahifa (`/`) va `?ll=`siz havola to'liq,
    // ulashsa bo'ladigan manzilga aylanadi.
    sync();
    // Va xarita to'liq yuklangach yana bir marta: Next.js gidratsiyada
    // sahifaning ASL (serverdagi) sarlavhasini qaytarib qo'yadi va birinchi
    // `sync` yozgan tab nomi ustidan yozilib ketadi.
    map.once("idle", sync);
    return () => {
      map.off("moveend", onMoveEnd);
      clearTimeout(timer);
    };
  }, [map, sync]);

  return sync;
}
