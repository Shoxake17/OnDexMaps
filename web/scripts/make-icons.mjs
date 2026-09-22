/**
 * Brauzer belgilarini (favicon) OnDexMap logotipidan yasaydi.
 *
 *   node scripts/make-icons.mjs
 *
 * Manba: `public/ondexmap-logo.png` (to'q sariq «joy belgisi»). Natija Next.js
 * konventsiyasidagi fayllar — ular `<link rel="icon">` sifatida o'zi ulanadi:
 *   src/app/icon.png        256×256, shaffof fon (brauzer yorlig'i, Android)
 *   src/app/apple-icon.png  180×180, OQ fon (iOS shaffoflikni qora qiladi)
 *   src/app/favicon.ico     16/32/48 px (eski brauzerlar va /favicon.ico so'rovi)
 *   public/ondexmap-pin.png 96×96, shaffof (interfeysdagi kichik logotip)
 *
 * Logotip o'zgarsa shu buyruq qayta ishga tushiriladi. `sharp` — Next.js bilan
 * birga keladigan bog'liqlik, alohida o'rnatish shart emas.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "public", "ondexmap-logo.png");
const APP = path.join(root, "src", "app");

/** Logotipni kvadratga sig'diradi (kesmasdan), atrofida `pad` ulushcha bo'sh joy. */
async function square(size, { background, pad = 0.06 } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(SRC)
    .trim() // atrofidagi shaffof chetlar olib tashlanadi: belgi kvadratni to'ldiradi
    .resize(inner, inner, { fit: "inside" })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: "centre" }])
    // Palitrali PNG: gradientli logotip uchun ko'zga sezilmas, hajmi ~4 marta kichik.
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
}

/** PNG-lardan .ico (Vista+ PNG ichki formati; barcha zamonaviy brauzerlar o'qiydi). */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // zaxira
  head.writeUInt16LE(1, 2); // tur: ikonka
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const dir = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // tekisliklar
    e.writeUInt16LE(32, 6); // bit/piksel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...images.map((i) => i.data)]);
}

(async () => {
  const icon = await square(256);
  fs.writeFileSync(path.join(APP, "icon.png"), icon);

  const apple = await square(180, { background: { r: 255, g: 255, b: 255, alpha: 1 }, pad: 0.1 });
  fs.writeFileSync(path.join(APP, "apple-icon.png"), apple);

  // Interfeysdagi kichik logotip: «Mening joylashuvim» tugmasi va xaritadagi joylashuv belgisi.
  // 355 KB lik asl fayl o'rniga ~5 KB (ikki baravar zich, 32×32 CSS px gacha).
  const pin = await square(96, { pad: 0.02 });
  fs.writeFileSync(path.join(root, "public", "ondexmap-pin.png"), pin);

  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(async (s) => ({ size: s, data: await square(s, { pad: 0.02 }) })));
  fs.writeFileSync(path.join(APP, "favicon.ico"), ico(pngs));

  console.log("tayyor: icon.png, apple-icon.png, favicon.ico, public/ondexmap-pin.png");
})();
