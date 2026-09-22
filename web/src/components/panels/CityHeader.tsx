"use client";

/**
 * Sidebar sarlavhasi: shahar nomi, joriy harorat, "Barcha joylar".
 *
 * ⚠️ Harorat KO'RSATILMAYDI, agar manba sozlanmagan bo'lsa yoki so'rov
 * yiqilsa. Soxta yoki eskirgan raqam chiqarilmaydi: noto'g'ri harorat
 * "ma'lumot yo'q" dan battar — foydalanuvchi unga ishonadi.
 */

import {
  Cloud as CloudIcon,
  CloudRain,
  Snowflake,
  Sun as SunIcon,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Weather } from "@/lib/api";
import { useMap } from "@/components/map/MapProvider";
import { useCategories } from "./categories";

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
  const { expanded, setExpanded } = useCategories();
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

      {/* «Barcha joylar»: bosilsa asosiy 10 turkumga qo'shimcha turkumlar ochiladi. */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        data-testid="all-places"
        className="ml-auto rounded-md px-1.5 py-0.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10"
      >
        {expanded ? "Kamroq" : "Barcha joylar"}
      </button>
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

/** Ob-havo belgilari — Lucide; rang har holatga xos (quyosh sariq, bulut kulrang, ...). */
const W = { size: 17, strokeWidth: 2 } as const;

function Sun() {
  return <SunIcon {...W} color="#f5a623" />;
}

function Cloud() {
  return <CloudIcon {...W} color="#94a3b8" />;
}

function Rain() {
  return <CloudRain {...W} color="#60a5fa" />;
}

function Snow() {
  return <Snowflake {...W} color="#7dd3fc" />;
}

function Bolt() {
  return <Zap {...W} color="#f59e0b" fill="#f59e0b" />;
}