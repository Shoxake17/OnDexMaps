import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { Code } from "@/components/docs/parts";
import { EmailOff, OPERATOR } from "@/components/legal/legal-ui";

export const metadata = {
  title: "OnDexMap — O'zbekiston uchun xarita platformasi",
  description:
    "Xarita tayli, geokodlash, teskari geokodlash, marshrut va joylar. Xaritani ko'rsatish bepul va kalitsiz; REST API kalit bilan.",
};

/**
 * Bosh sahifa.
 *
 * ┌─ NEGA KERAK ───────────────────────────────────────────────────────┐
 * Ilgari `/` to'g'ridan-to'g'ri `/docs` ga yo'naltirardi. Baholayotgan
 * dasturchi yoki asoschi mahsulot sahifasini emas, ma'lumotnomani
 * ko'rardi: nima berilishi, nima YO'Qligi va narx bir joyda
 * turmasdi.
 *
 * Sahifaning asosiy talabi — ROSTGO'YLIK. «Qamrov» jadvali har bir
 * endpoint uchun ma'lumot haqiqatda qancha ekanini aytadi, chunki
 * to'lagandan keyin bo'sh javob olish eng yomon tajriba.
 * └────────────────────────────────────────────────────────────────────┘
 */

const NAMUNA = `<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js"></script>

<script>
  maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);

  const map = new maplibregl.Map({
    container: "map",
    style: "https://maps.ondex.uz/tiles/style.json",   // kalit KERAK EMAS
    center: [69.2401, 41.2995],
    zoom: 12,
    attributionControl: false,
  });

  map.addControl(
    new maplibregl.AttributionControl({ compact: false }),
    "bottom-right",
  );
</script>`;

const IMKONIYATLAR = [
  {
    nom: "Xarita tayllari",
    tavsif:
      "Vektor tayl, uslub fayli va shriftlar. Kalitsiz, chegarasiz va bepul — hisoblashga ham kirmaydi.",
    havola: "/docs/js/quickstart",
  },
  {
    nom: "Geokodlash",
    tavsif:
      "Nom bo'yicha qidirish — butun O'zbekiston bo'yicha 339 000 dan ortiq nom. Koordinatadan manzil aniqlash hozircha faqat Namangan viloyati atrofida.",
    havola: "/docs/api/geocode",
  },
  {
    nom: "Marshrut",
    tavsif:
      "A nuqtadan B nuqtaga haqiqiy yo'l chizig'i, masofa va taxminiy vaqt. Tirbandlik hisobga olinmaydi.",
    havola: "/docs/api/directions",
  },
  {
    nom: "Ob'ektlar",
    tavsif:
      "Moderatsiyadan o'tgan ob'ektlar GeoJSON ko'rinishida — to'rtburchak bo'yicha so'raladi.",
    havola: "/docs/api/places",
  },
];

/** Har bir manba uchun ma'lumot HAQIQATDA qancha — ro'yxat 2026-09-27 da o'lchangan. */
const QAMROV = [
  {
    nima: "Xarita tayllari, uslub, shriftlar",
    qamrov: "Butun O'zbekiston",
    holat: "toliq" as const,
  },
  {
    nima: "Geokodlash (nom bo'yicha qidirish)",
    qamrov: "Butun O'zbekiston — 339 000 dan ortiq nom",
    holat: "toliq" as const,
  },
  {
    nima: "Teskari geokodlash (koordinatadan manzil)",
    qamrov: "Faqat 40.5–41.6° sh., 70.5–72.0° sh. — Namangan viloyati atrofi",
    holat: "qisman" as const,
  },
  {
    nima: "Marshrut",
    qamrov: "Butun O'zbekiston — haqiqiy yo'l tarmog'i",
    holat: "toliq" as const,
  },
  {
    nima: "Bino konturlari",
    qamrov: "Butun O'zbekiston",
    holat: "toliq" as const,
  },
  {
    nima: "OnDexMap ob'ektlari (/v2/places)",
    qamrov: "Hozircha deyarli bo'sh — 1 ta yozuv",
    holat: "bosh" as const,
  },
];

const RANG = {
  toliq: "bg-emerald-100 text-emerald-900",
  qisman: "bg-amber-100 text-amber-900",
  bosh: "bg-rose-100 text-rose-900",
};

const YORLIQ = { toliq: "to'liq", qisman: "qisman", bosh: "bo'sh" };

const TARIFLAR = [
  {
    nom: "Bepul",
    narx: "0 so'm",
    izoh: "Ro'yxatdan o'tgan har bir hisob",
    bandlar: ["10 so'rov/sekund", "Oyiga 200 000 so'rov", "10 tagacha kalit", "SLA majburiyati yo'q"],
    asosiy: false,
  },
  {
    nom: "Obuna",
    narx: "50 000 so'm/oy",
    izoh: "So'rov soniga bog'liq emas",
    bandlar: ["100 so'rov/sekund", "Oylik chegara yo'q", "10 tagacha kalit", "99,5% SLA + chegirma"],
    asosiy: true,
  },
  {
    nom: "OnDex ekotizimi",
    narx: "0 so'm",
    izoh: "OnDex mahsulotlari uchun ichki",
    bandlar: ["500 so'rov/sekund", "Oylik chegara yo'q", "10 tagacha kalit", "SLA majburiyati yo'q"],
    asosiy: false,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* ── Sarlavha ────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">
            Xarita platformasi
          </p>
          <h1 className="mt-3 max-w-[20ch] text-[38px] font-bold leading-[1.1] tracking-tight sm:text-[52px]">
            O&apos;zbekiston xaritasi — o&apos;z ilovangizda
          </h1>
          <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-muted">
            Vektor xarita, geokodlash, marshrut va mahalla chegaralari. Xaritani
            ko&apos;rsatish <strong className="text-foreground">bepul va kalitsiz</strong> —
            kalit faqat REST API uchun kerak.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/docs/js/quickstart"
              className="rounded-lg bg-brand px-5 py-2.5 text-[15px] font-semibold text-white transition hover:brightness-110"
            >
              5 daqiqada boshlash
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border px-5 py-2.5 text-[15px] font-semibold transition hover:border-brand"
            >
              API kalit olish
            </Link>
            <Link
              href="/docs/api"
              className="rounded-lg px-5 py-2.5 text-[15px] font-semibold text-muted transition hover:text-foreground"
            >
              REST API →
            </Link>
          </div>

          <p className="mt-5 text-[13px] text-muted">
            Karta talab qilinmaydi · Ro&apos;yxatdan o&apos;tish — faqat elektron
            pochta
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        {/* ── Imkoniyatlar ──────────────────────────────────────────── */}
        <section className="py-14">
          <h2 className="text-[26px] font-bold tracking-tight">Nima bor</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {IMKONIYATLAR.map((i) => (
              <Link
                key={i.nom}
                href={i.havola}
                className="rounded-xl border border-border bg-card p-5 transition hover:border-brand"
              >
                <p className="text-[16px] font-semibold">{i.nom}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{i.tavsif}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Qamrov — ROSTGO'YLIK bo'limi ──────────────────────────── */}
        <section className="py-4">
          <h2 className="text-[26px] font-bold tracking-tight">
            Ma&apos;lumot qamrovi
          </h2>
          <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-muted">
            Har bir manbada ma&apos;lumot haqiqatda qancha ekani. Buni oldindan
            bilganingiz ma&apos;qul — integratsiyadan keyin bo&apos;sh javob
            olishdan ko&apos;ra.
          </p>

          <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[34rem] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold">Manba</th>
                  <th className="px-4 py-3 font-semibold">Qamrov</th>
                  <th className="px-4 py-3 font-semibold">Holat</th>
                </tr>
              </thead>
              <tbody>
                {QAMROV.map((q) => (
                  <tr key={q.nima} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">{q.nima}</td>
                    <td className="px-4 py-3 text-muted">{q.qamrov}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[12px] font-medium ${RANG[q.holat]}`}
                      >
                        {YORLIQ[q.holat]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Ob&apos;ektlar jadvali moderatsiya orqali to&apos;ldiriladi va
            hozircha bo&apos;sh. Xaritadagi do&apos;kon, maktab va dorixona
            yozuvlari esa tayllardan keladi — ular butun mamlakat bo&apos;ylab
            ko&apos;rinadi va <code>/v2/places</code> ga bog&apos;liq emas.
          </p>
        </section>

        {/* ── Kod namunasi ──────────────────────────────────────────── */}
        <section className="py-14">
          <h2 className="text-[26px] font-bold tracking-tight">
            Ishlaydigan namuna
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Xaritani chiqarish uchun shuning o&apos;zi yetarli. Kalit ham, hisob
            ham kerak emas.
          </p>
          <Code lang="html">{NAMUNA}</Code>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            <code>compact: false</code> — atribut tor ekranda ham
            ko&apos;rinib turishi uchun. Batafsil:{" "}
            <Link href="/docs/js/general#atribut" className="text-brand hover:underline">
              Atribut — majburiy
            </Link>
            .
          </p>
        </section>

        {/* ── Tariflar ──────────────────────────────────────────────── */}
        <section className="py-4">
          <h2 className="text-[26px] font-bold tracking-tight">Tariflar</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Tarif faqat REST API so&apos;rovlariga. Xaritani ko&apos;rsatish har
            doim bepul.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {TARIFLAR.map((t) => (
              <div
                key={t.nom}
                className={`rounded-xl border bg-card p-5 ${
                  t.asosiy ? "border-brand shadow-sm" : "border-border"
                }`}
              >
                <p className="text-[15px] font-semibold">{t.nom}</p>
                <p className="mt-2 text-[24px] font-bold tracking-tight">{t.narx}</p>
                <p className="mt-0.5 text-[13px] text-muted">{t.izoh}</p>
                <ul className="mt-4 space-y-1.5">
                  {t.bandlar.map((b) => (
                    <li key={b} className="text-[13px] text-muted">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Obuna narxi qat&apos;iy: so&apos;rovlar soni narxga ta&apos;sir
            qilmaydi. To&apos;lov bank o&apos;tkazmasi orqali.{" "}
            <Link href="/docs/billing/plans" className="text-brand hover:underline">
              Batafsil
            </Link>{" "}
            ·{" "}
            <Link href="/sla" className="text-brand hover:underline">
              SLA shartlari
            </Link>
          </p>
        </section>

        {/* ── Ishonch ───────────────────────────────────────────────── */}
        <section className="py-14">
          <h2 className="text-[26px] font-bold tracking-tight">
            Ishlashga qo&apos;yish oldidan
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                nom: "Kalit cheklovi",
                matn:
                  "Brauzer kaliti domen ro'yxati bilan, server kaliti IP ro'yxati bilan cheklanadi. Ro'yxatga kirmagan manbadan so'rov 403 oladi.",
                havola: "/docs/security/keys",
              },
              {
                nom: "Litsenziya va atribut",
                matn:
                  "Xaritada OnDexMap krediti ko'rinib turishi shart — buni integratsiya boshidan hisobga oling. Manbalar va litsenziyalar alohida sahifada.",
                havola: "/shartlar#2",
              },
              {
                nom: "Xizmat darajasi",
                matn:
                  "Obuna tarifida 99,5% oylik ishlash majburiyati. Bajarilmasa keyingi oy hisob-fakturasiga chegirma.",
                havola: "/sla",
              },
            ].map((k) => (
              <Link
                key={k.nom}
                href={k.havola}
                className="rounded-xl border border-border bg-card p-5 transition hover:border-brand"
              >
                <p className="text-[15px] font-semibold">{k.nom}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{k.matn}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Yakuniy chaqiruv ──────────────────────────────────────── */}
        <section className="mb-4 rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <h2 className="text-[24px] font-bold tracking-tight">Boshlash</h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            Xaritani hozir qo&apos;yib ko&apos;ring — kalitsiz ishlaydi. REST API
            kerak bo&apos;lganda pochta manzilingiz bilan hisob oching.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/docs/js/quickstart"
              className="rounded-lg bg-brand px-5 py-2.5 text-[15px] font-semibold text-white transition hover:brightness-110"
            >
              Tez boshlash
            </Link>
            <EmailOff>
              <a
                href={`mailto:${OPERATOR.email}`}
                className="rounded-lg border border-border px-5 py-2.5 text-[15px] font-semibold transition hover:border-brand"
              >
                Savol berish
              </a>
            </EmailOff>
          </div>
        </section>
      </div>

      <PublicFooter />
    </div>
  );
}
