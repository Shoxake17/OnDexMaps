import { permanentRedirect } from "next/navigation";

/**
 * `/v2/mahallas` OLIB TASHLANGAN.
 *
 * Endpoint bitta so'rovda BUTUN chegaralar to'plamini qaytarardi:
 * bbox ham, sahifalash ham yo'q edi. Ya'ni bepul rejadagi bitta
 * chaqiruv Operatorning qo'lda yig'ilgan va moderatsiyadan
 * o'tkazilgan barcha mahalla chegaralarini nusxalash uchun yetarli
 * bo'lardi.
 *
 * Sahifa o'chirilmadi, yo'naltirishga aylantirildi: manzil tashqi
 * havolalarda va qidiruv natijalarida qolgan bo'lishi mumkin.
 */
export default function MahallasRemoved(): never {
  permanentRedirect("/docs/api");
}