import Link from "next/link";
import {
  Clause,
  LegalPage,
  LegalTable,
  Note,
  OPERATOR,
  Section,
  UL,
  req,
} from "@/components/legal/legal-ui";

export const metadata = {
  title: "Ommaviy oferta — OnDexMap",
  description:
    "OnDexMap Platform xizmatidan foydalanish bo'yicha ommaviy oferta shartnomasi.",
};

const TOC = [
  { n: "1", title: "Atamalar" },
  { n: "2", title: "Oferta predmeti" },
  { n: "3", title: "Ofertani qabul qilish" },
  { n: "4", title: "Hisob va API kalitlar" },
  { n: "5", title: "Tariflar va to'lov" },
  { n: "6", title: "Xizmat ko'rsatish sifati" },
  { n: "7", title: "Foydalanuvchining majburiyatlari" },
  { n: "8", title: "Operatorning huquqlari" },
  { n: "9", title: "Intellektual mulk va litsenziya" },
  { n: "10", title: "Javobgarlik" },
  { n: "11", title: "Xizmatni to'xtatish va bekor qilish" },
  { n: "12", title: "Shaxsga doir ma'lumotlar" },
  { n: "13", title: "Fors-major" },
  { n: "14", title: "Nizolarni hal qilish" },
  { n: "15", title: "Shartlarni o'zgartirish" },
  { n: "16", title: "Operator rekvizitlari" },
];

export default function OfertaPage() {
  return (
    <LegalPage
      title="Ommaviy oferta"
      subtitle="OnDexMap Platform (xarita tayli, uslub, shriftlar va REST API) xizmatidan foydalanish bo'yicha shartnoma taklifi."
      toc={TOC}
    >
      <p className="text-[15px] leading-relaxed">
        Ushbu hujjat O&apos;zbekiston Respublikasi Fuqarolik kodeksining 369-moddasiga
        muvofiq <strong>ommaviy oferta</strong> — ya&apos;ni noma&apos;lum shaxslar
        doirasiga qaratilgan shartnoma tuzish taklifi hisoblanadi. Ofertani qabul
        qilgan shaxs bilan Operator o&apos;rtasida shartnoma tuzilgan deb hisoblanadi.
      </p>

      <Note kind="warn">
        Xizmatdan foydalanishni boshlashdan oldin ushbu ofertani, shuningdek uning
        ajralmas qismi bo&apos;lgan{" "}
        <Link href="/shartlar" className="font-semibold text-brand hover:underline">
          Foydalanish shartlari
        </Link>
        ,{" "}
        <Link href="/sla" className="font-semibold text-brand hover:underline">
          Xizmat darajasi kelishuvi
        </Link>{" "}
        va{" "}
        <Link href="/maxfiylik" className="font-semibold text-brand hover:underline">
          Maxfiylik siyosati
        </Link>{" "}
        hujjatlarini o&apos;qib chiqing.
      </Note>

      <Section n="1" title="Atamalar">
        <Clause n="1.1">
          <strong>Operator</strong> — {req(OPERATOR.legalName)}, xizmatni taqdim
          etuvchi shaxs.
        </Clause>
        <Clause n="1.2">
          <strong>Foydalanuvchi</strong> — ofertani qabul qilgan jismoniy yoki
          yuridik shaxs.
        </Clause>
        <Clause n="1.3">
          <strong>Xizmat</strong> — <code>{OPERATOR.api}</code> manzilida taqdim
          etiladigan xarita tayllari, uslub fayli, shriftlar va REST API
          (geokodlash, teskari geokodlash, marshrut, ob&apos;ektlar, mahalla
          chegaralari) majmuasi.
        </Clause>
        <Clause n="1.4">
          <strong>Konsol</strong> — <code>{OPERATOR.site}</code> manzilidagi
          boshqaruv paneli: hisob, API kalitlar, statistika va hisob-fakturalar.
        </Clause>
        <Clause n="1.5">
          <strong>API kalit</strong> — Foydalanuvchining so&apos;rovlarini
          aniqlaydigan maxfiy qator. Brauzer kaliti (<code>omk_b_</code>) domen
          ro&apos;yxati bilan, server kaliti (<code>omk_s_</code>) IP ro&apos;yxati
          bilan cheklanadi.
        </Clause>
        <Clause n="1.6">
          <strong>Hisobot davri</strong> — kalendar oy.
        </Clause>
        <Clause n="1.7">
          <strong>So&apos;rov</strong> — REST API&apos;ga yuborilgan va muvaffaqiyatli
          bajarilgan HTTP so&apos;rov. Xarita tayllari, uslub va shriftlar
          so&apos;rovlari hisobga olinmaydi.
        </Clause>
      </Section>

      <Section n="2" title="Oferta predmeti">
        <Clause n="2.1">
          Operator Foydalanuvchiga Xizmatdan tanlangan tarif doirasida foydalanish
          huquqini beradi, Foydalanuvchi esa ushbu oferta va uning ajralmas qismlari
          shartlariga rioya qilish majburiyatini oladi.
        </Clause>
        <Clause n="2.2">
          Xarita tayllari, uslub fayli va shriftlar <strong>bepul</strong> va API
          kalitsiz taqdim etiladi. Tarif faqat REST API so&apos;rovlariga taalluqli.
        </Clause>
        <Clause n="2.3">
          Xizmat hududi — O&apos;zbekiston Respublikasi. Hudud tashqarisidagi
          koordinatalar bo&apos;yicha so&apos;rovlar rad etiladi.
        </Clause>
        <Clause n="2.4">
          Ma&apos;lumotlar bazasining haqiqiy to&apos;ldirilganligi{" "}
          <Link href="/docs/api" className="text-brand hover:underline">
            hujjatlarda
          </Link>{" "}
          har bir endpoint uchun alohida ko&apos;rsatiladi. Operator ma&apos;lumot
          hajmi yoki to&apos;liqligi bo&apos;yicha kafolat bermaydi.
        </Clause>
      </Section>

      <Section n="3" title="Ofertani qabul qilish">
        <Clause n="3.1">
          Oferta Konsolda hisob yaratish, ya&apos;ni elektron pochta manziliga
          yuborilgan bir martalik kodni tasdiqlash yo&apos;li bilan qabul qilinadi.
        </Clause>
        <Clause n="3.2">
          Aksept Fuqarolik kodeksining 370-moddasiga muvofiq to&apos;liq va
          shartsiz hisoblanadi. Ofertaning ayrim bandlarini qabul qilmaslik mumkin
          emas.
        </Clause>
        <Clause n="3.3">
          Hisob yaratgan shaxs yuridik shaxs nomidan harakat qilayotgan bo&apos;lsa,
          u tegishli vakolatga ega ekanligini tasdiqlaydi.
        </Clause>
        <Clause n="3.4">
          Shartnoma aksept momentidan kuchga kiradi va muddatsiz amal qiladi.
        </Clause>
      </Section>

      <Section n="4" title="Hisob va API kalitlar">
        <Clause n="4.1">
          Bir hisobda bir vaqtning o&apos;zida <strong>10 tagacha</strong> faol
          kalit bo&apos;lishi mumkin.
        </Clause>
        <Clause n="4.2">
          Kalitning maxfiy qismi yaratish paytida <strong>bir marta</strong>{" "}
          ko&apos;rsatiladi va qayta ko&apos;rsatilmaydi. Uni saqlash
          Foydalanuvchining javobgarligida.
        </Clause>
        <Clause n="4.3">
          Kalit orqali amalga oshirilgan barcha so&apos;rovlar Foydalanuvchi
          tomonidan amalga oshirilgan deb hisoblanadi. Kalit oshkor bo&apos;lganda
          Foydalanuvchi uni Konsolda darhol bekor qilishi shart.
        </Clause>
        <Clause n="4.4">
          Hisobga kirish elektron pochta orqali amalga oshiriladi. Pochta qutisi
          ustidan nazorat yo&apos;qolganda Foydalanuvchi Operatorga{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-brand hover:underline">
            {OPERATOR.email}
          </a>{" "}
          manziliga xabar beradi.
        </Clause>
        <Clause n="4.5">
          Bir shaxsning chegaralarni chetlab o&apos;tish maqsadida bir nechta hisob
          ochishi taqiqlanadi (
          <Link href="/shartlar#5" className="text-brand hover:underline">
            Foydalanish shartlari, 5-bo&apos;lim
          </Link>
          ).
        </Clause>
      </Section>

      <Section n="5" title="Tariflar va to'lov">
        <Clause n="5.1">Amaldagi tariflar:</Clause>
        <LegalTable
          head={["Tarif", "Tezlik", "Oylik chegara", "Narx"]}
          rows={[
            ["Bepul", "10 so'rov/sekund", "200 000 so'rov", "0 so'm"],
            ["Obuna", "100 so'rov/sekund", "chegarasiz", "50 000 so'm/oy"],
            ["OnDex ekotizimi", "500 so'rov/sekund", "chegarasiz", "0 so'm (ichki)"],
          ]}
        />
        <Clause n="5.2">
          Obuna narxi <strong>qat&apos;iy</strong>: so&apos;rovlar soni narxga
          ta&apos;sir qilmaydi. Kutilmagan hisob chiqmaydi.
        </Clause>
        <Clause n="5.3">
          Obuna Konsolning «Hisob-faktura» bo&apos;limida so&apos;raladi. So&apos;rov
          ko&apos;rib chiqilgach reja yoqiladi va oylik chegara olib tashlanadi.
        </Clause>
        <Clause n="5.4">
          Hisob-faktura har oy boshida o&apos;tgan davr uchun chiqariladi. To&apos;lov
          bank o&apos;tkazmasi orqali, to&apos;lov muddati hisob-fakturada
          ko&apos;rsatiladi. O&apos;tkazma izohida hisob-faktura raqami
          ko&apos;rsatilishi kerak.
        </Clause>
        <Clause n="5.5">
          To&apos;lov Operatorning hisobiga tushgan sana to&apos;lov sanasi
          hisoblanadi. Tasdiqlash qo&apos;lda bajariladi.
        </Clause>
        <Clause n="5.6">
          To&apos;lov muddati o&apos;tganidan keyin <strong>7 kalendar kun</strong>{" "}
          ichida to&apos;lov kelmasa, hisob avtomatik ravishda Bepul tarifga
          o&apos;tkaziladi. Xizmat butunlay to&apos;xtatilmaydi — faqat chegaralar
          qaytariladi.
        </Clause>
        <Clause n="5.7">
          To&apos;langan obuna haqi qaytarilmaydi, bundan{" "}
          <Link href="/sla" className="text-brand hover:underline">
            SLA
          </Link>{" "}
          bo&apos;yicha beriladigan chegirmalar mustasno.
        </Clause>
        <Clause n="5.8">
          Barcha summalar O&apos;zbekiston Respublikasi so&apos;mida
          ko&apos;rsatiladi.
        </Clause>
      </Section>

      <Section n="6" title="Xizmat ko'rsatish sifati">
        <Clause n="6.1">
          Obuna tarifi uchun Operator{" "}
          <Link href="/sla" className="text-brand hover:underline">
            Xizmat darajasi kelishuvida
          </Link>{" "}
          belgilangan <strong>99,5%</strong> oylik ishlash ko&apos;rsatkichini
          o&apos;z zimmasiga oladi.
        </Clause>
        <Clause n="6.2">
          Bepul va ekotizim tariflari uchun ishlash ko&apos;rsatkichi bo&apos;yicha
          majburiyat olinmaydi.
        </Clause>
        <Clause n="6.3">
          Rejali texnik ishlar kamida 24 soat oldin Konsolda e&apos;lon qilinadi.
        </Clause>
      </Section>

      <Section n="7" title="Foydalanuvchining majburiyatlari">
        <Clause n="7.1">
          Foydalanuvchi{" "}
          <Link href="/shartlar" className="text-brand hover:underline">
            Foydalanish shartlariga
          </Link>{" "}
          to&apos;liq rioya qiladi. Ular ushbu ofertaning ajralmas qismidir.
        </Clause>
        <Clause n="7.2">
          <strong>Atributni saqlash majburiy.</strong> Xaritada OnDexMap,
          OpenStreetMap va Microsoft kreditlari ko&apos;rinib turishi shart. Bu
          ODbL litsenziyasining talabi va uni bajarmaslik shartnomani buzish
          hisoblanadi.
        </Clause>
        <Clause n="7.3">
          Foydalanuvchi o&apos;z ilovasining oxirgi foydalanuvchilari oldida
          javobgar bo&apos;ladi, jumladan ularning ma&apos;lumotlarini qayta ishlash
          uchun huquqiy asosga ega bo&apos;lish yuzasidan.
        </Clause>
        <Clause n="7.4">
          Rekvizitlar (pochta manzili, yuridik ma&apos;lumotlar) o&apos;zgarganda
          Foydalanuvchi ularni Konsolda yangilaydi.
        </Clause>
      </Section>

      <Section n="8" title="Operatorning huquqlari">
        <Clause n="8.1">
          Operator Xizmatning texnik tuzilishini, endpointlar tarkibini va
          ma&apos;lumotlar hajmini o&apos;zgartirish huquqiga ega. Muvofiqlikni
          buzadigan o&apos;zgarishlar haqida kamida{" "}
          <strong>30 kalendar kun</strong> oldin xabar beriladi.
        </Clause>
        <Clause n="8.2">
          Operator so&apos;rovlar statistikasini yuritadi. Statistika
          hisob-fakturaning asosi hisoblanadi va nizoda dalil bo&apos;lib xizmat
          qiladi.
        </Clause>
        <Clause n="8.3">
          Operator quyidagi hollarda kalitni yoki hisobni to&apos;xtatib turish
          huquqiga ega: shartlar buzilganda, Xizmat barqarorligiga tahdid
          bo&apos;lganda, yoki qonun talabiga ko&apos;ra (11-bo&apos;lim).
        </Clause>
      </Section>

      <Section n="9" title="Intellektual mulk va litsenziya">
        <Clause n="9.1">
          Operator Foydalanuvchiga Xizmatdan foydalanish uchun{" "}
          <strong>oddiy (mutlaq bo&apos;lmagan)</strong>, boshqaga
          o&apos;tkazilmaydigan va qaytarib olinishi mumkin bo&apos;lgan litsenziya
          beradi. Litsenziya faqat shartnoma amal qilgan davrda kuchda
          bo&apos;ladi.
        </Clause>
        <Clause n="9.2">
          Xarita ma&apos;lumotlari uchinchi tomon manbalaridan olingan:
        </Clause>
        <UL>
          <li>
            OpenStreetMap — <strong>ODbL 1.0</strong> litsenziyasi ostida;
          </li>
          <li>
            Microsoft GlobalMLBuildingFootprints (bino konturlari) —{" "}
            <strong>ODbL 1.0</strong>;
          </li>
          <li>
            mahalla chegaralari va OnDexMap ob&apos;ektlari — Operator tomonidan
            yig&apos;ilgan va moderatsiyadan o&apos;tkazilgan.
          </li>
        </UL>
        <Clause n="9.3">
          ODbL litsenziyasi atributni talab qiladi. Manbalar va shartlar to&apos;liq
          ro&apos;yxati{" "}
          <a
            href={`${OPERATOR.api}/copyright`}
            className="text-brand hover:underline"
            target="_blank"
            rel="noopener"
          >
            {OPERATOR.api}/copyright
          </a>{" "}
          sahifasida.
        </Clause>
        <Clause n="9.4">
          Xizmat orqali olingan ma&apos;lumotlarni ommaviy qayta tarqatish,
          ko&apos;chirib olish yoki o&apos;z proksi xizmatini ochish alohida yozma
          kelishuvni talab qiladi.
        </Clause>
        <Clause n="9.5">
          «OnDex», «OnDexMap» nomlari va belgilari Operatorga tegishli.
          Foydalanuvchi ularni faqat atributda va «OnDexMap asosida ishlaydi»
          ma&apos;nosidagi ko&apos;rsatmalarda ishlatishi mumkin.
        </Clause>
      </Section>

      <Section n="10" title="Javobgarlik">
        <Clause n="10.1">
          Xizmat «qanday bo&apos;lsa shunday» (as is) taqdim etiladi.
          Ma&apos;lumotlarning aniqligi, to&apos;liqligi yoki muayyan maqsadga
          yaroqliligi kafolatlanmaydi.
        </Clause>
        <Clause n="10.2">
          <strong>
            Xarita ma&apos;lumotlari hayot va sog&apos;liq xavfsizligiga bevosita
            ta&apos;sir qiladigan tizimlarda (tez yordam dispetcherligi,
            navigatsiya bo&apos;yicha avtonom boshqaruv, favqulodda xizmatlar) yagona
            manba sifatida ishlatilmasligi kerak.
          </strong>
        </Clause>
        <Clause n="10.3">
          Operatorning javobgarligi har qanday holatda ham{" "}
          <strong>
            talab yuzaga kelgan sanadan oldingi 3 (uch) oy ichida Foydalanuvchi
            haqiqatda to&apos;lagan summadan
          </strong>{" "}
          oshmaydi. Bepul tarif uchun javobgarlik summasi nolga teng.
        </Clause>
        <Clause n="10.4">
          Operator bilvosita zarar uchun javobgar emas: boy berilgan foyda,
          shartnomalarning buzilishi, obro&apos;ga yetkazilgan zarar,
          ma&apos;lumotlarning yo&apos;qolishi.
        </Clause>
        <Clause n="10.5">
          Foydalanuvchi shartlarni buzishi natijasida uchinchi shaxslar
          Operatorga talab qo&apos;ysa, Foydalanuvchi Operatorga yetkazilgan zararni
          qoplaydi.
        </Clause>
      </Section>

      <Section n="11" title="Xizmatni to'xtatish va bekor qilish">
        <Clause n="11.1">Buzilishga javob bosqichma-bosqich bo&apos;ladi:</Clause>
        <LegalTable
          head={["Bosqich", "Qachon", "Oqibat"]}
          rows={[
            [
              "Ogohlantirish",
              "Birinchi buzilish aniqlanganda",
              "Pochta orqali xabar; tuzatish uchun 7 kun",
            ],
            [
              "To'xtatib turish",
              "Muddat ichida tuzatilmasa",
              "Kalitlar vaqtincha o'chadi; hisob va ma'lumotlar saqlanadi",
            ],
            [
              "Bekor qilish",
              "Qo'pol yoki takroriy buzilishda",
              "Shartnoma bekor qilinadi, kalitlar butunlay o'chiriladi",
            ],
          ]}
        />
        <Clause n="11.2">
          Ogohlantirishsiz darhol to&apos;xtatish faqat quyidagi hollarda:
          Xizmatga hujum yoki uning barqarorligiga real tahdid; qonunga zid
          foydalanish; vakolatli organning talabi.
        </Clause>
        <Clause n="11.3">
          Foydalanuvchi istalgan vaqtda hisobini o&apos;chirish orqali shartnomani
          bekor qilishi mumkin. To&apos;langan joriy oy uchun haq qaytarilmaydi.
        </Clause>
        <Clause n="11.4">
          Hisob o&apos;chirilganda kalitlar darhol bekor qilinadi. Hisob-faktura va
          to&apos;lov yozuvlari qonunda belgilangan muddat davomida saqlanadi (
          <Link href="/maxfiylik" className="text-brand hover:underline">
            Maxfiylik siyosati
          </Link>
          ).
        </Clause>
      </Section>

      <Section n="12" title="Shaxsga doir ma'lumotlar">
        <Clause n="12.1">
          Ma&apos;lumotlarni qayta ishlash tartibi{" "}
          <Link href="/maxfiylik" className="text-brand hover:underline">
            Maxfiylik siyosatida
          </Link>{" "}
          belgilangan. U ushbu ofertaning ajralmas qismidir.
        </Clause>
        <Clause n="12.2">
          Ofertani qabul qilish bilan Foydalanuvchi o&apos;z ma&apos;lumotlari
          Maxfiylik siyosatida ko&apos;rsatilgan maqsadlarda qayta ishlanishiga
          rozilik bildiradi.
        </Clause>
        <Clause n="12.3">
          Foydalanuvchi o&apos;z ilovasi orqali OnDexMap&apos;ga uchinchi
          shaxslarning ma&apos;lumotlarini yuborganda, bunday yuborish uchun
          huquqiy asosni ta&apos;minlash Foydalanuvchining zimmasida.
        </Clause>
      </Section>

      <Section n="13" title="Fors-major">
        <Clause n="13.1">
          Tomonlar o&apos;zlariga bog&apos;liq bo&apos;lmagan favqulodda holatlar
          (tabiiy ofat, harbiy harakatlar, davlat organlarining qarorlari,
          magistral aloqa kanallarining uzilishi, keng ko&apos;lamli DDoS hujumlar)
          tufayli majburiyatlarni bajarmaganligi uchun javobgar emas.
        </Clause>
        <Clause n="13.2">
          Fors-major 30 kundan ortiq davom etsa, har bir tomon shartnomani bekor
          qilish huquqiga ega.
        </Clause>
      </Section>

      <Section n="14" title="Nizolarni hal qilish">
        <Clause n="14.1">
          Ushbu shartnomaga O&apos;zbekiston Respublikasining moddiy huquqi
          qo&apos;llaniladi.
        </Clause>
        <Clause n="14.2">
          Nizolar avval muzokara yo&apos;li bilan hal qilinadi. Yozma da&apos;vo{" "}
          <strong>15 ish kuni</strong> ichida ko&apos;rib chiqiladi.
        </Clause>
        <Clause n="14.3">
          Kelishuvga erishilmasa, nizo Operatorning joylashgan yeri bo&apos;yicha
          sudda ko&apos;riladi.
        </Clause>
        <Clause n="14.4">
          Shartnomaning ayrim bandi haqiqiy emas deb topilsa, qolgan bandlar
          kuchda qoladi.
        </Clause>
      </Section>

      <Section n="15" title="Shartlarni o'zgartirish">
        <Clause n="15.1">
          Operator oferta shartlarini bir tomonlama o&apos;zgartirishi mumkin. Yangi
          tahrir ushbu sahifada e&apos;lon qilinadi.
        </Clause>
        <Clause n="15.2">
          Obunachilarga tegishli mazmuniy o&apos;zgarishlar (narx, tarif chegaralari,
          javobgarlik) haqida kamida <strong>30 kalendar kun</strong> oldin
          pochta orqali xabar beriladi.
        </Clause>
        <Clause n="15.3">
          O&apos;zgarishlar bilan rozi bo&apos;lmagan Foydalanuvchi ular kuchga
          kirgunga qadar shartnomani bekor qilishi mumkin. O&apos;zgarish kuchga
          kirgandan keyin Xizmatdan foydalanishni davom ettirish rozilik
          hisoblanadi.
        </Clause>
        <Clause n="15.4">
          Narxning oshishi joriy to&apos;langan davrga taalluqli emas.
        </Clause>
      </Section>

      <Section n="16" title="Operator rekvizitlari">
        <Clause n="16.1">To&apos;liq nomi: {req(OPERATOR.legalName)}</Clause>
        <Clause n="16.2">STIR: {req(OPERATOR.taxId)}</Clause>
        <Clause n="16.3">
          Davlat ro&apos;yxatidan o&apos;tganligi: {req(OPERATOR.registration)}
        </Clause>
        <Clause n="16.4">Yuridik manzil: {req(OPERATOR.address)}</Clause>
        <Clause n="16.5">Bank rekvizitlari: {req(OPERATOR.bank)}</Clause>
        <Clause n="16.6">
          Elektron pochta:{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-brand hover:underline">
            {OPERATOR.email}
          </a>
        </Clause>
        <Clause n="16.7">
          Telefon:{" "}
          <a
            href={`tel:${OPERATOR.phone.replace(/\s/g, "")}`}
            className="text-brand hover:underline"
          >
            {OPERATOR.phone}
          </a>
        </Clause>
        <Clause n="16.8">
          Telegram:{" "}
          <a
            href={OPERATOR.telegramUrl}
            target="_blank"
            rel="noopener"
            className="text-brand hover:underline"
          >
            {OPERATOR.telegram}
          </a>
        </Clause>
      </Section>
    </LegalPage>
  );
}
