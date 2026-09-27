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
  title: "Foydalanish shartlari — OnDexMap",
  description:
    "OnDexMap Platform'dan foydalanishning texnik qoidalari: atribut, keshlash, taqiqlangan foydalanish va chegaralar.",
};

const TOC = [
  { n: "1", title: "Qamrov" },
  { n: "2", title: "Atribut — majburiy" },
  { n: "3", title: "API kalitlar bilan ishlash" },
  { n: "4", title: "Keshlash va saqlash" },
  { n: "5", title: "Taqiqlangan foydalanish" },
  { n: "6", title: "So'rov chegaralari" },
  { n: "7", title: "Uchinchi tomon ma'lumotlari" },
  { n: "8", title: "Buzilish oqibatlari" },
];

export default function ShartlarPage() {
  return (
    <LegalPage
      title="Foydalanish shartlari"
      subtitle="OnDexMap Platform'dan texnik jihatdan qanday foydalanish mumkin va nima taqiqlanadi. Ushbu hujjat ommaviy ofertaning ajralmas qismidir."
      toc={TOC}
    >
      <Section n="1" title="Qamrov">
        <Clause n="1.1">
          Ushbu shartlar <code>{OPERATOR.api}</code> orqali taqdim etiladigan
          barcha narsaga taalluqli: xarita tayllari, uslub fayli (
          <code>style.json</code>), shriftlar va REST API.
        </Clause>
        <Clause n="1.2">
          Shartlar <strong>kalitsiz</strong> foydalanadigan holatlarga ham
          taalluqli. Xaritani ko&apos;rsatish uchun kalit talab qilinmasligi
          atribut majburiyatini bekor qilmaydi.
        </Clause>
        <Clause n="1.3">
          Atamalar{" "}
          <Link href="/oferta#1" className="text-brand hover:underline">
            ofertaning 1-bo&apos;limida
          </Link>{" "}
          belgilangan.
        </Clause>
      </Section>

      <Section n="2" title="Atribut — majburiy">
        <Clause n="2.1">
          Xarita ko&apos;rsatilgan har qanday ekranda quyidagi kreditlar
          ko&apos;rinib turishi shart: <strong>OnDexMap</strong>,{" "}
          <strong>Microsoft</strong> (bino konturlari ko&apos;rsatilganda) va{" "}
          <strong>OpenStreetMap</strong>.
        </Clause>
        <Clause n="2.2">
          Matn uslub faylida yozilgan va kutubxona uni o&apos;zi chiqaradi —
          Foydalanuvchi uni qo&apos;lda yozmaydi.
        </Clause>

        <Clause n="2.3">Quyidagilar taqiqlanadi:</Clause>
        <UL>
          <li>yozuvni butunlay o&apos;chirish;</li>
          <li>
            CSS bilan yashirish, shaffof qilish yoki boshqa element bilan
            berkitish;
          </li>
          <li>o&apos;qib bo&apos;lmaydigan darajada kichraytirish;</li>
          <li>
            <code>attributionControl: false</code> yozib, o&apos;rniga yangisini
            qo&apos;shmaslik;
          </li>
          <li>
            <code>compact: true</code> qoldirish — yorliq foydalanuvchi xaritani
            surishi bilan «i» tugmasi ortiga yig&apos;iladi va kredit
            yo&apos;qoladi;
          </li>
          <li>matn mazmunini o&apos;zgartirish yoki tarjima qilish.</li>
        </UL>

        <Clause n="2.4">Quyidagilar ruxsat etiladi:</Clause>
        <UL>
          <li>yorliqni xaritaning boshqa burchagiga ko&apos;chirish;</li>
          <li>shrift o&apos;lchami va rangini mavzuyingizga moslashtirish;</li>
          <li>o&apos;qilishi uchun halo (<code>text-shadow</code>) qo&apos;shish;</li>
          <li>
            yoniga o&apos;z brendingizni qo&apos;shish (<code>customAttribution</code>).
          </li>
        </UL>

        <Note kind="warn">
          <p className="font-semibold">Tor ekran uchun alohida talab.</p>
          <p className="mt-1.5">
            MapLibre kengligi 640px dan kichik xaritada yorliqni avtomatik
            yig&apos;adi. Shuning uchun{" "}
            <code className="rounded bg-amber-100 px-1">compact: false</code> ni
            ochiq yozish <strong>shart</strong> — usiz telefon foydalanuvchisi
            xaritani birinchi marta surganda OnDexMap krediti ko&apos;rinmay
            qoladi. Namuna —{" "}
            <Link href="/docs/js/general#atribut" className="font-semibold text-brand hover:underline">
              JavaScript API → Atribut
            </Link>
            .
          </p>
        </Note>

        <Clause n="2.5">
          Xarita rasm sifatida (skrinshot, PDF, bosma material) tarqatilganda
          ham atribut saqlanishi kerak.
        </Clause>
        <Clause n="2.6">
          Atribut talabi ODbL litsenziyasidan kelib chiqadi va uni Operator bekor
          qila olmaydi. Manbalar ro&apos;yxati —{" "}
          <a
            href={`${OPERATOR.api}/copyright`}
            className="text-brand hover:underline"
            target="_blank"
            rel="noopener"
          >
            {OPERATOR.api}/copyright
          </a>
          .
        </Clause>
      </Section>

      <Section n="3" title="API kalitlar bilan ishlash">
        <Clause n="3.1">
          Brauzer kaliti (<code>omk_b_</code>) faqat domen ro&apos;yxati bilan
          ishlatiladi. Ro&apos;yxatsiz brauzer kaliti yaratish taqiqlanadi — u
          sahifa kodida ochiq ko&apos;rinadi.
        </Clause>
        <Clause n="3.2">
          Server kaliti (<code>omk_s_</code>) brauzerga yuborilmaydi va mobil
          ilova paketiga joylashtirilmaydi.
        </Clause>
        <Clause n="3.3">
          Kalitni uchinchi shaxslarga berish, sotish yoki ommaviy joylashtirish
          taqiqlanadi.
        </Clause>
        <Clause n="3.4">
          Kalitni boshqa tashkilot nomidan xizmat ko&apos;rsatish uchun ishlatish
          (qayta sotish) alohida yozma kelishuvni talab qiladi.
        </Clause>
      </Section>

      <Section n="4" title="Keshlash va saqlash">
        <Clause n="4.1">
          Tezlikni oshirish va so&apos;rovlar sonini kamaytirish uchun keshlash{" "}
          <strong>ruxsat etiladi</strong>, quyidagi chegaralar bilan:
        </Clause>
        <LegalTable
          head={["Nima", "Qancha saqlash mumkin", "Izoh"]}
          rows={[
            [
              <>
                Ob&apos;ekt identifikatorlari (<code>id</code>)
              </>,
              "muddatsiz",
              "Identifikator o'zgarmaydi — uni o'z bazangizda ishlatishingiz mumkin",
            ],
            [
              "Geokodlash va teskari geokodlash natijalari",
              "30 kungacha",
              "Undan keyin qayta so'ralishi kerak",
            ],
            [
              "Marshrut natijalari",
              "30 kungacha",
              "Yo'l holati o'zgaradi — uzoq saqlash mantiqsiz",
            ],
            [
              "Mahalla chegaralari",
              "muddatsiz",
              "Javob 1 soat keshlanadi; to'plam kamdan-kam o'zgaradi",
            ],
            [
              "Xarita tayllari va shriftlar",
              "HTTP sarlavhalarida ko'rsatilganicha",
              "Brauzer keshi — qo'shimcha cheklov yo'q",
            ],
          ]}
        />
        <Clause n="4.2">
          Keshlangan ma&apos;lumotni o&apos;z mahsulotingiz ichida ishlatish mumkin.
          Uni alohida ma&apos;lumotlar bazasi sifatida tarqatish, sotish yoki
          ochiq API orqali berish taqiqlanadi.
        </Clause>
        <Clause n="4.3">
          Xizmatdan foydalanishni to&apos;xtatganingizda keshlangan nusxa{" "}
          <strong>30 kun</strong> ichida o&apos;chiriladi, identifikatorlar
          bundan mustasno.
        </Clause>
      </Section>

      <Section n="5" title="Taqiqlangan foydalanish">
        <Clause n="5.1">
          <strong>Ma&apos;lumotni ommaviy yig&apos;ish.</strong> Bazani bo&apos;lak-
          bo&apos;lak so&apos;rab to&apos;liq yoki qisman nusxalash, shu maqsadda
          koordinatalarni panjara bo&apos;ylab aylanib chiqish.
        </Clause>
        <Clause n="5.2">
          <strong>Qayta tarqatish.</strong> Xizmat javoblarini o&apos;z API yoki
          proksi xizmatingiz orqali uchinchi shaxslarga berish.
        </Clause>
        <Clause n="5.3">
          <strong>Raqobatdosh mahsulot qurish.</strong> Xizmat ma&apos;lumotlari
          asosida OnDexMap bilan bevosita raqobatlashadigan xarita xizmatini
          yaratish.
        </Clause>
        <Clause n="5.4">
          <strong>Chegaralarni chetlab o&apos;tish.</strong> Bir nechta hisob yoki
          kalit ochib oylik chegarani ko&apos;paytirish; IP yoki domen tekshiruvini
          aldash.
        </Clause>
        <Clause n="5.5">
          <strong>Boshqa xarita ustida ko&apos;rsatish.</strong> OnDexMap
          geokodlash yoki marshrut natijalarini boshqa provayderning xaritasida
          chizish.
        </Clause>
        <Clause n="5.6">
          <strong>Zararli faoliyat.</strong> Xizmatga hujum, teskari
          muhandislik, himoya mexanizmlarini chetlab o&apos;tish, qonunga zid
          maqsadlarda foydalanish.
        </Clause>
        <Clause n="5.7">
          <strong>Kuzatuv.</strong> Jismoniy shaxslarni ularning xabarisiz va
          roziligisiz kuzatish uchun foydalanish.
        </Clause>
        <Clause n="5.8">
          <strong>Atributga foydalanuvchi matnini qo&apos;yish.</strong>{" "}
          <code>customAttribution</code> HTML sifatida kiritiladi — u yerga
          foydalanuvchidan kelgan matnni qo&apos;yish XSS zaifligini ochadi va
          taqiqlanadi.
        </Clause>
      </Section>

      <Section n="6" title="So'rov chegaralari">
        <Clause n="6.1">
          Tezlik chegarasidan oshganda API <code>429 rate_limited</code> va{" "}
          <code>Retry-After</code> sarlavhasini qaytaradi. Uni hurmat qilish
          shart.
        </Clause>
        <Clause n="6.2">
          Oylik chegara tugaganda <code>429 quota_exceeded</code> qaytadi.
          Xarita tayllari ishlashda davom etadi.
        </Clause>
        <Clause n="6.3">
          <code>429</code> javobiga darhol qayta so&apos;rov yuborish (retry
          bo&apos;roni) hujum deb baholanishi mumkin. Kechikish bilan qayta urinish
          namunasi —{" "}
          <Link href="/docs/api/errors" className="text-brand hover:underline">
            Xatolar
          </Link>{" "}
          sahifasida.
        </Clause>
        <Clause n="6.4">
          Xarita harakatlanganda so&apos;rovni kechiktirib yuborish (debounce)
          tavsiya etiladi — bu chegarani tejaydi.
        </Clause>
      </Section>

      <Section n="7" title="Uchinchi tomon ma'lumotlari">
        <Clause n="7.1">
          Xarita ma&apos;lumotlarining katta qismi OpenStreetMap&apos;dan olingan va{" "}
          <strong>ODbL 1.0</strong> litsenziyasi ostida tarqatiladi.
        </Clause>
        <Clause n="7.2">
          Bino konturlari Microsoft GlobalMLBuildingFootprints to&apos;plamidan,
          u ham ODbL ostida.
        </Clause>
        <Clause n="7.3">
          ODbL «hosila baza»ni tarqatishda uni ham ODbL ostida ochishni talab
          qiladi. Xizmatni o&apos;z ilovangizda ishlatish hosila bazani tarqatish
          hisoblanmaydi — talab faqat atribut. Ma&apos;lumotni ommaviy tarqatmoqchi
          bo&apos;lsangiz, avval{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-brand hover:underline">
            {OPERATOR.email}
          </a>{" "}
          manziliga murojaat qiling.
        </Clause>
        <Clause n="7.4">
          Xaritadagi noto&apos;g&apos;ri ma&apos;lumotni{" "}
          <a
            href="https://www.openstreetmap.org/"
            className="text-brand hover:underline"
            target="_blank"
            rel="noopener"
          >
            openstreetmap.org
          </a>{" "}
          da tuzatish mumkin — tuzatish keyingi yangilanishda OnDexMap&apos;ga
          o&apos;tadi.
        </Clause>
      </Section>

      <Section n="8" title="Buzilish oqibatlari">
        <Clause n="8.1">
          Buzilish aniqlanganda javob{" "}
          <Link href="/oferta#11" className="text-brand hover:underline">
            ofertaning 11-bo&apos;limi
          </Link>{" "}
          bo&apos;yicha bosqichma-bosqich bo&apos;ladi: ogohlantirish → to&apos;xtatib
          turish → bekor qilish.
        </Clause>
        <Clause n="8.2">
          Atributni olib tashlash yoki yashirish shartnomani buzish hisoblanadi
          va kalitning bekor qilinishiga olib keladi.
        </Clause>
        <Clause n="8.3">
          Texnik jihatdan brauzerdagi istalgan elementni o&apos;chirish mumkin — bu
          barcha xarita xizmatlarida shunday. Shuning uchun talab shartnoma
          darajasida ishlaydi: kalit sizning hisobingizga bog&apos;langan.
        </Clause>
        <Clause n="8.4">
          Shartlarning buzilishini ko&apos;rsangiz —{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-brand hover:underline">
            {OPERATOR.email}
          </a>
          .
        </Clause>
      </Section>
    </LegalPage>
  );
}
