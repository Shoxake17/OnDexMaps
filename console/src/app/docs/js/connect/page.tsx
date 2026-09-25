import { A, C, Callout, H2, H3, P, ParamTable, PrevNext, Tabs, UL } from "@/components/docs/parts";

export const metadata = {
  title: "API'ni ulash: JavaScript — OnDexMap",
  description: "OnDexMap JavaScript API'ni CDN yoki paket menejeri orqali ulash usullari.",
};

export default function ConnectJsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">API&apos;ni ulash: JavaScript</h1>

      <Callout kind="note">
        <p>
          Xaritaning o&apos;zini ko&apos;rsatish uchun API kalit KERAK EMAS. Kalit faqat{" "}
          <A href="/docs/api">REST API</A> chaqiruvlariga kerak (qidiruv, marshrut, ob&apos;ektlar) — uni{" "}
          <A href="/keys">API kalitlar</A> bo&apos;limida olasiz.
        </p>
      </Callout>

      <H2 id="cdn">Oddiy ulanish (CDN)</H2>
      <P>
        Eng qisqa yo&apos;l: kutubxonalarni <C>&lt;head&gt;</C> ichida ulash. Qurilish vositasi (bundler)
        talab qilinmaydi — oddiy HTML fayl yetarli.
      </P>
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
  <script src="index.js" defer></script>
</head>
<body>
  <div id="map" style="width: 600px; height: 400px"></div>
</body>
</html>`,
          },
          {
            name: "index.js",
            code: `// Protokolni xarita YARATISHDAN OLDIN ro'yxatdan o'tkazish shart
maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);

const map = new maplibregl.Map({
  container: "map",
  style: "https://maps.ondex.uz/tiles/style.json",
  center: [71.2394, 41.0004],
  zoom: 13,
});`,
          },
        ]}
      />

      <H2 id="npm">Paket menejeri orqali (npm)</H2>
      <P>
        Loyihangizda Vite, Webpack yoki boshqa bundler bo&apos;lsa — kutubxonalarni paket sifatida
        o&apos;rnating. Bu usul afzalroq: versiya <C>package-lock.json</C> da qulflanadi va tashqi CDN&apos;ga
        bog&apos;liqlik qolmaydi.
      </P>
      <Tabs
        files={[
          {
            name: "terminal",
            code: `npm install maplibre-gl@4.7.1 pmtiles@3.2.1`,
          },
          {
            name: "map.js",
            code: `import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

export function createMap(container) {
  return new maplibregl.Map({
    container,
    style: "https://maps.ondex.uz/tiles/style.json",
    center: [71.2394, 41.0004],
    zoom: 13,
  });
}`,
          },
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
      <Callout kind="warn">
        <p>
          Versiyalarni <C>^</C> siz, qat&apos;iy yozing. <C>maplibre-gl</C> v6 WebGL2&apos;ni majburiy
          talab qiladi va qo&apos;llab-quvvatlamaydigan qurilmada xarita <em>jimgina oq</em> bo&apos;lib
          qoladi — konsolda xato ham chiqmaydi.
        </p>
      </Callout>

      <H2 id="params">Xarita parametrlari</H2>
      <P>
        <C>new maplibregl.Map(...)</C> ga beriladigan asosiy parametrlar:
      </P>
      <ParamTable
        rows={[
          {
            name: "container",
            required: true,
            children: (
              <>
                Xarita joylashadigan element: <C>id</C> satri yoki <C>HTMLElement</C>. Elementning
                o&apos;lchami nolga teng bo&apos;lmasligi kerak.
              </>
            ),
          },
          {
            name: "style",
            required: true,
            children: (
              <>
                Uslub manzili. OnDexMap uchun:{" "}
                <C>https://maps.ondex.uz/tiles/style.json</C>
              </>
            ),
          },
          {
            name: "center",
            children: (
              <>
                Markaz koordinatasi <C>[lng, lat]</C> tartibida (avval uzunlik!). Masalan Chust:{" "}
                <C>[71.2394, 41.0004]</C>
              </>
            ),
          },
          {
            name: "zoom",
            children: <>Boshlang&apos;ich masshtab. Shahar ko&apos;rinishi uchun 12–14.</>,
          },
          {
            name: "maxBounds",
            children: (
              <>
                Xaritani ma&apos;lum hudud bilan cheklaydi. O&apos;zbekiston uchun:{" "}
                <C>[[55.5, 37.0], [73.5, 45.8]]</C> — tashqarida tile yo&apos;q, xarita oq
                ko&apos;rinardi.
              </>
            ),
          },
        ]}
      />

      <H2 id="features">Ulash xususiyatlari</H2>
      <ol className="mb-3 list-decimal space-y-3 pl-5 text-sm text-muted">
        <li>
          <strong className="text-foreground">Protokol tartibi muhim.</strong> <C>addProtocol</C> xarita
          yaratishdan OLDIN chaqirilishi shart — aks holda uslubdagi <C>pmtiles://</C> manbalari
          yuklanmaydi va xarita bo&apos;sh qoladi.
        </li>
        <li>
          <strong className="text-foreground">Uslub tashqi manbalarga murojaat qiladi.</strong> Tile
          fayllari <C>tiles.ondex.uz</C> dan, shriftlar <C>maps.ondex.uz</C> dan olinadi. Saytingizda
          qat&apos;iy CSP bo&apos;lsa — <A href="/docs/js/connect/csp">CSP bilan ulash</A> sahifasiga
          qarang.
        </li>
        <li>
          <strong className="text-foreground">Kutubxona brauzerda ishlaydi.</strong> Server tomonda
          (SSR, Node.js) <C>window</C> yo&apos;qligi sababli ishga tushmaydi — Next.js kabi ramkalarda uni
          faqat klientda yuklang (<A href="/docs/js/connect/react">React</A> sahifasiga qarang).
        </li>
        <li>
          <strong className="text-foreground">CSS unutilmasin.</strong> <C>maplibre-gl.css</C> ulanmasa
          boshqaruv tugmalari va markerlar joyida turmaydi.
        </li>
      </ol>

      <H3 id="frameworks">Ramkalar bilan</H3>
      <UL>
        <li>
          <A href="/docs/js/connect/typescript">TypeScript</A> — tiplar paket ichida keladi.
        </li>
        <li>
          <A href="/docs/js/connect/react">React</A> va <A href="/docs/js/connect/vue">Vue</A> — xaritaning
          hayotiy tsikli va tozalash.
        </li>
      </UL>

      <PrevNext current="/docs/js/connect" />
    </div>
  );
}
