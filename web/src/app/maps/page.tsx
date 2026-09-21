import type { Metadata } from "next";
import Link from "next/link";

import { CITIES, cityPath } from "@/lib/cities";

/**
 * `/maps/` — shaharlar ro'yxati. Oddiy statik sahifa: qidiruv tizimi
 * (va foydalanuvchi) barcha shahar xaritalarini bir joydan topadi.
 */

export const metadata: Metadata = {
  title: "O'zbekiston shaharlari xaritasi — OnDex Map",
  description:
    "O'zbekiston shaharlarining xaritasi va sun'iy yo'ldosh tasviri: " +
    "Toshkent, Samarqand, Buxoro, Namangan, Andijon, Farg'ona va boshqalar.",
  alternates: { canonical: "/maps/" },
};

export default function MapsIndex() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        O&apos;zbekiston shaharlari xaritasi
      </h1>
      <p className="mt-2 text-zinc-600">
        Shaharni tanlang — xarita ochiladi. Har biri uchun oddiy xarita va
        sun&apos;iy yo&apos;ldosh tasviri mavjud.
      </p>

      <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CITIES.map((c) => (
          <li key={c.id}>
            <Link
              href={cityPath(c, false)}
              className="block rounded-xl bg-zinc-100 px-4 py-3 text-[15px] font-medium text-zinc-900 transition hover:bg-zinc-200"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
