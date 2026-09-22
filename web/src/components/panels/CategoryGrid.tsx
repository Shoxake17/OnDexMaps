"use client";

/**
 * Turkumlar — 5 ustunli dumaloq belgilar (asosiy 10 ta; «Barcha joylar» bosilsa
 * qolganlari ham ochiladi).
 *
 * Joylashuvi va o'lchamlari Yandex sidebar'idagi bilan bir xil:
 * 56 px dumaloq, ostida ikki qatorgacha sig'adigan kichik yozuv.
 *
 * Turkum tanlanganda xaritada FAQAT shu turkumdagi joylar qoladi (`categories.tsx`
 * → `usePlacesLayer`); yana bosilsa (yoki shu chipni qayta bossa) filtr olib
 * tashlanadi.
 *
 * ⚠️ HALOLLIK QOIDASI: OnDexMap joylar katalogi EMAS — xaritada faqat
 * OpenStreetMap va jamoa qo'shgan ob'ektlar bor, to'liq bo'lmasligi mumkin.
 * Ilgari bu tanlangan turkum ostida matn bilan ham aytilardi — foydalanuvchi
 * talabi bilan OLIB TASHLANDI (keraksiz ogohlantirish). Qoidaning o'zi
 * kuchda: brend belgilari (KFC, Korzinka) YO'Q — "bizda bu joylar bor"
 * degan yolg'on va'da bo'lardi.
 */

import Image from "next/image";

import { CATEGORIES, MORE_CATEGORIES, useCategories } from "./categories";

export { CATEGORIES } from "./categories";
export type { Category } from "./categories";

export default function CategoryGrid() {
  const { active, setActive, expanded } = useCategories();
  const list = expanded ? [...CATEGORIES, ...MORE_CATEGORIES] : CATEGORIES;

  return (
    <div className="px-3 pb-1 pt-3">
      <div className="grid grid-cols-5 gap-x-0.5 gap-y-2" data-testid="category-grid">
        {list.map((c) => {
          const on = c.key === active;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(on ? null : c.key)}
              aria-pressed={on}
              data-category={c.key}
              className="flex flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition hover:bg-zinc-50 dark:hover:bg-white/5"
            >
              {c.pngIcon ? (
                // PNG pin — xaritadagi belgi bilan AYNAN BIR XIL rasm (rangli
                // doira YO'Q: rasmning o'zida o'z rangi, halqasi va soyasi bor).
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ outline: on ? "2px solid #ea580c" : undefined, outlineOffset: "2px" }}
                >
                  <Image src={c.pngIcon} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
                </span>
              ) : (
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
              )}
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
    </div>
  );
}
