/* ═══════════════════════════════════════════════════════════════════
   OnDexMap — IKONALAR (o'z serverimizdan, CDN'siz)

   ⚠️ NEGA CDN'DAN EMAS:
     1. Sahifa CSP'si `default-src 'none'`; tashqi manba sifatida faqat
        Mapbox ruxsat etilgan. CDN qo'shish `script-src`/`style-src` ni
        yana bir domenga ochish, ya'ni xarita sahifasida uchinchi tomon
        kodini bajarishga ruxsat berish degani bo'lardi.
     2. CDN o'chsa yoki internet bo'lmasa interfeys ikonasiz qolardi.
     3. Har bir foydalanuvchi brauzeri tashqi domenga so'rov yuborardi.

   Shu sabab kerakli ikonalarning SVG ma'lumoti shu faylga KO'CHIRILGAN
   va `/assets/icons.js` orqali beriladi.

   MANBALAR VA LITSENZIYALAR:
     - Lucide v1.28.0 (ISC). Ma'lumot loyihada allaqachon bor bo'lgan
       `lucide-react` paketidan (`dist/esm/icons/*.mjs`) AYNAN
       ko'chirilgan, shakli o'zgartirilmagan. https://lucide.dev
       Portions (c) Cole Bemis 2013-2022 (Feather, MIT); boshqa qismlar
       (c) Lucide Contributors 2022.
     - Font Awesome Free 6.7.2 — `street-view`. Icons: CC BY 4.0
       (attribution talab qiladi; shu izoh o'sha vazifani bajaradi).
       (c) 2024 Fonticons, Inc. https://fontawesome.com/license/free

   YANGILASH: ikona qo'shilsa ma'lumot yuqoridagi manbadan KO'CHIRILADI.
   "Ko'zga o'xshash" qilib qo'lda chizilgan ikona keyin to'plamning
   qolgan qismidan farq qilib turadi.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  /* Lucide: har ikona `[tag, atributlar]` juftliklari ro'yxati.
     `viewBox` va chiziq sozlamalari butun to'plam uchun bir xil. */
  var LUCIDE = {
    "utensils-crossed": [ ["path", { d: "m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" }], [ "path", { d: "M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" } ], ["path", { d: "m2.1 21.8 6.4-6.3" }], ["path", { d: "m19 5-7 7" }] ],
    "banknote": [ ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "2" }], ["circle", { cx: "12", cy: "12", r: "2" }], ["path", { d: "M6 12h.01M18 12h.01" }] ],
    "bed-double": [ ["path", { d: "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" }], ["path", { d: "M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" }], ["path", { d: "M12 4v6" }], ["path", { d: "M2 18h20" }] ],
    "shopping-cart": [ ["circle", { cx: "8", cy: "21", r: "1" }], ["circle", { cx: "19", cy: "21", r: "1" }], [ "path", { d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" } ] ],
    "pill": [ [ "path", { d: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" } ], ["path", { d: "m8.5 8.5 7 7" }] ],
    "shopping-bag": [ ["path", { d: "M16 10a4 4 0 0 1-8 0" }], ["path", { d: "M3.103 6.034h17.794" }], [ "path", { d: "M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" } ] ],
    "coffee": [ ["path", { d: "M10 2v2" }], ["path", { d: "M14 2v2" }], [ "path", { d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" } ], ["path", { d: "M6 2v2" }] ],
    "search": [ ["path", { d: "m21 21-4.34-4.34" }], ["circle", { cx: "11", cy: "11", r: "8" }] ],
    "route": [ ["circle", { cx: "6", cy: "19", r: "3" }], ["path", { d: "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" }], ["circle", { cx: "18", cy: "5", r: "3" }] ],
    "compass": [ ["circle", { cx: "12", cy: "12", r: "10" }], [ "path", { d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" } ] ],
    "image": [ ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }], ["circle", { cx: "9", cy: "9", r: "2" }], ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }] ],
    "plus": [ ["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }] ],
    "circle-question-mark": [ ["circle", { cx: "12", cy: "12", r: "10" }], ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }], ["path", { d: "M12 17h.01" }] ],
    "ellipsis": [ ["circle", { cx: "12", cy: "12", r: "1" }], ["circle", { cx: "19", cy: "12", r: "1" }], ["circle", { cx: "5", cy: "12", r: "1" }] ],
    "map-pin": [ [ "path", { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" } ], ["circle", { cx: "12", cy: "10", r: "3" }] ],
  };

  /* Font Awesome `fill` bilan chiziladi va O'ZINING viewBox'i bor
     (24x24 emas) — shuning uchun alohida saqlanadi.

     `street-view` — panorama (ko'cha ko'rinishi) tugmasi uchun.
     Lucide to'plamida shu ma'noni beradigan ikona yo'q. */
  var FA = {
    "street-view": {
      viewBox: "0 0 512 512",
      d: "M320 64A64 64 0 1 0 192 64a64 64 0 1 0 128 0zm-96 96c-35.3 0-64 28.7-64 64l0 48c0 17.7 14.3 32 32 32l1.8 0 11.1 99.5c1.8 16.2 15.5 28.5 31.8 28.5l38.7 0c16.3 0 30-12.3 31.8-28.5L318.2 304l1.8 0c17.7 0 32-14.3 32-32l0-48c0-35.3-28.7-64-64-64l-64 0zM132.3 394.2c13-2.4 21.7-14.9 19.3-27.9s-14.9-21.7-27.9-19.3c-32.4 5.9-60.9 14.2-82 24.8c-10.5 5.3-20.3 11.7-27.8 19.6C6.4 399.5 0 410.5 0 424c0 21.4 15.5 36.1 29.1 45c14.7 9.6 34.3 17.3 56.4 23.4C130.2 504.7 190.4 512 256 512s125.8-7.3 170.4-19.6c22.1-6.1 41.8-13.8 56.4-23.4c13.7-8.9 29.1-23.6 29.1-45c0-13.5-6.4-24.5-14-32.6c-7.5-7.9-17.3-14.3-27.8-19.6c-21-10.6-49.5-18.9-82-24.8c-13-2.4-25.5 6.3-27.9 19.3s6.3 25.5 19.3 27.9c30.2 5.5 53.7 12.8 69 20.5c3.2 1.6 5.8 3.1 7.9 4.5c3.6 2.4 3.6 7.2 0 9.6c-8.8 5.7-23.1 11.8-43 17.3C374.3 457 318.5 464 256 464s-118.3-7-157.7-17.9c-19.9-5.5-34.2-11.6-43-17.3c-3.6-2.4-3.6-7.2 0-9.6c2.1-1.4 4.8-2.9 7.9-4.5c15.3-7.7 38.8-14.9 69-20.5z"
    }
  };

  /* Atributlar BIZNING faylimizdan keladi (foydalanuvchi ma'lumotidan
     emas), lekin qo'shtirnoq baribir ekranlanadi — fayl kelajakda
     yangilanganda markup buzilib qolmasin. */
  function attrs(o) {
    var s = "";
    for (var k in o) {
      if (k === "key" || !Object.prototype.hasOwnProperty.call(o, k)) continue;
      s += " " + k + '="' + String(o[k]).replace(/"/g, "&quot;") + '"';
    }
    return s;
  }

  /* Lucide ikonasi. Noma'lum nom uchun BO'SH satr qaytadi — sahifada
     "undefined" so'zi chiqib qolmasin. */
  function lucide(name, cls) {
    var nodes = LUCIDE[name];
    if (!nodes) return "";
    var body = "";
    for (var i = 0; i < nodes.length; i++) {
      body += "<" + nodes[i][0] + attrs(nodes[i][1]) + "/>";
    }
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }

  function fa(name, cls) {
    var ic = FA[name];
    if (!ic) return "";
    return '<svg class="' + (cls || "") + '" viewBox="' + ic.viewBox + '" ' +
      'fill="currentColor" aria-hidden="true"><path d="' + ic.d + '"/></svg>';
  }

  global.OndexIcons = { lucide: lucide, fa: fa };
})(window);
