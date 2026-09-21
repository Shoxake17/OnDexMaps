import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * `robots.txt` — hammaga ochiq, sitemap ko'rsatilgan.
 *
 * `?ll=…&z=…` variantlari ATAYLAB yopilmaydi: ular canonical orqali
 * shahar sahifasiga birlashadi, robots bilan yopilsa esa qidiruv tizimi
 * canonical'ni o'qiy olmay qolardi.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
