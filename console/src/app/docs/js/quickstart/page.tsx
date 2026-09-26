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
  Success,
  Terminal,
  UL,
} from "@/components/docs/parts";
import { MapSketch } from "@/components/docs/art";
import { BoltIcon, KeyIcon, PlugIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Quick Start — OnDexMap",
  description: "Besh qadamda saytingizga ishlaydigan OnDexMap xaritasini joylashtiring.",
};

export default function QuickstartPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Quick Start"
        desc="Besh qadam: kutubxonani ulash, konteyner yaratish, xaritani ishga tushirish va qidiruvni bog'lash. Natijada ishlaydigan bitta HTML fayl bo'ladi."
        pills={[
          { href: "#qadam-1", label: "Boshlash", icon: <BoltIcon size={15} /> },
          { href: "/keys", label: "API kalit olish", icon: <KeyIcon size={15} /> },
          { href: "/docs/integration", label: "Integratsiya", icon: <PlugIcon size={15} /> },
        ]}
      />

      <H2 id="qadam-1">1. API kalit oling</H2>
      <P>
        Faqat xarita ko&apos;rsatmoqchi bo&apos;lsangiz bu qadam shart emas. Qidiruv, marshrut yoki
        ob&apos;ektlar kerak bo&apos;lsa — <A href="/keys">API kalitlar</A> bo&apos;limida{" "}
        <strong className="text-foreground">brauzer</strong> turidagi kalit yarating va sayt domeningizni
        ko&apos;rsating.
      </P>
      <Callout kind="note">
        <p>
          Brauzer kaliti faqat siz ko&apos;rsatgan domenlardan ishlaydi (<C>https://sayt.uz</C>,{" "}
          <C>https://*.sayt.uz</C>). Lokal ishlab chiqish uchun <C>http://localhost:3000</C> ni ham
          qo&apos;shing — aks holda so&apos;rov <C>key_restricted</C> bilan rad etiladi.
        </p>
      </Callout>

      <H2 id="qadam-2">2. Kutubxonalarni ulang</H2>
      <P>
        Sahifaning <C>&lt;head&gt;</C> qismiga MapLibre GL JS va PMTiles kutubxonalarini qo&apos;shing:
      </P>
      <Code lang="html">{`<head>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js"></script>
</head>`}</Code>
      <P>Bundler ishlatayotgan bo&apos;lsangiz, o&apos;rniga paketlarni o&apos;rnating:</P>
      <Terminal>{`npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Terminal>

      <H2 id="qadam-3">3. Konteyner yarating</H2>
      <P>
        Xarita joylashadigan blok element qo&apos;shing. Unga{" "}
        <strong className="text-foreground">nolga teng bo&apos;lmagan</strong> o&apos;lcham bering — xarita
        konteynerni to&apos;liq to&apos;ldiradi.
      </P>
      <Code lang="html">{`<body>
  <div id="map" style="width: 100%; height: 400px"></div>
</body>`}</Code>

      <H2 id="qadam-4">4. Xaritani ishga tushiring</H2>
      <P>
        Avval <C>pmtiles</C> protokolini ro&apos;yxatdan o&apos;tkazing (uslubdagi <C>pmtiles://</C>{" "}
        manzillari shu orqali o&apos;qiladi), so&apos;ng xaritani yarating:
      </P>
      <Split>
        <Code lang="js">{`<script>
  // PMTiles protokoli — usiz tile manbalari yuklanmaydi
  maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);

  const map = new maplibregl.Map({
    container: "map",
    style: "https://maps.ondex.uz/tiles/style.json",
    center: [71.2394, 41.0004], // [lng, lat] — Chust
    zoom: 13,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");
</script>`}</Code>
        <div>
          <Panel label="Natija">
            <div className="h-[200px] overflow-hidden rounded-lg border border-border">
              <MapSketch />
            </div>
          </Panel>
          <Success title="Xarita ishlayapti">
            Endi marker qo&apos;shish, hodisalarni tinglash va qidiruvni ulash mumkin.
          </Success>
        </div>
      </Split>
      <Callout kind="note">
        <p>
          MapLibre koordinatani <C>[lng, lat]</C> tartibida qabul qiladi — avval uzunlik, keyin kenglik.
          REST API javoblarida esa <C>lat</C> va <C>lng</C> alohida maydonlar.
        </p>
      </Callout>

      <H2 id="qadam-5">5. Qidiruvni ulang</H2>
      <P>
        Brauzer kaliti bilan <C>/v2/geocode</C> ga murojaat qilib, topilgan joyni xaritada belgilang:
      </P>
      <Code lang="js">{`const API_KEY = "omk_b_..."; // brauzer kaliti (domeningizga bog'langan)

async function qidir(matn) {
  const url = "https://maps.ondex.uz/v2/geocode"
    + "?q=" + encodeURIComponent(matn)
    + "&key=" + API_KEY;

  const javob = await fetch(url);
  const data = await javob.json();

  if (data.status !== "OK") {
    console.warn("qidiruv:", data.status, data.error?.code);
    return;
  }

  const joy = data.results[0];
  new maplibregl.Marker().setLngLat([joy.lng, joy.lat]).addTo(map);
  map.flyTo({ center: [joy.lng, joy.lat], zoom: 16 });
}

qidir("Chust bozori");`}</Code>
      <P>
        Javob shakli va boshqa endpointlar — <A href="/docs/api/geocode">Geocode</A> sahifasida.
      </P>

      <H2 id="toliq-misol">To&apos;liq misol</H2>
      <P>Quyidagi faylni brauzerda ochsangiz, ishlaydigan xaritani ko&apos;rasiz:</P>
      <Code lang="html">{`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <title>OnDexMap — Quick Start</title>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js"></script>
  <style>
    html, body { margin: 0; height: 100% }
    #map { width: 100%; height: 100% }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);

    const map = new maplibregl.Map({
      container: "map",
      style: "https://maps.ondex.uz/tiles/style.json",
      center: [71.2394, 41.0004],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
  </script>
</body>
</html>`}</Code>

      <H3 id="lokal">Lokal ishlab chiqish</H3>
      <UL>
        <li>
          Faylni <C>file://</C> orqali emas, HTTP server orqali oching (<C>npx serve</C> yoki{" "}
          <C>python -m http.server</C>).
        </li>
        <li>
          Kalitning domen ro&apos;yxatiga <C>http://localhost:3000</C> yoki ishlatayotgan portingizni
          qo&apos;shing.
        </li>
      </UL>

      <P>
        Ramkalar bilan ishlash (React, Vue, TypeScript, Next.js) —{" "}
        <A href="/docs/integration">Integratsiya</A> bo&apos;limida.
      </P>

      <PrevNext current="/docs/js/quickstart" />
    </div>
  );
}
