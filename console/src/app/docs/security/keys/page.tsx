import {
  A,
  C,
  Callout,
  CheckList,
  Code,
  H2,
  P,
  PageHead,
  Panel,
  PrevNext,
  Split,
  Table,
  Tabs,
  UL,
} from "@/components/docs/parts";
import { GlobeIcon, KeyIcon, ServerIcon } from "@/components/docs/icons";

export const metadata = {
  title: "API kalitlar — Security — OnDexMap",
  description: "OnDexMap API kalitlari: turlari, yaratish, saqlash, almashtirish va bekor qilish.",
};

export default function KeysPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="API kalitlar"
        desc="Kalit REST API chaqiruvlarini hisobingizga bog'laydi. Ikki turi bor: server kaliti — o'z serveringizdan, brauzer kaliti — sahifangizdan chaqirish uchun."
        pills={[
          { href: "/keys", label: "Kalit yaratish", icon: <KeyIcon size={15} /> },
          { href: "/docs/security/domains", label: "Domenlar", icon: <GlobeIcon size={15} /> },
          { href: "/docs/security/ips", label: "IP manzillar", icon: <ServerIcon size={15} /> },
        ]}
      />

      <H2 id="turlari">Kalit turlari</H2>
      <Table
        head={["", "Server kaliti", "Brauzer kaliti"]}
        rows={[
          [
            <strong key="a" className="text-foreground">
              Prefiks
            </strong>,
            <C key="b">omk_s_</C>,
            <C key="c">omk_b_</C>,
          ],
          [
            <strong key="a" className="text-foreground">
              Yuborish
            </strong>,
            <>
              faqat <C>X-API-Key</C> sarlavhasi
            </>,
            <>
              <C>X-API-Key</C> yoki <C>?key=</C>
            </>,
          ],
          [
            <strong key="a" className="text-foreground">
              Cheklov
            </strong>,
            "IP ro'yxati — ixtiyoriy",
            "domen ro'yxati — majburiy",
          ],
          [
            <strong key="a" className="text-foreground">
              Qayerda saqlanadi
            </strong>,
            "server muhit o'zgaruvchisida",
            "sahifa kodida (ochiq ko'rinadi)",
          ],
          [
            <strong key="a" className="text-foreground">
              Qachon ishlatiladi
            </strong>,
            "backend, cron, mobil ilova serveri",
            "sayt, SPA, statik sahifa",
          ],
        ]}
      />
      <Callout kind="warn">
        <p>
          Server kalitini brauzerga bermang. U <C>?key=</C> orqali umuman qabul qilinmaydi, lekin
          sahifa kodiga yozilsa ham ochiq ko&apos;rinadi va domen bilan chegaralanmagan bo&apos;ladi.
        </p>
      </Callout>

      <H2 id="yaratish">Kalit yaratish</H2>
      <P>
        <A href="/keys">API kalitlar</A> bo&apos;limida «Yangi kalit» tugmasi. Yaratishda quyidagilar
        so&apos;raladi:
      </P>
      <UL>
        <li>
          <strong className="text-foreground">Nom</strong> — kalit qayerda ishlatilishini eslab qolish
          uchun (masalan «sayt — production»).
        </li>
        <li>
          <strong className="text-foreground">Turi</strong> — server yoki brauzer.
        </li>
        <li>
          <strong className="text-foreground">API&apos;lar</strong> — <C>geocode</C>, <C>reverse</C>,{" "}
          <C>directions</C>, <C>places</C>. Faqat kerakligini yoqing.
        </li>
        <li>
          <strong className="text-foreground">Cheklov</strong> — brauzer kaliti uchun domenlar, server
          kaliti uchun IP manzillar.
        </li>
      </UL>
      <Callout kind="note">
        <p>
          Kalit yaratilgan paytda <strong className="text-foreground">bir marta</strong>{" "}
          ko&apos;rsatiladi. Keyin faqat prefiksi ko&apos;rinadi — bazada uning o&apos;zi emas, HMAC
          hisoblangan qiymati saqlanadi.
        </p>
      </Callout>

      <H2 id="saqlash">Kalitni saqlash</H2>
      <Split>
        <div>
          <Tabs
            files={[
              {
                name: ".env",
                lang: "terminal",
                code: `# Server kaliti — repoga TUSHMAYDI (.gitignore)
ONDEXMAP_KEY=omk_s_...`,
              },
              {
                name: "node.js",
                lang: "js",
                code: `const KEY = process.env.ONDEXMAP_KEY;
if (!KEY) throw new Error("ONDEXMAP_KEY berilmagan");

const res = await fetch("https://maps.ondex.uz/v2/geocode?q=Chust", {
  headers: { "X-API-Key": KEY },
});`,
              },
              {
                name: "docker-compose.yml",
                lang: "terminal",
                code: `services:
  api:
    image: mening-ilovam
    environment:
      ONDEXMAP_KEY: \${ONDEXMAP_KEY}`,
              },
            ]}
          />
        </div>
        <Panel label="Qoidalar">
          <CheckList
            items={[
              <>Server kaliti faqat muhit o&apos;zgaruvchisida</>,
              <>
                Repoga tushmasin — <C>.env</C> ni <C>.gitignore</C> ga qo&apos;shing
              </>,
              <>Har muhit uchun alohida kalit (dev, staging, production)</>,
              <>Kerakli API&apos;lardan boshqasi yoqilmasin</>,
              <>Ishlatilmaydigan kalit bekor qilinsin</>,
            ]}
          />
        </Panel>
      </Split>

      <H2 id="almashtirish">Almashtirish</H2>
      <P>
        Kalit oshkor bo&apos;lsa yoki muddatli almashtirish kerak bo&apos;lsa —{" "}
        <strong className="text-foreground">«Almashtirish»</strong> amalidan foydalaning:
      </P>
      <Table
        head={["Vaqt", "Eski kalit", "Yangi kalit"]}
        rows={[
          ["Almashtirish bosilgan payt", "ishlaydi", "ishlaydi"],
          ["Keyingi 24 soat", "ishlaydi — kodni yangilash uchun vaqt", "ishlaydi"],
          ["24 soatdan keyin", "avtomatik bekor bo'ladi", "ishlaydi"],
        ]}
      />
      <P>
        Bu uzilishsiz o&apos;tish uchun: yangi kalitni serverga qo&apos;yib, deploy qilib ulgurasiz.
        Zudlik bilan to&apos;xtatish kerak bo&apos;lsa «Bekor qilish» ishlatiladi — u darhol kuchga
        kiradi.
      </P>

      <H2 id="bekor">Bekor qilish</H2>
      <P>
        Bekor qilingan kalit bilan kelgan so&apos;rov <C>401 invalid_key</C> qaytaradi. Bekor qilish
        ortga qaytarilmaydi — o&apos;rniga yangi kalit yaratiladi.
      </P>
      <Code lang="json">{`{
  "status": "REQUEST_DENIED",
  "error": { "code": "invalid_key", "message": "kalit bekor qilingan" }
}`}</Code>

      <H2 id="tekshirish">Kalitni tekshirish</H2>
      <P>Sozlash to&apos;g&apos;ri bo&apos;lganini bitta so&apos;rov bilan tekshiring:</P>
      <Code lang="terminal">{`curl -i -H "X-API-Key: omk_s_..." \\
  "https://maps.ondex.uz/v2/geocode?q=Chust"

# 200  — hammasi joyida
# 401  — kalit noto'g'ri yoki bekor qilingan
# 403  — IP ro'yxatiga mos kelmadi yoki geocode yoqilmagan`}</Code>

      <PrevNext current="/docs/security/keys" />
    </div>
  );
}
