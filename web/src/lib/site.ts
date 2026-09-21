/**
 * Saytning ommaviy manzili — `canonical`, `sitemap.xml`, `robots.txt` uchun.
 *
 * ┌─ NEGA MAJBURIY ────────────────────────────────────────────────────
 * Qidiruv tizimi sahifaning ASOSIY manzilini shu qiymatdan oladi. Prod'da
 * u berilmay qolsa, hamma sahifa `http://localhost:3100/...` deb e'lon
 * qilinardi va indekslash JIMGINA buzilardi — hech qanday xato ko'rinmaydi.
 * Shu sabab prod build'da qiymat yo'q bo'lsa build YIQILADI.
 * └──────────────────────────────────────────────────────────────────
 *
 * Lokal ishlab chiqishda `http://localhost:3100` ishlatiladi.
 */

const raw = process.env.SITE_URL?.trim();

if (!raw && process.env.NODE_ENV === "production") {
  throw new Error(
    "SITE_URL berilmagan (masalan https://map.ondex.uz) — canonical va " +
      "sitemap noto'g'ri manzilga ega bo'lib qoladi. web/.env.local yoki " +
      "muhit o'zgaruvchisiga yozing.",
  );
}

export const SITE_URL = (raw || "http://localhost:3100").replace(/\/+$/, "");
export const SITE_NAME = "OnDex Map";
