import {
  A,
  C,
  Callout,
  Code,
  H2,
  H3,
  P,
  PageHead,
  Panel,
  PrevNext,
  Split,
  Table,
  Tabs,
} from "@/components/docs/parts";
import { NpmMark, TsMark } from "@/components/docs/art";

export const metadata = {
  title: "SDK — REST — OnDexMap",
  description:
    "createClient(): geocode, reverse, directions, places va place — SDK orqali. Chegaralar so'rovdan oldin qo'llanadi.",
};

export default function SdkRestPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="SDK — REST"
        desc="createClient() barcha /v2 endpointlarini beradi. Server chegaralari so'rovdan OLDIN qo'llanadi, shuning uchun kvota behuda sarflanmaydi."
        pills={[
          { href: "#klient", label: "Klient", icon: <NpmMark size={15} /> },
          { href: "#geocode", label: "geocode", icon: <TsMark size={15} /> },
          { href: "#places", label: "places", icon: <TsMark size={15} /> },
        ]}
      />

      <H2 id="klient">Klient</H2>
      <Code lang="js">{`import { createClient } from "@ondexmap/sdk";

const ondex = createClient({ key: "omk_b_..." });`}</Code>
      <Table
        head={["Parametr", "Standart", "Tavsif"]}
        rows={[
          [
            <C key="k">key</C>,
            <>—</>,
            <>
              API kalit. Brauzerda <C>omk_b_…</C>, serverda <C>omk_s_…</C>.
            </>,
          ],
          [
            <C key="b">baseUrl</C>,
            <C key="bv">https://maps.ondex.uz/v2</C>,
            <>O&apos;zgartirish kerak emas.</>,
          ],
          [
            <C key="p">plan</C>,
            <C key="pv">&quot;free&quot;</C>,
            <>
              Tarifingiz. <C>places</C> to&apos;rtburchagining chegarasini belgilaydi.
            </>,
          ],
          [
            <C key="r">retries</C>,
            <>2</>,
            <>
              <C>429</C> va <C>503</C> da qayta urinishlar soni.
            </>,
          ],
        ]}
      />

      <Callout kind="warn">
        <p>
          Brauzer kaliti (<C>omk_b_…</C>) sahifa kodida ko&apos;rinadi — uni himoya qiladigan
          yagona narsa <A href="/docs/security/domains">konsoldagi domen ro&apos;yxati</A>. Server
          kalitini (<C>omk_s_…</C>) frontend build&apos;iga <b>hech qachon</b> qo&apos;ymang:{" "}
          <C>VITE_</C>, <C>NEXT_PUBLIC_</C> prefiksli o&apos;zgaruvchilar bundlega kiradi.
        </p>
      </Callout>

      <H2 id="geocode">geocode(q, opts?)</H2>
      <P>Nom bo&apos;yicha qidirish. Qamrov — butun O&apos;zbekiston.</P>
      <Code lang="js">{`const topilgan = await ondex.geocode("Chust", { limit: 5, near: [71.24, 41.0] });

for (const m of topilgan.results) {
  console.log(m.name, m.label, m.lat, m.lng, m.score);
}`}</Code>
      <P>
        Natijalar <C>score</C> bo&apos;yicha saralangan. <C>near</C> — natijalarni shu nuqtaga
        yaqinlashtiradi, <C>[lng, lat]</C> tartibida. <C>limit</C> serverning yuqori chegarasiga
        (25) avtomatik qirqiladi: kattaroq son so&apos;ralsa server <C>400</C> qaytarardi.
      </P>

      <H2 id="reverse">reverse(lat, lng)</H2>
      <Split>
        <div>
          <Code lang="js">{`const manzil = await ondex.reverse(41.0, 71.24);

if (manzil === null) {
  // Nuqta qamrovdan tashqarida — so'rov YUBORILMADI.
} else if (manzil.result === null) {
  // Qamrov ichida, lekin manzil topilmadi.
} else {
  console.log(manzil.result.text);
}`}</Code>
          <P>
            Ikkita <C>null</C> bir xil emas: birinchisi SDK&apos;niki (so&apos;rov umuman
            ketmadi), ikkinchisi serverniki (so&apos;rov ketdi, natija yo&apos;q).
          </P>
        </div>
        <div>
          <Callout kind="warn">
            <p>
              <C>reverse</C> <b>butun mamlakatni qamramaydi</b> — faqat 40.5–41.6° N, 70.5–72.0° E
              ichida ishlaydi. Toshkent bundan tashqarida. SDK bu hududdan tashqarida{" "}
              <C>null</C> qaytaradi va so&apos;rov yubormaydi.
            </p>
          </Callout>
        </div>
      </Split>

      <H2 id="directions">directions(from, to)</H2>
      <Code lang="js">{`const marshrut = await ondex.directions([71.24, 41.0], [69.24, 41.3]);
const yol = marshrut.routes[0];

console.log(yol.distance_m);   // metr
console.log(yol.duration_s);   // soniya
console.log(yol.geometry);     // GeoJSON LineString`}</Code>
      <P>
        Nuqtalar <C>[lng, lat]</C> tartibida, GeoJSON kabi. Maydon nomlari <C>distance_m</C> va{" "}
        <C>duration_s</C> — birlik nomda ko&apos;rinib tursin uchun.
      </P>
      <Callout kind="note">
        <p>
          Marshrut <b>butun O&apos;zbekistonda</b> ishlaydi — Toshkent ichidagi qisqa yo&apos;l
          ham, Nukus–Termiz kabi uzoq marshrut ham. Bu <C>reverse</C> dan farq qiladi: u
          hozircha faqat Namangan viloyati atrofini qamraydi.
        </p>
      </Callout>

      <H2 id="places">places(bounds)</H2>
      <P>
        Ko&apos;rinayotgan hududdagi ob&apos;ektlar. <C>bounds</C> — to&apos;g&apos;ridan-to&apos;g&apos;ri{" "}
        <C>map.getBounds()</C>.
      </P>
      <Tabs
        files={[
          {
            name: "places.js",
            code: `map.on("moveend", async () => {
  const obyektlar = await ondex.places(map.getBounds());

  // Ko'rinish tarif chegarasidan keng — so'rov yuborilmadi.
  if (obyektlar === null) return;

  chizish(obyektlar.result.features);   // GeoJSON FeatureCollection
});`,
          },
        ]}
      />
      <Split>
        <div>
          <P>
            To&apos;rtburchak xizmat hududiga <b>qirqiladi</b>: chekkasi chegaradan chiqib
            ketgan bo&apos;lsa ham so&apos;rov o&apos;tadi. Tomoni tarif chegarasidan oshsa{" "}
            <C>null</C> qaytadi va so&apos;rov yuborilmaydi.
          </P>
          <Code lang="js">{`// Obunachi bo'lsangiz chegara kengroq:
createClient({ key: "omk_b_...", plan: "paid" });`}</Code>
        </div>
        <div>
          <Panel label="Tomon chegarasi">
            <Table
              head={["Tarif", "Chegara"]}
              rows={[
                [<C key="f">free</C>, <>0.25°</>],
                [<C key="p">paid</C>, <>1.0°</>],
                [<C key="e">ecosystem</C>, <>1.5°</>],
              ]}
            />
            <p className="text-sm text-muted">
              SDK tarifni bilmaydi — u serverda aniqlanadi. Shuning uchun standart holatda eng tor
              chegara olinadi: ortiqcha so&apos;rov yuborgandan ko&apos;ra yubormagan yaxshi.
            </p>
          </Panel>
        </div>
      </Split>

      <H2 id="place">place(id)</H2>
      <Code lang="js">{`const qidiruv = await ondex.geocode("OnDexCompany");
const tafsilot = await ondex.place(qidiruv.results[0].id);

console.log(tafsilot.result);`}</Code>
      <Callout kind="note">
        <p>
          <C>geocode</C> qaytaradigan <C>id</C> ob&apos;ekt uchun <C>p</C> harfi bilan boshlanadi,{" "}
          <C>/v2/places/{"{id}"}</C> esa toza UUID kutadi. SDK prefiksni o&apos;zi olib tashlaydi —
          bu hujjatda eng ko&apos;p adashtirgan joy edi.
        </p>
      </Callout>

      <H3 id="qamrov">Nima ko&apos;rinadi, nima ko&apos;rinmaydi</H3>
      <P>
        <C>/v2</C> orqali faqat <b>tasdiqlangan</b> ob&apos;ektlar ko&apos;rinadi. Foydalanuvchi
        yuborgan va hali moderatsiyadan o&apos;tmagan takliflar, mahalla chegaralari va ichki
        maydonlar API&apos;da yo&apos;q.
      </P>

      <PrevNext current="/docs/sdk/rest" />
    </div>
  );
}
