"use client";

/**
 * Xarita nusxasini bitta joyda saqlaydi va uni kontekst orqali
 * beradi.
 *
 * ┌─ NEGA KONTEKST ────────────────────────────────────────────────────┐
 * O'lchash, marshrut, qidiruv — har biri xaritaga murojaat qiladi.
 * Ular `props` orqali uzatilsa, har bir vosita qo'shilganda yuqoridagi
 * komponent ham o'zgartirilishi kerak bo'lardi. Kontekst bilan vosita
 * shunchaki `useMap()` deydi va mustaqil qo'shiladi.
 * └──────────────────────────────────────────────────────────────────┘
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
// maplibre-gl v6 `default` export'ni olib tashladi — nomlangan import.
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import { MAHALLA_ZOOM_IN, STYLE_URL, UZ_BOUNDS } from "@/lib/config";
import type { MapInit } from "@/lib/mapUrl";
import { api, type MahallaCollection } from "@/lib/api";
import {
  prefers3D,
  prefersSatellite,
  save3D,
  saveSatellite,
} from "@/lib/prefs";
import { TIERS } from "./importance";
import { loadPoiPngIcon, makePoiIcon, POI_PIXEL_RATIO, POI_PREFIX, poiLabelColor } from "./poiIcons";
import { cityById } from "@/lib/cities";
import { useUrlSync, type Place } from "./useUrlSync";
import { applyMapTheme } from "./theme";

export const LAYER = {
  mahallaFill: "mahalla-fill",
  mahallaLine: "mahalla-line",
  mahallaLabel: "mahalla-label",
} as const;

const SOURCE = {
  shapes: "ondex-mahallas",
  points: "ondex-mahalla-points",
} as const;

export interface SelectedArea {
  id: string;
  name: string;
  kind: string;
}

interface MapContextValue {
  map: MLMap | null;
  /**
   * Xarita tuvali joylashadigan element.
   *
   * Provayder uni O'ZI chizmaydi: shunda tuval joylashuvini sahifa
   * belgilaydi (yon panel yonida, ustida emas) va provayder faqat
   * xarita hayot siklini boshqaradi.
   */
  holderRef: React.RefObject<HTMLDivElement | null>;
  /** Uslub yuklanib, qatlamlar qo'shilgandan keyin `true`. */
  ready: boolean;
  selected: SelectedArea | null;
  selectArea: (id: string | null) => void;
  styleError: string | null;
  /** Sun'iy yo'ldosh manbasi sozlanganmi (tugma shunga qarab chiqadi). */
  satelliteAvailable: boolean;
  satellite: boolean;
  /** Sun'iy yo'ldosh manbasi krediti (masalan «Powered by Esri»); sozlanmagan bo'lsa bo'sh. */
  satelliteCredit: string;
  toggleSatellite: () => void;
  /** Xarita hozir 3D (egilgan) holatdami. Tugma yozuvi shunga qaraydi. */
  is3D: boolean;
  toggle3D: () => void;
  /** Xizmat hududi `[minLng, minLat, maxLng, maxLat]`, yoki noma'lum. */
  serviceBounds: [number, number, number, number] | null;
  /**
   * Xarita HOZIR qaysi shahar yaqinida. Sahifa ochilgan shahar EMAS:
   * xarita surilganda o'zgaradi (sarlavha va ob-havo shundan olinadi).
   */
  place: Place;
}

/**
 * Sun'iy yo'ldosh yoqilganda YASHIRILADIGAN vektor qatlamlari.
 *
 * ⚠️ Binolar bu yerda EMAS: ularning ko'rinishi ikki omilga (2D/3D va
 * sun'iy yo'ldosh) bog'liq va `applyBuildings` da BITTA joyda hal
 * qilinadi. Ikki joyda boshqarilsa, biri ikkinchisini bekor qilib
 * qo'yardi (sun'iy yo'ldoshni o'chirish ikkala bino qatlamini ham
 * qaytarib, 2D rejimda 3D ko'rinib qolardi).
 */
const GROUND_LAYERS = [
  "landcover",
  "landuse",
  "park",
  "water",
  "waterway",
] as const;

const SATELLITE = { src: "ondex-satellite", layer: "ondex-satellite" } as const;

/** Shu egilishdan boshlab xarita "3D" hisoblanadi (daraja). */
export const PITCH_3D = 10;

const BUILDING = {
  flat: "ms-building-flat",
  solid: "ms-building-3d",
} as const;

/**
 * Uslubdagi `ms-building-flat` ning ASL shaffofligi (zoom bo'yicha
 * so'nish). U bir marta uslubdan o'qib olinadi — kodga qayta yozilsa
 * uslub o'zgarganda ikki nusxa bir-biridan farq qilib qolardi.
 */
const flatOpacity = new WeakMap<MLMap, unknown>();

/**
 * Binolarning ko'rinishi: 2D/3D va sun'iy yo'ldoshga qarab.
 *
 * ┌─ NEGA 2D DA 3D KO'RINARDI ─────────────────────────────────────────
 * Uslubda tekis qatlam (`ms-building-flat`) z14.5–15.8 da SO'NADI, hajmli
 * qatlam (`ms-building-3d`) esa z15.8 dan boshlab to'liq chiqadi. Ya'ni
 * yaqinlashtirilganda faqat hajmli qatlam qolardi. Kamera tik (egilish
 * 0°) bo'lsa ham uning devorlari perspektiva tufayli ko'rinib turadi —
 * "2D tugmasi bosildi, lekin xarita 3D".
 *
 * Endi 2D da hajmli qatlam BUTUNLAY o'chiriladi va tekis qatlam
 * so'nmasdan (shaffofligi 1) chiziladi — ya'ni haqiqiy tekis xarita.
 * └──────────────────────────────────────────────────────────────────
 */
function applyBuildings(map: MLMap, is3D: boolean, satellite: boolean) {
  if (map.getLayer(BUILDING.solid)) {
    map.setLayoutProperty(
      BUILDING.solid,
      "visibility",
      !satellite && is3D ? "visible" : "none",
    );
  }
  if (map.getLayer(BUILDING.flat)) {
    if (!flatOpacity.has(map)) {
      flatOpacity.set(map, map.getPaintProperty(BUILDING.flat, "fill-opacity"));
    }
    map.setLayoutProperty(BUILDING.flat, "visibility", satellite ? "none" : "visible");
    // v6: qiymat turi qat'iyroq — asl qiymat `unknown` sifatida
    // saqlangan (uslubdan o'qilgan, turi oldindan noma'lum).
    map.setPaintProperty(
      BUILDING.flat,
      "fill-opacity",
      (is3D ? flatOpacity.get(map) : 1) as never,
    );
  }
}

/** Xaritaning HOZIRGI egilishi va sun'iy yo'ldosh holatiga ko'ra yangilaydi. */
function syncBuildings(map: MLMap) {
  applyBuildings(
    map,
    map.getPitch() >= PITCH_3D,
    Boolean(map.getLayer(SATELLITE.layer)),
  );
}

const MapContext = createContext<MapContextValue | null>(null);

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap faqat MapProvider ichida ishlaydi");
  return ctx;
}

/** PMTiles protokoli global — bir marta ro'yxatdan o'tadi. */
let protocolReady = false;
function ensurePMTilesProtocol() {
  if (protocolReady) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  protocolReady = true;
}

function selectionFilter(id: string | null) {
  return id === null
    ? ["in", ["get", "id"], ["literal", []]]
    : ["==", ["get", "id"], id];
}

export function MapProvider({
  children,
  init,
  dark = false,
}: {
  children: ReactNode;
  init: MapInit;
  /** Qorong'i xarita mavzusi (mobil + qurilma qorong'i rejimda). */
  dark?: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  // Boshlang'ich holat FAQAT xarita yaratilganda o'qiladi (effekt bir marta
  // ishlaydi). Keyin holatni xaritaning o'zi boshqaradi.
  const initRef = useRef(init);
  // Sun'iy yo'ldosh rejimi HOZIR kerakmi. Holat (`satellite`) EMAS, ref:
  // manzil qatori shundan olinadi va qatlam qo'shilishini kutmaydi
  // (`useUrlSync` ga qarang).
  const wantSatellite = useRef(false);
  const [place, setPlace] = useState<Place>(() => ({
    city: cityById(init.cityId),
    inCity: true,
  }));
  // Shahar o'zgarmagan bo'lsa holat YANGILANMAYDI (bir xil obyektni qaytaramiz):
  // aks holda har surish tugaganda butun yon panel qayta chizilardi.
  const updatePlace = useCallback((p: Place) => {
    setPlace((prev) =>
      prev.city.id === p.city.id && prev.inCity === p.inCity ? prev : p,
    );
  }, []);
  const areasRef = useRef<Map<string, SelectedArea>>(new Map());

  // ⚠️ Xarita REF da emas, HOLATDA saqlanadi. Ref render paytida
  // o'qilsa, kontekstni ishlatuvchilar xarita yaratilganini SEZMAYDI:
  // ref o'zgarishi qayta renderni ishga tushirmaydi va ular abadiy
  // `null` ko'rib turardi.
  const [map, setMap] = useState<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<SelectedArea | null>(null);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [is3D, setIs3D] = useState(true);
  // Uslub yuklandi (mahalla qatlamlarini kutmasdan): saqlangan sun'iy
  // yo'ldosh rejimini shu payt tiklash mumkin. `ready` ni kutilsa, xarita
  // avval oddiy ko'rinishda chizilib, keyin sakrab almashardi.
  const [styleLoaded, setStyleLoaded] = useState(false);
  const satelliteRestored = useRef(false);
  // Manzil REF da: u faqat tugma bosilganda kerak, holatga qo'yilsa
  // sozlama kelishi butun xaritani qayta render qilardi.
  const satUrl = useRef<{
    url: string;
    credit: string;
    maxzoom?: number;
  } | null>(null);
  const [satelliteAvailable, setSatelliteAvailable] = useState(false);
  const [satelliteCredit, setSatelliteCredit] = useState("");
  const [serviceBounds, setServiceBounds] = useState<
    [number, number, number, number] | null
  >(null);

  // Sun'iy yo'ldosh manzili — serverdan. Tugma FAQAT manzil bo'lsa
  // ko'rinadi: ishlamaydigan tugma soxta imkoniyat va'da qiladi.
  useEffect(() => {
    const controller = new AbortController();
    void api
      .config(controller.signal)
      .then((cfg) => {
        // Xizmat hududi — to'rtta son bo'lsagina qabul qilinadi.
        const b = (cfg.service_bounds ?? "").split(",").map(Number);
        if (b.length === 4 && b.every(Number.isFinite)) {
          setServiceBounds([b[0], b[1], b[2], b[3]]);
        }

        const raw = cfg.satellite_url;
        if (!raw) return;
        // `places`/`weather` bilan bir xil qoida: sxema tekshiriladi.
        const parsed = new URL(raw);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
        const mz = Number(cfg.satellite_maxzoom);
        satUrl.current = {
          url: raw,
          credit: cfg.satellite_attribution ?? "",
          // Noto'g'ri qiymat JIMGINA tashlanadi: `maxzoom: NaN` manbani
          // buzadi va sun'iy yo'ldosh umuman chizilmay qolardi.
          maxzoom: Number.isFinite(mz) && mz > 0 ? mz : undefined,
        };
        if (!controller.signal.aborted) {
          setSatelliteCredit(cfg.satellite_attribution ?? "");
          setSatelliteAvailable(true);
        }
      })
      .catch(() => {
        // Sozlama olinmadi — tugma chiqmaydi, xarita ishlayveradi.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!holder.current) return;
    ensurePMTilesProtocol();

    // `localStorage` FAQAT shu yerda o'qiladi (effekt ichida, ya'ni
    // brauzerda): render paytida o'qilsa server va mijoz turlicha
    // natija berib, hidratsiya buzilardi.
    const start3D = prefers3D();
    setIs3D(start3D);

    // Rejim: URL aniq aytgan bo'lsa (`true`/`false`) — shu; aytmasa
    // (bosh sahifa) — foydalanuvchining saqlangan tanlovi.
    wantSatellite.current = initRef.current.satellite ?? prefersSatellite();

    const map = new maplibregl.Map({
      container: holder.current,
      style: STYLE_URL,
      center: initRef.current.center,
      zoom: initRef.current.zoom,
      // Boshlang'ich ko'rinish — 3D, va foydalanuvchi 2D ni tanlagan
      // bo'lsa keyingi kirishda ham 2D. Ilgari bu saqlanmasdi:
      // 3D ga o'tkazilgan xarita qayta ochilganda o'z holiga qaytardi.
      pitch: start3D ? 50 : 0,
      bearing: start3D ? -17 : 0,
      maxBounds: UZ_BOUNDS,
      minZoom: 5.5,
      // v6: `antialias` endi `canvasContextAttributes` ichida.
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    });
    setMap(map);

    // ⚠️ Uslub yuklanishidan OLDIN ulanadi: `poi-dot` qatlami
    // belgilarni nom bo'yicha so'raydi va agar bu ishlovchi kech
    // ulansa, birinchi tile'lar belgisiz chizilib qolardi.
    // `restaurant`/`cafe`/`grocery` — PNG pin (`loadPoiPngIcon`, ASINXRON):
    // OnDexMap'ning o'z turkumlari bilan BIR XIL rasm (foydalanuvchi
    // talabi — ikki manba endi bu 3 klassda ham farqsiz ko'rinadi).
    // Rasm topilmasa (yoki hali yuklanmagan oraliqda) — generik Lucide
    // belgi (`makePoiIcon`), avvalgidek.
    map.on("styleimagemissing", (e) => {
      if (!e.id.startsWith(POI_PREFIX) || map.hasImage(e.id)) return;
      const cls = e.id.slice(POI_PREFIX.length);
      const addFallback = () => {
        if (map.hasImage(e.id)) return;
        const img = makePoiIcon(cls);
        if (img) map.addImage(e.id, img, { pixelRatio: POI_PIXEL_RATIO });
      };
      const pending = loadPoiPngIcon(cls);
      if (!pending) return addFallback();
      pending.then((img) => {
        if (map.hasImage(e.id)) return;
        if (img) map.addImage(e.id, img, { pixelRatio: POI_PIXEL_RATIO });
        else addFallback();
      });
    });

    // ⚠️ Zoom (+/−), kompas va geolokatsiya tugmalari MapLibre'ning
    // tayyor boshqaruvlari EMAS — ular `MapControls` da o'zimizning
    // dizaynimizda chiziladi (Yandex `LeftSide.png` kabi). Tayyor
    // boshqaruvlarning ko'rinishini to'liq o'zgartirib bo'lmaydi.
    //
    // ⚠️ ODbL / provayder talabi — kredit MAJBURIY va OLIB TASHLANMAYDI, lekin
    // ko'rinishda faqat «© OnDex map» va «ⓘ» turadi: hamma manba kreditlari
    // (OpenStreetMap, OpenMapTiles, Esri, ...) «ⓘ» bosilganda ochiladi
    // (`MapCredits`). MapLibre'ning o'z boshqaruvi ATAYLAB ulanmagan: u sun'iy
    // yo'ldosh krediti («Powered by Esri») ni doim ko'rsatib qo'ygan edi, uni
    // qolganlari kabi yashirib bo'lmasdi.
    map.addControl(
      // `maxWidth` 140: kapsula uzunligi masofani ANIQ ko'rsatadi, matn
      // esa sig'ishi uchun kamida ~56 px kerak (eng qisqa chiziq
      // maxWidth ning ~40% i). 120 da u ~48 px bo'lib qolar va yozuv
      // kapsuladan chiqib ketardi.
      new maplibregl.ScaleControl({ maxWidth: 140, unit: "metric" }),
      "bottom-left",
    );

    // MapLibre uslub xatosini JIMGINA yutadi va xarita oq qoladi —
    // shuning uchun xato ekranda ham ko'rsatiladi.
    map.on("error", (e) => {
      const msg = e.error?.message ?? "noma'lum xato";
      console.error("[xarita]", msg);
      setStyleError(msg);
    });

    const controller = new AbortController();

    map.on("style.load", () => {
      // OSM joylari nomi — turkum rangida (to'qroq), 4 muhimlik darajasining
      // HAMMASIGA. ⚠️ `setStyleLoaded(true)` DAN OLDIN: mavzu (`applyMapTheme`)
      // uslubdagi ASL qiymatni shu payt saqlab oladi va yorug' mavzuga qaytganda
      // shuni tiklaydi.
      for (const t of TIERS) {
        const id = `poi-tier${t}`;
        if (map.getLayer(id)) {
          map.setPaintProperty(id, "text-color", poiLabelColor() as maplibregl.ExpressionSpecification);
        }
      }
      // Boshlang'ich 2D/3D ga mos bino qatlami — mahalla ma'lumoti
      // kelishini KUTMASDAN (u tarmoq so'rovi, bino esa tayyor).
      syncBuildings(map);
      setStyleLoaded(true);

      void addMahallaLayers(map, controller.signal, areasRef.current)
        .then(() => setReady(true))
        .catch((err: Error) => {
          if (err.name !== "AbortError") setStyleError(err.message);
        });
    });

    // Sun'iy yo'ldosh tugmasi holati — xaritaning HAQIQIY qatlamidan.
    // Qatlam qo'shilsa/olib tashlansa `styledata` keladi; qiymat
    // o'zgarmagan bo'lsa React qayta chizmaydi.
    map.on("styledata", () => {
      setSatellite(Boolean(map.getLayer(SATELLITE.layer)));
    });

    // Bino qatlami egilishga ergashadi. `pitch` har kadrda keladi, shuning
    // uchun faqat 2D/3D CHEGARASI kesib o'tilganda qayta qo'llanadi.
    let wasFlat: boolean | null = null;
    map.on("pitch", () => {
      const flat = map.getPitch() < PITCH_3D;
      if (flat === wasFlat || !map.isStyleLoaded()) return;
      wasFlat = flat;
      syncBuildings(map);
    });
    // Tugma yozuvi va saqlangan tanlov — HAQIQIY egilishga ergashadi
    // (foydalanuvchi sichqoncha bilan ham egishi mumkin).
    map.on("pitchend", () => {
      const on = map.getPitch() >= PITCH_3D;
      setIs3D(on);
      save3D(on);
    });

    return () => {
      controller.abort();
      map.remove();
      setMap(null);
      setReady(false);
      setStyleLoaded(false);
      satelliteRestored.current = false;
    };
  }, []);

  // `useCallback` SHART: bu funksiya vositalar hook'ining bog'liqlik
  // ro'yxatiga tushadi. Har renderda yangi bo'lsa, xaritaning bosish
  // ishlovchisi doim uzilib-ulanib turardi.
  const selectArea = useCallback(
    (id: string | null) => {
      if (!map) return;
      const filter = selectionFilter(id);
      for (const layer of [LAYER.mahallaFill, LAYER.mahallaLine]) {
        if (map.getLayer(layer)) map.setFilter(layer, filter as never);
      }
      setSelected(id ? (areasRef.current.get(id) ?? null) : null);
    },
    [map],
  );

  /**
   * Sun'iy yo'ldosh qatlamini yoqadi/o'chiradi.
   *
   * Yer usti vektor qatlamlari (o't, turar-joy, suv, binolar)
   * YASHIRILADI — aks holda ular tasvirni to'sib qo'yardi. Yo'l va
   * yozuvlar qoladi: bu "gibrid" ko'rinish, ya'ni tasvir ustidan
   * ko'cha nomlari o'qiladi.
   */
  const applySatellite = useCallback(
    (on: boolean) => {
      const cfg = satUrl.current;
      if (!map || !cfg) return;

      // Allaqachon kerakli holatda — hech narsa qilinmaydi (qayta
      // qo'shish "layer allaqachon mavjud" xatosini berardi).
      if (on === Boolean(map.getLayer(SATELLITE.layer))) return;

      if (on) {
        if (!map.getSource(SATELLITE.src)) {
          map.addSource(SATELLITE.src, {
            type: "raster",
            tiles: [cfg.url],
            tileSize: 256,
            // ⚠️ `maxzoom` — provayderda tasvir tugaydigan chegara.
            // Usiz xarita chegaradan yuqori zoomda ham tile so'raydi
            // va provayder BO'SH rasm (yoki 404) qaytaradi — ekran
            // oqarib qolardi. Chegara bilan esa mavjud tile cho'ziladi:
            // xira, lekin haqiqiy tasvir.
            ...(cfg.maxzoom ? { maxzoom: cfg.maxzoom } : {}),
            // ⚠️ Manba krediti — litsenziya talabi. U xaritaga «attribution»
            // sifatida emas, `MapCredits` orqali («ⓘ» ichida) ko'rsatiladi:
            // `satelliteCredit` holati sun'iy yo'ldosh yoqilganda shu yerdan keladi.
          });
        }
        // Fon ustiga, qolgan HAMMA narsaning ostiga.
        const first = map.getStyle().layers?.[1]?.id;
        map.addLayer(
          { id: SATELLITE.layer, type: "raster", source: SATELLITE.src },
          first,
        );
        for (const id of GROUND_LAYERS) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
        }
      } else {
        map.removeLayer(SATELLITE.layer);
        for (const id of GROUND_LAYERS) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
        }
      }
      // Binolar: 2D/3D va sun'iy yo'ldoshga birga qaraydi.
      // `satellite` holati bu yerda YOZILMAYDI: u xaritaning haqiqiy
      // qatlamidan `styledata` hodisasi orqali olinadi (init effektida) —
      // shunda tugma holati xaritadan ajralib qola olmaydi.
      syncBuildings(map);
    },
    [map],
  );

  const syncUrl = useUrlSync(map, wantSatellite, updatePlace);

  // Xarita mavzusi: uslub yuklangach va mahalla qatlami qo'shilgach (u keyin
  // paydo bo'ladi — shuning uchun `ready` ham bog'liqlikda) hamda mavzu
  // almashganda qo'llanadi. Faqat RANG o'zgaradi, qatlamlar joyida qoladi.
  useEffect(() => {
    if (map && styleLoaded) applyMapTheme(map, dark);
  }, [map, styleLoaded, ready, dark]);

  // Sun'iy yo'ldosh qatlami QO'SHILGACH sarlavha va manzil qayta yoziladi.
  // Bosh sahifada (`/`) saqlangan rejim ~1 s keyin tiklanadi, shu orada
  // Next.js gidratsiyada sahifaning ASL sarlavhasini qaytarib qo'yadi va
  // brauzer yorlig'i «xarita» deb qolardi, holbuki sun'iy yo'ldosh yoqilgan.
  useEffect(() => {
    syncUrl();
  }, [satellite, syncUrl]);

  /** Tugma: joriy holatni teskarisiga o'zgartiradi va ESLAB QOLADI. */
  const toggleSatellite = useCallback(() => {
    if (!map) return;
    const next = !map.getLayer(SATELLITE.layer);
    applySatellite(next);
    saveSatellite(next);
    // Manzil qatori ham almashadi: `/…/` ↔ `/…/sputnik/`.
    wantSatellite.current = next;
    syncUrl();
  }, [map, applySatellite, syncUrl]);

  // ┌─ NEGA SUN'IY YO'LDOSH QAYTA OCHILGANDA O'CHIQ QOLARDI ────────────
  // Holat faqat `useState(false)` da edi — sahifa yangilansa yoki
  // qayta ochilsa standart qiymatga qaytardi. Endi tanlov `localStorage`
  // da saqlanadi va shu yerda TIKLANADI.
  //
  // Tiklash uchun IKKI narsa tayyor bo'lishi SHART: uslub (qatlam
  // qo'shiladigan joy) va server sozlamasi (tile manzili). Ikkalasi
  // ham asinxron va qaysi biri oldin kelishi noma'lum, shuning uchun
  // effekt ikkalasiga bog'langan. Manba sozlanmagan bo'lsa
  // (`satelliteAvailable === false`) tiklanmaydi — mavjud bo'lmagan
  // imkoniyat "yoqilmaydi".
  // └──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !styleLoaded || !satelliteAvailable) return;
    if (satelliteRestored.current) return;
    satelliteRestored.current = true;
    if (wantSatellite.current) applySatellite(true);
  }, [map, styleLoaded, satelliteAvailable, applySatellite]);

  /**
   * 3D ↔ 2D.
   *
   * Yozuv HOLATNI ko'rsatadi (`is3D`), maqsadni emas — bu qoida
   * ilgari buzilgan va "3D saqlanmayapti" degan shikoyat tug'dirgan.
   */
  const toggle3D = useCallback(() => {
    if (!map) return;
    const goFlat = map.getPitch() >= PITCH_3D;
    map.easeTo({
      pitch: goFlat ? 0 : 50,
      bearing: goFlat ? 0 : -17,
      duration: 600,
    });
    // Yozuv darhol o'zgaradi; `pitchend` keyin haqiqiy holat bilan
    // tasdiqlaydi. Animatsiya davomida yozuv ikki marta miltillamaydi:
    // `pitch` (har kadr) yozuvga TEGMAYDI, faqat `pitchend` tegadi.
    setIs3D(!goFlat);
    save3D(!goFlat);
  }, [map]);

  return (
    <MapContext.Provider
      value={{
        map,
        holderRef: holder,
        ready,
        selected,
        selectArea,
        styleError,
        satelliteAvailable,
        satellite,
        satelliteCredit,
        toggleSatellite,
        is3D,
        toggle3D,
        serviceBounds,
        place,
      }}
    >
      {children}
      {styleError && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 shadow">
          Xarita xatosi: {styleError}
        </div>
      )}
    </MapContext.Provider>
  );
}

/**
 * Mahalla qatlamlari.
 *
 * ⚠️ Nom POLIGONGA emas, alohida NUQTA manbasiga qo'yiladi: poligon
 * ichki tile chegaralari bo'ylab bo'linadi va har bo'lakka bitta nom
 * chiziladi — bitta mahalla nomi bir necha marta takrorlanardi.
 */
async function addMahallaLayers(
  map: MLMap,
  signal: AbortSignal,
  index: Map<string, SelectedArea>,
) {
  if (map.getLayer(LAYER.mahallaFill)) return;

  const data: MahallaCollection = await api.mahallas(signal);
  if (signal.aborted) return;

  index.clear();
  for (const f of data.features) {
    index.set(f.properties.id, {
      id: f.properties.id,
      name: f.properties.name,
      kind: f.properties.kind,
    });
  }

  map.addSource(SOURCE.shapes, { type: "geojson", data });
  map.addSource(SOURCE.points, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: data.features
        .filter((f) => f.properties?.center)
        .map((f) => ({
          type: "Feature" as const,
          geometry: f.properties.center,
          properties: {
            id: f.properties.id,
            name: f.properties.name,
            kind: f.properties.kind,
          },
        })),
    },
  });

  const under = map.getLayer("road-label") ? "road-label" : undefined;

  map.addLayer(
    {
      id: LAYER.mahallaFill,
      type: "fill",
      source: SOURCE.shapes,
      filter: selectionFilter(null) as never,
      paint: { "fill-color": "#ea580c", "fill-opacity": 0.14 },
    },
    under,
  );
  map.addLayer(
    {
      id: LAYER.mahallaLine,
      type: "line",
      source: SOURCE.shapes,
      filter: selectionFilter(null) as never,
      paint: { "line-color": "#ea580c", "line-width": 2.5 },
    },
    under,
  );
  map.addLayer({
    id: LAYER.mahallaLabel,
    type: "symbol",
    source: SOURCE.points,
    layout: {
      // Nom ostida turi yoziladi: «Serob» + «mahallasi».
      //
      // NEGA IKKI QATOR: «Serob» o'zi nima ekani noaniq — ko'cha ham,
      // qishloq ham bo'lishi mumkin. Tur kichikroq shrift bilan
      // ostiga qo'yilgani uchun nomning o'zi baribir birinchi
      // o'qiladi.
      "text-field": [
        "format",
        ["get", "name"],
        {},
        "\n",
        {},
        [
          "match",
          ["get", "kind"],
          "qishloq",
          "qishlog'i",
          "daha",
          "dahasi",
          "mahallasi",
        ],
        { "font-scale": 0.78 },
      ],
      "text-font": ["Noto Sans Bold"],
      "text-size": 13,
      "text-line-height": 1.1,
      "text-allow-overlap": false,
      "text-padding": 4,
    },
    paint: {
      "text-color": "#7c2d12",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
      "text-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        0,
        MAHALLA_ZOOM_IN,
        1,
      ],
    },
  });

  map.on("mouseenter", LAYER.mahallaLabel, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", LAYER.mahallaLabel, () => {
    map.getCanvas().style.cursor = "";
  });
}
