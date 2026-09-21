import { notFound, permanentRedirect } from "next/navigation";

import { cityPath, findCity } from "@/lib/cities";

/**
 * `/maps/10335/` — `slug`siz havola. Asosiy manzilga DOIMIY yo'naltiriladi:
 * `id` yagona kalit, `slug` esa faqat chiroyli qism.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const city = findCity(id);
  if (!city) notFound();
  permanentRedirect(cityPath(city, false));
}
