import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { OPERATOR, operatorIncomplete, req } from "@/components/legal/legal-ui";

export const metadata = {
  title: "Aloqa — OnDexMap",
  description:
    "OnDexMap Platform bo'yicha texnik yordam, hisob-faktura va shaxsga doir ma'lumotlar bo'yicha murojaat kanallari.",
};

/**
 * Aloqa sahifasi.
 *
 * Har bir kanal uchun ATAYLAB javob muddati yozilgan: «bog'laning»
 * deb yozib, qachon javob kelishini aytmaslik pullik xizmat uchun
 * yetarli emas.
 */

const KANALLAR = [
  {
    sarlavha: "Texnik yordam",
    tavsif:
      "Integratsiya, xatolar, API kalitlar, chegaralar. Savolga tezroq javob olish uchun kalit prefiksini (omk_b_… / omk_s_…), so'rov URL'ini va olingan javobni qo'shing — maxfiy qismni EMAS.",
    muddat: "1 ish kuni",
  },
  {
    sarlavha: "Hisob-faktura va obuna",
    tavsif:
      "Obunaga o'tish, hisob-faktura, to'lov holati. O'tkazma izohida hisob-faktura raqamini ko'rsatgan bo'lsangiz, taqqoslash tezroq bo'ladi.",
    muddat: "2 ish kuni",
  },
  {
    sarlavha: "Shaxsga doir ma'lumotlar",
    tavsif:
      "Ma'lumotni olish, tuzattirish yoki o'chirtirish so'rovlari. Murojaat hisobga bog'langan pochta manzilidan yuborilishi kerak.",
    muddat: "30 kalendar kun (qonun bo'yicha)",
  },
  {
    sarlavha: "SLA bo'yicha chegirma talabi",
    tavsif:
      "Uzilish sanalari va dalil bilan. Talab uzilish bo'lgan oy tugaganidan keyin 30 kun ichida yuborilishi kerak.",
    muddat: "15 ish kuni",
  },
  {
    sarlavha: "Xavfsizlik zaifligi",
    tavsif:
      "Zaiflik topsangiz, uni ommaga e'lon qilishdan oldin xabar bering. Xabarda takrorlash qadamlarini yozing. Biz tuzatgunimizcha ma'lumotni oshkor qilmaslikni so'raymiz.",
    muddat: "3 ish kuni ichida birinchi javob",
  },
];

export default function AloqaPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link href="/" className="text-sm text-muted transition hover:text-foreground">
          ← OnDexMap
        </Link>

        <h1 className="mt-6 text-[30px] font-bold leading-tight tracking-tight sm:text-[34px]">
          Aloqa
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Barcha murojaatlar bitta manzilga boradi — mavzuda qaysi masala
          ekanini yozsangiz tezroq yo&apos;naltiriladi.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <a
            href={`mailto:${OPERATOR.email}`}
            className="rounded-xl border border-border bg-card p-4 transition hover:border-brand"
          >
            <p className="text-[13px] text-muted">Elektron pochta</p>
            <p className="mt-1 text-[17px] font-semibold">{OPERATOR.email}</p>
          </a>

          {OPERATOR.telegram ? (
            <a
              href={`https://t.me/${OPERATOR.telegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener"
              className="rounded-xl border border-border bg-card p-4 transition hover:border-brand"
            >
              <p className="text-[13px] text-muted">Telegram</p>
              <p className="mt-1 text-[17px] font-semibold">{OPERATOR.telegram}</p>
            </a>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[13px] text-muted">Telegram</p>
              <p className="mt-1">{req("")}</p>
            </div>
          )}
        </div>

        <h2 className="mt-10 text-[19px] font-bold">Qaysi masala bo&apos;yicha</h2>
        <div className="mt-4 space-y-3">
          {KANALLAR.map((k) => (
            <div key={k.sarlavha} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[15px] font-semibold">{k.sarlavha}</p>
                <p className="text-[12px] text-muted">Javob: {k.muddat}</p>
              </div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{k.tavsif}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-[19px] font-bold">Avval shu yerga qarang</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Ko&apos;p uchraydigan savollarga javob hujjatlarda bor va u yerdan
          tezroq topiladi:
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            { href: "/docs/faq", label: "FAQ — tez-tez so'raladigan savollar" },
            { href: "/docs/api/errors", label: "Xato kodlari va qayta urinish qoidalari" },
            { href: "/docs/security/domains", label: "Domen cheklovi ishlamasa" },
            { href: "/docs/billing/usage", label: "Chegara va statistika" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-[15px] text-brand hover:underline">
                {l.label} →
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-[19px] font-bold">Rekvizitlar</h2>
        <dl className="mt-3 space-y-2 rounded-xl border border-border bg-card p-4 text-[14px]">
          {[
            ["To'liq nomi", req(OPERATOR.legalName)],
            ["STIR", req(OPERATOR.taxId)],
            ["Yuridik manzil", req(OPERATOR.address)],
            ["Bank rekvizitlari", req(OPERATOR.bank)],
          ].map(([k, v], i) => (
            <div key={i} className="flex flex-wrap gap-x-3 gap-y-1">
              <dt className="min-w-[10rem] text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        {operatorIncomplete() && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Rekvizitlar yuridik shaxs ro&apos;yxatdan o&apos;tgach to&apos;ldiriladi.
            Ular bir joyda —{" "}
            <code className="rounded bg-border/60 px-1 text-[12px]">
              src/components/legal/legal-ui.tsx
            </code>{" "}
            faylidagi <code className="rounded bg-border/60 px-1 text-[12px]">OPERATOR</code>{" "}
            obyektida.
          </p>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
