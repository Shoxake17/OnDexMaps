/**
 * `lucide-react/dist/esm/icons/<nom>.mjs` — har bir belgi alohida modul: standart
 * eksport React komponenti, `__iconData` esa uning ma'lumoti (tuvalda chizish
 * uchun, `lib/lucideCanvas.ts`). Paketning o'zi bu chuqur yo'l uchun tur bermaydi.
 */
declare module "lucide-react/dist/esm/icons/*.mjs" {
  import type { LucideIcon, LucideIconData } from "lucide-react";
  export const __iconData: LucideIconData;
  const Icon: LucideIcon;
  export default Icon;
}
