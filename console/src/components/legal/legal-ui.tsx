import Link from "next/link";
import type { ReactNode } from "react";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "../PublicFooter";

/**
 * Huquqiy hujjatlar uchun umumiy karkas: ommaviy oferta, foydalanish
 * shartlari, maxfiylik siyosati, SLA.
 *
 * ┌─ NEGA BITTA KOMPONENT ─────────────────────────────────────────────┐
 * To'rtala hujjat bir xil talablarga bo'ysunadi:
 *
 *   * bo'lim va band raqamlari HAVOLA bo'lishi kerak — nizoda
 *     «4.2-bandga muvofiq» deb aniq ko'rsatish mumkin bo'lsin;
 *   * tahrir raqami va kuchga kirish sanasi KO'RINIB tursin — bu
 *     huquqiy hujjatning majburiy elementi;
 *   * rekvizitlar YAGONA manbadan kelsin — aks holda bir hujjatda
 *     STIR yangilanib, ikkinchisida eski qolib ketadi;
 *   * chop etishga yaroqli bo'lsin — nizoli holatda hujjat qog'ozda
 *     so'raladi.
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Hujjatlarning amaldagi tahriri. Har mazmuniy o'zgarishda YANGILANADI. */
export const LEGAL_VERSION = "1.0";

/** Kuchga kirish sanasi. */
export const LEGAL_EFFECTIVE_DATE = "2026-09-27";

/**
 * Operator rekvizitlari — BARCHA huquqiy hujjatlar uchun yagona manba.
 *
 * ┌─ TO'LDIRILISHI SHART ──────────────────────────────────────────────┐
 * `TODO` maydonlar yuridik shaxs ro'yxatdan o'tgach to'ldiriladi.
 * Ularsiz oferta SHARTNOMA hisoblanmaydi: O'zbekiston Respublikasi
 * Fuqarolik kodeksining 369-moddasiga ko'ra oferta taklif qiluvchini
 * ANIQLASH imkonini berishi shart.
 *
 * Bo'sh maydon sahifada sariq belgi bo'lib ko'rinadi va hujjat
 * tepasida ogohlantirish chiqadi — «tayyor» bo'lib ko'rinib, aslida
 * yaroqsiz qolishidan ko'ra shunisi xavfsizroq.
 * └────────────────────────────────────────────────────────────────────┘
 */
/**
 * Rekvizitlar tipi.
 *
 * ⚠️ `as const` ISHLATILMAYDI: u bo'sh maydonga `""` literal tipini beradi
 * va `OPERATOR.telegram && …` shartidan keyin tip `never` ga aylanib,
 * `.replace(...)` kompilyatsiyada yiqiladi. Maydonlar to'ldirilishi
 * kutilgani uchun ular oddiy `string`.
 */
type OperatorInfo = Record<
  | "brand"
  | "service"
  | "legalName"
  | "taxId"
  | "registration"
  | "address"
  | "bank"
  | "pdRegistry"
  | "email"
  | "phone"
  | "telegram"
  | "telegramUrl"
  | "site"
  | "api",
  string
>;

export const OPERATOR: OperatorInfo = {
  brand: "OnDexMap",
  service: "OnDexMap Platform",
  /** To'liq yuridik nom. */
  legalName: "", // TODO: masalan «ONDEX GROUP» MChJ yoki YaTT to'liq F.I.Sh.
  /** STIR (soliq to'lovchining identifikatsiya raqami). */
  taxId: "070977329",
  /** Davlat ro'yxatidan o'tganlik guvohnomasi raqami va sanasi. */
  registration: "", // TODO
  /** Yuridik manzil. */
  address: "", // TODO
  /** Bank rekvizitlari — hisob-faktura uchun to'liq to'plam. */
  bank: "Hamkorbank, hisob raqami: 20218000907519062001, MFO: 00083",
  /**
   * Shaxsga doir ma'lumotlar bazasining davlat reyestridagi raqami
   * (pd.gov.uz). «Shaxsga doir ma'lumotlar to'g'risida»gi qonunning
   * 27-1-moddasiga ko'ra baza ro'yxatdan o'tkazilishi kerak.
   */
  pdRegistry: "", // TODO
  /** Texnik yordam — hujjatlarda e'lon qilinadigan asosiy kanal. */
  email: "support@ondex.uz",
  /** Aloqa telefoni. */
  phone: "+998 90 278 42 07",
  /** Telegram — O'zbekistonda eng tez kanal. */
  telegram: "@shoxrux_developer",
  telegramUrl: "https://t.me/shoxrux_developer",
  site: "https://console.ondex.uz",
  api: "https://maps.ondex.uz",
};

/** Oferta huquqiy kuchga ega bo'lishi uchun yetishmayotgan rekvizitlar. */
export function operatorIncomplete(): boolean {
  return (
    !OPERATOR.legalName ||
    !OPERATOR.taxId ||
    !OPERATOR.registration ||
    !OPERATOR.address ||
    !OPERATOR.bank
  );
}

/**
 * Operatorning elektron pochtasi — Cloudflare uni BUZMAYDIGAN qilib.
 *
 * ┌─ NIMA HAL QILINADI ────────────────────────────────────────────────┐
 * Cloudflare'ning "Email Address Obfuscation" xizmati sahifadagi
 * pochta manzilini `[email protected]` ga almashtiradi va uni
 * o'z skripti bilan tiklaydi. Bu spamdan himoya, lekin narxi bor:
 * JavaScript ishlamasa — brauzerda o'chirilgan bo'lsa, sahifa PDF
 * qilib saqlansa yoki uni bot/arxiv o'qisa — rasmiy aloqa manzili
 * O'QILMAYDIGAN bo'lib qoladi.
 *
 * 2026-09-27 da bu jonli sahifalarda o'lchandi: `/oferta`,
 * `/copyright` va `/aloqa` da manzil `data-cfemail` ga aylantirilgan
 * edi. Oferta — shartnoma; undagi aloqa manzili har qanday holatda
 * o'qilishi kerak.
 *
 * `<!--email_off-->` — Cloudflare'ning O'Z rasmiy istisno belgisi:
 * shu izohlar orasidagi matnga u tegmaydi. React izohni render
 * qilmaydi, shuning uchun u `dangerouslySetInnerHTML` bilan
 * chiqariladi — ichida foydalanuvchi ma'lumoti yo'q, faqat sobit
 * izoh.
 * └────────────────────────────────────────────────────────────────────┘
 */
export function EmailOff({ children }: { children: ReactNode }) {
  return (
    <>
      <span dangerouslySetInnerHTML={{ __html: "<!--email_off-->" }} />
      {children}
      <span dangerouslySetInnerHTML={{ __html: "<!--/email_off-->" }} />
    </>
  );
}

/**
 * Tayyor pochta havolasi.
 *
 * ⚠️ `mailto:` MANZILNING O'ZI ham himoyaga muhtoj: Cloudflare uni
 * `/cdn-cgi/l/email-protection#…` ga almashtiradi, ya'ni JavaScriptsiz
 * havola umuman ochilmaydi — matn ko'rinmasa ham. Shuning uchun
 * `<a>` ning o'zi ham o'rovchi ichida turadi, faqat matni emas.
 */
export function OperatorEmail({ className }: { className?: string }) {
  return (
    <EmailOff>
      <a href={`mailto:${OPERATOR.email}`} className={className}>
        {OPERATOR.email}
      </a>
    </EmailOff>
  );
}

/** Rekvizit qiymati yoki uning to'ldirilmaganini bildiruvchi belgi. */
export function req(value: string): ReactNode {
  if (value) return value;
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[13px] font-medium text-amber-900">
      to&apos;ldirilishi kerak
    </span>
  );
}

const HUJJATLAR = [
  { href: "/oferta", label: "Ommaviy oferta" },
  { href: "/shartlar", label: "Foydalanish shartlari" },
  { href: "/maxfiylik", label: "Maxfiylik siyosati" },
  { href: "/sla", label: "Xizmat darajasi (SLA)" },
];

/**
 * LegalPage — hujjat sahifasi qolipi.
 *
 * `toc` — bo'limlar ro'yxati: uzun hujjatda kerakli bandga sakrash
 * imkonini beradi (nizoda eng ko'p so'raladigan narsa).
 */
export function LegalPage({
  title,
  subtitle,
  toc,
  /**
   * Rekvizitlar ogohlantirishini ko'rsatish.
   *
   * Shartnoma hujjatlari (oferta, shartlar, maxfiylik, SLA) uchun SHART:
   * rekvizitsiz ular huquqiy kuchga ega emas. Mualliflik sahifasi esa
   * axborot sahifasi — u o'zicha to'liq va u yerda «hujjat yakuniy
   * emas» degan yozuv faqat chalg'itadi. Ayni o'sha sahifaga xaritadagi
   * atribut yozuvidan kirishadi, ya'ni ko'pchilik uchun bu birinchi
   * taassurot.
   */
  requisites = true,
  children,
}: {
  title: string;
  subtitle: string;
  toc: { n: string; title: string }[];
  requisites?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/" className="text-sm text-muted transition hover:text-foreground">
        ← OnDexMap
      </Link>

      <h1 className="mt-6 text-[30px] font-bold leading-tight tracking-tight sm:text-[34px]">
        {title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
        <div className="flex gap-2">
          <dt className="text-muted">Tahrir:</dt>
          <dd className="font-medium">{LEGAL_VERSION}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Kuchga kirgan:</dt>
          <dd className="font-medium">{LEGAL_EFFECTIVE_DATE}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Amal qiladi:</dt>
          <dd className="font-medium">{OPERATOR.api}</dd>
        </div>
      </dl>

      {requisites && operatorIncomplete() && (
        <div className="mt-6 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Diqqat: hujjat hali yakuniy emas.</p>
          <p className="mt-1.5 leading-relaxed">
            Operatorning yuridik rekvizitlari (to&apos;liq nom, STIR, ro&apos;yxatdan
            o&apos;tish ma&apos;lumotlari, yuridik manzil, bank) to&apos;ldirilmagan.
            Ularsiz ushbu hujjat shartnoma hisoblanmaydi — Fuqarolik kodeksining
            369-moddasi ofertadan taklif qiluvchini aniqlash imkonini talab qiladi.
            Rekvizitlar{" "}
            <code className="rounded bg-amber-100 px-1 text-[12px]">
              src/components/legal/legal-ui.tsx
            </code>{" "}
            faylidagi <code className="rounded bg-amber-100 px-1 text-[12px]">OPERATOR</code>{" "}
            obyektida belgilanadi.
          </p>
        </div>
      )}

      {toc.length > 0 && (
        <nav className="mt-8 rounded-xl border border-border bg-card p-4">
          <p className="text-[13px] font-semibold text-muted">Bo&apos;limlar</p>
          <ol className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {toc.map((t) => (
              <li key={t.n} className="text-[13px]">
                <a href={`#${t.n}`} className="text-muted transition hover:text-brand">
                  <span className="font-mono text-[12px]">{t.n}.</span> {t.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <article className="mt-6">{children}</article>

      <hr className="my-10 border-border" />

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        {HUJJATLAR.map((h) => (
          <Link key={h.href} href={h.href} className="transition hover:text-foreground">
            {h.label}
          </Link>
        ))}
        <OperatorEmail className="transition hover:text-foreground" />
      </div>
      </main>
      <PublicFooter />
    </div>
  );
}

/** Raqamlangan bo'lim. `id` — anchor, hujjatga murojaat uchun. */
export function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={n} className="scroll-mt-6">
      <h2 className="mt-9 text-[19px] font-bold leading-snug">
        <a href={`#${n}`} className="text-muted transition hover:text-brand">
          {n}.
        </a>{" "}
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

/** Ichki band — `4.2` ko'rinishidagi raqam bilan. */
export function Clause({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p id={n} className="scroll-mt-6">
      <a href={`#${n}`} className="mr-1.5 font-semibold text-muted transition hover:text-brand">
        {n}.
      </a>
      {children}
    </p>
  );
}

/** Band ichidagi sanab o'tish. */
export function UL({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-1.5 text-[15px] leading-relaxed">{children}</ul>;
}

/** Umumiy jadval — sarlavhalar va qatorlar. */
export function LegalTable({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-border text-left align-bottom">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 align-top">
              {r.map((c, j) => (
                <td key={j} className="py-2.5 pr-4 text-muted">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ta'kidlangan qoida — «buzilsa oqibati bor» degan joylar uchun. */
export function Note({ children, kind = "note" }: { children: ReactNode; kind?: "note" | "warn" }) {
  const rang =
    kind === "warn"
      ? "border-amber-400 bg-amber-50 text-amber-900"
      : "border-border bg-card text-foreground";
  return (
    <div className={`my-4 rounded-lg border-l-4 p-3.5 text-[14px] leading-relaxed ${rang}`}>
      {children}
    </div>
  );
}
