import { redirect } from "next/navigation";

/**
 * Bosh sahifa — HUJJATLAR (login EMAS).
 *
 * Dasturchi avval API bilan tanishib chiqishi kerak; kalit olish uchun kirish
 * faqat keyingi qadam. Shuning uchun ildiz manzil `/docs` ga yo'naltiriladi.
 */
export default function RootPage() {
  redirect("/docs");
}
