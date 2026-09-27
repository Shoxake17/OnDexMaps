import Link from "next/link";
import { OPERATOR } from "./legal/legal-ui";

/**
 * PublicFooter — barcha ochiq sahifalar uchun pastki qism.
 *
 * ┌─ NEGA KERAK ───────────────────────────────────────────────────────┐
 * 2026-09-27 dagi tekshiruvda hujjatlarning 30 ta sahifasida birorta
 * aloqa manzili yoki huquqiy hujjatga havola topilmadi. Pullik xizmat
 * uchun bu jiddiy kamchilik: hisob-faktura bo'yicha savoli bor mijoz
 * operatorga yeta olmaydi, oferta esa hech qayerdan ko'rinmaydi.
 *
 * Futer YAGONA joy: yangi huquqiy hujjat qo'shilsa shu yerga qo'shiladi
 * va hamma sahifada bir vaqtda paydo bo'ladi.
 * └────────────────────────────────────────────────────────────────────┘
 */

const USTUNLAR: { sarlavha: string; bandlar: { href: string; label: string }[] }[] = [
  {
    sarlavha: "Mahsulot",
    bandlar: [
      { href: "/docs/js/quickstart", label: "Tez boshlash" },
      { href: "/docs/api", label: "REST API" },
      { href: "/docs/integration", label: "Integratsiya" },
      { href: "/docs/billing/plans", label: "Tariflar" },
    ],
  },
  {
    sarlavha: "Hujjatlar",
    bandlar: [
      { href: "/docs", label: "Bosh sahifa" },
      { href: "/docs/api/reference", label: "API Reference" },
      { href: "/docs/security", label: "Xavfsizlik" },
      { href: "/docs/faq", label: "FAQ" },
    ],
  },
  {
    sarlavha: "Huquqiy",
    bandlar: [
      { href: "/oferta", label: "Ommaviy oferta" },
      { href: "/shartlar", label: "Foydalanish shartlari" },
      { href: "/maxfiylik", label: "Maxfiylik siyosati" },
      { href: "/sla", label: "Xizmat darajasi (SLA)" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-[1440px] px-4 py-10 xl:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- kichik statik belgi */}
              <img src="/logo.png" alt="" width={24} height={24} />
              <span className="text-[17px] font-bold tracking-tight">OnDexMap</span>
            </Link>
            <p className="mt-2.5 max-w-[22rem] text-[13px] leading-relaxed text-muted">
              O&apos;zbekiston uchun xarita platformasi: tayl, geokodlash,
              marshrut va mahalla chegaralari.
            </p>
            <Link
              href="/copyright"
              className="mt-3 inline-block text-[13px] text-muted transition hover:text-foreground"
            >
              © OnDexMap — ma&apos;lumot manbalari va litsenziyalar
            </Link>
          </div>

          {USTUNLAR.map((u) => (
            <div key={u.sarlavha}>
              <p className="text-[13px] font-semibold">{u.sarlavha}</p>
              <ul className="mt-2.5 space-y-1.5">
                {u.bandlar.map((b) => (
                  <li key={b.href}>
                    <Link
                      href={b.href}
                      className="text-[13px] text-muted transition hover:text-foreground"
                    >
                      {b.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-[13px] text-muted">
          <Link href="/aloqa" className="font-medium text-foreground transition hover:text-brand">
            Aloqa
          </Link>
          <a href={`mailto:${OPERATOR.email}`} className="transition hover:text-foreground">
            {OPERATOR.email}
          </a>
          {OPERATOR.telegramUrl && (
            <a
              href={OPERATOR.telegramUrl}
              className="transition hover:text-foreground"
              target="_blank"
              rel="noopener"
            >
              Telegram: {OPERATOR.telegram}
            </a>
          )}
          {OPERATOR.phone && (
            <a href={`tel:${OPERATOR.phone.replace(/\s/g, "")}`} className="transition hover:text-foreground">
              {OPERATOR.phone}
            </a>
          )}
          <span className="ml-auto">
            OnDexMap · {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
