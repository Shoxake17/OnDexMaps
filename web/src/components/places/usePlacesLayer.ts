"use client";

/**
 * Tasdiqlangan ob'ektlarni xaritada ko'rsatadi va bosilganda tanlaydi.
 *
 * Ma'lumot `/v1/places?bbox=…` dan keladi: xarita to'xtaganda (`moveend`)
 * ko'rinayotgan to'rtburchak so'raladi. Barcha ob'ektni birdan yuklamaymiz —
 * server ham buni rad etadi (bbox hajmi chegaralangan).
 *
 * ⚠️ Faqat TASDIQLANGAN ob'ektlar keladi (karantindagilar ommaviy API'ga
 * umuman ko'rinmaydi). Belgi rasmi brauzerda chiziladi (`makePlaceIcon`),
 * sprite fayli yo'q — `poiIcons.ts` bilan bir xil yo'l.
 */

import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";

import { placesApi } from "@/lib/places";
import {
  makePlaceIcon,
  PLACE_ICON_PIXEL_RATIO,
  PLACE_ICON_PREFIX,
} from "./kindUi";

/** Qatlam identifikatori — `useMapTools` bosishni shu qatlamga qarab ajratadi. */
export const PLACES_LAYER = "ondex-places";
const SOURCE = "ondex-places-src";

/** Bundan uzoqda ob'ektlar so'ralmaydi va chizilmaydi. */
const MIN_ZOOM = 13;
/** Server chegarasi 1.5° — undan kichik ushlaymiz. */
const MAX_SPAN = 1.4;
const DEBOUNCE_MS = 300;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function usePlacesLayer(
  map: MLMap | null,
  ready: boolean,
  /** `false` bo'lsa ob'ekt bosilganda tanlanmaydi (marshrut, o'lchash, qo'shish). */
  active: boolean,
  onSelect: (id: string) => void,
  /** O'zgarsa ma'lumot qayta yuklanadi. */
  refreshKey = 0,
) {
  const activeRef = useRef(active);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    activeRef.current = active;
    selectRef.current = onSelect;
  });

  // Manba va qatlam — bir marta.
  useEffect(() => {
    if (!map || !ready) return;

    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: EMPTY });
    }
    if (!map.getLayer(PLACES_LAYER)) {
      map.addLayer({
        id: PLACES_LAYER,
        type: "symbol",
        source: SOURCE,
        minzoom: MIN_ZOOM,
        layout: {
          "icon-image": ["concat", PLACE_ICON_PREFIX, ["get", "kind"]],
          "icon-allow-overlap": true,
          "icon-anchor": "center",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 1.2],
          "text-max-width": 8,
          // Nom sig'masa yashiriladi, lekin BELGI doim qoladi.
          "text-optional": true,
        },
        paint: {
          "text-color": "#1e3a8a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }

    // Belgi rasmi kerak bo'lganda (uslub `ondex-place-<tur>` so'raydi) chizamiz.
    const onMissing = (e: { id: string }) => {
      if (!e.id.startsWith(PLACE_ICON_PREFIX) || map.hasImage(e.id)) return;
      const img = makePlaceIcon(e.id.slice(PLACE_ICON_PREFIX.length));
      if (img) map.addImage(e.id, img, { pixelRatio: PLACE_ICON_PIXEL_RATIO });
    };
    map.on("styleimagemissing", onMissing);

    const onClick = (e: {
      features?: { properties?: Record<string, unknown> }[];
    }) => {
      if (!activeRef.current) return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") selectRef.current(id);
    };
    const onEnter = () => {
      if (activeRef.current) map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      if (activeRef.current) map.getCanvas().style.cursor = "";
    };
    map.on("click", PLACES_LAYER, onClick);
    map.on("mouseenter", PLACES_LAYER, onEnter);
    map.on("mouseleave", PLACES_LAYER, onLeave);

    return () => {
      map.off("styleimagemissing", onMissing);
      map.off("click", PLACES_LAYER, onClick);
      map.off("mouseenter", PLACES_LAYER, onEnter);
      map.off("mouseleave", PLACES_LAYER, onLeave);
    };
  }, [map, ready]);

  // Ma'lumotni yuklash: xarita to'xtaganda.
  useEffect(() => {
    if (!map || !ready) return;

    let ctl: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const setData = (data: GeoJSON.FeatureCollection) => {
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data);
    };

    const load = () => {
      ctl?.abort();
      if (map.getZoom() < MIN_ZOOM) {
        setData(EMPTY);
        return;
      }
      const b = map.getBounds();
      let w = b.getWest();
      let s = b.getSouth();
      let e = b.getEast();
      let n = b.getNorth();
      // Qiya (3D) ko'rinishda ufqqacha bo'lgan maydon juda katta bo'lishi mumkin.
      if (e - w > MAX_SPAN) {
        const c = (e + w) / 2;
        w = c - MAX_SPAN / 2;
        e = c + MAX_SPAN / 2;
      }
      if (n - s > MAX_SPAN) {
        const c = (n + s) / 2;
        s = c - MAX_SPAN / 2;
        n = c + MAX_SPAN / 2;
      }
      ctl = new AbortController();
      placesApi
        .inView([w, s, e, n], ctl.signal)
        .then((fc) => setData(fc))
        .catch(() => {
          // Tarmoq xatosi yoki bekor qilingan so'rov: oldingi belgilar qoladi,
          // xarita ishlashda davom etadi.
        });
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(load, DEBOUNCE_MS);
    };

    map.on("moveend", schedule);
    load();
    return () => {
      map.off("moveend", schedule);
      clearTimeout(timer);
      ctl?.abort();
    };
  }, [map, ready, refreshKey]);
}
