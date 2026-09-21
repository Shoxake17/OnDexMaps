"use client";

/**
 * «Ob'ekt qo'shish» paytida xaritada turadigan SUDRALADIGAN belgi.
 *
 * Foydalanuvchi belgini ob'ekt ustiga suradi (yoki xaritani bosadi) va
 * koordinata shundan olinadi (Yandex: «Belgini ob'ektga to'g'ri qo'ying»).
 */

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

import type { LngLat } from "@/lib/geo";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Ko'k tomchi-belgi. Faqat DOM API (matn/HTML qatori yo'q). */
function pinElement(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "width:34px;height:44px;cursor:grab;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))";
  el.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 34 44");
  svg.setAttribute("width", "34");
  svg.setAttribute("height", "44");

  const body = document.createElementNS(SVG_NS, "path");
  body.setAttribute("d", "M17 1C8.2 1 1 8 1 16.6 1 28 17 43 17 43s16-15 16-26.4C33 8 25.800 1 17 1z");
  body.setAttribute("fill", "#2f6bff");
  body.setAttribute("stroke", "#ffffff");
  body.setAttribute("stroke-width", "2");

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", "17");
  dot.setAttribute("cy", "16.5");
  dot.setAttribute("r", "5.5");
  dot.setAttribute("fill", "#ffffff");

  svg.append(body, dot);
  el.append(svg);
  return el;
}

/**
 * `point` bo'lsa belgi shu joyda turadi; sudralib qo'yib yuborilganda
 * `onMove` yangi joy bilan chaqiriladi. `point` `null` bo'lsa belgi yo'q.
 */
export function useAddMarker(
  map: MLMap | null,
  point: LngLat | null,
  onMove: (p: LngLat) => void,
) {
  const marker = useRef<Marker | null>(null);
  const moveRef = useRef(onMove);
  useEffect(() => {
    moveRef.current = onMove;
  });

  const active = point !== null;

  // Belgi faqat qo'shish rejimida mavjud.
  useEffect(() => {
    if (!map || !active) return;
    const m = new maplibregl.Marker({
      element: pinElement(),
      anchor: "bottom",
      draggable: true,
    });
    m.on("dragend", () => {
      const ll = m.getLngLat();
      moveRef.current({ lat: ll.lat, lng: ll.lng });
    });
    m.setLngLat([map.getCenter().lng, map.getCenter().lat]).addTo(map);
    marker.current = m;
    return () => {
      m.remove();
      marker.current = null;
    };
  }, [map, active]);

  // Joy o'zgarganda (xaritani bosish yoki menyu) belgi ko'chadi.
  const lat = point?.lat;
  const lng = point?.lng;
  useEffect(() => {
    if (marker.current && lat !== undefined && lng !== undefined) {
      marker.current.setLngLat([lng, lat]);
    }
  }, [lat, lng, active]);
}
