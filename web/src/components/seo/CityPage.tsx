/**
 * Shahar sahifasi — SERVER komponenti: xarita + indekslanadigan matn.
 *
 * Xarita tuvali faqat brauzerda ishlaydi, lekin sahifaning MATNI (sarlavha,
 * tavsif, shaharlar ro'yxati, JSON-LD) serverda HTML ichiga yoziladi —
 * qidiruv tizimi JavaScript'ni kutmasdan ko'radi. Aynan shu sabab loyiha
 * Vite/SPA emas, Next.js.
 */

import type { Metadata } from "next";

import MapShell from "@/components/MapShell";
import { api } from "@/lib/api";
import {
  CITIES,
  cityDescription,
  cityPath,
  cityTitle,
  type City,
} from "@/lib/cities";
import { makeInit } from "@/lib/mapUrl";
import { sputnikAvailable } from "@/lib/sputnik";
import { SITE_NAME, SITE_URL } from "@/lib/site";

type Query = Record<string, string | string[] | undefined>;

/** Sahifa metama'lumoti. `canonical` — ASOSIY manzil (`?ll=` va `?z=` SIZ). */
export function cityMetadata(city: City, sputnik: boolean): Metadata {
  const path = cityPath(city, sputnik);
  const title = cityTitle(city, sputnik);
  const description = cityDescription(city, sputnik);
  return {
    title,
    description,
    // ⚠️ Canonical'da `?ll=…&z=…` YO'Q: xarita har surilganda yangi manzil
    // hosil bo'ladi va ularning hammasini alohida sahifa deb hisoblash
    // cheksiz nusxalarga olib kelardi. Canonical ularni bitta shahar
    // sahifasiga birlashtiradi.
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "uz_UZ",
      images: [{ url: "/ondexmap-logo.png" }],
    },
    twitter: { card: "summary", title, description },
  };
}

async function loadAreaNames(): Promise<{ name: string; kind: string }[]> {
  try {
    const fc = await api.mahallas();
    return fc.features
      .map((f) => ({ name: f.properties.name, kind: f.properties.kind }))
      .sort((a, b) => a.name.localeCompare(b.name, "uz"));
  } catch {
    // API yetib bo'lmasa sahifa baribir ochilishi kerak — xarita
    // klient tomonda qayta urinadi. Bu blok faqat matn uchun.
    return [];
  }
}

interface Props {
  city: City;
  /** Sahifa sun'iy yo'ldosh varianti (matn va canonical shunga qarab). */
  sputnik: boolean;
  /** Xaritaga beriladigan rejim: `null` — URL hal qilmaydi (bosh sahifa). */
  satellite: boolean | null;
  query: Query;
}

export async function CityPage({ city, sputnik, satellite, query }: Props) {
  // Sun'iy yo'ldosh havolasini FAQAT u haqiqatan ishlasa ko'rsatamiz.
  // Bu yerda xato sahifani yiqitmasligi kerak — havola shunchaki chiqmaydi.
  const [areas, sputnikOk] = await Promise.all([
    city.hasAreas ? loadAreaNames() : Promise.resolve([]),
    sputnik ? Promise.resolve(true) : sputnikAvailable().catch(() => false),
  ]);

  const canonical = SITE_URL + cityPath(city, sputnik);
  // `<` belgisi `<` ga almashtiriladi: JSON `</script>` ni o'z ichiga
  // olib, blokdan chiqib ketishi mumkin bo'lmasligi uchun.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${city.name}, O'zbekiston`,
    url: canonical,
    hasMap: canonical,
    geo: {
      "@type": "GeoCoordinates",
      longitude: city.center[0],
      latitude: city.center[1],
    },
  }).replace(/</g, "\\u003c");

  return (
    <>
      <MapShell init={makeInit(city, satellite, query)} />

      {/* Qidiruv tizimlari va ekran o'qigichlari uchun. Matn sahifaning
          HAQIQIY mazmuni bilan bir xil — xaritada aynan shu shahar. */}
      <section className="sr-only">
        <h1>
          {sputnik
            ? `${city.name} sun'iy yo'ldosh xaritasi`
            : `${city.name} xaritasi`}
        </h1>
        <p>{cityDescription(city, sputnik)}</p>

        {sputnikOk && (
          <p>
            <a href={cityPath(city, !sputnik)}>
              {sputnik
                ? `${city.name} — oddiy xarita`
                : `${city.name} — sun'iy yo'ldosh tasviri`}
            </a>
          </p>
        )}

        {areas.length > 0 && (
          <ul>
            {areas.map((a) => (
              <li key={a.name}>
                {a.name} ({a.kind})
              </li>
            ))}
          </ul>
        )}

        {/* Ichki havolalar: qidiruv tizimi bir sahifadan hamma shaharlarni
            topadi (sitemap'dan tashqari ikkinchi yo'l). */}
        <nav aria-label="O'zbekiston shaharlari xaritasi">
          <ul>
            {CITIES.map((c) => (
              <li key={c.id}>
                <a href={cityPath(c, sputnik)}>
                  {c.name} {sputnik ? "sun'iy yo'ldosh xaritasi" : "xaritasi"}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
    </>
  );
}
