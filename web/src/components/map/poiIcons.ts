"use client";

/**
 * POI belgilari (OSM'dan kelgan joylar) — sprite FAYLISIZ.
 *
 * ┌─ NEGA SPRITE EMAS ─────────────────────────────────────────────────
 * MapLibre odatda belgilarni tayyor sprite (PNG + JSON) dan oladi.
 * Bu bizga ikki narsani qo'shardi: yasash bosqichi (SVG → atlas) va
 * serverdan yana ikkita fayl. Yangi turkum qo'shish har safar sprite'ni
 * qayta yasash va binarni qayta qurishni talab qilardi.
 *
 * Buning o'rniga belgilar BRAUZERDA, tuvalda chiziladi va MapLibre'ga
 * `addImage` bilan beriladi. Uslub faqat NOM so'raydi
 * (`ondex-poi-<class>`), rasm topilmasa `styleimagemissing` hodisasi
 * ishlaydi va biz shu zahoti chizib beramiz.
 * └──────────────────────────────────────────────────────────────────
 *
 * ┌─ OnDexMap BELGILARI BILAN BIR XIL ─────────────────────────────────
 * OSM joylari foydalanuvchi qo'shgan ob'ektlar (`places/kindUi.tsx`) bilan AYNAN
 * bir xil chizuvchidan (`markerBadge.ts`) chiziladi: o'lcham, halqa, chiziq qalinligi,
 * Lucide shakllari bir xil. Mos kelgan joylar OnDexMap belgisining o'zi:
 * avtobus bekati — «Transport bekati» belgisi, avtoturargoh — «P».
 * Nomlar belgining o'ng yonida, belgi rangining to'qroq tusida (uslub: `poi-tier1..4`,
 * har biri o'z muhimlik darajasida — `components/map/importance.ts`).
 * └────────────────────────────────────────────────────────────────────
 *
 * ┌─ RO'YXAT MANBAI — OpenMapTiles'ning O'ZI, TAXMIN EMAS ──────────────
 * Kalitlar (2026-09-22 tekshirilgan, rasmiy sxema:
 * https://github.com/openmaptiles/openmaptiles/blob/master/layers/poi/poi.yaml):
 *   1) `class.sql` dagi 37 ta ANIQ "quti" nomi (ko'p xil OSM tegini bitta
 *      klassga yig'adi — masalan `shop=supermarket` HAM, `shop=greengrocer`
 *      HAM klass sifatida `grocery` beradi, `supermarket` degan klass
 *      UMUMAN YO'Q);
 *   2) qutiga tushmagan subklass — o'z nomi bilan klass bo'lib chiqadi
 *      (masalan `amenity=bank` → klass `bank`).
 * ⚠️ TUZOQ (2026-09-22 topilgan xato): ilgari shu ro'yxatda `pub`,
 * `supermarket`, `convenience`, `marketplace` degan kalitlar bor edi — bular
 * HAQIQIY klass NOMLARI EMAS (mos ravishda `beer`, `grocery`, `shop`,
 * `grocery` ga yig'iladi) va HECH QACHON mos kelmasdi: shu turdagi haqiqiy
 * joylar sukut bo'yicha kulrang «boshqa» belgisi bo'lib chiqib turardi.
 * Yangi turkum qo'shishdan oldin rasmiy `class.sql`/`poi.yaml` bilan
 * tekshiring — "shunga o'xshash nom qo'yish" xato qiladi.
 *
 * Tuzatilgach Chust'ning HAQIQIY plitka ma'lumotida (`querySourceFeatures`,
 * 304 ta xususiyat) tasdiqlandi: eski xato nomlar HAQIQATAN kelmaydi, yangi
 * qo'shilganlar (`grocery`, `shop`, `office`, `cafe`, `ice_cream`,
 * `art_gallery`, `clothing_store`...) HAQIQATAN keladi. Shu tekshiruvda yana
 * 3 ta DEFS'da yo'q, lekin haqiqiy klass ham topildi: `sports_centre`,
 * `swimming_pool`, `toilets` — ular ham qo'shildi.
 * └────────────────────────────────────────────────────────────────────
 *
 * Belgi shakllari Lucide'dan (`lib/lucideCanvas.ts`).
 */

import type { LucideIconData } from "lucide-react";
import { __iconData as anchorData } from "lucide-react/dist/esm/icons/anchor.mjs";
import { __iconData as bedData } from "lucide-react/dist/esm/icons/bed-double.mjs";
import { __iconData as beerData } from "lucide-react/dist/esm/icons/beer.mjs";
import { __iconData as briefcaseData } from "lucide-react/dist/esm/icons/briefcase.mjs";
import { __iconData as cableCarData } from "lucide-react/dist/esm/icons/cable-car.mjs";
import { __iconData as busData } from "lucide-react/dist/esm/icons/bus-front.mjs";
import { __iconData as castleData } from "lucide-react/dist/esm/icons/castle.mjs";
import { __iconData as carData } from "lucide-react/dist/esm/icons/car-front.mjs";
import { __iconData as cupData } from "lucide-react/dist/esm/icons/coffee.mjs";
import { __iconData as cardData } from "lucide-react/dist/esm/icons/credit-card.mjs";
import { __iconData as crossData } from "lucide-react/dist/esm/icons/cross.mjs";
import { __iconData as dotData } from "lucide-react/dist/esm/icons/dot.mjs";
import { __iconData as flagData } from "lucide-react/dist/esm/icons/flag.mjs";
import { __iconData as flowerData } from "lucide-react/dist/esm/icons/flower-2.mjs";
import { __iconData as fuelData } from "lucide-react/dist/esm/icons/fuel.mjs";
import { __iconData as schoolData } from "lucide-react/dist/esm/icons/graduation-cap.mjs";
import { __iconData as hospitalData } from "lucide-react/dist/esm/icons/hospital.mjs";
import { __iconData as iceCreamData } from "lucide-react/dist/esm/icons/ice-cream-cone.mjs";
import { __iconData as infoData } from "lucide-react/dist/esm/icons/info.mjs";
import { __iconData as landmarkData } from "lucide-react/dist/esm/icons/landmark.mjs";
import { __iconData as logInData } from "lucide-react/dist/esm/icons/log-in.mjs";
import { __iconData as mailData } from "lucide-react/dist/esm/icons/mail.mjs";
import { __iconData as musicData } from "lucide-react/dist/esm/icons/music.mjs";
import { __iconData as paletteData } from "lucide-react/dist/esm/icons/palette.mjs";
import { __iconData as pawData } from "lucide-react/dist/esm/icons/paw-print.mjs";
import { __iconData as shieldData } from "lucide-react/dist/esm/icons/shield.mjs";
import { __iconData as shirtData } from "lucide-react/dist/esm/icons/shirt.mjs";
import { __iconData as bagData } from "lucide-react/dist/esm/icons/shopping-bag.mjs";
import { __iconData as cartData } from "lucide-react/dist/esm/icons/shopping-cart.mjs";
import { __iconData as tentData } from "lucide-react/dist/esm/icons/tent.mjs";
import { __iconData as toiletData } from "lucide-react/dist/esm/icons/toilet.mjs";
import { __iconData as trainData } from "lucide-react/dist/esm/icons/train-front.mjs";
import { __iconData as sportData } from "lucide-react/dist/esm/icons/trophy.mjs";
import { __iconData as treeData } from "lucide-react/dist/esm/icons/trees.mjs";
import { __iconData as foodData } from "lucide-react/dist/esm/icons/utensils.mjs";
// `waves` — eski nom (taxallus), haqiqiy modul `waves-horizontal`.
import { __iconData as wavesData } from "lucide-react/dist/esm/icons/waves-horizontal.mjs";
import { __iconData as wineData } from "lucide-react/dist/esm/icons/wine.mjs";

import { BADGE_RATIO, LABEL_DARKEN, darken, loadPngPin, makeBadge, type IconImage } from "./markerBadge";

export const POI_PREFIX = "ondex-poi-";

interface IconDef {
  color: string;
  data?: LucideIconData;
  /** Belgi o'rniga harf (avtoturargoh — «P»). */
  letter?: string;
  stroke?: number;
}

/**
 * Turkum → rang va belgi. To'liq rasmiy ro'yxat (yuqoridagi izohga qarang):
 * 37 ta `class.sql` qutisi + qutiga tushmaydigan keng tarqalgan subklasslar.
 * Ro'yxatda yo'q turkum `other` ga tushadi: bu — ATAYLAB, noma'lum turkum
 * uchun "o'xshash" belgi tanlash yolg'on ma'no berardi.
 */
const DEFS: Record<string, IconDef> = {
  // ── Ovqatlanish ──────────────────────────────────────────────────────
  // `restaurant`/`cafe`/`grocery` rangi PNG pin bilan (pastga qarang)
  // moslashtirilgan — yorliq matni ham shu tusda chiqadi (`poiLabelColor`).
  // Lucide `data` shu 3 tasi uchun FAQAT PNG topilmasa ishlatiladi
  // (tarmoq xatosi — zaxira yo'l).
  restaurant: { color: "#f2611d", data: foodData },
  fast_food: { color: "#f59e42", data: foodData },
  cafe: { color: "#f2611d", data: cupData },
  bar: { color: "#a855f7", data: cupData },
  // `pub` klass NOMI EMAS (`beer` qutisiga yig'iladi, biergarten bilan birga).
  beer: { color: "#a855f7", data: beerData },
  alcohol_shop: { color: "#a855f7", data: wineData },
  ice_cream: { color: "#f59e42", data: iceCreamData },
  bakery: { color: "#f97316", data: bagData },

  // ── Savdo ────────────────────────────────────────────────────────────
  // `supermarket`/`marketplace` klass NOMI EMAS — ikkalasi ham `grocery`.
  grocery: { color: "#f2611d", data: cartData },
  // `convenience` klass NOMI EMAS — oddiy `shop` qutisiga tushadi (u yerga
  // ko'plab kichik do'kon turi — kiyim, elektronika va h.k. ham yig'iladi).
  shop: { color: "#6fb9ef", data: bagData },
  clothing_store: { color: "#6fb9ef", data: bagData },
  laundry: { color: "#38bdf8", data: shirtData },

  // ── Sog'liq ──────────────────────────────────────────────────────────
  // `pharmacy`/`hospital`/`doctors`/`dentist` — har biri O'Z PNG pinida
  // (pastga qarang), rangi ham shunga moslashtirilgan.
  pharmacy: { color: "#e2231f", data: crossData },
  hospital: { color: "#e2231f", data: hospitalData },
  doctors: { color: "#e2231f", data: crossData },
  dentist: { color: "#e2231f", data: crossData },

  // ── Moliya va ish ────────────────────────────────────────────────────
  bank: { color: "#e8453c", data: cardData },
  atm: { color: "#e8453c", data: cardData },
  office: { color: "#78716c", data: briefcaseData },

  // ── Transport ────────────────────────────────────────────────────────
  fuel: { color: "#9b8cf5", data: fuelData },
  car: { color: "#64748b", data: carData },
  // OnDexMap «Transport bekati» va «Avtoturargoh» belgilari bilan AYNAN bir xil.
  bus: { color: "#3178e2", data: busData },
  parking: { color: "#3b82f6", letter: "P" },
  railway: { color: "#0ea5e9", data: trainData },
  aerialway: { color: "#0ea5e9", data: cableCarData },
  harbor: { color: "#0ea5e9", data: anchorData },
  // Metro/temir yo'l bekati KIRISHI (nuqta) — bekatning o'zi emas.
  entrance: { color: "#94a3b8", data: logInData },

  // ── Ta'lim ───────────────────────────────────────────────────────────
  // Har uchalasi — PNG pin (pastga qarang), rangi shunga moslashtirilgan.
  school: { color: "#e6a700", data: schoolData },
  college: { color: "#e6a700", data: schoolData },
  library: { color: "#e6a700", data: schoolData },

  // ── Turar-joy va dam olish ───────────────────────────────────────────
  // `lodging` — PNG pin (pastga qarang), rangi shunga moslashtirilgan.
  lodging: { color: "#3c434e", data: bedData },
  campsite: { color: "#4cc15f", data: tentData },

  // ── Diniy va tarixiy ─────────────────────────────────────────────────
  place_of_worship: { color: "#8b7355", data: landmarkData },
  castle: { color: "#8b7355", data: castleData },
  cemetery: { color: "#8b7355", data: flowerData },
  art_gallery: { color: "#a78bfa", data: paletteData },
  music: { color: "#ec4899", data: musicData },

  // ── Davlat ───────────────────────────────────────────────────────────
  police: { color: "#3b82f6", data: shieldData },
  town_hall: { color: "#3b82f6", data: landmarkData },
  post: { color: "#3b82f6", data: mailData },

  // ── Tabiat va sport ──────────────────────────────────────────────────
  park: { color: "#4cc15f", data: treeData },
  garden: { color: "#4cc15f", data: treeData },
  golf: { color: "#4cc15f", data: flagData },
  zoo: { color: "#4cc15f", data: pawData },
  pitch: { color: "#4cc15f", data: sportData },
  stadium: { color: "#4cc15f", data: sportData },
  sport: { color: "#4cc15f", data: sportData },
  sports_centre: { color: "#4cc15f", data: sportData },
  swimming: { color: "#38bdf8", data: sportData },
  swimming_pool: { color: "#38bdf8", data: wavesData },
  toilets: { color: "#94a3b8", data: toiletData },

  // ── Diqqatga sazovor ─────────────────────────────────────────────────
  attraction: { color: "#f59e42", data: infoData },
  information: { color: "#94a3b8", data: infoData },

  other: { color: "#94a3b8", data: dotData, stroke: 3.4 },
};

/**
 * MapLibre `text-color` ifodasi: har turkum nomi o'z belgisi rangida (to'qroq) —
 * OnDexMap ob'ektlari (`kindUi.placeLabelColor`) bilan bir xil qoida.
 */
export function poiLabelColor(): unknown[] {
  const expr: unknown[] = ["match", ["coalesce", ["get", "class"], "other"]];
  for (const [cls, def] of Object.entries(DEFS)) expr.push(cls, darken(def.color, LABEL_DARKEN));
  expr.push(darken(DEFS.other.color, LABEL_DARKEN));
  return expr;
}

/**
 * Turkum uchun belgi rasmi.
 *
 * `null` — tuval mavjud emas (masalan test muhitida): chaqiruvchi
 * shunchaki rasm qo'shmaydi va MapLibre belgisiz davom etadi.
 */
export function makePoiIcon(className: string): IconImage | null {
  return makeBadge(DEFS[className] ?? DEFS.other);
}

/** MapLibre'ga beriladigan piksel nisbati. */
export const POI_PIXEL_RATIO = BADGE_RATIO;

// ── OSM klassi → PNG pin (`image/geologo/`) ─────────────────────────────
//
// ┌─ FOYDALANUVCHI TALABI ─────────────────────────────────────────────
// «osm ni ku xam shunaqa apelsin pin bo'lsin OnDexMap nikiga o'xshab» —
// OnDexMap'ning o'z «Tashkilot» turkumlarida (`kindUi.tsx`) ishlatilgan
// AYNAN o'sha rasmlar, OSM'dan kelgan mos klasslarda ham. Shu bilan
// avvalgi «ikki manba — ikki xil ko'rinish» ziddiyati yo'qoladi.
// `hospital`/`pharmacy`/`doctors`/`dentist` — alohida rasmlar (`kasalxona.png`,
// `dorixona.png`, `shifokor.png`, `stomotologiya.png`), har biriga fon
// olib tashlangan (`sharp`, fon-yorug'lik asosida alfa hisoblash).
// ⚠️ `image/geologo/`dagi qolgan sog'liq belgilari (laboratoriya,
// kardiologiya, oftalmolog, pediatr, vaksinatsiya, rentgen, UZI,
// ginekologiya, reabilitatsiya, profilaktika, statsionar, qabulxona)
// ULANMAGAN — ularga mos OSM `poi.class` HAM, OnDexMap turkumi HAM yo'q
// (OSM'da bular alohida klass emas, `doctors`ning ichki tegi, xaritada
// hech qachon so'ralmaydi).
// ⚠️ `style-chust.json` dagi `poi-tier1`/`poi-tier2`/`poi-tier3` `icon-anchor`
// ifodasi shu ro'yxatga QO'LDA moslangan (JSON'ga JS import qilib
// bo'lmaydi) — bu yerga klass qo'shsangiz, o'sha yerni ham yangilang.
// └────────────────────────────────────────────────────────────────────
const PNG_ICON: Record<string, string> = {
  restaurant: "/org-icons/restaurant.png",
  cafe: "/org-icons/cafe.png",
  grocery: "/org-icons/grocery.png",
  hospital: "/org-icons/hospital.png",
  pharmacy: "/org-icons/pharmacy.png",
  doctors: "/org-icons/doctors.png",
  dentist: "/org-icons/dentist.png",
  lodging: "/org-icons/hotel.png",
  school: "/org-icons/school.png",
  college: "/org-icons/college.png",
  library: "/org-icons/library.png",
};

/** PNG pin belgisini yuklaydi (topilmasa `null` — chaqiruvchi `makePoiIcon`ga tushadi). */
export function loadPoiPngIcon(className: string): Promise<IconImage | null> | null {
  const src = PNG_ICON[className];
  return src ? loadPngPin(src) : null;
}
