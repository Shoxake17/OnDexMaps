"use client";

/**
 * Xarita sahnasi: yon panel + tuval + vositalar (desktop) yoki to'liq ekran
 * xarita + pastki panel (mobil).
 *
 * ┌─ IKKI KO'RINISH, BITTA XARITA ─────────────────────────────────────
 * Desktop: yon panel xarita YONIDA, vositalar xarita burchaklarida.
 * Mobil (< 768 px): xarita to'liq ekran, hamma narsa uning USTIDA suzadi
 * (`MobileChrome` — Yandex `mobilemap.png`).
 *
 * ⚠️ Xarita tuvali (`MapSurface`) ikkala ko'rinishda ham BIR XIL joyda va
 * `key="map"` bilan turadi: oyna kengligi o'zgarganda (telefonni burish,
 * oynani toraytirish) React uni QAYTA YARATMAYDI. Aks holda MapLibre
 * nusxasi yo'q qilinib, xarita bo'sh qolardi.
 * └──────────────────────────────────────────────────────────────────
 */

import { useCallback, useMemo, useState } from "react";

import { MapProvider, useMap } from "./MapProvider";
import MapControls from "./MapControls";
import MapContextMenu from "./MapContextMenu";
import { useMapTools, type ToolMode } from "./useMapTools";
import { ChevronLeft, ChevronRight } from "lucide-react";

import OnDexMark from "@/components/brand/OnDexMark";
import MapCredits from "./MapCredits";
import { extendLine, type LngLat } from "@/lib/geo";
import AddObjectPanel from "@/components/places/AddObjectPanel";
import PlaceDetails from "@/components/places/PlaceDetails";
import { useAddLine } from "@/components/places/useAddLine";
import { useAddMarker } from "@/components/places/useAddMarker";
import { usePlacesLayer, type CategoryFilter } from "@/components/places/usePlacesLayer";
import { CategoryContext, findCategory, type CategoryState } from "@/components/panels/categories";
import { usePlacesMeta } from "@/components/places/usePlacesMeta";
import ToolBar from "@/components/panels/ToolBar";
import SearchBar from "@/components/panels/SearchBar";
import CityHeader from "@/components/panels/CityHeader";
import CategoryGrid from "@/components/panels/CategoryGrid";
import RoutePanel from "@/components/panels/RoutePanel";
import MobileChrome, { type SheetState } from "@/components/mobile/MobileChrome";
import CategoryChips from "@/components/mobile/CategoryChips";
import { MOBILE_DARK_THEME } from "@/lib/config";
import { DARK_QUERY, MOBILE_QUERY, useMedia } from "@/lib/useMedia";
import type { MapInit } from "@/lib/mapUrl";
import type { LineRule, PlaceGeometry } from "@/lib/places";

interface Props {
  init: MapInit;
  address: string | null;
  addressBusy: boolean;
  onAddress: (text: string | null, busy: boolean) => void;
}

export default function MapStage({ init, ...rest }: Props) {
  const mobile = useMedia(MOBILE_QUERY);
  // Qorong'i mavzu FAQAT mobilda, qurilma qorong'i rejimda VA bayroq yoqilgan
  // bo'lsa (`MOBILE_DARK_THEME`, hozir o'chiq). Desktop xaritasi doim oq.
  // `useMedia` har doim chaqiriladi: hook'lar shartli bo'lishi mumkin emas.
  const systemDark = useMedia(DARK_QUERY);
  const dark = MOBILE_DARK_THEME && systemDark && mobile;

  return (
    <MapProvider init={init} dark={dark}>
      <StageInner {...rest} mobile={mobile} dark={dark} />
    </MapProvider>
  );
}

/** Xarita tuvalidagi nuqta (piksel). */
type ScreenPoint = { x: number; y: number };

const KIND_LABEL: Record<string, string> = {
  mahalla: "mahalla",
  qishloq: "qishloq",
  daha: "daha",
};

function StageInner({
  address,
  addressBusy,
  onAddress,
  mobile,
  dark,
}: Omit<Props, "init"> & { mobile: boolean; dark: boolean }) {
  const { map, ready, selected, selectArea, serviceBounds } = useMap();
  const [mode, setMode] = useState<ToolMode>("idle");
  // Desktop yon paneli.
  const [open, setOpen] = useState(true);
  // Mobil pastki paneli.
  const [sheet, setSheet] = useState<SheetState>("peek");

  // ── Foydalanuvchi ob'ektlari ─────────────────────────────────────────
  // `placesMeta` — server qoidalari; `null` bo'lsa (yoki qabul qilish
  // yoqilmagan) «Ob'ekt qo'shish» ko'rinmaydi.
  const placesMeta = usePlacesMeta();
  // Belgining hozirgi joyi — «Ob'ekt qo'shish» oqimi ochiq ekanini ham bildiradi.
  const [add, setAdd] = useState<LngLat | null>(null);
  // Yo'l (chiziq) turi tanlanganda: chizilayotgan yo'l nuqtalari va hozirgi shakl.
  // Shakl AddObjectPanel dan keladi (qaysi tur tanlangan): line bo'lsa belgi
  // o'rniga chizish rejimi yoqiladi va xaritadagi HAR BIR bosish yo'lga nuqta qo'shadi.
  const [addLine, setAddLine] = useState<LngLat[]>([]);
  const [addShape, setAddShape] = useState<PlaceGeometry>("point");
  // Chiziq turining chegarasi (server metadan): eng uzun va eng ko'p nuqta.
  // Shu chegarada xarita yangi nuqtani qabul qilmaydi yoki qisqartiradi
  // (piyodalar o'tish joyi 10 m dan oshmasin).
  const [addRule, setAddRule] = useState<LineRule | null>(null);
  const onAddShape = useCallback((shape: PlaceGeometry, rule: LineRule | null) => {
    setAddShape(shape);
    setAddRule(rule);
  }, []);
  // Xaritada tanlangan (tasdiqlangan) ob'ekt.
  const [placeId, setPlaceId] = useState<string | null>(null);
  // Qo'shish oqimi FAQAT desktop'da (telefonda o'ng tugma menyusi yo'q):
  // oyna toraysa belgi va bosishni ushlash to'xtaydi.
  const addPoint = mobile ? null : add;
  const adding = addPoint !== null;
  const drawingLine = adding && addShape === "line";
  // ── Turkumlar (sidebar): tanlangan turkum va «Barcha joylar» ─────────────
  // Holat shu yerda: xaritaga filtr qo'llanadi (`usePlacesLayer`), sidebar, sarlavha
  // va mobil chiplar esa kontekst orqali BIR holatni bo'lishadi.
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const categoryState = useMemo<CategoryState>(
    () => ({
      active: categoryKey,
      setActive: setCategoryKey,
      expanded: categoriesExpanded,
      setExpanded: setCategoriesExpanded,
    }),
    [categoryKey, categoriesExpanded],
  );
  const categoryFilter = useMemo<CategoryFilter | null>(() => {
    const c = findCategory(categoryKey);
    return c
      ? { key: c.key, classes: c.classes, orgCategories: c.orgCategories, kinds: c.kinds }
      : null;
  }, [categoryKey]);

  const pickPoint = useMemo(
    () =>
      adding
        ? drawingLine
          ? (p: LngLat) =>
              // Turning chegarasi ichida qo'shiladi: nuqta soni to'lsa qo'shilmaydi,
              // uzunlik oshsa chiziq chegarada to'xtaydi (server ham shuni talab qiladi).
              setAddLine((prev) =>
                addRule ? extendLine(prev, p, addRule) : [...prev, p],
              )
          : (p: LngLat) => setAdd(p)
        : null,
    [adding, drawingLine, addRule],
  );

  // Har qanday manzil aniqlash ob'ekt panelini yopadi: foydalanuvchi bo'sh
  // joyni bossa, eski ob'ekt ma'lumoti panelda qolib ketmasin.
  const handleAddress = useCallback(
    (text: string | null, busy: boolean) => {
      setPlaceId(null);
      onAddress(text, busy);
    },
    [onAddress],
  );

  const {
    points,
    route,
    routeState,
    clear,
    swapRoute,
    pickSlot,
    placeRoutePoint,
    addMeasurePoint,
    inspectAt,
    hasDrawing,
    measuredText,
  } = useMapTools({
    map,
    ready,
    mode,
    onSelectArea: selectArea,
    onAddress: handleAddress,
    serviceBounds,
    onPick: pickPoint,
  });

  const selectPlace = useCallback(
    (id: string) => {
      selectArea(null);
      onAddress(null, false);
      setPlaceId(id);
      setOpen(true);
      setSheet("half");
    },
    [selectArea, onAddress],
  );
  // Belgilar faqat oddiy rejimda bosiladi (marshrut/o'lchash/qo'shishda emas).
  usePlacesLayer(map, ready, mode === "idle" && !adding, selectPlace, 0, categoryFilter);
  // Belgi FAQAT nuqta turlarida; yo'lda uning o'rniga chiziq va nuqta belgilari.
  useAddMarker(map, drawingLine ? null : addPoint, setAdd);
  useAddLine(map, drawingLine ? addLine : null, setAddLine);

  /**
   * Rejim almashganda eski chizma tozalanadi.
   *
   * Bu ATAYLAB effektda emas, hodisa ishlovchisida: rejim
   * foydalanuvchi amali bilan o'zgaradi va tozalash ham o'sha
   * amalning bir qismi.
   *
   * Mobilda panel ham moslanadi: marshrutda A/B ni xaritadan tanlash uchun
   * xarita ko'rinib turishi kerak (`half`), boshqa rejimlarda yig'ilgan.
   */
  const changeMode = useCallback(
    (m: ToolMode) => {
      clear();
      setMode(m);
      setSheet(m === "route" ? "half" : "peek");
    },
    [clear],
  );
  const toggleRoute = () => changeMode(mode === "route" ? "idle" : "route");

  // ── O'ng tugma menyusi amallari (faqat desktop) ──────────────────────
  // Har biri kerakli rejimga o'tadi VA yon panelni ochadi: natija
  // (manzil, marshrut) panelda ko'rinadi, yopiq bo'lsa foydalanuvchi
  // amal natijasini ko'rmay qolardi. Rejim allaqachon to'g'ri bo'lsa
  // chizma TEGILMAYDI (masalan A qo'yilgan bo'lsa «bu yerga» uni saqlaydi).
  const menuRoute = (slot: "a" | "b", p: LngLat, screen: ScreenPoint) => {
    if (mode !== "route") changeMode("route");
    setOpen(true);
    placeRoutePoint(slot, p, screen);
  };
  const menuWhatsHere = (p: LngLat, screen: ScreenPoint) => {
    if (mode !== "idle") changeMode("idle");
    setOpen(true);
    inspectAt(screen, p);
  };
  const menuMeasure = (p: LngLat) => {
    if (mode !== "measure") changeMode("measure");
    addMeasurePoint(p);
  };
  // «Ob'ekt qo'shish»: oddiy rejimga o'tadi, yon panelni ochadi va belgini
  // o'ng tugma bosilgan joyga qo'yadi.
  const menuAddObject = (p: LngLat) => {
    if (mode !== "idle") changeMode("idle");
    setPlaceId(null);
    setOpen(true);
    setAddLine([]);
    setAdd(p);
  };

  // Tanlangan hudud, o'lchash natijasi va manzil — desktop paneli va mobil
  // panelida BIR XIL blok.
  //
  // ⚠️ Hech narsa tanlanmagan/aniqlanmagan bo'lsa blok UMUMAN chiqmaydi: ilgari
  // shunda «Tanlangan hudud — Chegarasini ko'rish uchun…» va «Manzil — Bilish uchun…»
  // yo'l-yo'riq matnlari turardi (talab bo'yicha olib tashlandi).
  const showInfo = !!selected || mode === "measure" || addressBusy || !!address;
  const info = !showInfo ? null : (
    <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 dark:border-white/10">
      {selected && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Tanlangan hudud
          </h3>
          <p className="mt-1 text-base text-zinc-900 dark:text-white">
            {selected.name}{" "}
            <span className="text-zinc-500 dark:text-zinc-400">
              ({KIND_LABEL[selected.kind] ?? selected.kind})
            </span>
          </p>
        </section>
      )}

      {mode === "measure" && (
        <section className="rounded-2xl bg-orange-50 p-4 dark:bg-orange-500/15">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-orange-700/80 dark:text-orange-300">
            Masofa o&apos;lchash
          </h3>
          <p className="mt-1 text-2xl font-semibold text-orange-900 dark:text-orange-200">
            {measuredText}
          </p>
          <p className="mt-1 text-xs text-orange-800 dark:text-orange-300">
            {points.length < 2
              ? "Xaritada nuqtalarni ketma-ket bosing"
              : `${points.length} nuqta · to'g'ri chiziq bo'ylab`}
          </p>
        </section>
      )}

      {(addressBusy || address) && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Manzil
          </h3>
          <p className="mt-1 text-sm text-zinc-900 dark:text-white">
            {addressBusy ? "so'ralmoqda…" : address}
          </p>
        </section>
      )}
    </div>
  );

  const routePanel = (
    <RoutePanel
      state={routeState}
      route={route}
      onPick={pickSlot}
      onSwap={swapRoute}
      onClear={clear}
    />
  );

  return (
    <CategoryContext.Provider value={categoryState}>
    <div
      className={`relative flex h-full w-full overflow-hidden ${
        mobile ? "ondex-mobile" : ""
      } ${dark ? "dark" : ""}`}
    >
      {/* ── Yon panel (faqat desktop) ────────────────────────────────
          Yopilganda kengligi nolga tushadi (DOM'dan olinmaydi):
          shunda ochilish/yopilish silliq bo'ladi va ichkaridagi
          holat — tanlangan turkum, natijalar — saqlanib qoladi. */}
      {!mobile && (
        <aside
          className={`h-full shrink-0 overflow-hidden border-zinc-200 bg-white transition-[width] duration-200 ${
            open ? "w-[400px] border-r" : "w-0 border-r-0"
          }`}
        >
          {/* Tepadagi bo'shliq — qidiruv paneli uchun (u ustida turadi). */}
          <div className="h-full w-[400px] overflow-y-auto pt-[72px]">
            {addPoint && placesMeta ? (
              // «Ob'ekt qo'shish» — butun panel almashadi (Yandex
              // `obyektSidebar.png`).
              <AddObjectPanel
                meta={placesMeta}
                point={addPoint}
                line={addLine}
                onLineChange={setAddLine}
                onShape={onAddShape}
                onClose={() => {
                  setAdd(null);
                  setAddLine([]);
                }}
              />
            ) : placeId ? (
              <PlaceDetails id={placeId} onClose={() => setPlaceId(null)} />
            ) : mode === "route" ? (
              // Marshrut rejimi — butun panel almashadi (Yandex
              // `MatrixSidebar.png`): shahar sarlavhasi va turkumlar yo'qoladi.
              routePanel
            ) : (
              <>
                <CityHeader />
                <CategoryGrid />
                {info}
              </>
            )}
          </div>
        </aside>
      )}

      {/* Xarita qolgan joyni egallaydi. `min-h-0` SHART: flex
          bolasining standart `min-height:auto` qiymati uni
          qisqarishga qo'ymaydi va tuval balandligi buziladi. */}
      <main key="map" className="relative min-h-0 flex-1">
        <MapSurface />
        {!mobile && (
          <>
            <ToolBar
              mode={mode}
              onMode={changeMode}
              onClear={clear}
              hasMeasure={hasDrawing}
            />
            <MapControls />
            <MapContextMenu
              map={map}
              onWhatsHere={menuWhatsHere}
              onRouteTo={(p, s) => menuRoute("b", p, s)}
              onRouteFrom={(p, s) => menuRoute("a", p, s)}
              onMeasure={menuMeasure}
              onAddObject={placesMeta ? menuAddObject : undefined}
            />
          </>
        )}
        {/* Brend yozuvi: eng pastki o'ng burchak (desktop va mobil). «© OnDex map»
            krediti va to'liq manba ro'yxati (ODbL talabi) MapLibre'ning o'z
            boshqaruvida — u yozuvning chap tomonida turadi (globals.css). Ilgari
            shu yerda uning ikkinchi nusxasi ham bor edi: bir xil matn ikki marta chiqardi. */}
        <MapCredits />
        <OnDexMark />
      </main>

      {mobile ? (
        <MobileChrome
          mode={mode}
          onMode={changeMode}
          sheet={sheet}
          onSheet={setSheet}
          onRoute={toggleRoute}
          measure={{ text: measuredText, points: points.length, onClear: clear }}
          search={
            <SearchBar
              variant="sheet"
              onRoute={toggleRoute}
              routeActive={mode === "route"}
              // Maydonga bosilsa panel to'liq ochiladi (natijalar sig'ishi
              // uchun); natija tanlansa yig'iladi va xarita ko'rinadi.
              onFocusSearch={() => setSheet("full")}
              onPick={() => setSheet("peek")}
            />
          }
          content={
            placeId ? (
              <PlaceDetails id={placeId} onClose={() => setPlaceId(null)} />
            ) : mode === "route" ? (
              routePanel
            ) : (
              <>
                {/* Mobilda turkumlar — gorizontal chiplar (Yandex `image.png`). */}
                <CategoryChips />
                <CityHeader />
                {info}
              </>
            )
          }
        />
      ) : (
        <>
          {/* ── Qidiruv paneli ───────────────────────────────────────
              ATAYLAB yon panel ICHIDA emas, uning USTIDA: yon panel
              yopilganda ham qidiruv joyida qoladi. Bitta nusxa — ya'ni
              yozilgan matn ham, natijalar ham yo'qolmaydi. */}
          <div
            className={`absolute left-3 top-3 z-30 max-w-[calc(100%-1.5rem)] transition-[width] duration-200 ${
              open ? "w-[376px]" : "w-[360px]"
            } ${open ? "" : "rounded-xl bg-white shadow-lg"}`}
          >
            <SearchBar onRoute={toggleRoute} routeActive={mode === "route"} />
          </div>

          {/* Ochish/yopish. Panel chetida turadi va u bilan birga suriladi. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Yon panelni yopish" : "Yon panelni ochish"}
            aria-expanded={open}
            className={`absolute top-1/2 z-30 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-zinc-200 bg-white text-zinc-600 shadow-sm transition-[left] duration-200 hover:bg-zinc-50 ${
              open ? "left-[400px]" : "left-0"
            }`}
          >
            {open ? <ChevronLeft size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
          </button>
        </>
      )}
    </div>
    </CategoryContext.Provider>
  );
}

/** Xarita tuvali joylashadigan element (MapProvider uni to'ldiradi). */
function MapSurface() {
  const { holderRef } = useMap();
  return <div ref={holderRef} className="h-full w-full" />;
}
