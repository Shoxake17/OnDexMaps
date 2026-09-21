"use client";

/**
 * Turkumlar — 5 ustunli ikki qator dumaloq belgilar.
 *
 * Joylashuvi va o'lchamlari Yandex sidebar'idagi bilan bir xil:
 * 56 px dumaloq, ostida ikki qatorgacha sig'adigan kichik yozuv.
 *
 * ⚠️ HALOLLIK QOIDASI: manbasi yo'q turkum bosilganda SOXTA natija
 * chizilmaydi. OnDexMap joylar katalogi EMAS — u mahalla va ko'cha
 * nomlarini saqlaydi. Ovqatlanish joylari ChustApp katalogidan
 * keladi, qolganlari esa jamoa takliflari bilan to'ladi.
 *
 * Shu sababli bu yerda Yandex'dagidek brend belgilari (KFC, Korzinka)
 * YO'Q: ularni chizish "bizda bu joylar bor" degan yolg'on va'da
 * bo'lardi.
 */

import { useState } from "react";

export interface Category {
  key: string;
  name: string;
  color: string;
  /** Ma'lumot manbasi bormi. `false` — halol izoh ko'rsatiladi. */
  hasSource: boolean;
  icon: React.ReactNode;
}

const ICON = "h-[22px] w-[22px]";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className={ICON}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const CATEGORIES: Category[] = [
  {
    key: "ovqat",
    name: "Ovqatlanish joylari",
    color: "#f59e42",
    hasSource: true,
    icon: (
      <Svg>
        <path d="M4 3v8a3 3 0 0 0 6 0V3M7 11v10" />
        <path d="M17 3c-1.5 2-2 4-2 6s.5 3 2 3 2-1 2-3-.5-4-2-6zM17 12v9" />
      </Svg>
    ),
  },
  {
    key: "hotel",
    name: "Mehmonxonalar",
    color: "#a78bfa",
    hasSource: false,
    icon: (
      <Svg>
        <path d="M2 18v-6a2 2 0 0 1 2-2h12a4 4 0 0 1 4 4v4M2 18h20M2 14h6" />
        <circle cx="7" cy="9" r="2" />
      </Svg>
    ),
  },
  {
    key: "oziq",
    name: "Oziq-ovqat",
    color: "#5ca9e8",
    hasSource: false,
    icon: (
      <Svg>
        <path d="M4 8h16l-1.5 11h-13z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </Svg>
    ),
  },
  {
    key: "dori",
    name: "Dorixonalar",
    color: "#4cc15f",
    hasSource: false,
    icon: (
      <Svg>
        <path d="M12 6v12M6 12h12" />
      </Svg>
    ),
  },
  {
    key: "savdo",
    name: "Savdo markazlari",
    color: "#6fb9ef",
    hasSource: false,
    icon: (
      <Svg>
        <path d="M5 8h14l-1.3 12H6.3z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </Svg>
    ),
  },
  {
    key: "azs",
    name: "Shoxobchalar",
    color: "#9b8cf5",
    hasSource: false,
    icon: (
      <Svg>
        <path d="M4 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M3 20h11" />
        <path d="M13 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2.5-2.5" />
        <path d="M6 7h5v3H6z" />
      </Svg>
    ),
  },
  {
    key: "kafe",
    name: "Kafelar",
    color: "#5cb8e8",
    hasSource: true,
    icon: (
      <Svg>
        <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
        <path d="M17 10h2a2.5 2.5 0 0 1 0 5h-2M6 3v2.5M10 3v2.5M14 3v2.5" />
      </Svg>
    ),
  },
  {
    key: "bank",
    name: "Bankomatlar",
    color: "#e8453c",
    hasSource: false,
    icon: (
      <Svg>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <path d="M2.5 10h19" />
        <path d="M6 14.5h4" />
      </Svg>
    ),
  },
  {
    key: "bozor",
    name: "Bozorlar",
    color: "#f97316",
    hasSource: false,
    icon: (
      <Svg>
        <path d="M3 9l1.5-4h15L21 9" />
        <path d="M3 9a2.5 2.5 0 0 0 4.5 1.5A2.5 2.5 0 0 0 12 9a2.5 2.5 0 0 0 4.5 1.5A2.5 2.5 0 0 0 21 9" />
        <path d="M5 11.5V20h14v-8.5" />
      </Svg>
    ),
  },
  {
    key: "shifoxona",
    name: "Shifoxonalar",
    color: "#14b8a6",
    hasSource: false,
    icon: (
      <Svg>
        <path d="M4 21V8l8-5 8 5v13" />
        <path d="M12 10v6M9 13h6" />
      </Svg>
    ),
  },
];

export default function CategoryGrid() {
  const [active, setActive] = useState<string | null>(null);
  const chosen = CATEGORIES.find((c) => c.key === active) ?? null;

  return (
    <div className="px-3 pb-1 pt-3">
      <div className="grid grid-cols-5 gap-x-0.5 gap-y-2">
        {CATEGORIES.map((c) => {
          const on = c.key === active;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(on ? null : c.key)}
              aria-pressed={on}
              className="flex flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition hover:bg-zinc-50 dark:hover:bg-white/5"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                style={{
                  backgroundColor: c.color,
                  outline: on ? "2px solid #ea580c" : undefined,
                  outlineOffset: "2px",
                }}
              >
                {c.icon}
              </span>
              <span
                className={`text-center text-[10.5px] leading-[12px] ${
                  on ? "font-semibold text-orange-900 dark:text-orange-300" : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      {chosen && !chosen.hasSource && (
        <p className="mt-2 rounded-lg bg-zinc-50 dark:bg-white/5 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          <b>{chosen.name}</b> uchun ma&apos;lumot manbasi hali yo&apos;q.
          OnDexMap joylar katalogi emas — u mahalla va ko&apos;cha
          nomlarini saqlaydi. Bu turkum jamoa takliflari bilan to&apos;ladi.
        </p>
      )}

      {chosen?.hasSource && (
        <p className="mt-2 rounded-lg bg-zinc-50 dark:bg-white/5 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          <b>{chosen.name}</b> ChustApp katalogidan keladi — bu bog&apos;lanish
          keyingi bosqichda ulanadi.
        </p>
      )}
    </div>
  );
}
