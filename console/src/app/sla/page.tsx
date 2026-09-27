import Link from "next/link";
import {
  Clause,
  LegalPage,
  LegalTable,
  Note,
  OPERATOR,
  Section,
  UL,
} from "@/components/legal/legal-ui";

export const metadata = {
  title: "Xizmat darajasi kelishuvi (SLA) — OnDexMap",
  description:
    "OnDexMap Platform obuna tarifi uchun 99,5% oylik ishlash majburiyati, chegirmalar va ularni olish tartibi.",
};

const TOC = [
  { n: "1", title: "Qamrov" },
  { n: "2", title: "Atamalar" },
  { n: "3", title: "Majburiyat" },
  { n: "4", title: "Chegirmalar" },
  { n: "5", title: "Hisobga olinmaydigan holatlar" },
  { n: "6", title: "Chegirmani olish tartibi" },
  { n: "7", title: "Rejali ishlar" },
  { n: "8", title: "Yagona huquqiy vosita" },
];

export default function SlaPage() {
  return (
    <LegalPage
      title="Xizmat darajasi kelishuvi (SLA)"
      subtitle="Obuna tarifi uchun Operator qanday ishlash ko'rsatkichini o'z zimmasiga oladi va majburiyat bajarilmasa nima bo'ladi."
      toc={TOC}
    >
      <Note>
        Qisqacha: obuna tarifida oyiga <strong>99,5%</strong> ishlash
        kafolatlanadi — bu oyiga taxminan <strong>3 soat 39 daqiqa</strong>{" "}
        uzilishga yo&apos;l qo&apos;yadi. Ko&apos;rsatkich bajarilmasa, keyingi oy
        hisob-fakturasiga chegirma beriladi.
      </Note>

      <Section n="1" title="Qamrov">
        <Clause n="1.1">
          Ushbu SLA faqat <strong>Obuna</strong> tarifidagi hisoblarga taalluqli
          va{" "}
          <Link href="/oferta" className="text-brand hover:underline">
            ommaviy ofertaning
          </Link>{" "}
          ajralmas qismidir.
        </Clause>
        <Clause n="1.2">
          Bepul va OnDex ekotizimi tariflari uchun ishlash ko&apos;rsatkichi
          bo&apos;yicha majburiyat olinmaydi. Operator ular uchun ham xizmatni
          barqaror ushlab turishga harakat qiladi, lekin chegirma bermaydi.
        </Clause>
        <Clause n="1.3">Qamrab olingan xizmatlar:</Clause>
        <UL>
          <li>
            REST API: <code>/v2/geocode</code>, <code>/v2/reverse</code>,{" "}
            <code>/v2/directions</code>, <code>/v2/places</code>,{" "}
            <code>/v2/places/{"{id}"}</code>, <code>/v2/mahallas</code>;
          </li>
          <li>
            xarita tayllari, uslub fayli va shriftlar (<code>/tiles/*</code>,{" "}
            <code>/fonts/*</code>).
          </li>
        </UL>
        <Clause n="1.4">
          Konsol interfeysi (<code>{OPERATOR.site}</code>) SLA qamroviga
          kirmaydi: uning uzilishi ishlab turgan integratsiyaga ta&apos;sir
          qilmaydi.
        </Clause>
      </Section>

      <Section n="2" title="Atamalar">
        <Clause n="2.1">
          <strong>Uzilish daqiqasi</strong> — bir daqiqa ichida qamrab olingan
          xizmatga yuborilgan to&apos;g&apos;ri so&apos;rovlarning{" "}
          <strong>5% dan ortig&apos;i</strong> <code>5xx</code> xatosi bilan
          tugagan yoki javob umuman kelmagan daqiqa.
        </Clause>
        <Clause n="2.2">
          <code>4xx</code> javoblar (noto&apos;g&apos;ri so&apos;rov, kalit xatosi,{" "}
          <code>429</code> chegara) uzilish hisoblanmaydi — ular xizmatning
          to&apos;g&apos;ri ishlashi natijasidir.
        </Clause>
        <Clause n="2.3">
          <strong>Oylik ishlash foizi</strong> quyidagicha hisoblanadi:
        </Clause>
        <div className="my-3 rounded-lg border border-border bg-card px-4 py-3 font-mono text-[13px] leading-relaxed">
          (oydagi jami daqiqa − uzilish daqiqalari) ÷ oydagi jami daqiqa × 100
        </div>
        <Clause n="2.4">
          Hisob-kitob kalendar oy bo&apos;yicha va har bir hisob uchun alohida
          yuritiladi.
        </Clause>
      </Section>

      <Section n="3" title="Majburiyat">
        <Clause n="3.1">
          Operator har bir kalendar oy uchun oylik ishlash foizi{" "}
          <strong>99,5% dan kam bo&apos;lmasligini</strong> o&apos;z zimmasiga
          oladi.
        </Clause>
        <Clause n="3.2">
          99,5% quyidagi uzilish byudjetini anglatadi:
        </Clause>
        <LegalTable
          head={["Davr", "Ruxsat etilgan uzilish"]}
          rows={[
            ["Sutkasiga", "7 daqiqa 12 soniya"],
            ["Haftasiga", "50 daqiqa 24 soniya"],
            ["30 kunlik oyda", "3 soat 36 daqiqa"],
            ["31 kunlik oyda", "3 soat 43 daqiqa"],
          ]}
        />
      </Section>

      <Section n="4" title="Chegirmalar">
        <Clause n="4.1">
          Ko&apos;rsatkich bajarilmasa, Foydalanuvchi quyidagi chegirmaga haqli
          bo&apos;ladi:
        </Clause>
        <LegalTable
          head={["Oylik ishlash foizi", "Chegirma", "50 000 so'mdan"]}
          rows={[
            ["99,5% dan 99,0% gacha", "10%", "5 000 so'm"],
            ["99,0% dan 95,0% gacha", "25%", "12 500 so'm"],
            ["95,0% dan past", "50%", "25 000 so'm"],
          ]}
        />
        <Clause n="4.2">
          Chegirma <strong>keyingi oy hisob-fakturasiga</strong> qo&apos;llaniladi.
          Naqd pul yoki boshqa shaklda to&apos;lanmaydi.
        </Clause>
        <Clause n="4.3">
          Bir oy uchun jami chegirma o&apos;sha oylik to&apos;lovning{" "}
          <strong>100% idan oshmaydi</strong>.
        </Clause>
        <Clause n="4.4">
          Chegirma faqat haqiqatda to&apos;langan oylar uchun beriladi. Sinov yoki
          to&apos;lanmagan davr uchun berilmaydi.
        </Clause>
        <Clause n="4.5">
          Uzilish <strong>72 soatdan</strong> uzluksiz davom etsa, Foydalanuvchi
          shartnomani darhol bekor qilish va to&apos;langan joriy oyning
          ishlatilmagan qismini qaytarib olish huquqiga ega.
        </Clause>
      </Section>

      <Section n="5" title="Hisobga olinmaydigan holatlar">
        <Clause n="5.1">
          Quyidagilar uzilish daqiqasi sifatida hisobga olinmaydi:
        </Clause>
        <UL>
          <li>
            7-bo&apos;limga muvofiq oldindan e&apos;lon qilingan rejali ishlar;
          </li>
          <li>
            Foydalanuvchi tomonidagi sabablar: noto&apos;g&apos;ri so&apos;rov,
            muddati o&apos;tgan yoki bekor qilingan kalit, domen ro&apos;yxatiga
            mos kelmaydigan manba;
          </li>
          <li>
            <Link href="/shartlar" className="text-brand hover:underline">
              Foydalanish shartlarining
            </Link>{" "}
            buzilishi natijasida qo&apos;llanilgan to&apos;xtatish;
          </li>
          <li>chegaradan oshish natijasidagi 429 javoblar;</li>
          <li>
            Foydalanuvchi va Operator o&apos;rtasidagi tarmoq muammolari (uning
            provayderi, DNS, mahalliy tarmoq);
          </li>
          <li>
            <Link href="/oferta#13" className="text-brand hover:underline">
              fors-major
            </Link>{" "}
            holatlari, jumladan keng ko&apos;lamli DDoS hujumlar;
          </li>
          <li>
            «beta» yoki «tajriba» deb belgilangan yangi imkoniyatlar;
          </li>
          <li>
            vakolatli davlat organining talabi bilan to&apos;xtatish.
          </li>
        </UL>
      </Section>

      <Section n="6" title="Chegirmani olish tartibi">
        <Clause n="6.1">
          Chegirma avtomatik berilmaydi — Foydalanuvchi talab yuborishi kerak.
        </Clause>
        <Clause n="6.2">
          Talab uzilish sodir bo&apos;lgan oy tugaganidan keyin{" "}
          <strong>30 kalendar kun</strong> ichida{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-brand hover:underline">
            {OPERATOR.email}
          </a>{" "}
          manziliga yuboriladi. Muddat o&apos;tsa chegirma berilmaydi.
        </Clause>
        <Clause n="6.3">Talabda ko&apos;rsatiladi:</Clause>
        <UL>
          <li>hisobning pochta manzili;</li>
          <li>uzilish sanalari va vaqti (vaqt mintaqasi bilan);</li>
          <li>
            dalil: so&apos;rov jurnallari, <code>5xx</code> javoblar namunasi yoki
            kuzatuv tizimingizning hisoboti.
          </li>
        </UL>
        <Clause n="6.4">
          Operator talabni <strong>15 ish kuni</strong> ichida ko&apos;rib chiqadi
          va o&apos;z jurnallari bilan solishtiradi.
        </Clause>
        <Clause n="6.5">
          Nizoda Operatorning server tomonidagi o&apos;lchovlari asosiy dalil
          hisoblanadi, biroq Foydalanuvchining mustaqil kuzatuv
          ma&apos;lumotlari ham inobatga olinadi.
        </Clause>
      </Section>

      <Section n="7" title="Rejali ishlar">
        <Clause n="7.1">
          Rejali texnik ishlar kamida <strong>24 soat</strong> oldin Konsolda va
          obunachilarning pochtasiga e&apos;lon qilinadi.
        </Clause>
        <Clause n="7.2">
          Rejali ishlar oyiga jami <strong>4 soatdan</strong> oshmasligi kerak.
          Oshgan qismi uzilish sifatida hisobga olinadi.
        </Clause>
        <Clause n="7.3">
          Xavfsizlik zaifligini bartaraf etish uchun shoshilinch ishlar
          oldindan xabarsiz bajarilishi mumkin, lekin ular ham 7.2-banddagi
          byudjetga kiradi.
        </Clause>
      </Section>

      <Section n="8" title="Yagona huquqiy vosita">
        <Clause n="8.1">
          Ushbu bo&apos;limda belgilangan chegirmalar — ishlash ko&apos;rsatkichi
          bajarilmaganligi uchun Foydalanuvchining{" "}
          <strong>yagona va to&apos;liq</strong> huquqiy vositasidir.
        </Clause>
        <Clause n="8.2">
          Operatorning umumiy javobgarligi{" "}
          <Link href="/oferta#10" className="text-brand hover:underline">
            ofertaning 10-bo&apos;limi
          </Link>{" "}
          bilan cheklanadi.
        </Clause>
        <Clause n="8.3">
          SLA shartlari o&apos;zgarganda obunachilarga kamida 30 kun oldin xabar
          beriladi (
          <Link href="/oferta#15" className="text-brand hover:underline">
            oferta, 15-bo&apos;lim
          </Link>
          ).
        </Clause>
      </Section>
    </LegalPage>
  );
}
