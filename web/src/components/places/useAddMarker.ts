"use client";

/**
 * «Ob'ekt qo'shish» paytida xaritada turadigan SUDRALADIGAN belgi.
 *
 * Foydalanuvchi belgini ob'ekt ustiga suradi (yoki xaritani bosadi) va
 * koordinata shundan olinadi (Yandex: «Belgini ob'ektga to'g'ri qo'ying»).
 * Belgi — OnDexMap logotipi (`components/map/logoPin.ts`), qidiruv
 * natijasi belgisi bilan BIR XIL rasm.
 */

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

import { logoPinElement } from "@/components/map/logoPin";
import type { LngLat } from "@/lib/geo";

const PIN_SIZE = 46;

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
      element: logoPinElement(PIN_SIZE, "grab"),
      anchor: "bottom",
      // Rasm kvadrat tuvalning pastki chetiga 2% yaqin: uchi shu yerda.
      offset: [0, 1],
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
