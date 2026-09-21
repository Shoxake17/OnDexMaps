"use client";

/**
 * Turkumlar — mobil pastki panelda GORIZONTAL aylantiriladigan chiplar
 * (Yandex `image.png`): kulrang kichik kvadrat ichida oq belgi va yozuv,
 * pastida ingichka chiziq. Chetlari kesilib ko'rinadi — "yana bor" degan
 * ishora, barmoq bilan suriladi.
 *
 * Ma'lumot `CategoryGrid` bilan BIR XIL (`CATEGORIES`): ikki nusxa
 * bir-biridan farq qilib qolmasin.
 *
 * ⚠️ HALOLLIK QOIDASI (CategoryGrid'dagi bilan bir xil): manbasi yo'q
 * turkum bosilganda SOXTA natija chizilmaydi — sababi ochiq aytiladi.
 */

import { useState } from "react";

import { CATEGORIES } from "@/components/panels/CategoryGrid";

export default function CategoryChips() {
  const [active, setActive] = useState<string | null>(null);
  const chosen = CATEGORIES.find((c) => c.key === active) ?? null;

  return (
    <div className="border-b border-zinc-200 pb-3 dark:border-white/10">
      {/* `-mx-3`: qator panel chetigacha cho'ziladi (panelning yon bo'shlig'i
          bekor qilinadi), shuning uchun chiplar ekran chetida kesiladi.
          Aylantirish chizig'i yashirin. */}
      <div
        role="group"
        aria-label="Turkumlar"
        className="-mx-3 flex gap-5 overflow-x-auto px-3 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CATEGORIES.map((c) => {
          const on = c.key === active;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(on ? null : c.key)}
              className="flex shrink-0 items-center gap-2.5 rounded-xl py-1 text-left active:opacity-70"
            >
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-white [&_svg]:h-[18px] [&_svg]:w-[18px]"
                // Kulrang (rasmdagi kabi); tanlanganda turkumning o'z rangi.
                style={{ backgroundColor: on ? c.color : "#9a9ca4" }}
              >
                {c.icon}
              </span>
              <span
                className={`whitespace-nowrap text-[16px] leading-none ${
                  on
                    ? "font-semibold text-orange-800 dark:text-orange-300"
                    : "font-medium text-zinc-900 dark:text-white"
                }`}
              >
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      {chosen && (
        <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
          <b>{chosen.name}</b>{" "}
          {chosen.hasSource
            ? "ChustApp katalogidan keladi — bu bog'lanish keyingi bosqichda ulanadi."
            : "uchun ma'lumot manbasi hali yo'q. OnDexMap joylar katalogi emas — u mahalla va ko'cha nomlarini saqlaydi. Bu turkum jamoa takliflari bilan to'ladi."}
        </p>
      )}
    </div>
  );
}
