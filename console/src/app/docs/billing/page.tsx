import { A, C, Callout, CardGrid, H2, PageHead, PrevNext, Table } from "@/components/docs/parts";
import { CardIcon, ChartIcon, HelpIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Usage & Billing — OnDexMap",
  description: "Foydalanish statistikasi, tarif rejalari va hisob-fakturalar.",
};

export default function BillingDocsPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Usage & Billing"
        desc="Xaritani ko'rsatish har doim bepul va kalitsiz. Hisob faqat REST API chaqiruvlariga yuritiladi: qaysi so'rov hisoblanadi, chegara qancha va to'lov qanday amalga oshiriladi."
        pills={[
          { href: "/docs/billing/usage", label: "Statistika", icon: <ChartIcon size={15} /> },
          { href: "/docs/billing/plans", label: "Tariflar", icon: <CardIcon size={15} /> },
          { href: "/docs/faq", label: "FAQ", icon: <HelpIcon size={15} /> },
        ]}
      />

      <H2 id="bolimlar">Bo&apos;limlar</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/billing/usage",
            title: "Statistika",
            desc: "Nima hisoblanadi, ko'rsatkichlarni qayerdan ko'rish va chegarani kuzatish.",
            icon: <ChartIcon size={20} />,
          },
          {
            href: "/docs/billing/plans",
            title: "Tariflar",
            desc: "Bepul reja, obuna va OnDex ekotizimi rejasi.",
            icon: <CardIcon size={20} />,
          },
          {
            href: "/docs/billing/invoices",
            title: "Hisob-fakturalar",
            desc: "Hisob-faktura chiqishi, to'lov va holatlar.",
            icon: <CardIcon size={20} />,
          },
        ]}
      />

      <H2 id="qisqacha">Qisqacha</H2>
      <Table
        head={["Savol", "Javob"]}
        rows={[
          ["Xarita ko'rsatish pullikmi?", "Yo'q. Tile'lar, uslub va shriftlar kalitsiz va bepul"],
          [
            "Nima hisoblanadi?",
            <>
              Faqat muvaffaqiyatli <C>/v2/…</C> so&apos;rovlari
            </>,
          ],
          ["Bepul chegara qancha?", "10 so'rov/sekund, oyiga 200 000 so'rov"],
          ["Obuna qancha turadi?", "Oyiga qat'iy 50 000 so'm, so'rov soniga bog'liq emas"],
          ["Chegara tugasa nima bo'ladi?", <><C>429 quota_exceeded</C>; xarita ishlashda davom etadi</>],
        ]}
      />
      <Callout kind="note">
        <p>
          Joriy holat, qolgan chegara va kunlik grafik <A href="/usage">Foydalanish</A> bo&apos;limida;
          hisob-fakturalar <A href="/billing">Hisob-faktura</A> bo&apos;limida ko&apos;rinadi.
        </p>
      </Callout>

      <PrevNext current="/docs/billing" />
    </div>
  );
}
