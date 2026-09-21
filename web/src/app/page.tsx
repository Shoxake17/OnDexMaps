import type { Metadata } from "next";

import { CityPage, cityMetadata } from "@/components/seo/CityPage";
import { DEFAULT_CITY } from "@/lib/cities";

/**
 * Bosh sahifa (`/`) — standart shahar (Chust) xaritasi.
 *
 * ⚠️ Bu sahifa `/maps/10351/chust/` bilan BIR XIL mazmunda, shuning uchun
 * canonical o'sha manzilga qaratilgan — qidiruv tizimi ikki nusxani
 * alohida hisoblamaydi.
 *
 * `satellite={null}`: URL rejimni hal qilmaydi, shu sababli foydalanuvchining
 * saqlangan tanlovi (sun'iy yo'ldosh yoqilgan/o'chiq) qo'llanadi. Xarita
 * birinchi holat o'zgarishida manzil qatorini shahar sahifasiga aylantiradi.
 */

export const metadata: Metadata = cityMetadata(DEFAULT_CITY, false);

/**
 * Har so'rovda yangilanadi: mahalla ro'yxati BUILD paytidagi holatda
 * qotib qolmasin — yangi mahalla qo'shilganda sahifa uni ko'rsatishi kerak.
 */
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CityPage
      city={DEFAULT_CITY}
      sputnik={false}
      satellite={null}
      query={await searchParams}
    />
  );
}
