"use client";

/**
 * Xarita krediti: ko'rinishda FAQAT «© OnDex map».
 *
 * Manba kreditlari (OpenStreetMap, OpenMapTiles, Microsoft, sun'iy yo'ldosh
 * provayderi — «Powered by Esri») ko'rinmaydi: ular sahifada SHAFFOF va o'lchamsiz
 * (`.ondex-credits-hidden`) turadi. Ular DOM'da mavjud (ekran o'qish dasturlari,
 * qidiruv tizimlari va tekshiruvchilar ko'ra oladi), ko'z ko'rmaydi.
 * Sun'iy yo'ldosh krediti faqat sun'iy yo'ldosh yoqilganda qo'shiladi.
 *
 * ⚠️ Bu — mahsulot qarori (egasi shunday talab qildi). ODbL / Esri shartlari kreditni
 * ko'rinadigan qilib ko'rsatishni talab qilishi mumkin: sayt ommaviy ochilishidan
 * oldin huquqiy jihatdan tekshirib oling.
 *
 * Joylashuvi: ekranning eng pastki o'ng burchagi (`fixed`: desktopda ham, mobilda
 * pastki panel ustida ham); «OnDex» yozuvi (`OnDexMark`) uning tepasida.
 */

import { useMap } from "./MapProvider";

/** Ko'rinmas manba kreditlari. */
const HIDDEN_CREDITS = [
  "© OpenStreetMap contributors",
  "OpenMapTiles",
  "Microsoft Building Footprints",
] as const;

export default function MapCredits() {
  const { satellite, satelliteCredit } = useMap();
  const hidden: string[] = [...HIDDEN_CREDITS];
  if (satellite && satelliteCredit) hidden.push(satelliteCredit);

  return (
    <div className="ondex-credits">
      <span className="ondex-credits-brand">© OnDex map</span>
      {/* Shaffof va o'lchamsiz: ko'rinmaydi, lekin sahifa matnida mavjud. */}
      <ul className="ondex-credits-hidden" data-testid="credits-hidden">
        {hidden.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
