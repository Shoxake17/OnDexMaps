/**
 * «OnDex» yozuvi — xaritaning ENG PASTKI O'NG burchagida (brend belgisi).
 *
 * `fixed`: desktopda xarita ekranning o'ng-pastki burchagigacha cho'zilgan,
 * mobilda esa pastki panel xaritani yopadi — yozuv har ikkala holatda ham
 * burchakda va panel USTIDA (`z-40`) ko'rinadi. Bosilmaydi (`pointer-events-none`):
 * xaritani bosishga xalaqit bermaydi.
 *
 * ⚠️ Bu — brend, litsenziya krediti EMAS. OpenStreetMap (ODbL) va Esri talab qiladigan
 * kreditlar `MapCredits` da («ⓘ» ichida) — u yozuvning chap tomonida turadi
 * (`globals.css` → `.ondex-credits`). Yozuv katta (28 px): brend ko'zga tashlansin.
 */
export default function OnDexMark() {
  return (
    <span aria-label="OnDex" className="ondex-mark">
      <span className="ondex-mark-on">On</span>
      <span className="ondex-mark-dex">Dex</span>
    </span>
  );
}
