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
  Terminal,
} from "@/components/docs/parts";
import { CdnMark, NpmMark, ReactMark } from "@/components/docs/art";

export const metadata = {
  title: "NPM orqali ulash — OnDexMap",
  description: "OnDexMap xaritasini paket menejeri orqali ulash: Vite, Webpack va boshqa bundlerlar.",
};

export default function NpmPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="NPM orqali ulash"
        desc="Vite, Webpack yoki boshqa bundler ishlatilgan loyihalarda shu usul afzal: versiya package-lock.json da qulflanadi va tashqi CDN'ga bog'liqlik qolmaydi."
        pills={[
          { href: "#ornatish", label: "O'rnatish", icon: <NpmMark size={15} /> },
          { href: "/docs/integration/cdn", label: "CDN usuli", icon: <CdnMark size={15} /> },
          { href: "/docs/integration/react", label: "React bilan", icon: <ReactMark size={15} /> },
        ]}
      />

      <H2 id="ornatish">O&apos;rnatish</H2>
      <Split>
        <div>
          <Terminal>{`npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Terminal>
          <Tabs
            files={[
              {
                name: "package.json",
                code: `{
  "dependencies": {
    "maplibre-gl": "4.7.1",
    "pmtiles": "3.2.1"
  }
}`,
              },
            ]}
          />
        </div>
        <div>
          <Panel label="Kerakli talablar">
            <CheckList
              items={[
                <>Node.js 18 yoki undan yuqori</>,
                <>ES modullarini qo&apos;llab-quvvatlaydigan bundler</>,
                <>WebGL qo&apos;llab-quvvatlaydigan brauzer</>,
                <>Nolga teng bo&apos;lmagan o&apos;lchamli konteyner</>,
              ]}
            />
          </Panel>
          <Callout kind="warn">
            <p>
              Versiyalar <C>^</C> belgisisiz, qat&apos;iy ko&apos;rsatiladi. <C>maplibre-gl</C>{" "}
              6-versiyasi WebGL2&apos;ni majburiy talab qiladi va uni qo&apos;llab-quvvatlamaydigan
              qurilmada xarita xato xabarisiz oq qoladi.
            </p>
          </Callout>
        </div>
      </Split>

      <H2 id="modul">Xarita moduli</H2>
      <P>
        Protokolni modul darajasida bir marta ro&apos;yxatdan o&apos;tkazing — har chaqiruvda qayta
        chaqirish shart emas:
      </P>
      <Tabs
        files={[
          {
            name: "map.js",
            code: `import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

// Protokol xarita yaratilishidan OLDIN ro'yxatdan o'tadi.
maplibregl.addProtocol("pmtiles", new Protocol().tile);

export const ONDEX_STYLE = "https://maps.ondex.uz/tiles/style.json";

export function createMap(container, options = {}) {
  return new maplibregl.Map({
    container,
    style: ONDEX_STYLE,
    center: [69.2401, 41.2995],
    zoom: 12,
    ...options,
  });
}`,
          },
          {
            name: "main.js",
            code: `import { createMap } from "./map.js";
import maplibregl from "maplibre-gl";

const map = createMap(document.getElementById("map"));
map.addControl(new maplibregl.NavigationControl(), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));`,
          },
          {
            name: "index.html",
            code: `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <title>OnDexMap</title>
  <style>
    html, body { margin: 0; height: 100% }
    #map { width: 100%; height: 100% }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="module" src="/main.js"></script>
</body>
</html>`,
          },
        ]}
      />

      <H2 id="bundler">Bundler sozlamalari</H2>
      <Table
        head={["Bundler", "Nima qilish kerak"]}
        rows={[
          [
            "Vite",
            <>
              Qo&apos;shimcha sozlama shart emas. CSS importi <C>maplibre-gl/dist/maplibre-gl.css</C>{" "}
              to&apos;g&apos;ridan-to&apos;g&apos;ri ishlaydi
            </>,
          ],
          [
            "Webpack 5",
            <>
              CSS uchun <C>style-loader</C> + <C>css-loader</C>; worker&apos;lar avtomatik
              bo&apos;linadi
            </>,
          ],
          [
            "Rollup",
            <>
              <C>@rollup/plugin-node-resolve</C> kerak — paket ES moduli sifatida yechiladi
            </>,
          ],
          [
            "Parcel",
            <>
              Sozlama shart emas; <C>.parcelrc</C> ga tegmaslik kifoya
            </>,
          ],
        ]}
      />
      <Callout kind="note">
        <p>
          Kutubxona tile&apos;larni fon oqimida (web worker) ochadi. Bundler worker&apos;ni{" "}
          <C>blob:</C> orqali yaratadi — qat&apos;iy CSP bo&apos;lsa <C>worker-src blob:</C> kerak
          bo&apos;ladi (<A href="/docs/security/csp">CSP va HTTPS</A>).
        </p>
      </Callout>

      <H2 id="qidiruv">REST API ni ulash</H2>
      <P>Qidiruv funksiyasini alohida modulga chiqaring:</P>
      <Code lang="js">{`// search.js
const BASE = "https://maps.ondex.uz/v2";

export async function geocode(q, key) {
  const url = new URL(BASE + "/geocode");
  url.searchParams.set("q", q);
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode: " + res.status);

  const data = await res.json();
  return data.status === "OK" ? data.results : [];
}`}</Code>
      <P>
        Tiplar bilan ishlash — <A href="/docs/integration/typescript">TypeScript</A> sahifasida.
      </P>

      <PrevNext current="/docs/integration/npm" />
    </div>
  );
}
