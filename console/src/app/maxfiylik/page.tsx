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
  title: "Maxfiylik siyosati — OnDexMap",
  description:
    "OnDexMap Platform qanday shaxsga doir ma'lumotlarni qayta ishlaydi, qancha saqlaydi va foydalanuvchining qanday huquqlari bor.",
};

const TOC = [
  { n: "1", title: "Operator" },
  { n: "2", title: "Qanday ma'lumot yig'iladi" },
  { n: "3", title: "Nima YIG'ILMAYDI" },
  { n: "4", title: "Cookie va brauzer xotirasi" },
  { n: "5", title: "Uchinchi tomon xizmatlari" },
  { n: "6", title: "Ma'lumotni chet elda saqlash" },
  { n: "7", title: "Saqlash muddatlari" },
  { n: "8", title: "Xavfsizlik choralari" },
  { n: "9", title: "Sizning huquqlaringiz" },
  { n: "10", title: "Foydalanuvchining o'z mijozlari" },
  { n: "11", title: "O'zgarishlar" },
];

export default function MaxfiylikPage() {
  return (
    <LegalPage
      title="Maxfiylik siyosati"
      subtitle="OnDexMap Platform hisobingiz bilan bog'liq qanday ma'lumotni qayta ishlaydi, nega, qancha muddat va sizda qanday huquq bor."
      toc={TOC}
    >
      <p className="text-[15px] leading-relaxed">
        Ushbu siyosat O&apos;zbekiston Respublikasining{" "}
        <strong>«Shaxsga doir ma&apos;lumotlar to&apos;g&apos;risida»</strong>gi
        Qonuni (O&apos;RQ-547, 02.07.2019) talablari asosida tuzilgan va{" "}
        <Link href="/oferta" className="text-brand hover:underline">
          ommaviy ofertaning
        </Link>{" "}
        ajralmas qismidir.
      </p>

      <Section n="1" title="Operator">
        <Clause n="1.1">
          Ma&apos;lumotlar operatori — {req(OPERATOR.legalName)}, STIR{" "}
          {req(OPERATOR.taxId)}, yuridik manzil: {req(OPERATOR.address)}.
        </Clause>
        <Clause n="1.2">
          Shaxsga doir ma&apos;lumotlar bazasining davlat reyestridagi raqami:{" "}
          {req(OPERATOR.pdRegistry)} (
          <a
            href="https://pd.gov.uz/"
            className="text-brand hover:underline"
            target="_blank"
            rel="noopener"
          >
            pd.gov.uz
          </a>
          ).
        </Clause>
        <Clause n="1.3">
          Ma&apos;lumotlar bo&apos;yicha murojaat:{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-brand hover:underline">
            {OPERATOR.email}
          </a>
          .
        </Clause>
      </Section>

      <Section n="2" title="Qanday ma'lumot yig'iladi">
        <Clause n="2.1">
          Faqat xizmatning ishlashi uchun zarur bo&apos;lgan ma&apos;lumot
          yig&apos;iladi:
        </Clause>
        <LegalTable
          head={["Ma'lumot", "Nima uchun", "Huquqiy asos", "Saqlanish muddati"]}
          rows={[
            [
              "Elektron pochta manzili",
              "Hisobni aniqlash, kirish kodini yuborish, hisob-faktura va muhim xabarlar",
              "Shartnomani bajarish",
              "Hisob mavjud bo'lganicha",
            ],
            [
              "Ism (ixtiyoriy)",
              "Hisob-fakturada va murojaatda murojaat qilish uchun",
              "Rozilik",
              "Hisob mavjud bo'lganicha",
            ],
            [
              <>
                Kirish kodining <strong>xeshi</strong>
              </>,
              "Bir martalik kodni tekshirish",
              "Shartnomani bajarish",
              "Muddati tugagach 1 kun",
            ],
            [
              <>
                Sessiya tokenining <strong>xeshi</strong>
              </>,
              "Kirgan holatni saqlash",
              "Shartnomani bajarish",
              "30 kun; 7 kun faolsizlikda o'chadi",
            ],
            [
              <>
                IP manzilning <strong>xeshi</strong>
              </>,
              "Sessiya xavfsizligi, tezlik chegarasi, suiiste'molni aniqlash",
              "Qonuniy manfaat",
              "Sessiya bilan birga",
            ],
            [
              "Brauzer qatori (User-Agent)",
              "Sessiyalar ro'yxatida qurilmani ajratish",
              "Qonuniy manfaat",
              "Sessiya bilan birga",
            ],
            [
              "API kalit metama'lumoti (nom, tur, domen/IP ro'yxati)",
              "Kalitni boshqarish va cheklovni qo'llash",
              "Shartnomani bajarish",
              "Kalit bekor qilinguncha",
            ],
            [
              "Kunlik so'rovlar soni",
              "Chegarani hisoblash va hisob-faktura",
              "Shartnomani bajarish",
              "Hisob-kitob uchun zarur muddat",
            ],
            [
              "Hisob-faktura va to'lov yozuvlari",
              "Buxgalteriya va soliq hisobi",
              "Qonun talabi",
              "Qonunda belgilangan muddat",
            ],
            [
              "Audit jurnali (kalit yaratildi/bekor qilindi va h.k.)",
              "Xavfsizlik hodisalarini tekshirish",
              "Qonuniy manfaat",
              "Xavfsizlik uchun zarur muddat",
            ],
          ]}
        />
        <Clause n="2.2">
          <strong>IP manzil ochiq saqlanmaydi.</strong> U bir tomonlama
          kriptografik xeshga aylantiriladi — asl qiymatni tiklab bo&apos;lmaydi.
          Xesh faqat «shu sessiya o&apos;sha tarmoqdanmi» degan savolga javob berish
          uchun ishlatiladi.
        </Clause>
        <Clause n="2.3">
          Parol yo&apos;q — tizim faqat bir martalik kod bilan ishlaydi. Demak
          o&apos;g&apos;irlanadigan parol ham yo&apos;q.
        </Clause>
      </Section>

      <Section n="3" title="Nima YIG'ILMAYDI">
        <Clause n="3.1">Quyidagilar yig&apos;ilmaydi va so&apos;ralmaydi:</Clause>
        <UL>
          <li>pasport yoki boshqa hujjat ma&apos;lumotlari;</li>
          <li>to&apos;lov kartasi raqamlari — to&apos;lov bank o&apos;tkazmasi orqali;</li>
          <li>biometrik va genetik ma&apos;lumotlar;</li>
          <li>joylashuv (geolokatsiya) ma&apos;lumotlari;</li>
          <li>
            sizning ilovangiz oxirgi foydalanuvchilarining shaxsi haqidagi
            ma&apos;lumot.
          </li>
        </UL>
        <Clause n="3.2">
          <strong>Reklama va kuzatuv skriptlari ishlatilmaydi.</strong> Konsolda
          uchinchi tomon analitikasi, piksel yoki reklama tarmog&apos;i yo&apos;q.
        </Clause>
        <Clause n="3.3">
          Geokodlash va marshrut so&apos;rovlarining mazmuni (qidirilgan matn,
          koordinatalar) ma&apos;lumotlar bazasida hisobga bog&apos;lab
          saqlanmaydi — faqat so&apos;rovlarning umumiy soni hisoblanadi.
        </Clause>
      </Section>

      <Section n="4" title="Cookie va brauzer xotirasi">
        <Clause n="4.1">
          Konsol bitta zarur cookie ishlatadi — sessiya tokeni. U{" "}
          <code>HttpOnly</code>, <code>Secure</code> va <code>SameSite</code>{" "}
          bayroqlari bilan o&apos;rnatiladi, ya&apos;ni JavaScript uni o&apos;qiy
          olmaydi.
        </Clause>
        <Clause n="4.2">
          CSRF himoyasi uchun qo&apos;shimcha token ishlatiladi.
        </Clause>
        <Clause n="4.3">
          Analitika, reklama yoki kuzatuv cookie&apos;lari{" "}
          <strong>yo&apos;q</strong>. Shuning uchun cookie bo&apos;yicha rozilik
          oynasi ham ko&apos;rsatilmaydi.
        </Clause>
        <Clause n="4.4">
          Xarita tayllarini olish uchun cookie talab qilinmaydi — ular kalitsiz
          va anonim beriladi.
        </Clause>
      </Section>

      <Section n="5" title="Uchinchi tomon xizmatlari">
        <Clause n="5.1">
          Xizmatning ishlashi uchun quyidagi provayderlar jalb qilingan:
        </Clause>
        <LegalTable
          head={["Provayder", "Nima uchun", "Unga nima o'tadi"]}
          rows={[
            [
              "Resend (elektron pochta)",
              "Kirish kodi va xizmat xabarlarini yuborish",
              "Pochta manzili va xat matni",
            ],
            [
              "Cloudflare (CDN va himoya)",
              "Trafikni yetkazish, DDoS himoyasi, TLS",
              "So'rov metama'lumoti, jumladan IP manzil",
            ],
            [
              "Hosting provayderi",
              "Serverlarni joylashtirish",
              "Serverdagi barcha ma'lumot (shifrlangan disk)",
            ],
          ]}
        />
        <Clause n="5.2">
          Provayderlarga ma&apos;lumot faqat xizmatni ko&apos;rsatish uchun zarur
          hajmda beriladi. Ularga ma&apos;lumotni o&apos;z maqsadlarida ishlatishga
          ruxsat berilmaydi.
        </Clause>
        <Clause n="5.3">
          Ma&apos;lumot sotilmaydi va reklama maqsadida uchinchi shaxslarga
          berilmaydi.
        </Clause>
      </Section>

      <Section n="6" title="Ma'lumotni chet elda saqlash">
        <Clause n="6.1">
          Serverlar va yuqorida sanab o&apos;tilgan provayderlarning bir qismi
          O&apos;zbekiston Respublikasi hududidan tashqarida joylashgan.
        </Clause>
        <Clause n="6.2">
          «Shaxsga doir ma&apos;lumotlar to&apos;g&apos;risida»gi Qonunning
          27<sup>1</sup>-moddasiga 2026-yil mart oyida kiritilgan
          o&apos;zgartirishlarga ko&apos;ra, O&apos;zbekiston hududida saqlash
          talabi <strong>biometrik va genetik</strong> ma&apos;lumotlarga hamda
          telekommunikatsiya operatorlari foydalanuvchilarining
          ma&apos;lumotlariga nisbatan qo&apos;llaniladi. Boshqa ma&apos;lumotlar
          himoya darajasi tegishli bo&apos;lgan davlatlarda saqlanishi mumkin.
        </Clause>
        <Clause n="6.3">
          OnDexMap biometrik va genetik ma&apos;lumotlarni umuman yig&apos;maydi
          (3-bo&apos;lim), shuning uchun lokalizatsiya talabi qo&apos;llanilmaydi.
        </Clause>

        <Note kind="warn">
          Ma&apos;lumotlar bazasini davlat reyestrida ro&apos;yxatdan
          o&apos;tkazish talabi saqlanib qolgan. Reyestr raqami 1.2-bandda
          ko&apos;rsatiladi; u to&apos;ldirilmaguncha ushbu bo&apos;lim to&apos;liq
          bajarilgan hisoblanmaydi.
        </Note>
      </Section>

      <Section n="7" title="Saqlash muddatlari">
        <Clause n="7.1">
          Muddat tugagan ma&apos;lumot avtomatik o&apos;chiriladi. Tozalash ishi
          soatiga bir marta bajariladi.
        </Clause>
        <Clause n="7.2">
          Hisob o&apos;chirilganda pochta manzili, ism, kalitlar va sessiyalar
          o&apos;chiriladi.
        </Clause>
        <Clause n="7.3">
          Hisob-faktura va to&apos;lov yozuvlari qonun talabiga ko&apos;ra hisob
          o&apos;chirilganidan keyin ham saqlanadi — ularni o&apos;chirish soliq
          qonunchiligini buzgan bo&apos;lardi.
        </Clause>
        <Clause n="7.4">
          Zaxira nusxalar navbatdagi almashtirilishigacha saqlanadi va faqat
          tiklash uchun ishlatiladi.
        </Clause>
      </Section>

      <Section n="8" title="Xavfsizlik choralari">
        <Clause n="8.1">Amaldagi choralar:</Clause>
        <UL>
          <li>barcha trafik TLS bilan shifrlanadi;</li>
          <li>
            parol yo&apos;q — kirish faqat bir martalik kod orqali, kod
            xeshlangan holda saqlanadi;
          </li>
          <li>
            API kalitlar ochiq saqlanmaydi: bazada faqat xesh bo&apos;ladi, maxfiy
            qism bir marta ko&apos;rsatiladi;
          </li>
          <li>
            baza roli darajasida ajratilgan: ommaviy API hisob va kalit
            jadvallarini umuman o&apos;qiy olmaydi;
          </li>
          <li>
            kirish kodi so&apos;rovlariga tezlik chegarasi qo&apos;yilgan
            (bombardimonga qarshi);
          </li>
          <li>
            muhim harakatlar (kalit yaratish, bekor qilish) audit jurnaliga
            yoziladi.
          </li>
        </UL>
        <Clause n="8.2">
          Ma&apos;lumot sizib chiqqani aniqlansa, ta&apos;sirlangan
          foydalanuvchilarga pochta orqali xabar beriladi va vakolatli organga
          qonunda belgilangan tartibda ma&apos;lumot yuboriladi.
        </Clause>
      </Section>

      <Section n="9" title="Sizning huquqlaringiz">
        <Clause n="9.1">Siz quyidagi huquqlarga egasiz:</Clause>
        <UL>
          <li>o&apos;zingiz haqingizdagi ma&apos;lumotni olish;</li>
          <li>noto&apos;g&apos;ri ma&apos;lumotni tuzattirish;</li>
          <li>
            ma&apos;lumotni o&apos;chirtirish (hisobni o&apos;chirish orqali, 7.2 va
            7.3-bandlar hisobga olingan holda);
          </li>
          <li>rozilikni qaytarib olish;</li>
          <li>qayta ishlashga e&apos;tiroz bildirish;</li>
          <li>
            vakolatli davlat organiga shikoyat qilish (Raqamli texnologiyalar
            vazirligi huzuridagi nazorat inspeksiyasi).
          </li>
        </UL>
        <Clause n="9.2">
          Murojaat{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-brand hover:underline">
            {OPERATOR.email}
          </a>{" "}
          manziliga yuboriladi va <strong>30 kalendar kun</strong> ichida
          ko&apos;rib chiqiladi.
        </Clause>
        <Clause n="9.3">
          Shaxsni tasdiqlash uchun murojaat hisobga bog&apos;langan pochta
          manzilidan yuborilishi kerak.
        </Clause>
      </Section>

      <Section n="10" title="Foydalanuvchining o'z mijozlari">
        <Clause n="10.1">
          Siz OnDexMap&apos;ni o&apos;z ilovangizda ishlatganingizda, o&apos;z
          foydalanuvchilaringiz uchun <strong>siz operator</strong> bo&apos;lasiz,
          OnDexMap esa qayta ishlovchi vosita hisoblanadi.
        </Clause>
        <Clause n="10.2">
          O&apos;z foydalanuvchilaringizdan rozilik olish, ularga maxfiylik
          siyosatini ko&apos;rsatish va ularning huquqlarini ta&apos;minlash
          sizning zimmangizda.
        </Clause>
        <Clause n="10.3">
          Agar siz geokodlash yoki marshrut so&apos;rovlarida shaxsni
          aniqlaydigan ma&apos;lumot (masalan aniq uy manzili bilan birga ism)
          yuborsangiz — buning huquqiy asosi sizda bo&apos;lishi kerak. OnDexMap
          so&apos;rov mazmunini hisobga bog&apos;lab saqlamaydi (3.3-band).
        </Clause>
      </Section>

      <Section n="11" title="O'zgarishlar">
        <Clause n="11.1">
          Siyosat o&apos;zgarganda yangi tahrir ushbu sahifada e&apos;lon qilinadi
          va tepadagi sana yangilanadi.
        </Clause>
        <Clause n="11.2">
          Ma&apos;lumotlarni qayta ishlash hajmini kengaytiradigan
          o&apos;zgarishlar haqida oldindan pochta orqali xabar beriladi.
        </Clause>
      </Section>
    </LegalPage>
  );
}
