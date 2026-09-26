import { permanentRedirect } from "next/navigation";

/** Eski manzil: sahifa `/docs/js/quickstart` ga qaytarildi. */
export default function QuickstartRedirect(): never {
  permanentRedirect("/docs/js/quickstart");
}
