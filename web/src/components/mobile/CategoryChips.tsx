"use client";

/**
 * Turkumlar — mobil pastki panelda GORIZONTAL aylantiriladigan chiplar
 * (Yandex `image.png`): kulrang kichik kvadrat ichida oq belgi va yozuv,
 * pastida ingichka chiziq. Chetlari kesilib ko'rinadi — "yana bor" degan
 * ishora, barmoq bilan suriladi.
 *
 * Ma'lumot va holat `panels/categories.tsx` bilan BIR XIL: ikki nusxa
 * bir-biridan farq qilib qolmasin. Mobilda «Barcha joylar» tugmasi yo'q —
 * hamma turkum shu yerda (aylantiriladi). Tanlangan turkum xaritada faqat
 * o'sha turkumdagi joylarni qoldiradi.
 */

import Image from "next/image";

import { ALL_CATEGORIES, useCategories } from "@/components/panels/categories";

export default function CategoryChips() {
  const { active, setActive } = useCategories();

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
        {ALL_CATEGORIES.map((c) => {
          const on = c.key === active;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(on ? null : c.key)}
              className="flex shrink-0 items-center gap-2.5 rounded-xl py-1 text-left active:opacity-70"
            >
              {c.pngIcon ? (
                // PNG pin — xaritadagi belgi bilan AYNAN BIR XIL (fon YO'Q:
                // rasmning o'zida o'z rangi bor).
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center">
                  <Image src={c.pngIcon} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
                </span>
              ) : (
                <span
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-white [&_svg]:h-[18px] [&_svg]:w-[18px]"
                  // Kulrang (rasmdagi kabi); tanlanganda turkumning o'z rangi.
                  style={{ backgroundColor: on ? c.color : "#9a9ca4" }}
                >
                  {c.icon}
                </span>
              )}
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
    </div>
  );
}
