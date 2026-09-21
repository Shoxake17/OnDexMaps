import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { CityPage, cityMetadata } from "@/components/seo/CityPage";
import { cityPath, findCity } from "@/lib/cities";
import { preservedQuery } from "@/lib/mapUrl";
import { sputnikAvailable } from "@/lib/sputnik";

/**
 * `/maps/10335/tashkent/sputnik/?ll=…&z=…` — sun'iy yo'ldosh varianti.
 *
 * Server sun'iy yo'ldosh manbasini sozlamagan bo'lsa, bu sahifa 404 beradi:
 * aks holda u "sun'iy yo'ldosh xaritasi" deb indekslanib, aslida oddiy
 * xaritani ko'rsatardi (yolg'on mazmun).
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
  return city ? cityMetadata(city, true) : {};
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

  if (slug !== city.slug) {
    permanentRedirect(cityPath(city, true) + preservedQuery(query));
  }

  // API'ga yetib bo'lmasa bu yerda istisno chiqadi (5xx) — 404 EMAS:
  // vaqtinchalik nosozlik sahifani indeksdan chiqarib yubormasligi kerak.
  if (!(await sputnikAvailable())) notFound();

  return <CityPage city={city} sputnik satellite query={query} />;
}
