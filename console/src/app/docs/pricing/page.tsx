import { permanentRedirect } from "next/navigation";

/** Eski manzil: tariflar `Usage & Billing` bo'limiga ko'chdi. */
export default function PricingRedirect(): never {
  permanentRedirect("/docs/billing/plans");
}
