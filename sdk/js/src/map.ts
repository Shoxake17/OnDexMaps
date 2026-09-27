import { DEFAULT_STYLE_URL } from "./limits.js";

/**
 * `customAttribution` ni atribut yorlig'iga qo'yishdan OLDIN tekshiradi.
 *
 * ┌─ NEGA KERAK ───────────────────────────────────────────────────────┐
 * MapLibre atribut matnini `innerHTML` bilan joylashtiradi va uni
 * SANITIZATSIYA QILMAYDI (4.x da `DOM.sanitize` umuman yo'q; 6.x dagi
 * versiyasi esa 6.4.1 gacha chetlab o'tilardi — GHSA-jrc7-96c5-q579).
 *
 * Demak bu yerga tushgan har qanday HTML bajariladi. Brend matni
 * odatda statik, lekin integrator uni sozlamadan yoki foydalanuvchi
 * profilidan olib qo'yishi mumkin — o'shanda bu to'g'ridan-to'g'ri
 * XSS yo'liga aylanadi.
 *
 * Shuning uchun `<a href>` va oddiy matn belgilashdan boshqasi RAD
 * ETILADI. Rad etish jim emas: `throw` ishlab chiqish vaqtidayoq
 * ko'rinadi, jimgina tozalash esa "nega logotipim chiqmayapti"
 * degan savol tug'dirardi.
 * └────────────────────────────────────────────────────────────────────┘
 */
function tekshirAtribut(matn: string): void {
  const xato = (sabab: string): never => {
    throw new Error(
      `OnDexMap: customAttribution rad etildi — ${sabab}.\n` +
        "Atribut yorlig'i HTML sifatida joylashtiriladi, shuning uchun " +
        "unda faqat matn va oddiy `<a href=\"https://…\">` havola bo'lishi mumkin. " +
        "Bu qiymat foydalanuvchi kiritmasidan kelyaptimi? Unda uni atributga qo'ymang.",
    );
  };

  if (/<\s*(script|iframe|object|embed|style|svg|img|link|meta|form)\b/i.test(matn)) {
    xato("xavfli teg");
  }
  // `onclick=`, `onerror=` va hokazo — bo'shliq yoki `/` orqali ham.
  if (/\bon[a-z]+\s*=/i.test(matn)) xato("hodisa atributi (`on…=`)");
  if (/javascript:|data:|vbscript:/i.test(matn)) xato("xavfli sxema");
  // `<a>` va `</a>` dan boshqa teg qoldirmaymiz.
  const teglar = matn.match(/<\/?\s*([a-z][a-z0-9]*)/gi) ?? [];
  for (const t of teglar) {
    const nom = t.replace(/[<\/\s]/g, "").toLowerCase();
    if (nom !== "a" && nom !== "span" && nom !== "b" && nom !== "strong") {
      xato(`ruxsat etilmagan teg \`${nom}\``);
    }
  }
}

/* ── maplibre-gl / pmtiles minimal tiplari ─────────────────────────
   SDK ularni IMPORT QILMAYDI: ular `peerDependencies` va ularni
   ilovaning o'zi olib keladi. Shuning uchun bu yerda faqat kerakli
   shakl tasvirlanadi — SDK maplibre'siz ham (faqat REST uchun)
   ishlatilishi mumkin. */

/**
 * Xarita obyektining SDK'ga kerak bo'lgan YAGONA metodi.
 *
 * ⚠️ Bu qaytariladigan tur EMAS. `createMap` chaqiruvchining o'z
 * `maplibregl.Map` turini qaytaradi ({@link createMap} ga qarang) —
 * aks holda `map.on(…)`, `map.getBounds()` kabi hamma narsa
 * yo'qolardi. Bu xato README misollarini kompilyatsiya qilganda
 * aniqlangan edi.
 */
interface MapLike {
  addControl(control: unknown, position?: string): unknown;
}

/**
 * `maplibre-gl` modulining SDK ishlatadigan qismi.
 *
 * `M` — kutubxonaning haqiqiy `Map` turi. U parametr sifatida
 * o'tkaziladi va aynan shu tur qaytariladi, shuning uchun SDK
 * maplibre'ni IMPORT QILMAY turib ham uning to'liq API'sini
 * yo'qotmaydi.
 */
interface MapLibreLike<M extends MapLike> {
  // ⚠️ Konstruktor parametrlari `never[]`, `Record<string, unknown>`
  // emas. Sabab — kontravariantlik: maplibre'ning haqiqiy
  // `new (options: MapOptions)` imzosi `Record<string, unknown>`
  // qabul qiladigan imzoga MOS KELMAYDI, va SDK haqiqiy `maplibregl`
  // ni rad etib qo'yardi. Buni README misollarini kompilyatsiya
  // qilish aniqladi.
  //
  // Parametrlarni SDK'ning o'zi quradi (pastda), shuning uchun bu
  // yerda ularning turi tekshirilishi shart emas — bizga faqat
  // qaytariladigan `M` kerak.
  Map: new (...args: never[]) => M;
  AttributionControl: new (...args: never[]) => unknown;
  NavigationControl: new (...args: never[]) => unknown;
  addProtocol(name: string, fn: never): void;
}

/** SDK quradigan konstruktor argumentlari. */
type MapCtorArgs = [Record<string, unknown>];
type AttribCtorArgs = [{ compact: boolean; customAttribution?: string }];

export interface CreateMapOptions<M extends MapLike = MapLike> {
  /** Xarita joylashadigan element yoki uning `id` si. */
  container: HTMLElement | string;
  /** `import maplibregl from "maplibre-gl"` natijasi. */
  maplibregl: MapLibreLike<M>;
  /** `new Protocol().tile` — `import { Protocol } from "pmtiles"`. */
  pmtilesProtocol?: unknown;
  center?: [number, number];
  zoom?: number;
  /** Uslub manzili. Standart — OnDexMap uslubi. */
  style?: string;
  /** Atribut yorlig'ining burchagi. Standart `bottom-right`. */
  attributionPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Yoniga qo'shiladigan o'z brendingiz, masalan `"© Mening Kompaniyam"`. */
  customAttribution?: string;
  /** Navigatsiya tugmalari. Standart — qo'shiladi. */
  navigationControl?: boolean;
  /** Qolgan `maplibregl.Map` parametrlari. */
  mapOptions?: Record<string, unknown>;
}

/**
 * OnDexMap xaritasini yaratadi.
 *
 * ┌─ NEGA SHU FUNKSIYA BOR ────────────────────────────────────────────┐
 * Xarita yaratish kodining o'zi uzun emas. Lekin unda TAKRORLANADIGAN
 * xato bor edi: hujjatning 8 ta sahifasida `compact: false`
 * yozilmagani uchun atribut 640px dan tor ekranda foydalanuvchi
 * xaritani birinchi surishida «i» tugmasi ortiga yashirinardi.
 *
 * Atribut — ODbL litsenziyasining va foydalanish shartlarining talabi.
 * Uni «hujjatni o'qigan odam to'g'ri yozadi» degan umidga qoldirish
 * ishonchsiz: sinovda aynan shunday bo'lmadi.
 *
 * Shu sababli bu funksiya atributni O'ZI qo'yadi va uni o'chirib
 * bo'lmaydi: `mapOptions` orqali `attributionControl` berilsa ham
 * e'tiborga olinmaydi.
 * └────────────────────────────────────────────────────────────────────┘
 *
 * @example
 * import maplibregl from "maplibre-gl";
 * import { Protocol } from "pmtiles";
 * import { createMap } from "@ondexmap/sdk";
 *
 * const map = createMap({
 *   container: "map",
 *   maplibregl,
 *   pmtilesProtocol: new Protocol().tile,
 *   center: [69.2401, 41.2995],
 *   zoom: 12,
 * });
 *
 * // `map` — maplibre'ning O'Z `Map` turi, hamma metodi joyida:
 * map.on("moveend", () => console.log(map.getBounds()));
 */
export function createMap<M extends MapLike>(opts: CreateMapOptions<M>): M {
  const { maplibregl } = opts;

  if (opts.customAttribution !== undefined) {
    tekshirAtribut(opts.customAttribution);
  }

  // PMTiles protokoli xarita yaratilishidan OLDIN ro'yxatdan o'tishi
  // SHART — aks holda uslubdagi `pmtiles://` manbalari yuklanmaydi.
  if (opts.pmtilesProtocol) {
    maplibregl.addProtocol("pmtiles", opts.pmtilesProtocol as never);
  }

  // `never[]` imzolar chaqiruvda qayta tiklanadi: argumentlarni shu
  // yerda SDK quradi, shuning uchun ularning shakli ma'lum.
  const MapCtor = maplibregl.Map as unknown as new (...a: MapCtorArgs) => M;
  const AttribCtor = maplibregl.AttributionControl as unknown as new (
    ...a: AttribCtorArgs
  ) => unknown;
  const NavCtor = maplibregl.NavigationControl as unknown as new () => unknown;

  const {
    attributionControl: _yoq,
    ...qolgan
  } = (opts.mapOptions ?? {}) as Record<string, unknown>;
  void _yoq; // ataylab e'tiborsiz qoldiriladi

  const map = new MapCtor({
    container: opts.container,
    style: opts.style ?? DEFAULT_STYLE_URL,
    center: opts.center ?? [69.2401, 41.2995],
    zoom: opts.zoom ?? 12,
    ...qolgan,
    // Standart yorliq o'chiriladi va pastda O'ZIMIZNIKI qo'yiladi.
    attributionControl: false,
  });

  if (opts.navigationControl !== false) {
    map.addControl(new NavCtor(), "top-right");
  }

  map.addControl(
    new AttribCtor({
      // ⚠️ `false` — QAT'IY. Sozlanmaydi.
      compact: false,
      ...(opts.customAttribution ? { customAttribution: opts.customAttribution } : {}),
    }),
    opts.attributionPosition ?? "bottom-right",
  );

  return map;
}
