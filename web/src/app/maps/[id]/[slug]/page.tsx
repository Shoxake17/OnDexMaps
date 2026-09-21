import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { CityPage, cityMetadata } from "@/components/seo/CityPage";
import { cityPath, findCity } from "@/lib/cities";
import { preservedQuery } from "@/lib/mapUrl";

/**
 * `/maps/10335/tashkent/?ll=69.33,41.22&z=11` — shahar xaritasi.
 *
 * Har so'rovda hisoblanadi (`searchParams` shuni talab qiladi), lekin
 * natija qidiruv tizimi uchun to'liq HTML: sarlavha, tavsif, canonical.
 */

type Params = Promise<{ id: string; slug: string }>;
type Query = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const city = findCity(id);
  // Topilmasa — `notFound()` sahifa ichida chaqiriladi va noindex beradi.
  return city ? cityMetadata(city, false) : {};
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const { id, slug } = await params;
  const city = findCity(id);
  if (!city) notFound();

  const query = await searchParams;

  // Sahifa `id` bo'yicha topiladi, `slug` faqat chiroyli qism. Noto'g'ri
  // yoki eski `slug` — dublikat sahifa hosil qilmasligi uchun asosiy
  // manzilga DOIMIY (308) yo'naltiriladi; `?ll=` va `?z=` saqlanadi.
  if (slug !== city.slug) {
    permanentRedirect(cityPath(city, false) + preservedQuery(query));
  }

  return <CityPage city={city} sputnik={false} satellite={false} query={query} />;
}
