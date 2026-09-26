import { A, C, Callout, Code, H2, H3, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { BoltIcon, PlugIcon, ServerIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Umumiy ma'lumot — JavaScript API — OnDexMap",
  description:
    "OnDexMap JavaScript API qanday qurilgan: arxitektura, versiyalar, endpointlar, kalit, limitlar va Map obyektlari.",
};

export default function GeneralPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Umumiy ma'lumot"
        desc="JavaScript API nimadan iborat, qaysi manzillardan foydalanadi, qaysi versiyalar qo'llab-quvvatlanadi va qanday obyektlar bilan ishlaydi."
        pills={[
          { href: "/docs/js/quickstart", label: "Quick Start", icon: <BoltIcon size={15} /> },
          { href: "/docs/integration", label: "Integratsiya", icon: <PlugIcon size={15} /> },
          { href: "/docs/api", label: "REST API", icon: <ServerIcon size={15} /> },
        ]}
      />

      <H2 id="arxitektura">Arxitektura</H2>
      <P>JavaScript API uch qismdan tashkil topgan:</P>
      <UL>
        <li>
          <strong className="text-foreground">MapLibre GL JS</strong> — xaritani chizadigan ochiq kutubxona
          (WebGL). Xarita obyekti, qatlamlar, markerlar, hodisalar — hammasi uning API&apos;si.
        </li>
        <li>
          <strong className="text-foreground">PMTiles</strong> — bitta faylda saqlanadigan vektor tile
          formati. Brauzer faqat kerakli baytlarni <C>Range</C> so&apos;rovi bilan oladi.
        </li>
        <li>
          <strong className="text-foreground">OnDexMap xarita ma&apos;lumoti</strong> — <C>style.json</C>,
          shriftlar va O&apos;zbekiston bo&apos;yicha vektor tile&apos;lar.
        </li>
      </UL>
      <Callout kind="note">
        <p>
          MapLibre GL JS hujjatlaridagi misollar OnDexMap bilan ham ishlaydi — farq faqat <C>style</C>{" "}
          manzilida.
        </p>
      </Callout>

      <H2 id="versiyalar">Versiyalar</H2>
      <Code lang="terminal">{`maplibre-gl  4.7.1
pmtiles      3.2.1`}</Code>
      <Callout kind="warn">
        <p>
          Qo&apos;llab-quvvatlanadigan versiya —{" "}
          <strong className="text-foreground">MapLibre GL JS 4.7.x</strong>. 6-versiya WebGL2&apos;ni
          majburiy talab qiladi va uni qo&apos;llab-quvvatlamaydigan qurilmalarda xarita xato xabarisiz oq
          qoladi.
        </p>
      </Callout>
      <P>
        Versiyalarni <C>^</C> belgisisiz, qat&apos;iy yozing — shunda <C>package-lock.json</C> ularni
        qulflaydi.
      </P>

      <H2 id="endpointlar">API endpointlar</H2>
      <Table
        head={["Manzil", "Nima uchun", "Kalit"]}
        rows={[
          [
            <code key="1" className="font-mono text-xs text-brand">
              /tiles/style.json
            </code>,
            "Xarita uslubi: qatlamlar, ranglar, tile manbalari",
            "kerak emas",
          ],
          [
            <code key="2" className="font-mono text-xs text-brand">
              /fonts/{"{fontstack}"}/{"{range}"}.pbf
            </code>,
            "Yozuvlar uchun shriftlar",
            "kerak emas",
          ],
          [
            <code key="3" className="font-mono text-xs text-brand">
              /v2/…
            </code>,
            "REST API: geocode, reverse, directions, places",
            "kerak",
          ],
        ]}
      />
      <Code lang="terminal">{`Uslub:      https://maps.ondex.uz/tiles/style.json
Shriftlar:  https://maps.ondex.uz/fonts/{fontstack}/{range}.pbf
REST API:   https://maps.ondex.uz/v2/...`}</Code>
      <P>
        Uslub fayli tile manbalarini o&apos;zi ko&apos;rsatadi (<C>pmtiles://</C> sxemasi bilan) — ularni
        qo&apos;lda yozish shart emas.
      </P>

      <H2 id="kalit">API kalit</H2>
      <P>
        Xaritaning o&apos;zini ko&apos;rsatish uchun kalit talab qilinmaydi. Kalit{" "}
        <A href="/docs/api">REST API</A> chaqiruvlari uchun kerak — qidiruv, manzil aniqlash, marshrut va
        ob&apos;ektlar.
      </P>
      <P>
        Brauzerdan chaqirilganda <strong className="text-foreground">brauzer kaliti</strong> ishlatiladi:
        yaratishda ruxsat etilgan domenlar ko&apos;rsatiladi va kalit faqat o&apos;sha domenlardan qabul
        qilinadi. Server kaliti sahifa kodiga joylashtirilmaydi — u ochiq ko&apos;rinadi. Batafsil —{" "}
        <A href="/docs/security/keys">API kalitlar</A>.
      </P>

      <H2 id="limitlar">Limitlar</H2>
      <Table
        head={["Nima", "Qamrov"]}
        rows={[
          [
            <>
              Xarita tile&apos;lari, <C>/v2/geocode</C>, <C>/v2/places</C>
            </>,
            "Butun O'zbekiston",
          ],
          [
            <>
              <C>/v2/reverse</C>, <C>/v2/directions</C>
            </>,
            "40.5–41.6° shimol, 70.5–72.0° sharq",
          ],
        ]}
      />
      <P>
        Xizmat hududidan tashqaridagi koordinata <C>INVALID_REQUEST</C> qaytaradi. So&apos;rov tezligi va
        oylik chegara tarifga bog&apos;liq — <A href="/docs/billing/plans">Tariflar</A>.
      </P>
      <Callout kind="note">
        <p>
          Xaritani ma&apos;lum hudud bilan cheklash uchun <C>maxBounds</C> parametridan foydalaning.
          O&apos;zbekiston uchun: <C>[[55.5, 37.0], [73.5, 45.8]]</C>.
        </p>
      </Callout>

      <H2 id="obyektlar">Map obyektlari</H2>
      <Table
        head={["Obyekt", "Vazifasi"]}
        rows={[
          [<C key="1">Map</C>, "Xaritaning o'zi: markaz, masshtab, hodisalar, boshqaruv"],
          [<C key="2">Source</C>, "Ma'lumot manbasi: vektor tile, GeoJSON, tasvir"],
          [<C key="3">Layer</C>, "Chizish qatlami: manbadagi ma'lumot qanday ko'rinishi"],
          [<C key="4">Marker</C>, "Koordinataga bog'langan HTML element"],
          [<C key="5">Popup</C>, "Marker yoki nuqta ustida ochiladigan oyna"],
          [
            <>
              <C>NavigationControl</C>, <C>ScaleControl</C>
            </>,
            "Masshtab tugmalari va masshtab chizg'ichi",
          ],
        ]}
      />

      <H3 id="obyektlar-misol">Manba va qatlam qo&apos;shish</H3>
      <Code lang="js">{`map.on("load", () => {
  map.addSource("topilganlar", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "topilganlar-nuqta",
    type: "circle",
    source: "topilganlar",
    paint: { "circle-radius": 6, "circle-color": "#f97316" },
  });
});

// Keyinchalik ma'lumotni almashtirish
map.getSource("topilganlar").setData(yangiGeoJSON);`}</Code>

      <H3 id="obyektlar-hodisalar">Hodisalar</H3>
      <Code lang="js">{`map.on("click", (e) => {
  console.log(e.lngLat.lat.toFixed(5), e.lngLat.lng.toFixed(5));
});

map.on("moveend", () => {
  const c = map.getCenter();
  console.log("markaz:", c.lat, c.lng, "zoom:", map.getZoom());
});

// Qatlam ustiga bosish
map.on("click", "topilganlar-nuqta", (e) => {
  const f = e.features[0];
  new maplibregl.Popup()
    .setLngLat(f.geometry.coordinates)
    .setText(f.properties.name)
    .addTo(map);
});`}</Code>

      <PrevNext current="/docs/js/general" />
    </div>
  );
}
