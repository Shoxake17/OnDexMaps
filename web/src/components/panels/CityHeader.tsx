"use client";

/**
 * Sidebar sarlavhasi: shahar nomi, joriy harorat, "Barcha joylar".
 *
 * ⚠️ Harorat KO'RSATILMAYDI, agar manba sozlanmagan bo'lsa yoki so'rov
 * yiqilsa. Soxta yoki eskirgan raqam chiqarilmaydi: noto'g'ri harorat
 * "ma'lumot yo'q" dan battar — foydalanuvchi unga ishonadi.
 */

import { useEffect, useState } from "react";
import { api, type Weather } from "@/lib/api";
import { useMap } from "@/components/map/MapProvider";

/**
 * Ob-havo manzilini SHU SHAHAR uchun moslaydi.
 *
 * Sozlamadagi manzil bitta joy (Chust) uchun yozilgan. O'zgartirilmasa,
 * Toshkent sahifasida Chust harorati chiqardi — aynan shu fayl e'lon
 * qilgan "noto'g'ri harorat yo'qdan battar" holati. `latitude`/`longitude`
 * parametrlari bo'lmasa (boshqa provayder) moslab bo'lmaydi va harorat
 * KO'RSATILMAYDI.
 */
function weatherUrlFor(raw: string, center: [number, number]): string | null {
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("latitude") || !u.searchParams.has("longitude")) return null;
    u.searchParams.set("longitude", center[0].toFixed(4));
    u.searchParams.set("latitude", center[1].toFixed(4));
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Joriy ob-havo — xarita HOZIR turgan shahar uchun (yo'q bo'lsa `null`).
 * Sarlavha (desktop) va xaritadagi harorat belgisi (mobil) BIR MANBADAN oladi.
 */
export function useWeather(): Weather | null {
  const { place } = useMap();
  const [weather, setWeather] = useState<Weather | null>(null);

  // Ob-havo FAQAT xarita shahar yaqinida bo'lsa. Cho'l o'rtasida yoki
  // shaharlar orasida eng yaqin shaharning haroratini ko'rsatish noto'g'ri
  // bo'lardi. Ikkita primitiv qiymat: obyekt emas, shuning uchun effekt
  // faqat shahar HAQIQATAN o'zgarganda qayta ishlaydi.
  const inCity = place.inCity;
  const [lng, lat] = place.city.center;

  useEffect(() => {
    const controller = new AbortController();
    if (!inCity) return () => controller.abort();

    void (async () => {
      try {
        const cfg = await api.config(controller.signal);
        if (!cfg.weather_url) return; // sozlanmagan — jim qolamiz
        const url = weatherUrlFor(cfg.weather_url, [lng, lat]);
        if (!url) return;
        const w = await api.weather(url, controller.signal);
        if (!controller.signal.aborted) setWeather(w);
      } catch {
        // Ob-havo — bezak, xarita emas. Yiqilsa sahifaga xato
        // chiqarmaymiz, shunchaki haroratsiz ko'rsatamiz.
      }
    })();

    return () => controller.abort();
  }, [inCity, lng, lat]);

  return inCity ? weather : null;
}

export default function CityHeader() {
  const { place } = useMap();
  const weather = useWeather();
  const inCity = place.inCity;

  return (
    <div className="flex items-baseline gap-2 px-4 pt-3">
      <h2 className="text-[22px] font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">
        {inCity ? place.city.name : "O'zbekiston"}
      </h2>

      {inCity && weather && (
        <span className="flex items-center gap-1 text-[15px] text-zinc-800 dark:text-zinc-200">
          <WeatherIcon code={weather.code} />
          {Math.round(weather.tempC)}°C
        </span>
      )}

      <span className="ml-auto text-sm text-zinc-400">Barcha joylar</span>
    </div>
  );
}

/**
 * WMO ob-havo kodi → belgi.
 *
 * Kodlar guruhlangan (WMO 4677): 0-1 ochiq, 2-3 bulutli, 45-48 tuman,
 * 51-67 va 80-82 yomg'ir, 71-77 va 85-86 qor, 95+ momaqaldiroq.
 */
export function WeatherIcon({ code }: { code: number }) {
  if (code >= 95) return <Bolt />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <Snow />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <Rain />;
  if (code >= 2) return <Cloud />;
  return <Sun />;
}

const SVG = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
};

function Sun() {
  return (
    <svg {...SVG} fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" fill="#f5a623" stroke="none" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

function Cloud() {
  return (
    <svg {...SVG} fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round">
      <path d="M6.5 18h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.2A4 4 0 0 0 6.5 18z" />
    </svg>
  );
}

function Rain() {
  return (
    <svg {...SVG} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 14h10a3.2 3.2 0 0 0 .3-6.4A5.2 5.2 0 0 0 7.2 6.5 3.8 3.8 0 0 0 7 14z" />
      <path d="M9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5" />
    </svg>
  );
}

function Snow() {
  return (
    <svg {...SVG} fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    </svg>
  );
}

function Bolt() {
  return (
    <svg {...SVG} fill="#f59e0b" stroke="none">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
