import { A, C, Callout, Code, H2, H3, P, PrevNext, UL } from "@/components/docs/parts";

export const metadata = {
  title: "Tezkor start — JavaScript API — OnDexMap",
  description: "5 qadamda saytingizga ishlaydigan OnDexMap xaritasini joylashtiring.",
};

export default function QuickstartPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">Tezkor start</h1>

      <Callout kind="tip">
        <p>
          Boshlashdan oldin <A href="/docs/api#pricing">tariflar</A> bilan tanishib chiqing. Xaritani
          ko'rsatish bepul; REST API chaqiruvlari kalit va limitga bog'liq.
        </p>
      </Callout>

      <H2 id="step1">1-qadam. API kalit oling</H2>
      <P>
        Faqat xarita ko'rsatmoqchi bo'lsangiz bu qadamni o'tkazib yuboring. Qidiruv, marshrut yoki
        ob'ektlar kerak bo'lsa — <A href="/keys">API kalitlar</A> bo'limida{" "}
        <strong className="text-foreground">brauzer</strong> turidagi kalit yarating va sayt domeningizni
        ko'rsating.
      </P>
      <Callout kind="note">
        <p>
          Brauzer kaliti faqat siz ko'rsatgan domenlardan ishlaydi (<C>https://sayt.uz</C>,{" "}
          <C>https://*.sayt.uz</C>). Lokal ishlab chiqish uchun <C>http://localhost:3000</C> ni ham
          qo'shing — aks holda brauzeringizdan kelgan so'rov <C>key_restricted</C> bilan rad etiladi.
        </p>
      </Callout>

      <H2 id="step2">2-qadam. Kutubxonalarni ulang</H2>
      <P>
        Sahifaning <C>&lt;head&gt;</C> qismiga MapLibre GL JS va PMTiles kutubxonalarini qo'shing:
      </P>
      <Code lang="html">{`<head>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js"></script>
</head>`}</Code>
      <P>
        Versiyalarni ATAYLAB qat'iy yozing. Sabab —{" "}
        <A href="/docs/js/general#versions">Umumiy ma'lumot → Versiyalar</A>.
      </P>

      <H2 id="step3">3-qadam. Konteyner yarating</H2>
      <P>
        Xarita joylashadigan blok element qo'shing. Unga <strong className="text-foreground">nolga teng
        bo'lmagan</strong> o'lcham bering — xarita konteynerni to'liq to'ldiradi.
      </P>
      <Code lang="html">{`<body>
  <div id="map" style="width: 600px; height: 400px"></div>
</body>`}</Code>

      <H2 id="step4">4-qadam. Xaritani ishga tushiring</H2>
      <P>
        Avval <C>pmtiles</C> protokolini ro'yxatdan o'tkazing (uslubdagi <C>pmtiles://</C> manzillari shu
        orqali o'qiladi), so'ng xaritani yarating:
      </P>
      <Code lang="js">{`<script>
  // PMTiles protokoli — usiz uslubdagi tile manbalari yuklanmaydi
  maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);

  const map = new maplibregl.Map({
    container: "map",
    style: "https://maps.ondex.uz/tiles/style.json",
    center: [71.2394, 41.0004], // [lng, lat] — Chust
    zoom: 13,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");
</script>`}</Code>
      <Callout kind="note">
        <p>
          Koordinata tartibi MapLibre'da <C>[lng, lat]</C> — ya'ni avval uzunlik, keyin kenglik. Bizning
          REST API esa <C>lat</C> va <C>lng</C> ni alohida maydon sifatida qaytaradi, shuning uchun
          markerga berayotganda tartibni almashtirishni unutmang.
        </p>
      </Callout>

      <H2 id="step5">5-qadam (ixtiyoriy). Qidiruvni ulang</H2>
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
        Javob shakli va boshqa endpointlar — <A href="/docs/api#geocode">REST API</A> bo'limida.
      </P>

      <H2 id="full">To'liq misol</H2>
      <P>Quyidagi faylni brauzerda ochsangiz, ishlaydigan xaritani ko'rasiz:</P>
      <Code lang="html">{`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <title>OnDexMap — tezkor start</title>
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

      <H3 id="local">Lokal ishlab chiqish</H3>
      <UL>
        <li>
          Faylni <C>file://</C> orqali emas, HTTP server orqali oching (<C>npx serve</C> yoki{" "}
          <C>python -m http.server</C>) — aks holda brauzer xavfsizlik siyosati tufayli ba'zi so'rovlarni
          bloklaydi.
        </li>
        <li>
          Kalitning domen ro'yxatiga <C>http://localhost:3000</C> (yoki ishlatayotgan portingizni) qo'shing.
        </li>
      </UL>

      <PrevNext current="/docs/js/quickstart" />
    </div>
  );
}
