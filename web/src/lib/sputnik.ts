import { api } from "@/lib/api";

/**
 * Server sun'iy yo'ldosh manbasini sozlaganmi.
 *
 * ⚠️ API'ga yetib bo'lmasa ISTISNO tashlaydi (`false` qaytarmaydi): "manba
 * yo'q" va "hozir javob bermayapti" farqi muhim. Birinchisida sahifa 404
 * bo'ladi va indeksdan chiqadi; ikkinchisida 5xx — qidiruv tizimi buni
 * VAQTINCHALIK deb biladi va sahifani indeksda saqlab, keyinroq qaytadi.
 */
export async function sputnikAvailable(): Promise<boolean> {
  const cfg = await api.config();
  return Boolean(cfg.satellite_url);
}