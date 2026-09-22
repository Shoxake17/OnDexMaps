"use client";

/**
 * Turkumlar (sidebar) — ma'lumot va HOLAT.
 *
 * ┌─ TURKUM NIMANI FILTRLAYDI ─────────────────────────────────────────
 * Turkum tanlanganda xaritada FAQAT shu turkumdagi joylar belgisi qoladi:
 *   • OSM joylari — `classes` (OpenMapTiles `poi.class` qiymatlari);
 *   • OnDexMap ob'ektlari — `orgCategories` («Tashkilot» turkumi nomlari,
 *     `internal/places.Categories` dagi AYNAN shu satrlar) va `kinds` (turkumsiz
 *     turlar: transport bekati, avtoturargoh).
 * Boshqa hamma belgi yashiriladi. Filtrni xaritaga `usePlacesLayer` va
 * `useCategoryFilter` qo'llaydi.
 * └────────────────────────────────────────────────────────────────────
 *
 * «Barcha joylar» bosilganda asosiy 10 turkumga qo'shimcha turkumlar ochiladi
 * (`MORE_CATEGORIES`).
 */

import {
  BedDouble,
  BusFront,
  Coffee,
  CreditCard,
  Cross,
  Fuel,
  GraduationCap,
  Hammer,
  Hospital,
  Landmark,
  MapPinned,
  School,
  Scissors,
  ShoppingBag,
  ShoppingBasket,
  SquareParking,
  Store,
  Trees,
  Trophy,
  Utensils,
  Wrench,
  Building,
} from "lucide-react";
import { createContext, useContext } from "react";

export interface Category {
  key: string;
  name: string;
  color: string;
  /** Ma'lumot manbasi bormi (ChustApp katalogi). `false` — halol izoh ko'rsatiladi. */
  hasSource: boolean;
  icon: React.ReactNode;
  /**
   * PNG pin (`image/geologo/`, xaritadagi belgi bilan AYNAN BIR XIL —
   * `kindUi.tsx`/`poiIcons.ts`). Bo'lsa, chip Lucide+rangli doira o'rniga
   * shu rasmning O'ZINI ko'rsatadi (`CategoryGrid`/`CategoryChips`).
   */
  pngIcon?: string;
  /** OSM `poi.class` qiymatlari. */
  classes: string[];
  /** OnDexMap «Tashkilot» turkumlari (server ro'yxatidagi aynan shu nomlar). */
  orgCategories: string[];
  /** Turkumsiz OnDexMap turlari (masalan `stop`, `parking`). */
  kinds: string[];
}

/** Turkum belgisi — Lucide (22 px, doira ichida oq). */
const ic = { size: 22, strokeWidth: 1.9 } as const;

/** Asosiy turkumlar — sidebarning boshida doim ko'rinadi. */
export const CATEGORIES: Category[] = [
  {
    key: "ovqat", name: "Ovqatlanish joylari", color: "#f59e42", hasSource: true,
    icon: <Utensils {...ic} />,
    pngIcon: "/org-icons/restaurant.png",
    classes: ["restaurant", "fast_food"], orgCategories: ["Restoran", "Choyxona"], kinds: [],
  },
  {
    key: "hotel", name: "Mehmonxonalar", color: "#a78bfa", hasSource: false,
    icon: <BedDouble {...ic} />,
    pngIcon: "/org-icons/hotel.png",
    classes: ["lodging"], orgCategories: ["Mehmonxona"], kinds: [],
  },
  {
    key: "oziq", name: "Oziq-ovqat", color: "#5ca9e8", hasSource: false,
    icon: <ShoppingBasket {...ic} />,
    pngIcon: "/org-icons/grocery.png",
    classes: ["grocery", "supermarket", "convenience", "bakery"],
    orgCategories: ["Oziq-ovqat do'koni"], kinds: [],
  },
  {
    key: "dori", name: "Dorixonalar", color: "#4cc15f", hasSource: false,
    icon: <Cross {...ic} />,
    pngIcon: "/org-icons/pharmacy.png",
    classes: ["pharmacy"], orgCategories: ["Dorixona"], kinds: [],
  },
  {
    key: "savdo", name: "Savdo markazlari", color: "#6fb9ef", hasSource: false,
    icon: <ShoppingBag {...ic} />,
    classes: ["shop", "clothing_store"], orgCategories: ["Kiyim do'koni"], kinds: [],
  },
  {
    key: "azs", name: "Shoxobchalar", color: "#9b8cf5", hasSource: false,
    icon: <Fuel {...ic} />,
    classes: ["fuel"], orgCategories: ["Yoqilg'i shoxobchasi"], kinds: [],
  },
  {
    key: "kafe", name: "Kafelar", color: "#5cb8e8", hasSource: true,
    icon: <Coffee {...ic} />,
    pngIcon: "/org-icons/cafe.png",
    classes: ["cafe", "bar", "pub"], orgCategories: ["Kafe"], kinds: [],
  },
  {
    key: "bank", name: "Bankomatlar", color: "#e8453c", hasSource: false,
    icon: <CreditCard {...ic} />,
    classes: ["bank", "atm"], orgCategories: ["Bank / Bankomat"], kinds: [],
  },
  {
    key: "bozor", name: "Bozorlar", color: "#f97316", hasSource: false,
    icon: <Store {...ic} />,
    classes: ["marketplace"], orgCategories: ["Bozor"], kinds: [],
  },
  {
    key: "shifoxona", name: "Shifoxonalar", color: "#14b8a6", hasSource: false,
    icon: <Hospital {...ic} />,
    pngIcon: "/org-icons/hospital.png",
    classes: ["hospital", "doctors", "dentist"], orgCategories: ["Shifoxona / Klinika"], kinds: [],
  },
];

/** «Barcha joylar» bosilganda ochiladigan qo'shimcha turkumlar. */
export const MORE_CATEGORIES: Category[] = [
  {
    key: "maktab", name: "Maktab va bog'chalar", color: "#eab308", hasSource: false,
    icon: <School {...ic} />,
    pngIcon: "/org-icons/school.png",
    classes: ["school", "library"], orgCategories: ["Maktab", "Bolalar bog'chasi"], kinds: [],
  },
  {
    key: "kollej", name: "Kollej va universitet", color: "#ca8a04", hasSource: false,
    icon: <GraduationCap {...ic} />,
    pngIcon: "/org-icons/college.png",
    classes: ["college"], orgCategories: ["Kollej / Universitet"], kinds: [],
  },
  {
    key: "masjid", name: "Masjidlar", color: "#8b7355", hasSource: false,
    icon: <Landmark {...ic} />,
    classes: ["place_of_worship"], orgCategories: ["Masjid"], kinds: [],
  },
  {
    key: "bekat", name: "Transport bekatlari", color: "#3178e2", hasSource: false,
    icon: <BusFront {...ic} />,
    classes: ["bus", "railway"], orgCategories: [], kinds: ["stop"],
  },
  {
    key: "turargoh", name: "Avtoturargohlar", color: "#3b82f6", hasSource: false,
    icon: <SquareParking {...ic} />,
    classes: ["parking"], orgCategories: [], kinds: ["parking"],
  },
  {
    key: "avtoservis", name: "Avtoservis", color: "#64748b", hasSource: false,
    icon: <Wrench {...ic} />,
    classes: ["car"], orgCategories: ["Avtoservis"], kinds: [],
  },
  {
    key: "salon", name: "Go'zallik saloni", color: "#ec4899", hasSource: false,
    icon: <Scissors {...ic} />,
    classes: [], orgCategories: ["Go'zallik saloni"], kinds: [],
  },
  {
    key: "davlat", name: "Davlat va idoralar", color: "#3b82f6", hasSource: false,
    icon: <Building {...ic} />,
    classes: ["police", "town_hall", "post"], orgCategories: ["Davlat muassasasi", "Idora / Ofis"], kinds: [],
  },
  {
    key: "xizmat", name: "Xizmatlar", color: "#78716c", hasSource: false,
    icon: <Hammer {...ic} />,
    classes: [], orgCategories: ["Ta'mirlash va xizmatlar"], kinds: [],
  },
  {
    key: "sport", name: "Sport", color: "#4cc15f", hasSource: false,
    icon: <Trophy {...ic} />,
    classes: ["pitch", "stadium", "sport", "swimming"], orgCategories: [], kinds: [],
  },
  {
    key: "park", name: "Bog'lar va parklar", color: "#22a55b", hasSource: false,
    icon: <Trees {...ic} />,
    classes: ["park", "garden"], orgCategories: [], kinds: [],
  },
  {
    key: "diqqat", name: "Diqqatga sazovor joylar", color: "#f59e42", hasSource: false,
    icon: <MapPinned {...ic} />,
    classes: ["attraction", "information"], orgCategories: [], kinds: [],
  },
];

export const ALL_CATEGORIES: Category[] = [...CATEGORIES, ...MORE_CATEGORIES];

export function findCategory(key: string | null): Category | null {
  return key ? (ALL_CATEGORIES.find((c) => c.key === key) ?? null) : null;
}

// ── Holat: tanlangan turkum va «Barcha joylar» ochiqmi ────────────────

export interface CategoryState {
  /** Tanlangan turkum kaliti (`null` — hammasi ko'rinadi). */
  active: string | null;
  setActive: (key: string | null) => void;
  /** «Barcha joylar» ochilganmi (qo'shimcha turkumlar ko'rinadimi). */
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}

/**
 * Sidebar (desktop), turkum chiplari (mobil) va sarlavha («Barcha joylar») BIR
 * holatni bo'lishadi: bitta joyda tanlansa hamma joyda va xaritada ko'rinadi.
 */
export const CategoryContext = createContext<CategoryState>({
  active: null,
  setActive: () => {},
  expanded: false,
  setExpanded: () => {},
});

export const useCategories = () => useContext(CategoryContext);
