import Link from "next/link";
import { Clause, LegalPage, LegalTable, Note, OPERATOR, OperatorEmail, Section, UL } from "@/components/legal/legal-ui";

export const metadata = {
  title: "Mualliflik va atribut — OnDexMap",
  description:
    "OnDexMap xaritasining ma'lumot manbalari, litsenziyalari va atribut ko'rsatish talabi.",
};

/**
 * Mualliflik sahifasi.
 *
 * ┌─ NEGA BU YERDA, API'DA EMAS ───────────────────────────────────────┐
 * Ilgari sahifa Go serverida `assets/copyright.html` sifatida
 * joylashgandi va shuning uchun konsolning navbar'i ham, futeri ham
 * yo'q edi: u boshqa ilovada, qo'lda yozilgan CSS bilan turardi.
 *
 * Nav va futerni o'sha HTML'ga KO'CHIRIB yozish ikki nusxa yaratardi
 * va ular albatta bir-biridan uzoqlashib ketardi (yangi huquqiy hujjat
 * qo'shilsa faqat bittasida paydo bo'lardi).
 *
 * Shuning uchun sahifa shu yerga ko'chirildi, `maps.ondex.uz/copyright`
 * esa shu manzilga yo'naltiradi. Uslubdagi atribut havolasi
 * (`__SELF__/copyright`) O'ZGARMAYDI — integratorlarda hech narsa
 * buzilmaydi.
 * └────────────────────────────────────────────────────────────────────┘
 */

const TOC = [
  { n: "1", title: "Ma'lumot manbalari" },
  { n: "2", title: "Atribut — talab" },
  { n: "3", title: "Ma'lumotni qayta ishlatish" },
  { n: "4", title: "Xato topdingizmi" },
  { n: "5", title: "Huquqiy hujjatlar" },
];

export default function CopyrightPage() {
  return (
    <LegalPage
      title="Mualliflik va atribut"
      subtitle="OnDexMap xaritasi ochiq ma'lumotlar asosida qurilgan. Undan foydalanganda ma'lumot manbalari ko'rsatilishi shart."
      toc={TOC}
      // Axborot sahifasi — shartnoma emas, rekvizit ogohlantirishi kerak emas.
      requisites={false}
    >
      <Section n="1" title="Ma'lumot manbalari">
        <LegalTable
          head={["Nima", "Manba", "Litsenziya"]}
          rows={[
            [
              "Ko'chalar, joylar, geografiya",
              "OpenStreetMap",
              <a
                key="l1"
                href="https://opendatacommons.org/licenses/odbl/"
                target="_blank"
                rel="noopener"
                className="text-brand hover:underline"
              >
                ODbL 1.0
              </a>,
            ],
            [
              "Bino konturlari",
              "Microsoft Global ML Building Footprints",
              <a
                key="l2"
                href="https://opendatacommons.org/licenses/odbl/"
                target="_blank"
                rel="noopener"
                className="text-brand hover:underline"
              >
                ODbL 1.0
              </a>,
            ],
            [
              "Mahalla chegaralari, ob'ektlar bazasi, xarita uslubi",
              "OnDexMap",
              <Link key="l3" href="/shartlar" className="text-brand hover:underline">
                OnDexMap shartlari
              </Link>,
            ],
          ]}
        />
      </Section>

      <Section n="2" title="Atribut — talab">
        <Clause n="2.1">
          Xaritani ishlatgan har qanday sahifa yoki ilova quyidagi yozuvni{" "}
          <strong>ko&apos;rinadigan joyda</strong> saqlashi shart:
        </Clause>
        <div className="my-3 rounded-lg border border-border bg-card px-4 py-3 font-mono text-[13px]">
          © OnDexMap · Bino konturlari © Microsoft · © OpenStreetMap
        </div>
        <Clause n="2.2">
          Yozuv xarita uslubiga (<code>style.json</code>) kiritilgan va xarita
          kutubxonasi uni <strong>o&apos;zi chiqaradi</strong> — odatdagi holatda
          qo&apos;lda yozish kerak emas.
        </Clause>

        <Note kind="warn">
          <p className="font-semibold">Nima qilish mumkin emas</p>
          <p className="mt-1.5">
            Atribut yozuvini o&apos;chirish, yashirish, o&apos;qib
            bo&apos;lmaydigan qilib qo&apos;yish (shaffoflik, juda kichik shrift,
            boshqa element ostiga berkitish) yoki{" "}
            <code className="rounded bg-amber-100 px-1">attributionControl: false</code>{" "}
            yozib uni qaytarmaslik — foydalanish shartlarining buzilishi
            hisoblanadi va API kalitining bekor qilinishiga olib keladi.
          </p>
          <p className="mt-2">
            Yorliqni <code className="rounded bg-amber-100 px-1">compact: true</code>{" "}
            bilan yig&apos;ib qo&apos;yish ham mumkin emas: foydalanuvchi xaritani
            surishi bilan yozuv «i» tugmasi ortiga kirib ketadi va kredit
            ko&apos;rinmay qoladi.
          </p>
        </Note>

        <Clause n="2.3">Nima qilish mumkin:</Clause>
        <UL>
          <li>yorliqni boshqa burchakka ko&apos;chirish;</li>
          <li>shrift o&apos;lchami va rangini moslashtirish;</li>
          <li>
            yoniga o&apos;z brendingizni qo&apos;shish —{" "}
            <Link href="/docs/js/general#brend" className="text-brand hover:underline">
              O&apos;z brendingiz bilan
            </Link>
            .
          </li>
        </UL>
        <Clause n="2.4">
          To&apos;liq qoidalar —{" "}
          <Link href="/shartlar#2" className="text-brand hover:underline">
            Foydalanish shartlari, 2-bo&apos;lim
          </Link>
          .
        </Clause>
      </Section>

      <Section n="3" title="Ma'lumotni qayta ishlatish">
        <Clause n="3.1">
          ODbL — «share-alike» litsenziyasi. OpenStreetMap ma&apos;lumotidan
          hosila ma&apos;lumotlar bazasi yaratsangiz, uni ham shu litsenziya
          ostida tarqatishingiz kerak bo&apos;ladi. Xaritani sahifangizda
          ko&apos;rsatish yoki API javoblarini ilovangizda ishlatish bunga
          kirmaydi — talab faqat atribut.
        </Clause>
        <Clause n="3.2">
          Xarita tayllarini, uslubni yoki API javoblarini ommaviy qayta tarqatish
          (o&apos;z proksi xizmatingizni ochish, ma&apos;lumotni yuklab olib
          boshqalarga berish) alohida kelishuvni talab qiladi.
        </Clause>
        <Clause n="3.3">
          Keshlash muddatlari{" "}
          <Link href="/shartlar#4" className="text-brand hover:underline">
            Foydalanish shartlarining 4-bo&apos;limida
          </Link>{" "}
          jadval bilan berilgan.
        </Clause>
      </Section>

      <Section n="4" title="Xato topdingizmi">
        <Clause n="4.1">
          Noto&apos;g&apos;ri ma&apos;lumotni bizga yuboring:{" "}
          <OperatorEmail className="text-brand hover:underline" />{" "}
          yoki{" "}
          <a
            href={OPERATOR.telegramUrl}
            target="_blank"
            rel="noopener"
            className="text-brand hover:underline"
          >
            {OPERATOR.telegram}
          </a>
          . Xabarda joyning nomi va koordinatasini ko&apos;rsating.
        </Clause>
        <Clause n="4.2">
          Yangi ob&apos;ektni{" "}
          <a
            href={OPERATOR.api}
            target="_blank"
            rel="noopener"
            className="text-brand hover:underline"
          >
            xaritadagi
          </a>{" "}
          «Ob&apos;ekt qo&apos;shish» tugmasi orqali yuborish mumkin. Yuborilgan
          ob&apos;ekt darhol chiqmaydi — avval moderatsiyadan o&apos;tadi.
        </Clause>
        <Clause n="4.3">
          Tuzatish upstream manbaga ham yuborilishi mumkin; bunday holatda u
          keyingi yangilanishda OnDexMap&apos;ga o&apos;tadi.
        </Clause>
      </Section>

      <Section n="5" title="Huquqiy hujjatlar">
        <Clause n="5.1">
          Xizmatdan foydalanish shartlari, to&apos;lov tartibi va shaxsga doir
          ma&apos;lumotlarni qayta ishlash qoidalari alohida hujjatlarda:
        </Clause>
        <UL>
          <li>
            <Link href="/oferta" className="text-brand hover:underline">
              Ommaviy oferta
            </Link>{" "}
            — shartnoma taklifi;
          </li>
          <li>
            <Link href="/shartlar" className="text-brand hover:underline">
              Foydalanish shartlari
            </Link>{" "}
            — texnik qoidalar va taqiqlar;
          </li>
          <li>
            <Link href="/maxfiylik" className="text-brand hover:underline">
              Maxfiylik siyosati
            </Link>
            ;
          </li>
          <li>
            <Link href="/sla" className="text-brand hover:underline">
              Xizmat darajasi kelishuvi
            </Link>
            .
          </li>
        </UL>
        <Clause n="5.2">
          Savol yoki shartlarning buzilishi haqida xabar:{" "}
          <OperatorEmail className="text-brand hover:underline" />{" "}
          (
          <Link href="/aloqa" className="text-brand hover:underline">
            boshqa kanallar
          </Link>
          ).
        </Clause>
      </Section>
    </LegalPage>
  );
}
