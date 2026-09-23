"use client";

/**
 * Xarita vositalari: o'lchash (lineyka), marshrut va manzil aniqlash.
 *
 * NEGA BITTA HOOK: har bir vosita xaritaning `click` hodisasiga o'z
 * ishlovchisini qo'shsa, ular bir-biriga xalaqit berardi — bitta
 * bosish uch xil amalni ishga tushirib yuborardi. Shu sabab ishlovchi
 * BITTA va u joriy REJIMga qarab ish ko'radi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from "maplibre-gl";

import { api } from "@/lib/api";
import { formatDistance, pathLengthMeters, type LngLat } from "@/lib/geo";
import { LAYER } from "./MapProvider";
import { PLACES_HIT_LAYERS } from "@/components/places/usePlacesLayer";

export type ToolMode = "idle" | "measure" | "route";

/**
 * Uslubdagi (server bergan) qatlamlar — bosilgan joyni nomlash uchun.
 *
 * ⚠️ `queryRenderedFeatures` FAQAT chizilgan obyektni topadi. POI va
 * uy raqami z15–16 dan chiziladi, ya'ni uzoq zoomda bu qidiruv bo'sh
 * qaytadi — bu kutilgan holat, xato emas.
 */
const STYLE_LYR = {
  // 4 muhimlik darajasi (`importance.ts`) — hammasi «poi» sifatida so'raladi.
  poi: ["poi-tier1", "poi-tier2", "poi-tier3", "poi-tier4"],
  house: ["housenumber"],
  building: ["ms-building-3d", "ms-building-flat"],
} as const;

/** Bosilgan nuqta atrofidagi kvadrat (piksel) — barmoq aniq tegmaydi. */
const HIT_PAD = 10;

/** Faqat uslubda MAVJUD qatlamlarni qaytaradi (yo'qi so'ralsa MapLibre yiqiladi). */
function present(map: MLMap, ids: readonly string[]): string[] {
  return ids.filter((id) => map.getLayer(id));
}

/**
 * ⚠️ MapLibre bu yerda `[[x1,y1],[x2,y2]]` — ya'ni SON juftliklarini
 * kutadi, `{x,y}` obyektini emas.
 */
function boxAround(p: {
  x: number;
  y: number;
}): [[number, number], [number, number]] {
  return [
    [p.x - HIT_PAD, p.y - HIT_PAD],
    [p.x + HIT_PAD, p.y + HIT_PAD],
  ];
}

/**
 * Bosilgan joydagi obyekt nomi.
 *
 * Tartib: POI nomi → uy raqami → `null`. `null` bo'lsa chaqiruvchi
 * serverdan manzil so'raydi.
 *
 * NEGA SERVERGA EMAS: nom allaqachon chizilgan tile ichida bor —
 * uni so'rash bilan olish keraksiz kechikish va keraksiz yuk.
 */
function describeAt(map: MLMap, point: { x: number; y: number }): string | null {
  const box = boxAround(point);

  const poiLayers = present(map, STYLE_LYR.poi);
  if (poiLayers.length > 0) {
    for (const f of map.queryRenderedFeatures(box, { layers: poiLayers })) {
      const name = f.properties?.name;
      if (typeof name === "string" && name.trim() !== "") return name.trim();
    }
  }

  const houseLayers = present(map, STYLE_LYR.house);
  if (houseLayers.length > 0) {
    for (const f of map.queryRenderedFeatures(box, { layers: houseLayers })) {
      const n = f.properties?.housenumber;
      if (n !== undefined && n !== null && String(n).trim() !== "") {
        return `${String(n).trim()}-uy`;
      }
    }
  }

  return null;
}

/** Koordinata — o'qiladigan shaklda (taxminan 1 m aniqlik). */
export function fmtCoord(p: LngLat): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

/** Bosilgan joyda bino bormi (nomi bo'lmasa ham). */
function buildingAt(map: MLMap, point: { x: number; y: number }): boolean {
  const layers = present(map, STYLE_LYR.building);
  if (layers.length === 0) return false;
  return map.queryRenderedFeatures(boxAround(point), { layers }).length > 0;
}

const SRC = { line: "ondex-tool-line", pts: "ondex-tool-points" } as const;

const LYR = {
  // O'lchash va marshrut uchun IKKI qatlam, bitta emas.
  // `line-dasharray` ifoda qabul qilmaydi (u ma'lumotga bog'liq
  // bo'lolmaydi), shuning uchun punktir va uzluksiz chiziq alohida
  // qatlam bo'lishi SHART — ular filtr bilan ajratiladi.
  measure: "ondex-tool-line-measure",
  route: "ondex-tool-line-route",
  halo: "ondex-tool-points-halo",
  labels: "ondex-tool-points-label",
} as const;

/** Marshrut chizig'i va panel — bir xil ko'k (Yandex marshruti kabi). */
const ROUTE_BLUE = "#2f6bff";
/** A nuqta — qizil, B nuqta — to'q kulrang (sidebar'dagi doiralar bilan bir xil). */
const ROUTE_DOT = { a: "#ff4d3a", b: "#3f3f46" } as const;

export interface RouteInfo {
  distanceM: number;
  durationS: number;
  /** Haqiqiy yo'l bo'ylab hisoblanganmi. `false` — zaxira to'g'ri chiziq. */
  onRoad: boolean;
  /** Yetib borish vaqti (ms, epoch). `onRoad` bo'lmasa — 0. */
  etaMs: number;
  /** Marshrut olinmagan bo'lsa — sababi. */
  note?: string;
}

export type RouteSlot = "a" | "b";

/**
 * Marshrut nuqtalari va ularning manzillari.
 *
 * `slot` — xaritadagi KEYINGI bosish qaysi nuqtani qo'yishi:
 *   "a" / "b" — o'sha nuqtani;
 *   `null`    — ikkalasi ham qo'yilgan va hech qaysi maydon tanlanmagan:
 *               keyingi bosish YANGI marshrutni boshlaydi.
 */
export interface RouteState {
  a: LngLat | null;
  b: LngLat | null;
  labelA: string | null;
  labelB: string | null;
  slot: RouteSlot | null;
}

const EMPTY_ROUTE: RouteState = {
  a: null,
  b: null,
  labelA: null,
  labelB: null,
  slot: "a",
};

function samePoint(x: LngLat | null, y: LngLat): boolean {
  return x !== null && x.lat === y.lat && x.lng === y.lng;
}

interface Args {
  map: MLMap | null;
  ready: boolean;
  mode: ToolMode;
  onSelectArea: (id: string | null) => void;
  onAddress: (text: string | null, busy: boolean) => void;
  /** Xizmat hududi `[minLng, minLat, maxLng, maxLat]` — serverdan. */
  serviceBounds: [number, number, number, number] | null;
  /**
   * Berilsa, xaritadagi HAR BIR bosish shu funksiyaga ketadi va boshqa vosita
   * (o'lchash, marshrut, manzil) ishlamaydi. «Ob'ekt qo'shish» paytida belgini
   * bosilgan joyga ko'chirish uchun.
   */
  onPick?: ((p: LngLat) => void) | null;
}

/**
 * Nuqta xizmat hududida ekanini tekshiradi.
 *
 * Chegara noma'lum bo'lsa `true` — ya'ni so'rov yuboriladi va qarorni
 * SERVER beradi. Fail-open bu yerda to'g'ri: chegarani bilmaganimiz
 * uchun foydalanuvchining haqiqiy bosishini rad etib qo'ymaymiz.
 */
function inService(
  p: LngLat,
  b: [number, number, number, number] | null,
): boolean {
  if (!b) return true;
  return p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3];
}

export function useMapTools({
  map,
  ready,
  mode,
  onSelectArea,
  onAddress,
  serviceBounds,
  onPick = null,
}: Args) {
  // O'lchash nuqtalari.
  const [points, setPoints] = useState<LngLat[]>([]);
  // Marshrut nuqtalari — o'lchashdan ALOHIDA: ikkalasi bitta ro'yxatda
  // turganda A/B ning "ikkinchisini almashtirish" kabi amallar mumkin emas edi.
  const [rp, setRp] = useState<RouteState>(EMPTY_ROUTE);
  const [routeRes, setRouteRes] = useState<{
    key: string;
    info: RouteInfo;
  } | null>(null);

  const pending = useRef<AbortController | null>(null);
  const labelCtl = useRef<AbortController | null>(null);

  // ⚠️ Effekt ichida yaratiladi (ref ning boshlang'ich qiymatida emas):
  // React dev rejimida effektni "ulash → uzish → qayta ulash" qiladi va
  // birinchi uzishda bekor qilingan controller abadiy qolib, manzillar
  // hech qachon aniqlanmay qolardi.
  useEffect(() => {
    labelCtl.current = new AbortController();
    return () => labelCtl.current?.abort();
  }, []);

  const routeA = rp.a;
  const routeB = rp.b;

  // Natija QAYSI nuqtalar uchun hisoblangani kalit bilan bog'lanadi.
  // Kalit mos kelmasa (nuqta o'zgardi/almashdi) eski natija
  // ko'rsatilmaydi — holatni effekt ichida qo'lda tozalash shart emas.
  const routeKey =
    routeA && routeB
      ? `${routeA.lat},${routeA.lng}>${routeB.lat},${routeB.lng}`
      : "";
  const route = routeRes && routeRes.key === routeKey ? routeRes.info : null;

  /** Vositaning barcha nuqta va chiziqlarini tozalaydi. */
  const clear = useCallback(() => {
    pending.current?.abort();
    setPoints([]);
    setRp(EMPTY_ROUTE);
  }, []);

  /** A va B ni almashtiradi (manzillari bilan birga). */
  const swapRoute = useCallback(() => {
    setRp((prev) => ({
      a: prev.b,
      b: prev.a,
      labelA: prev.labelB,
      labelB: prev.labelA,
      slot: prev.slot === "a" ? "b" : prev.slot === "b" ? "a" : null,
    }));
  }, []);

  /** Maydon bosildi — xaritadagi keyingi bosish shu nuqtani qo'yadi. */
  const pickSlot = useCallback((slot: RouteSlot) => {
    setRp((prev) => ({ ...prev, slot }));
  }, []);

  /**
   * Marshrut nuqtasi uchun manzil matni.
   *
   * Nom tile ichida bo'lsa (`named`) so'rov YUBORILMAYDI. Aks holda
   * serverdan so'raladi; xato bo'lsa koordinata ko'rsatiladi —
   * foydalanuvchi qayerni tanlaganini baribir bilishi kerak.
   */
  const labelPoint = useCallback(
    (p: LngLat, named: string | null) => {
      const setLabel = (text: string) =>
        setRp((prev) => {
          // Nuqta shu orada almashtirilgan bo'lishi mumkin (swap, yangi
          // bosish) — matn FAQAT o'sha nuqtaga tegishli bo'lsa yoziladi.
          if (samePoint(prev.a, p)) return { ...prev, labelA: text };
          if (samePoint(prev.b, p)) return { ...prev, labelB: text };
          return prev;
        });

      if (named) return;
      if (!inService(p, serviceBounds)) {
        setLabel(fmtCoord(p));
        return;
      }
      const signal = labelCtl.current?.signal;
      void api
        .resolve(p.lat, p.lng, signal)
        .then((r) => {
          if (!signal?.aborted) setLabel(r.text);
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setLabel(fmtCoord(p));
        });
    },
    [serviceBounds],
  );

  /**
   * Marshrutning A yoki B nuqtasini KOORDINATA bo'yicha qo'yadi (o'ng tugma
   * menyusi). Xaritani bosish bilan bir xil natija beradi: matn tile'dan yoki
   * serverdan olinadi, ikkala nuqta tayyor bo'lsa marshrut hisoblanadi.
   *
   * `slot` menyudan keladi ("Bu yerdan" → a, "Bu yerga" → b). Ikkinchi
   * nuqta hali yo'q bo'lsa, xaritadagi KEYINGI bosish o'shani qo'yadi.
   */
  const placeRoutePoint = useCallback(
    (slot: RouteSlot, p: LngLat, screen: { x: number; y: number }) => {
      if (!map) return;
      const named = describeAt(map, screen);
      setRp((prev) => {
        const next: RouteState = { ...prev };
        if (slot === "a") {
          next.a = p;
          next.labelA = named;
        } else {
          next.b = p;
          next.labelB = named;
        }
        const other = slot === "a" ? next.b : next.a;
        next.slot = other ? null : slot === "a" ? "b" : "a";
        return next;
      });
      labelPoint(p, named);
    },
    [map, labelPoint],
  );

  /** O'lchash chizig'iga nuqta qo'shadi (o'ng tugma menyusidagi «Lineyka»). */
  const addMeasurePoint = useCallback((p: LngLat) => {
    setPoints((prev) => [...prev, p]);
  }, []);

  /**
   * «Bu yerda nima bor?» — oddiy rejimdagi chap bosish bilan BIR XIL amal:
   * mahalla nomiga tegilsa chegarasi, aks holda obyekt nomi yoki manzil.
   * Ikki joyda (bosish va menyu) takrorlanmasligi uchun shu yerda turadi.
   */
  const inspectAt = useCallback(
    (screen: { x: number; y: number }, p: LngLat) => {
      if (!map) return;

      // Chegara mahalla HUDUDINING ISTALGAN NUQTASIGA bosilganda chiziladi.
      // Bino/joy bosilsa BUNDAN OLDINROQ (yuqorida, `placeLayers`
      // tekshiruvida) qaytib ketilgan — demak bu yerga faqat "aniq
      // obyekt yo'q" holatlar yetib keladi.
      //
      // ⚠️ `mahallaHit` ishlatiladi, `mahallaFill` EMAS: `mahallaFill`ning
      // filtri odatda hech narsani ko'rsatmaydi (faqat TANLANGAN
      // mahalla) — `queryRenderedFeatures` esa faqat chizilgan (filtrdan
      // o'tgan) obyektni topadi, ya'ni tanlanguncha undan HECH QACHON
      // natija chiqmasdi ("tovuq-tuxum": mahalla ma'lumoti production'ga
      // qo'shilgandan keyin BIRINCHI marta sinalganda aniqlangan bug —
      // 2026-09-23). `mahallaHit` — filtrsiz, ko'rinmas qatlam, doim
      // barcha mahallalarni "chizadi" (`LAYER.mahallaHit` izohiga qarang).
      //
      // ILGARI (bundan ham oldin) faqat mahalla NOMI YOZUVIGA
      // (`mahallaLabel`) bosilganda ishlagan — juda tor nishon (bir
      // necha piksellik matn) va qo'shimcha zoom sharti bilan
      // cheklangan edi.
      if (map.getLayer(LAYER.mahallaHit)) {
        const hit = map.queryRenderedFeatures(boxAround(screen), {
          layers: [LAYER.mahallaHit],
        })[0];
        if (hit?.properties?.id) {
          onSelectArea(String(hit.properties.id));
          onAddress(null, false);
          return;
        }
      }
      onSelectArea(null);

      // Nom tile ichida bo'lsa — so'rovsiz, darhol.
      const named = describeAt(map, screen);
      if (named) {
        pending.current?.abort();
        onAddress(named, false);
        return;
      }

      // Hudud tashqarisi — so'rov YUBORILMAYDI. Server uni baribir
      // 400 bilan rad etadi; bekorga so'rash konsolni xato bilan
      // to'ldiradi va foydalanuvchini kutishga majburlaydi.
      if (!inService(p, serviceBounds)) {
        pending.current?.abort();
        onAddress(`${fmtCoord(p)} · xizmat hududidan tashqarida`, false);
        return;
      }

      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      onAddress(null, true);
      void api
        .resolve(p.lat, p.lng, controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) onAddress(r.text, false);
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          // Manzil topilmadi (masalan xizmat hududidan tashqarida).
          // Xato matni o'rniga KOORDINATA ko'rsatiladi: foydalanuvchi
          // qayerni bosganini baribir bilishi kerak.
          onAddress(
            buildingAt(map, screen)
              ? `Nomsiz bino · ${fmtCoord(p)}`
              : fmtCoord(p),
            false,
          );
        });
    },
    [map, onSelectArea, onAddress, serviceBounds],
  );

  // Qatlamlar bir marta qo'shiladi.
  useEffect(() => {
    if (!map || !ready) return;
    if (map.getSource(SRC.line)) return;

    const empty: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };
    map.addSource(SRC.line, { type: "geojson", data: empty });
    map.addSource(SRC.pts, { type: "geojson", data: empty });

    // Haqiqiy marshrut — uzluksiz va qalin; o'lchash chizig'i —
    // punktir. Shakl farqi ataylab: foydalanuvchi izohni o'qimasdan
    // ham qaysi birini ko'rayotganini bilishi kerak.
    map.addLayer({
      id: LYR.route,
      type: "line",
      source: SRC.line,
      filter: ["==", ["get", "kind"], "route"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ROUTE_BLUE, "line-width": 6, "line-opacity": 0.92 },
    });
    map.addLayer({
      id: LYR.measure,
      type: "line",
      source: SRC.line,
      // `preview` — marshrut hisoblanguncha A→B oralig'idagi punktir.
      filter: ["in", ["get", "kind"], ["literal", ["measure", "preview"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["match", ["get", "kind"], "preview", ROUTE_BLUE, "#ea580c"],
        "line-width": 3,
        "line-dasharray": [2, 1.4],
      },
    });
    // Nuqta ranglari MA'LUMOTDAN keladi (`fill`/`stroke`/`ink`): marshrut
    // nuqtalari A qizil / B to'q, o'lchash nuqtalari esa oq (standart).
    map.addLayer({
      id: LYR.halo,
      type: "circle",
      source: SRC.pts,
      paint: {
        "circle-radius": 10,
        "circle-color": ["coalesce", ["get", "fill"], "#ffffff"],
        "circle-stroke-width": 2,
        "circle-stroke-color": ["coalesce", ["get", "stroke"], "#ea580c"],
      },
    });
    map.addLayer({
      id: LYR.labels,
      type: "symbol",
      source: SRC.pts,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 11,
        "text-allow-overlap": true,
      },
      paint: { "text-color": ["coalesce", ["get", "ink"], "#7c2d12"] },
    });
  }, [map, ready]);

  // Nuqtalar o'zgarganda chizma yangilanadi.
  useEffect(() => {
    if (!map || !ready || !map.getSource(SRC.pts)) return;

    const isRoute = mode === "route";
    const drawn: { p: LngLat; props: Record<string, string> }[] = [];
    if (isRoute) {
      if (routeA) {
        drawn.push({
          p: routeA,
          props: { label: "A", fill: ROUTE_DOT.a, stroke: "#ffffff", ink: "#ffffff" },
        });
      }
      if (routeB) {
        drawn.push({
          p: routeB,
          props: { label: "B", fill: ROUTE_DOT.b, stroke: "#ffffff", ink: "#ffffff" },
        });
      }
    } else {
      points.forEach((p, i) => drawn.push({ p, props: { label: String(i + 1) } }));
    }

    const ptsSource = map.getSource(SRC.pts) as GeoJSONSource;
    ptsSource.setData({
      type: "FeatureCollection",
      features: drawn.map(({ p, props }) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: props,
      })),
    });

    const lineSource = map.getSource(SRC.line) as GeoJSONSource;
    if (drawn.length < 2) {
      lineSource.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    // Punktir sifatida chiziladi. Marshrut rejimida server javobi
    // kelgach bu chiziq uzluksiz marshrut bilan almashtiriladi —
    // ya'ni punktir "hali haqiqiy yo'l emas" degani.
    lineSource.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: drawn.map(({ p }) => [p.lng, p.lat]),
      },
      properties: { kind: isRoute ? "preview" : "measure" },
    });
  }, [map, ready, points, mode, routeA, routeB]);

  // Marshrut: ikki nuqta tayyor bo'lganda so'raladi.
  useEffect(() => {
    if (mode !== "route" || !routeA || !routeB || !map) return;

    const key = `${routeA.lat},${routeA.lng}>${routeB.lat},${routeB.lng}`;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;

    void (async () => {
      try {
        const r = await api.route(routeA, routeB, controller.signal);
        if (controller.signal.aborted) return;

        const src = map.getSource(SRC.line) as GeoJSONSource;
        src.setData({
          type: "Feature",
          geometry: r.geometry,
          properties: { kind: "route" },
        });
        setRouteRes({
          key,
          info: {
            distanceM: r.distance_m,
            durationS: r.duration_s,
            onRoad: true,
            // `Date.now()` bu yerda (asinxron qaytarishda) chaqiriladi,
            // render paytida emas — render sof bo'lib qoladi.
            etaMs: Date.now() + r.duration_s * 1000,
          },
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        // Soxta marshrut chizilmaydi. To'g'ri chiziqqa qaytamiz va
        // buni OCHIQ aytamiz — foydalanuvchi taxminni yo'l masofasi
        // deb o'ylamasligi kerak.
        setRouteRes({
          key,
          info: {
            distanceM: pathLengthMeters([routeA, routeB]),
            durationS: 0,
            onRoad: false,
            etaMs: 0,
            note: (e as Error).message,
          },
        });
      }
    })();
  }, [mode, routeA, routeB, map]);

  // Yagona bosish ishlovchisi.
  useEffect(() => {
    if (!map || !ready) return;

    const onClick = (e: MapMouseEvent) => {
      const p = { lat: e.lngLat.lat, lng: e.lngLat.lng };

      // «Ob'ekt qo'shish» rejimi: bosish faqat belgini ko'chiradi.
      if (onPick) {
        onPick(p);
        return;
      }

      if (mode === "measure") {
        setPoints((prev) => [...prev, p]);
        return;
      }
      if (mode === "route") {
        // Tanlangan maydon bo'lsa — shu nuqta almashtiriladi. Ikkala
        // nuqta qo'yilgan va maydon tanlanmagan bo'lsa (`slot === null`)
        // bosish YANGI marshrutni boshlaydi.
        const base = rp.slot === null ? EMPTY_ROUTE : rp;
        const target: RouteSlot = rp.slot ?? "a";
        const named = describeAt(map, e.point);

        const next: RouteState = { ...base };
        if (target === "a") {
          next.a = p;
          next.labelA = named;
        } else {
          next.b = p;
          next.labelB = named;
        }
        const other = target === "a" ? next.b : next.a;
        next.slot = other ? null : target === "a" ? "b" : "a";

        setRp(next);
        labelPoint(p, named);
        return;
      }

      // ── Oddiy rejim ────────────────────────────────────────────
      // Foydalanuvchi qo'shgan ob'ekt belgisi bosilgan bo'lsa, uni qatlamning
      // o'z ishlovchisi ochadi (`usePlacesLayer`). Bu yerda ham manzil so'ralsa,
      // ikkalasi bir bosishga javob berib, panel ikki marta almashardi.
      // (Belgi VA yo'l chizig'i: ikkalasining ham o'z ishlovchisi bor.)
      const placeLayers = present(map, PLACES_HIT_LAYERS);
      if (
        placeLayers.length > 0 &&
        map.queryRenderedFeatures(boxAround(e.point), { layers: placeLayers }).length > 0
      ) {
        return;
      }
      inspectAt(e.point, p);
    };

    // ⚠️ Bog'liqliklar to'liq sanalgan (ilgari ular ref orqali
    // o'qilardi — React qoidasi buni taqiqlaydi va eskirgan qiymat
    // ushlanib qolish xavfi bor edi). Ishlovchi rejim yoki marshrut
    // nuqtalari o'zgarganda qayta ulanadi; bu arzon amal.
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, ready, mode, rp, labelPoint, inspectAt, onPick]);

  // Kursor joriy rejimni ko'rsatadi.
  const picking = onPick !== null;
  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = mode === "idle" && !picking ? "" : "crosshair";
  }, [map, mode, picking]);

  return {
    points,
    route,
    routeState: rp,
    clear,
    swapRoute,
    pickSlot,
    placeRoutePoint,
    addMeasurePoint,
    inspectAt,
    hasDrawing: points.length > 0 || rp.a !== null || rp.b !== null,
    measuredText: formatDistance(pathLengthMeters(points)),
  };
}
