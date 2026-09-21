import type { MetadataRoute } from "next";

import { CITIES, cityPath } from "@/lib/cities";
import { SITE_URL } from "@/lib/site";
import { sputnikAvailable } from "@/lib/sputnik";

/**
 * `sitemap.xml` — indekslanadigan sahifalar.
 *
 * Har so'rovda hisoblanadi: sun'iy yo'ldosh manzillari FAQAT server uni
 * sozlagan bo'lsa kiradi (aks holda ular 404). API vaqtincha javob
 * bermasa, sun'iy yo'ldosh manzillari ro'yxatdan tushib qoladi — bu zarar
 * qilmaydi, keyingi o'qishda qaytadi.
 *
 * `lastModified` ATAYLAB yo'q: har so'rovda "hozir" deb yozish yolg'on
 * bo'lardi (xarita ma'lumoti har soniyada o'zgarmaydi) va qidiruv tizimi
 * bunday sarlavhaga ishonishni to'xtatadi.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sputnik = await sputnikAvailable().catch(() => false);

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/maps/`, changeFrequency: "monthly", priority: 0.6 },
  ];

  for (const c of CITIES) {
    entries.push({
      url: SITE_URL + cityPath(c, false),
      changeFrequency: "monthly",
      priority: c.hasAreas ? 0.9 : 0.8,
    });
    if (sputnik) {
      entries.push({
        url: SITE_URL + cityPath(c, true),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }
  return entries;
}
