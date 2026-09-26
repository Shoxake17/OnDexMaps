import { permanentRedirect } from "next/navigation";

/** Eski manzil: bo'lim `/docs/integration` ga ko'chdi (har usul alohida sahifa). */
export default function IntegratsiyaRedirect(): never {
  permanentRedirect("/docs/integration");
}
