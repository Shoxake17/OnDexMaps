/**
 * Yuklashdan OLDIN rasmni brauzerda tayyorlaydi: kichraytiradi va JPEG'ga
 * aylantiradi.
 *
 * ┌─ NEGA BRAUZERDA ───────────────────────────────────────────────────
 * Telefon rasmi 3–8 MB. Uni o'zgartirmay yuborish sekin tarmoqda daqiqalar
 * oladi va serverni bekorga yuklaydi. 1600 px / JPEG 82% ≈ 200–400 KB.
 *
 * Qo'shimcha foyda: `createImageBitmap` EXIF aylantirishini hisobga oladi
 * (telefonda tik olingan rasm yotib qolmaydi), va tuvalga chizilgan rasmda
 * metama'lumot (GPS joyi) QOLMAYDI.
 *
 * Bu — QULAYLIK, xavfsizlik chegarasi EMAS: server rasmni baribir o'zi
 * qaytadan dekodlaydi va tozalaydi (`internal/places/photo.go`).
 * └────────────────────────────────────────────────────────────────────
 */

/** Saqlanadigan rasmning eng uzun tomoni (server chegarasi bilan bir xil). */
export const MAX_SIDE = 1600;

/** Tanlangan fayl hajmi chegarasi (dekodlashdan oldin). */
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export class ImageError extends Error {}

export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError("Faqat rasm fayli yuklash mumkin");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError("Rasm juda katta (30 MB dan oshmasin)");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("Bu rasmni o'qib bo'lmadi (JPEG yoki PNG tanlang)");
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Rasmni tayyorlab bo'lmadi");
    // JPEG'da shaffoflik yo'q: oq fon (aks holda shaffof joylar qora bo'ladi).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) throw new ImageError("Rasmni tayyorlab bo'lmadi");
    return blob;
  } finally {
    bitmap.close();
  }
}
