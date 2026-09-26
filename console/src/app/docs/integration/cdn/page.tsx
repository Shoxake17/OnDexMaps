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
  Success,
  Table,
  Tabs,
} from "@/components/docs/parts";
import { CdnMark, MapSketch, NpmMark } from "@/components/docs/art";
import { KeyIcon } from "@/components/docs/icons";

export const metadata = {
  title: "CDN orqali ulash — OnDexMap",
  description: "OnDexMap xaritasini CDN orqali bitta HTML faylga ulash.",
};

export default function CdnPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="CDN orqali ulash"
        desc="Eng qisqa yo'l: kutubxonalar <head> ichida ulanadi. Qurilish vositasi (bundler) talab qilinmaydi — oddiy HTML fayl yetarli."
        pills={[
          { href: "#kod", label: "Kodga o'tish", icon: <CdnMark size={15} /> },
          { href: "/docs/integration/npm", label: "NPM usuli", icon: <NpmMark size={15} /> },
          { href: "/keys", label: "API kalit olish", icon: <KeyIcon size={15} /> },
        ]}
      />

      <H2 id="kod">To&apos;liq kod</H2>
      <Split>
        <div>
          <Tabs
            files={[
              {
                name: "index.html",
                code: `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js"></script>
</head>
<body>
  <div id="map" style="width: 100%; height: 400px"></div>

  <script>
    maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);

    const map = new maplibregl.Map({
      container: "map",
      style: "https://maps.ondex.uz/tiles/style.json",
      center: [69.2401, 41.2995],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
  </script>
</body>
</html>`,
              },
            ]}
          />
        </div>
        <div>
          <Panel label="Natija">
            <div className="h-[200px] overflow-hidden rounded-lg border border-border">
              <MapSketch />
            </div>
          </Panel>
          <Success title="Tayyor">
            Xarita yuklandi va boshqaruv tugmalari joyida. Endi marker qo&apos;shish, hodisalarni tinglash
            yoki <A href="/docs/api">REST API</A> ni ulash mumkin.
          </Success>
        </div>
      </Split>

      <H2 id="tartib">Ulash tartibi</H2>
      <Table
        head={["Qadam", "Nima uchun"]}
        rows={[
          [
            <C key="1">maplibre-gl.css</C>,
            "Boshqaruv tugmalari va markerlar joylashuvi. Ulanmasa ular siljib qoladi",
          ],
          [<C key="2">maplibre-gl.js</C>, "Xarita kutubxonasi"],
          [<C key="3">pmtiles.js</C>, "Vektor tile fayllarini Range so'rovi bilan o'qiydi"],
          [
            <C key="4">addProtocol</C>,
            "Xarita yaratilishidan OLDIN chaqiriladi — aks holda uslubdagi pmtiles:// manbalari yuklanmaydi",
          ],
        ]}
      />
      <Callout kind="warn">
        <p>
          Versiyalar URL&apos;da qat&apos;iy ko&apos;rsatiladi (<C>@4.7.1</C>, <C>@3.2.1</C>).{" "}
          <C>@latest</C> yozmang: <C>maplibre-gl</C> 6-versiyasi WebGL2&apos;ni majburiy talab qiladi va
          uni qo&apos;llab-quvvatlamaydigan qurilmada xarita xato xabarisiz oq qoladi.
        </p>
      </Callout>

      <H2 id="talablar">Talablar</H2>
      <Panel label="Kerakli talablar">
        <CheckList
          items={[
            <>WebGL qo&apos;llab-quvvatlaydigan brauzer</>,
            <>
              Nolga teng bo&apos;lmagan o&apos;lchamli konteyner (<C>#map</C>)
            </>,
            <>
              Sahifa HTTPS orqali ochilishi (<C>http://</C> manbalar bloklanadi)
            </>,
            <>Faylni HTTP server orqali ochish — file:// emas</>,
          ]}
        />
      </Panel>

      <H2 id="qidiruv">Qidiruvni qo&apos;shish</H2>
      <P>
        Brauzer kaliti bilan <C>/v2/geocode</C> ga murojaat qiling. Kalit sahifa kodida ochiq
        ko&apos;rinadi, shuning uchun u domen ro&apos;yxati bilan cheklanadi —{" "}
        <A href="/docs/security/domains">Domain restrictions</A>.
      </P>
      <Code lang="js">{`const API_KEY = "omk_b_...";

async function qidir(matn) {
  const res = await fetch(
    "https://maps.ondex.uz/v2/geocode"
      + "?q=" + encodeURIComponent(matn)
      + "&key=" + API_KEY,
  );
  const data = await res.json();
  if (data.status !== "OK") return;

  const joy = data.results[0];
  new maplibregl.Marker().setLngLat([joy.lng, joy.lat]).addTo(map);
  map.flyTo({ center: [joy.lng, joy.lat], zoom: 16 });
}`}</Code>

      <H2 id="nosozlik">Nosozlikni topish</H2>
      <Table
        head={["Belgisi", "Sabab"]}
        rows={[
          ["Xarita joyi bo'sh, balandligi 0", "Konteynerga o'lcham berilmagan"],
          [
            "Fon bor, lekin ko'chalar yo'q",
            <>
              <C>addProtocol</C> xarita yaratilgandan KEYIN chaqirilgan
            </>,
          ],
          ["Butunlay oq ekran", "Uslub yuklanmagan — manzilni va tarmoq panelini tekshiring"],
          [
            "Tugmalar joyidan siljigan",
            <>
              <C>maplibre-gl.css</C> ulanmagan
            </>,
          ],
          [
            <>
              Konsolda <C>Refused to …</C>
            </>,
            <>
              CSP bloklayapti — <A href="/docs/security/csp">CSP va HTTPS</A>
            </>,
          ],
        ]}
      />

      <PrevNext current="/docs/integration/cdn" />
    </div>
  );
}
