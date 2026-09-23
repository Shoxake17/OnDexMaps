"use client";

/**
 * «Ob'ekt qo'shish» → «Yo'l»: foydalanuvchi yo'lni xaritada CHIZADI.
 *
 * Qanday ishlaydi:
 *   • xaritani bosish chiziq OXIRIGA yangi nuqta qo'shadi (`onPick` orqali —
 *     bosishni `useMapTools` yagona ishlovchi bilan qabul qiladi, shu hook
 *     bosishni o'zi tinglamaydi);
 *   • har nuqta SUDRALADIGAN belgi: uni surib yo'lni tuzatish mumkin;
 *   • nuqtani ikki marta bosish uni O'CHIRADI;
 *   • «Ortga» va «Tozalash» — yon paneldagi tugmalar (`AddObjectPanel`).
 *
 * Chiziq va nuqtalar faqat shu oqim ochiq paytda mavjud: `line` `null` bo'lsa
 * (yoki nuqta turi tanlangan bo'lsa) hech narsa chizilmaydi va qatlam olib
 * tashlanadi — xaritada qoldiq qolmaydi.
 */

import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from "maplibre-gl";

import type { LngLat } from "@/lib/geo";

const SRC = "ondex-add-line-src";
const CASING = "ondex-add-line-casing";
const LINE = "ondex-add-line";

/** Chizilayotgan yo'l rangi — tasdiqlangan yo'llardan farqli (ko'k). */
const DRAFT_BLUE = "#2f6bff";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Nuqta belgisi: birinchisi yashil, oxirgisi to'q ko'k, o'rtadagilar oq. */
function vertexElement(kind: "first" | "last" | "mid", index: number): HTMLElement {
  const el = document.createElement("div");
  const fill = kind === "first" ? "#16a34a" : kind === "last" ? DRAFT_BLUE : "#ffffff";
  const ink = kind === "mid" ? DRAFT_BLUE : "#ffffff";
  el.style.cssText =
    `width:18px;height:18px;border-radius:50%;box-sizing:border-box;` +
    `background:${fill};border:3px solid ${kind === "mid" ? DRAFT_BLUE : "#ffffff"};` +
    `box-shadow:0 1px 4px rgba(0,0,0,.45);cursor:grab;` +
    `display:flex;align-items:center;justify-content:center;` +
    `font:700 9px/1 system-ui,sans-serif;color:${ink};user-select:none`;
  el.title = "Suring · ikki marta bosib o'chiring";
  // `data-vertex`: MapLibre `aria-label` ni o'zi qayta yozadi, shuning uchun
  // nuqtani (va sinovlarda topishni) alohida atribut bilan belgilaymiz.
  el.dataset.vertex = String(index);
  el.setAttribute("role", "button");
  // Faqat oxirgi va birinchi nuqtada raqam yo'q (belgi rangi o'zi aytadi).
  if (kind === "mid") el.textContent = String(index + 1);
  return el;
}

function lineFeature(points: LngLat[]): GeoJSON.FeatureCollection {
  if (points.length < 2) return EMPTY;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) },
      },
    ],
  };
}

/**
 * `line` — hozirgi nuqtalar (`null` — chizish rejimi o'chiq). `onChange` har
 * o'zgarishda YANGI massiv bilan chaqiriladi (siljitish, o'chirish).
 */
export function useAddLine(
  map: MLMap | null,
  line: LngLat[] | null,
  onChange: (next: LngLat[]) => void,
) {
  const lineRef = useRef<LngLat[]>([]);
  const changeRef = useRef(onChange);
  const markers = useRef<Marker[]>([]);
  useEffect(() => {
    changeRef.current = onChange;
    lineRef.current = line ?? [];
  });

  const active = line !== null;

  // Qatlam: faqat chizish rejimida.
  useEffect(() => {
    if (!map || !active) return;
    if (!map.getSource(SRC)) map.addSource(SRC, { type: "geojson", data: EMPTY });
    if (!map.getLayer(CASING)) {
      map.addLayer({
        id: CASING,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.95 },
      });
    }
    if (!map.getLayer(LINE)) {
      map.addLayer({
        id: LINE,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": DRAFT_BLUE, "line-width": 5, "line-opacity": 0.95 },
      });
    }
    return () => {
      // Xarita allaqachon yo'q qilingan bo'lishi mumkin (sahifadan chiqish).
      try {
        if (map.getLayer(LINE)) map.removeLayer(LINE);
        if (map.getLayer(CASING)) map.removeLayer(CASING);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        // e'tiborsiz
      }
    };
  }, [map, active]);

  // Chiziq va nuqta belgilari — `line` o'zgarganda.
  useEffect(() => {
    if (!map || !active) return;

    const setLine = (pts: LngLat[]) => {
      (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(lineFeature(pts));
    };
    const pts = line ?? [];
    setLine(pts);

    const kindAt = (i: number, n: number): "first" | "last" | "mid" =>
      i === 0 ? "first" : i === n - 1 ? "last" : "mid";

    // Belgilar soni o'zgarsa hammasi qayta yasaladi (raqam/rang o'zgaradi);
    // faqat joy o'zgargan bo'lsa mavjud belgilar ko'chiriladi.
    if (markers.current.length !== pts.length) {
      markers.current.forEach((m) => m.remove());
      markers.current = pts.map((p, i) => {
        const m = new maplibregl.Marker({
          element: vertexElement(kindAt(i, pts.length), i),
          draggable: true,
        })
          .setLngLat([p.lng, p.lat])
          .addTo(map);

        // Sudrash paytida chiziq jonli yangilanadi.
        m.on("drag", () => {
          const ll = m.getLngLat();
          const cur = lineRef.current.slice();
          cur[i] = { lat: ll.lat, lng: ll.lng };
          setLine(cur);
        });
        m.on("dragend", () => {
          const ll = m.getLngLat();
          const cur = lineRef.current.slice();
          cur[i] = { lat: ll.lat, lng: ll.lng };
          changeRef.current(cur);
        });
        // Ikki marta bosish — nuqtani o'chiradi. Xaritaning "ikki bosishda
        // yaqinlashtirish" harakati ham ishga tushmasligi uchun to'xtatiladi.
        m.getElement().addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const cur = lineRef.current.slice();
          cur.splice(i, 1);
          changeRef.current(cur);
        });
        // Belgi ustidagi bosish xaritaga (yangi nuqta qo'shishga) o'tmasin.
        m.getElement().addEventListener("click", (e) => e.stopPropagation());
        return m;
      });
    } else {
      markers.current.forEach((m, i) => m.setLngLat([pts[i].lng, pts[i].lat]));
    }
  }, [map, active, line]);

  // Rejim o'chganda belgilar olib tashlanadi.
  useEffect(() => {
    if (active) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
  }, [active]);

  // Komponent yo'q bo'lganda hech qanday belgi qolmasin.
  useEffect(
    () => () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
    },
    [],
  );
}
