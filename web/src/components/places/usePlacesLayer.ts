"use client";

/**
 * Tasdiqlangan ob'ektlarni xaritada ko'rsatadi va bosilganda tanlaydi.
 *
 * Ma'lumot `/v1/places?bbox=…` dan keladi: xarita to'xtaganda (`moveend`)
 * ko'rinayotgan to'rtburchak so'raladi. Barcha ob'ektni birdan yuklamaymiz —
 * server ham buni rad etadi (bbox hajmi chegaralangan).
 *
 * ⚠️ Faqat TASDIQLANGAN ob'ektlar keladi (karantindagilar ommaviy API'ga
 * umuman ko'rinmaydi). Belgi rasmi brauzerda chiziladi (`makePlaceIcon`),
 * sprite fayli yo'q — `poiIcons.ts` bilan bir xil yo'l.
 *
 * ┌─ OSM BILAN BITTA ARXITEKTURA ────────────────────────────────────────
 * OnDexMap ob'ektlari (bu qatlam) va OSM joylari (`poi-tier1..4`, uslub
 * ichida) IKKI XIL manbadan (biri jonli GeoJSON, biri vector tile) keladi,
 * lekin bitta chizuvchidan (`markerBadge.ts`) chiziladi, bitta to'qnashuv
 * qoidasidan (`icon-allow-overlap: false`, bir xil padding) VA bitta
 * muhimlik shkalasidan (`components/map/importance.ts` — 4 daraja) o'tadi.
 * Har daraja — ALOHIDA qatlam (MapLibre'da `minzoom` ma'lumotdan hisoblanmaydi,
 * shuning uchun boshqacha ilojи yo'q — OpenMapTiles'ning o'z uslublari ham
 * shu yo'l bilan ishlaydi): daraja 1 eng uzoqdan (z12) ko'rinadi, daraja 4
 * faqat yaqindan (z16.5). `symbol-sort-key` ham shu darajadan — joy torlashsa
 * past raqamli (muhimroq) daraja g'olib chiqadi, manbasidan qat'i nazar.
 * Natijada Google/Yandex kabi DINAMIK ko'rinish: yaqinlashtirilganda ko'proq
 * belgi paydo bo'ladi, uzoqlashtirilganda faqat muhimlari qoladi.
 * └────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";

import { TIER_MINZOOM, TIER_SORT_BASE, TIERS, placeTierExpr, type Tier } from "@/components/map/importance";
import { placesApi } from "@/lib/places";
import {
  loadOrgCategoryIcon,
  makePlaceIcon,
  orgIconAnchorExpr,
  placeIconImageExpr,
  placeLabelColor,
  PLACE_ICON_PIXEL_RATIO,
  PLACE_ICON_PREFIX,
} from "./kindUi";

/** Daraja → qatlam id (`ondex-places-tier1` ... `tier4`). */
const placesTierLayer = (t: Tier): string => `ondex-places-tier${t}`;
/** OSM joylari — daraja bo'yicha 4 qatlam (uslub ichida, `style-chust.json`). */
const osmTierLayer = (t: Tier): string => `poi-tier${t}`;

/** Yo'l (chiziq) qatlamlari: ko'rinmas KENG bosish zonasi va nom yozuvi (chiziq o'zi chizilmaydi). */
export const PLACES_LINE_HIT_LAYER = "ondex-places-line-hit";
const LINE_LABEL = "ondex-places-line-label";
/**
 * Piyodalar o'tish joyi va to'siq (ular CHIZILADI, yo'ldan farqli ravishda
 * xaritada ko'rinadi): ko'rinmas bosish zonasi shu yerda, faqat ular chizilgan
 * masshtabdan boshlab (aks holda ko'rinmas 10 m li joy yo'ldagi bosishni yeb qo'yardi).
 */
export const PLACES_SHAPE_HIT_LAYER = "ondex-places-shape-hit";
/** Zebra (piyodalar o'tish joyi) va to'siq chiziqlari. */
const CROSSING_LAYER = "ondex-places-crossing";
const FENCE_CASING = "ondex-places-fence-casing";
const FENCE_LAYER = "ondex-places-fence";
const FENCE_ICON = "ondex-places-fence-icon";
/** Shu masshtabdan yaqinroqda o'tish joyi va to'siq chiziqlari ko'rinadi. */
const SHAPE_MIN_ZOOM = 15;
/** Yo'l nomi va uning bosish zonasi shu masshtabdan (chiziq — turkumlanmagan, o'z chegarasi). */
const ROAD_MIN_ZOOM = 13;
/** Bino kirishi qatlami: o'ta kichik belgi, faqat yaqin masshtabda (yozuvsiz). */
export const PLACES_ENTRANCE_LAYER = "ondex-places-entrance";
/** Bosishni qabul qiladigan hamma qatlam (4 daraja + kirish + yo'l). */
export const PLACES_HIT_LAYERS = [
  ...TIERS.map(placesTierLayer),
  PLACES_ENTRANCE_LAYER,
  PLACES_LINE_HIT_LAYER,
  PLACES_SHAPE_HIT_LAYER,
] as const;

/**
 * Kirish belgisi shu yaqinlikdan yuqorida ko'rinadi. MapLibre'da 1 px ≈
 * 59066 / 2^z metr (41° kenglikda); masshtab chizg'ichi 30 m ni z≈17.5 dan
 * ko'rsatadi — undan uzoqroqda (30 m dan «balandda») kirishlar yashiriladi.
 */
export const ENTRANCE_MIN_ZOOM = 17.5;

const SOURCE = "ondex-places-src";

/**
 * Ma'lumot bundan uzoqda so'ralmaydi. Eng uzoqdan ko'rinadigan daraja (1) va
 * yo'l qatlamining chegarasidan kichigi olinadi — hech biri ma'lumotsiz qolmasin.
 */
const DATA_MIN_ZOOM = Math.min(TIER_MINZOOM[1], ROAD_MIN_ZOOM);
/** Server chegarasi 1.5° — undan kichik ushlaymiz. */
const MAX_SPAN = 1.4;
const DEBOUNCE_MS = 300;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Tanlangan turkum filtri (sidebar): faqat shu turkumdagi joylar belgisi qoladi.
 * `classes` — OSM `poi.class`; `orgCategories` — «Tashkilot» turkumlari; `kinds` —
 * turkumsiz OnDexMap turlari (bekat, avtoturargoh). `null` — filtr yo'q.
 */
export interface CategoryFilter {
  key: string;
  classes: string[];
  orgCategories: string[];
  kinds: string[];
}

/** Nuqta ob'ektlar (kirish — o'z qatlamida, bunga kirmaydi) va berilgan daraja. */
function tierPointFilter(t: Tier): maplibregl.FilterSpecification {
  return [
    "all",
    ["==", ["geometry-type"], "Point"],
    ["!=", ["get", "kind"], "entrance"],
    ["==", placeTierExpr() as maplibregl.ExpressionSpecification, t],
  ];
}

/** Turkum tanlangan bo'lsa, shu filtrga QO'SHIMCHA «faqat shu turkum» sharti. */
function withCategory(base: maplibregl.FilterSpecification, c: CategoryFilter | null): maplibregl.FilterSpecification {
  if (!c) return base;
  return [
    "all",
    base,
    [
      "any",
      ["in", ["get", "kind"], ["literal", c.kinds]],
      [
        "all",
        ["==", ["get", "kind"], "organization"],
        ["in", ["get", "category"], ["literal", c.orgCategories]],
      ],
    ],
  ] as maplibregl.FilterSpecification;
}

export function usePlacesLayer(
  map: MLMap | null,
  ready: boolean,
  /** `false` bo'lsa ob'ekt bosilganda tanlanmaydi (marshrut, o'lchash, qo'shish). */
  active: boolean,
  onSelect: (id: string) => void,
  /** O'zgarsa ma'lumot qayta yuklanadi. */
  refreshKey = 0,
  /** Tanlangan turkum (`null` — hammasi ko'rinadi). */
  category: CategoryFilter | null = null,
) {
  const activeRef = useRef(active);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    activeRef.current = active;
    selectRef.current = onSelect;
  });

  // Manba va qatlam — bir marta.
  useEffect(() => {
    if (!map || !ready) return;

    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: EMPTY });
    }
    // ── Yo'llar (LineString): nuqta belgisi bilan aralashmasin, alohida qatlamlar ──
    const lineOf = (...kinds: string[]): maplibregl.FilterSpecification => [
      "all",
      ["==", ["geometry-type"], "LineString"],
      ["in", ["get", "kind"], ["literal", kinds]],
    ];
    const isRoad = lineOf("road");
    const isShape = lineOf("crossing", "fence");
    // Yo'lning CHIZIG'I xaritada KO'RINMAYDI (talab): faqat NOMI yozuv sifatida
    // yo'l bo'ylab chiziladi. Bosish uchun esa ko'rinmas (opacity 0) KENG zona
    // bor — yozuv ustiga yoki yo'l yoniga bosilsa ob'ekt tanlanadi.
    if (!map.getLayer(PLACES_LINE_HIT_LAYER)) {
      map.addLayer({
        id: PLACES_LINE_HIT_LAYER,
        type: "line",
        source: SOURCE,
        minzoom: ROAD_MIN_ZOOM - 1,
        filter: isRoad,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 18 },
      });
    }

    // ── Piyodalar o'tish joyi: ZEBRA ────────────────────────────────────
    // Chiziq keng (≈3.5 m) va `line-dasharray` bilan yo'l-yo'l qilinadi: chiziq
    // yo'nalishi bo'ylab navbatma-navbat bo'yalgan/bo'sh bo'laklar — aynan zebra
    // (`image/z.png`). Kenglik va bo'lak uzunligi METRDA doimiy bo'lishi uchun
    // kenglik masshtab bilan 2 ning darajasida o'sadi (1 px ≈ 59066/2^z m).
    if (!map.getLayer(CROSSING_LAYER)) {
      map.addLayer({
        id: CROSSING_LAYER,
        type: "line",
        source: SOURCE,
        minzoom: SHAPE_MIN_ZOOM,
        filter: lineOf("crossing"),
        layout: { "line-cap": "butt", "line-join": "bevel" },
        paint: {
          "line-color": "#5b6b86",
          "line-opacity": 0.92,
          "line-width": ["interpolate", ["exponential", 2], ["zoom"], 15, 1.9, 22, 248],
          // Birlik — chiziq kengligi: 0.14 × 3.5 m ≈ 0.5 m li yo'l-yo'l.
          "line-dasharray": [0.14, 0.14],
        },
      });
    }

    // ── To'siq: ingichka chiziq (o'rtasida belgi) ───────────────────────
    if (!map.getLayer(FENCE_CASING)) {
      map.addLayer({
        id: FENCE_CASING,
        type: "line",
        source: SOURCE,
        minzoom: SHAPE_MIN_ZOOM,
        filter: lineOf("fence"),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-opacity": 0.9, "line-width": 5.5 },
      });
    }
    if (!map.getLayer(FENCE_LAYER)) {
      map.addLayer({
        id: FENCE_LAYER,
        type: "line",
        source: SOURCE,
        minzoom: SHAPE_MIN_ZOOM,
        filter: lineOf("fence"),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#8b7355", "line-width": 2.4 },
      });
    }
    if (!map.getLayer(FENCE_ICON)) {
      map.addLayer({
        id: FENCE_ICON,
        type: "symbol",
        source: SOURCE,
        minzoom: SHAPE_MIN_ZOOM + 1,
        filter: lineOf("fence"),
        layout: {
          "symbol-placement": "line-center",
          "icon-image": ["concat", PLACE_ICON_PREFIX, ["get", "kind"]],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.75, 17, 1],
          "icon-allow-overlap": true,
          "icon-rotation-alignment": "viewport",
        },
      });
    }
    if (!map.getLayer(PLACES_SHAPE_HIT_LAYER)) {
      map.addLayer({
        id: PLACES_SHAPE_HIT_LAYER,
        type: "line",
        source: SOURCE,
        minzoom: SHAPE_MIN_ZOOM,
        filter: isShape,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 18 },
      });
    }

    if (!map.getLayer(LINE_LABEL)) {
      map.addLayer({
        id: LINE_LABEL,
        type: "symbol",
        source: SOURCE,
        minzoom: ROAD_MIN_ZOOM,
        filter: isRoad,
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
          "text-letter-spacing": 0.03,
          "text-max-angle": 35,
        },
        paint: {
          "text-color": "#7c2d12",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }

    // ── OnDexMap ob'ektlari: 4 muhimlik darajasi (bir qatlam — bir daraja) ──
    for (const t of TIERS) {
      const id = placesTierLayer(t);
      if (map.getLayer(id)) continue;
      map.addLayer({
        id,
        type: "symbol",
        source: SOURCE,
        minzoom: TIER_MINZOOM[t],
        filter: tierPointFilter(t),
        layout: {
          "icon-image": placeIconImageExpr() as maplibregl.ExpressionSpecification,
          // Belgi masshtabga qarab biroz o'zgaradi (xaritadagi boshqa belgilar kabi).
          "icon-size": ["interpolate", ["linear"], ["zoom"], TIER_MINZOOM[t], 0.75, 17, 1],
          // ⚠️ OSM POI (`poi-tier1..4`) BILAN AYNAN BIR XIL to'qnashuv qoidasi:
          // `allow-overlap` O'CHIQ, bir xil `padding` VA bir xil sort-key shkalasi
          // (`importance.ts`) — ikkalasi BITTA umumiy to'qnashuv hisobida qatnashadi.
          "icon-allow-overlap": false,
          "icon-padding": 3,
          // PNG pin (`org:<turkum>`) pastki uchi bilan, qolgan doira belgilar markazdan.
          "icon-anchor": orgIconAnchorExpr() as maplibregl.ExpressionSpecification,
          "symbol-sort-key": TIER_SORT_BASE[t],
          // Transport bekati nomi ko'rsatilmaydi (belgining o'zi yetarli; nom tafsilotda).
          "text-field": ["case", ["==", ["get", "kind"], "stop"], "", ["get", "name"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          // Nom belgining O'NG YONIDA (chapga tekislangan), pastida emas. Masofa belgi
          // o'lchamiga (`icon-size`) ergashadi: belgi kichrayganda yozuv unga yopishib turadi.
          "text-anchor": "left",
          "text-justify": "left",
          "text-offset": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            ["literal", [1.0, 0]],
            17,
            ["literal", [1.2, 0]],
          ],
          "text-max-width": 9,
          "text-padding": 2,
          // Nom sig'masa yashiriladi, lekin BELGI doim qoladi (OSM bilan bir xil qoida).
          "text-optional": true,
        },
        paint: {
          // Yozuv rangi — turning belgi rangi (to'qroq): `image/image.png` dagi «Кафе» kabi.
          "text-color": placeLabelColor() as maplibregl.ExpressionSpecification,
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }

    if (!map.getLayer(PLACES_ENTRANCE_LAYER)) {
      map.addLayer({
        id: PLACES_ENTRANCE_LAYER,
        type: "symbol",
        source: SOURCE,
        minzoom: ENTRANCE_MIN_ZOOM,
        filter: [
          "all",
          ["==", ["geometry-type"], "Point"],
          ["==", ["get", "kind"], "entrance"],
        ],
        layout: {
          "icon-image": ["concat", PLACE_ICON_PREFIX, ["get", "kind"]],
          "icon-allow-overlap": true,
          "icon-anchor": "center",
          // Yozuv YO'Q: kirish faqat kichik belgi (tavsifi bosilganda ochiladi).
        },
      });
    }

    // Belgi rasmi kerak bo'lganda (uslub `ondex-place-<tur>` so'raydi) chizamiz.
    //
    // `org:<turkum>` — PNG pin bor «Tashkilot» turkumi (`placeIconImageExpr`):
    // rasm ASINXRON yuklanadi (`loadOrgCategoryIcon`), shu oraliqda MapLibre
    // belgisiz qoladi va rasm kelgach o'zi qayta chizadi (standart naqsh).
    // Rasm topilmasa (hali PNG berilmagan turkum) — generik bino belgisiga
    // tushadi, xuddi avvalgidek.
    const onMissing = (e: { id: string }) => {
      if (!e.id.startsWith(PLACE_ICON_PREFIX) || map.hasImage(e.id)) return;
      const rest = e.id.slice(PLACE_ICON_PREFIX.length);
      const addFallback = () => {
        if (map.hasImage(e.id)) return;
        const img = makePlaceIcon("organization");
        if (img) map.addImage(e.id, img, { pixelRatio: PLACE_ICON_PIXEL_RATIO });
      };
      if (rest.startsWith("org:")) {
        const pending = loadOrgCategoryIcon(rest.slice(4));
        if (!pending) return addFallback();
        pending.then((img) => {
          if (map.hasImage(e.id)) return;
          if (img) map.addImage(e.id, img, { pixelRatio: PLACE_ICON_PIXEL_RATIO });
          else addFallback();
        });
        return;
      }
      const img = makePlaceIcon(rest);
      if (img) map.addImage(e.id, img, { pixelRatio: PLACE_ICON_PIXEL_RATIO });
    };
    map.on("styleimagemissing", onMissing);

    const onClick = (e: {
      features?: { properties?: Record<string, unknown> }[];
    }) => {
      if (!activeRef.current) return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") selectRef.current(id);
    };
    const onEnter = () => {
      if (activeRef.current) map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      if (activeRef.current) map.getCanvas().style.cursor = "";
    };
    for (const layer of PLACES_HIT_LAYERS) {
      map.on("click", layer, onClick);
      map.on("mouseenter", layer, onEnter);
      map.on("mouseleave", layer, onLeave);
    }

    return () => {
      map.off("styleimagemissing", onMissing);
      for (const layer of PLACES_HIT_LAYERS) {
        map.off("click", layer, onClick);
        map.off("mouseenter", layer, onEnter);
        map.off("mouseleave", layer, onLeave);
      }
    };
  }, [map, ready]);

  // ⚠️ Qatlamlar yaratilgandan KEYIN (yuqoridagi effekt) — shuning uchun shu yerda.
  // Turkum filtri: OSM joylari, OnDexMap ob'ektlari (HAR BIR daraja) — faqat
  // tanlangan turkum ko'rinadi. (Kirish va to'siq belgilari turkumga kirmaydi —
  // turkum tanlanganda yashiriladi; zebra va to'siq CHIZIQLARI xarita elementi
  // sifatida qoladi.)
  //
  // ┌─ TURKUM TANLANSA — DARAJA-CHEGARASI OLIB TASHLANADI ─────────────────
  // Har daraja qatlamining o'z `minzoom`si bor (daraja 1 — z12, daraja 4 —
  // z16.5): filtrsiz holatda bu TO'G'RI (Google/Yandex kabi dinamik
  // ko'rinish). Lekin foydalanuvchi ANIQ bitta turkumni tanlasa (masalan
  // «Shifoxonalar»), u uzoqlashtirganda ham O'SHA turkumdagi HAMMA
  // belgini ko'rishni kutadi — «kamroq muhimi yo'qoladi» qoidasi endi
  // kerak emas, chunki ekranda faqat BITTA turkum bor, tirbandlik yo'q.
  // Shuning uchun turkum tanlanganda `setLayerZoomRange` bilan chegarani
  // OLIB TASHLAYMIZ (0..24), bekor qilinsa asl `TIER_MINZOOM`ga qaytadi.
  // └────────────────────────────────────────────────────────────────────
  const catKey = category?.key ?? null;
  const catRef = useRef(category);
  useEffect(() => {
    catRef.current = category;
  });
  useEffect(() => {
    if (!map || !ready) return;
    const c = catRef.current;
    for (const t of TIERS) {
      const id = placesTierLayer(t);
      if (map.getLayer(id)) {
        map.setFilter(id, withCategory(tierPointFilter(t), c));
        map.setLayerZoomRange(id, c ? 0 : TIER_MINZOOM[t], 24);
      }
      const osmId = osmTierLayer(t);
      if (map.getLayer(osmId)) {
        map.setFilter(
          osmId,
          c ? ["in", ["coalesce", ["get", "class"], "other"], ["literal", c.classes]] : null,
        );
        map.setLayerZoomRange(osmId, c ? 0 : TIER_MINZOOM[t], 24);
      }
    }
    for (const id of [PLACES_ENTRANCE_LAYER, FENCE_ICON]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", c ? "none" : "visible");
    }
  }, [map, ready, catKey]);

  // Ma'lumotni yuklash: xarita to'xtaganda.
  useEffect(() => {
    if (!map || !ready) return;

    let ctl: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const setData = (data: GeoJSON.FeatureCollection) => {
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data);
    };

    const load = () => {
      ctl?.abort();
      // Turkum tanlangan bo'lsa, past masshtab chegarasi HAM olib tashlanadi
      // (qatlam `minzoom`i kabi — yuqoridagi izohga qarang): aks holda
      // ma'lumotning o'zi so'ralmay, qatlam chegarasi ochiq bo'lsa ham
      // belgi chizadigan hech narsa qolmasdi.
      if (map.getZoom() < DATA_MIN_ZOOM && !catRef.current) {
        setData(EMPTY);
        return;
      }
      const b = map.getBounds();
      let w = b.getWest();
      let s = b.getSouth();
      let e = b.getEast();
      let n = b.getNorth();
      // Qiya (3D) ko'rinishda ufqqacha bo'lgan maydon juda katta bo'lishi mumkin.
      if (e - w > MAX_SPAN) {
        const c = (e + w) / 2;
        w = c - MAX_SPAN / 2;
        e = c + MAX_SPAN / 2;
      }
      if (n - s > MAX_SPAN) {
        const c = (n + s) / 2;
        s = c - MAX_SPAN / 2;
        n = c + MAX_SPAN / 2;
      }
      ctl = new AbortController();
      placesApi
        .inView([w, s, e, n], ctl.signal)
        .then((fc) => setData(fc))
        .catch(() => {
          // Tarmoq xatosi yoki bekor qilingan so'rov: oldingi belgilar qoladi,
          // xarita ishlashda davom etadi.
        });
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(load, DEBOUNCE_MS);
    };

    map.on("moveend", schedule);
    load();
    return () => {
      map.off("moveend", schedule);
      clearTimeout(timer);
      ctl?.abort();
    };
    // `catKey`: turkum XARITANI SURMASDAN tanlansa/bekor qilinsa ham,
    // yuqoridagi chegara-bypass darhol qayta baholanishi kerak (aks holda
    // keyingi `moveend`gacha eski — bo'sh yoki chegaralangan — holat qoladi).
  }, [map, ready, refreshKey, catKey]);
}
