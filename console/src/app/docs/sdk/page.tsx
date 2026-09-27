import {
  A,
  C,
  Callout,
  CardGrid,
  CheckList,
  H2,
  P,
  PageHead,
  Panel,
  PrevNext,
  Split,
  Table,
  Terminal,
} from "@/components/docs/parts";
import { NpmMark, TsMark } from "@/components/docs/art";

export const metadata = {
  title: "SDK — OnDexMap",
  description:
    "OnDexMap rasmiy JavaScript/TypeScript SDK'si: xarita, geokodlash, marshrut va joylar. Tiplar OpenAPI kontraktidan generatsiya qilinadi.",
};

export default function SdkPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="SDK"
        desc="@ondexmap/sdk — xaritani to'g'ri sozlab yaratadi va REST API bilan ishlaydi. Tiplar OpenAPI kontraktidan generatsiya qilinadi, shuning uchun ular serverdan ortda qola olmaydi."
        pills={[
          { href: "#ornatish", label: "O'rnatish", icon: <NpmMark size={15} /> },
          { href: "/docs/sdk/xarita", label: "Xarita", icon: <TsMark size={15} /> },
          { href: "/docs/sdk/rest", label: "REST", icon: <TsMark size={15} /> },
        ]}
      />

      <H2 id="ornatish">O&apos;rnatish</H2>
      <Split>
        <div>
          <Terminal>{`npm install @ondexmap/sdk

# xarita ham kerak bo'lsa:
npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Terminal>
          <P>
            <C>maplibre-gl</C> va <C>pmtiles</C> — <C>peerDependencies</C>, va ular{" "}
            <b>ixtiyoriy</b>. Faqat REST kerak bo&apos;lsa ularni o&apos;rnatmang: SDK&apos;ning
            REST qismi ularni import qilmaydi.
          </P>
        </div>
        <div>
          <Panel label="Nima kiradi">
            <CheckList
              items={[
                <>
                  <C>createMap()</C> — xarita, atribut avtomatik to&apos;g&apos;ri
                </>,
                <>
                  <C>createClient()</C> — geocode, reverse, directions, places
                </>,
                <>TypeScript tiplari — kontraktdan generatsiya qilingan</>,
                <>Nol ishlash vaqti bog&apos;liqligi (runtime dependency)</>,
              ]}
            />
          </Panel>
        </div>
      </Split>

      <H2 id="nega">Nega SDK, oddiy fetch emas</H2>
      <P>
        SDK <C>fetch</C>&apos;ni qulayroq qilish uchun emas. U hujjatni sinash paytida{" "}
        <b>haqiqatan ro&apos;y bergan</b> beshta nosozlikni imkonsiz qiladi:
      </P>
      <Table
        head={["Nosozlik", "Oddiy fetch bilan", "SDK bilan"]}
        rows={[
          [
            <>
              <C>bbox</C> xizmat hududidan chiqib ketadi — Termiz yoki Nukus yonida
              yaqinlashtirilgan bo&apos;lsangiz ham
            </>,
            <>
              <C>400</C>, sababi tushunarsiz
            </>,
            <>chekka qirqiladi, so&apos;rov o&apos;tadi</>,
          ],
          [
            <>
              <C>bbox</C> tarif chegarasidan keng
            </>,
            <>
              <C>400</C>, kvota behuda sarflanadi
            </>,
            <>
              <C>null</C> qaytadi, so&apos;rov <b>yuborilmaydi</b>
            </>,
          ],
          [
            <>atribut mobil ekranda «i» ortiga yashirinadi</>,
            <>shart buziladi, siz buni bilmaysiz</>,
            <>
              <C>compact: false</C> majburiy
            </>,
          ],
          [
            <>
              <C>geocode</C> natijasining <C>id</C>&apos;si <C>/places/{"{id}"}</C>&apos;ga
              to&apos;g&apos;ri kelmaydi
            </>,
            <>
              <C>404</C>
            </>,
            <>
              <C>p</C> prefiksi avtomatik olinadi
            </>,
          ],
          [
            <>
              <C>429</C> da qayta urinish
            </>,
            <>qo&apos;lda yoziladi yoki umuman yo&apos;q</>,
            <>
              <C>Retry-After</C> hurmat qilinadi; kvota tugaganda urinilmaydi
            </>,
          ],
        ]}
      />

      <Callout kind="warn">
        <p>
          API kalit SDK&apos;da <b>doim sarlavhada</b> (<C>X-API-Key</C>) yuboriladi, hech qachon
          so&apos;rov qatorida. Manzil brauzer tarixiga, proksi va server jurnallariga tushadi —
          kalit u yerga tushmasligi kerak.
        </p>
      </Callout>

      <H2 id="kontrakt">Tiplar qayerdan keladi</H2>
      <P>
        SDK tiplari qo&apos;lda yozilmaydi. Ular{" "}
        <A href="https://maps.ondex.uz/v2/openapi.yaml">OpenAPI kontraktidan</A> generatsiya
        qilinadi, va CI har build&apos;da generatsiya natijasi eskirmaganini tekshiradi. Server
        javobidagi maydon nomi o&apos;zgarsa, SDK bilan yozilgan kod <b>kompilyatsiya
        bo&apos;lmaydi</b> — ishlash vaqtida <C>undefined</C> bo&apos;lib qolmaydi.
      </P>

      <H2 id="bolimlar">Bo&apos;limlar</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/sdk/xarita",
            title: "Xarita",
            desc: "createMap(): uslub, atribut, navigatsiya va o'z brendingiz.",
          },
          {
            href: "/docs/sdk/rest",
            title: "REST",
            desc: "geocode, reverse, directions, places, place — parametrlar va javoblar.",
          },
          {
            href: "/docs/sdk/xatolar",
            title: "Xatolar va kvota",
            desc: "OnDexMapError, qayta urinish qoidalari, kvota sarlavhalari.",
          },
        ]}
      />

      <PrevNext current="/docs/sdk" />
    </div>
  );
}
