import { A, C, Callout, H2, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { CardIcon, ChartIcon, HelpIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Hisob-fakturalar — Usage & Billing — OnDexMap",
  description: "Hisob-faktura qanday chiqadi, to'lov tartibi va holatlar.",
};

export default function InvoicesPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Hisob-fakturalar"
        desc="Obuna yoqilgach har oy hisob-faktura chiqadi. To'lov bank o'tkazmasi orqali amalga oshiriladi va qo'lda tasdiqlanadi."
        pills={[
          { href: "/billing", label: "Hisob-fakturalar", icon: <CardIcon size={15} /> },
          { href: "/docs/billing/plans", label: "Tariflar", icon: <ChartIcon size={15} /> },
          { href: "/docs/faq", label: "FAQ", icon: <HelpIcon size={15} /> },
        ]}
      />

      <H2 id="tsikl">Hisob-faktura tsikli</H2>
      <Table
        head={["Qadam", "Nima bo'ladi"]}
        rows={[
          ["1. So'rov", <>
            <A href="/billing">Hisob-faktura</A> bo&apos;limida obuna so&apos;raladi
          </>],
          ["2. Tasdiqlash", "So'rov ko'rib chiqiladi va reja yoqiladi"],
          ["3. Hisob-faktura", "Har oy boshida o'tgan davr uchun hisob-faktura chiqadi"],
          ["4. To'lov", "Bank o'tkazmasi; ko'rsatma hisob-faktura bo'limida"],
          ["5. Tasdiq", "To'lov kelgach holat «To'langan» ga o'zgaradi"],
        ]}
      />

      <H2 id="holatlar">Holatlar</H2>
      <Table
        head={["Holat", "Ma'nosi"]}
        rows={[
          [
            <span key="1" className="font-medium text-amber-600">
              To&apos;lanmagan
            </span>,
            "Hisob-faktura chiqarilgan, to'lov hali kelmagan",
          ],
          [
            <span key="2" className="font-medium text-emerald-600">
              To&apos;langan
            </span>,
            "To'lov qabul qilingan va tasdiqlangan",
          ],
          [
            <span key="3" className="font-medium text-muted">
              Bekor qilingan
            </span>,
            "Hisob-faktura bekor qilingan — to'lov talab qilinmaydi",
          ],
        ]}
      />
      <P>
        Har bir hisob-fakturada raqami, davri (<C>dan</C> — <C>gacha</C>), summasi va to&apos;lov muddati
        ko&apos;rsatiladi.
      </P>

      <H2 id="tolov">To&apos;lov</H2>
      <UL>
        <li>To&apos;lov bank o&apos;tkazmasi orqali amalga oshiriladi.</li>
        <li>
          To&apos;lov ko&apos;rsatmasi (rekvizitlar va izoh) <A href="/billing">Hisob-faktura</A>{" "}
          bo&apos;limida ko&apos;rinadi.
        </li>
        <li>
          O&apos;tkazma izohida hisob-faktura raqamini ko&apos;rsating — shunda to&apos;lov tezroq
          taqqoslanadi.
        </li>
        <li>Tasdiqlash qo&apos;lda bajariladi, shuning uchun holat darhol o&apos;zgarmasligi mumkin.</li>
      </UL>

      <H2 id="muddat">Muddati o&apos;tgan to&apos;lov</H2>
      <P>
        To&apos;lov muddati o&apos;tib ketsa, boshqaruv panelida ogohlantirish chiqadi. Kalitlar darhol
        bloklanmaydi — xizmat ishlashda davom etadi, lekin qarz uzoq vaqt to&apos;lanmasa hisob bepul
        reja chegarasiga qaytariladi.
      </P>
      <Callout kind="note">
        <p>
          Bepul reja chegarasiga qaytarilganda kalitlar ishlaydi, faqat tezlik va oylik chegara bepul
          reja darajasiga tushadi: 10 so&apos;rov/sekund va oyiga 200 000 so&apos;rov.
        </p>
      </Callout>

      <H2 id="bekor">Obunani to&apos;xtatish</H2>
      <P>
        Obunani to&apos;xtatish uchun <A href="/billing">Hisob-faktura</A> bo&apos;limida murojaat
        qoldiring. To&apos;xtatilgandan keyin hisob bepul rejaga o&apos;tadi; kalitlar va sozlamalar
        saqlanib qoladi.
      </P>

      <PrevNext current="/docs/billing/invoices" />
    </div>
  );
}
