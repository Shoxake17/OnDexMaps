"use client";

/**
 * Geolokatsiya ("mening joylashuvim") — desktop va mobil tugmalar uchun UMUMIY.
 *
 * `GeolocateControl` xaritaga QO'SHILADI (ruxsat, kuzatish, ko'k nuqta va
 * aniqlik doirasini u boshqaradi), lekin uning o'z tugmasi KO'RINMAYDI
 * (`globals.css`): tugma bizning dizaynda va dasturiy `trigger()` qiladi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

import { useMap } from "./MapProvider";

const TOAST_MS = 4500;

export function useGeolocate() {
  const { map } = useMap();
  const geo = useRef<maplibregl.GeolocateControl | null>(null);
  const [tracking, setTracking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    // ⚠️ Geolokatsiya faqat XAVFSIZ kontekstda ishlaydi: `https://`
    // yoki `http://localhost`. LAN IP (`http://192.168.x.x`) da
    // brauzer rad etadi — bu bizning xatomiz emas, shuning uchun
    // tugma bosilganda sabab ochiq aytiladi.
    const control = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    });
    map.addControl(control, "bottom-right");
    geo.current = control;

    control.on("trackuserlocationstart", () => setTracking(true));
    control.on("trackuserlocationend", () => setTracking(false));
    control.on("error", (e: unknown) => {
      setTracking(false);
      const code = (e as { code?: number }).code;
      setToast(
        code === 1
          ? "Joylashuvga ruxsat berilmagan"
          : "Joylashuvni aniqlab bo'lmadi",
      );
    });

    return () => {
      geo.current = null;
      map.removeControl(control);
    };
  }, [map]);

  // Xabar o'zi yo'qoladi.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const locate = useCallback(() => {
    if (!window.isSecureContext) {
      setToast("Joylashuv faqat https yoki localhost orqali ishlaydi");
      return;
    }
    geo.current?.trigger();
  }, []);

  return { locate, tracking, toast };
}
