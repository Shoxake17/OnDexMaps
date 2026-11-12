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
      <Code lang="terminal">{`maplibre-gl  6.18.0
pmtiles      4.5.0`}</Code>
      <Callout kind="warn">
        <p>
          Qo&apos;llab-quvvatlanadigan versiya —{" "}
          <strong className="text-foreground">MapLibre GL JS 6.18 va yangilari</strong>. 6.4.0 va undan
          eski versiyalarda kritik XSS zaifligi bor (
          <A href="https://github.com/advisories/GHSA-jrc7-96c5-q579">GHSA-jrc7-96c5-q579</A>) — ularni
          ishlatmang.
        </p>
        <p className="mt-2">
          MapLibre 6 — ES modul (<C>import * as maplibregl</C>, default eksport yo&apos;q) va WebGL2 talab
          qiladi. WebGL2 yo&apos;q brauzerda <C>new maplibregl.Map</C> xato beradi — uni ushlab,
          foydalanuvchiga tushunarli xabar ko&apos;rsating (oq ekran qoldirmang).
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

      <H2 id="atribut">Atribut — majburiy</H2>
      <P>
        Xaritani ko&apos;rsatgan har qanday ekranda OnDexMap krediti va ma&apos;lumot
        manbalarining kreditlari <strong className="text-foreground">ko&apos;rinib turishi shart</strong>.
        Bu ham foydalanish shartlarining, ham ma&apos;lumot litsenziyasining talabi.
      </P>
      <Code lang="terminal">{`© OnDexMap · Bino konturlari © Microsoft · © OpenStreetMap`}</Code>
      <P>
        Yozuvning barcha qismlari{" "}
        <A href="https://maps.ondex.uz/copyright">maps.ondex.uz/copyright</A> sahifasiga olib
        boradi — u yerda manbalar, litsenziyalar, ommaviy oferta, maxfiylik siyosati va SLA
        havolalari to&apos;liq yig&apos;ilgan.
      </P>
      <P>
        Uslub faylida atribut allaqachon yozilgan — kutubxona uni o&apos;zi chiqaradi. Lekin
        standart sozlama <strong className="text-foreground">tor ekranda yetarli emas</strong>:
        MapLibre kengligi 640px dan kichik xaritada yorliqni yig&apos;adi va foydalanuvchi
        xaritani birinchi marta surganda uni «i» tugmasi ortiga yashiradi. Shuning uchun{" "}
        <C>compact: false</C> ni ochiq yozing:
      </P>
      <Code lang="js">{`const map = new maplibregl.Map({
  container: "map",
  style: "https://maps.ondex.uz/tiles/style.json",
  attributionControl: false,   // standart yorliq o'rniga...
});

// ...yig'ilmaydigan yorliq. Atribut matni uslubdan keladi.
map.addControl(
  new maplibregl.AttributionControl({ compact: false }),
  "bottom-right",
);`}</Code>
      <Callout kind="warn">
        <p>
          Haqiqiy brauzerda o&apos;lchangan (xarita 420px kenglikda):
        </p>
        <Table
          head={["Sozlama", "Boshida", "Foydalanuvchi surganidan keyin"]}
          rows={[
            [<C key="a">compact: false</C>, "ko'rinadi", "ko'rinadi"],
            [<C key="b">compact</C>, "ko'rinadi", "YASHIRINADI"],
            [<C key="c">compact: true</C>, "ko'rinadi", "YASHIRINADI"],
          ]}
        />
        <p className="mt-2">
          Kengligi 640px dan katta xaritada <C>compact</C> berilmasa yorliq yig&apos;ilmaydi —
          shuning uchun muammo faqat telefonda ko&apos;rinadi va kompyuterda sinaganda
          sezilmaydi.
        </p>
      </Callout>
      <Table
        head={["Mumkin", "Mumkin emas"]}
        rows={[
          [
            "Joyini boshqa burchakka ko'chirish",
            "Yozuvni butunlay o'chirish",
          ],
          [
            "Yoniga o'z brendingizni qo'shish",
            <>
              <C key="c">compact: true</C> — surilganda «i» tugmasi ortiga yashiradi
            </>,
          ],
          ["Shrift o'lchami va rangini moslashtirish", "CSS bilan yashirish yoki shaffof qilish"],
          [
            "O'qilishi uchun oq halo (text-shadow) qo'shish",
            "O'qib bo'lmaydigan darajada kichraytirish",
          ],
          [
            "Fon va ramka rangini mavzuyingizga moslash",
            <>
              <C key="x">attributionControl: false</C> yozib qaytarmaslik
            </>,
          ],
        ]}
      />
      <Callout kind="warn">
        <p>
          Atributni olib tashlash — foydalanish shartlarining buzilishi va{" "}
          <strong className="text-foreground">API kaliti bekor qilinishiga</strong> olib keladi.
          Ko&apos;rinishini o&apos;zgartirish kerak bo&apos;lsa —{" "}
          <A href="#brend">pastdagi bo&apos;limga</A> qarang: yorliqni o&apos;chirish emas, uni
          o&apos;z joyingizga ko&apos;chirish kerak.
        </p>
      </Callout>
      <Callout kind="note">
        <p>
          Texnik jihatdan brauzerdagi istalgan elementni o&apos;chirish mumkin — bu barcha xarita
          xizmatlarida shunday. Shuning uchun talab shartnoma darajasida: kalit sizning
          hisobingizga bog&apos;langan va shart buzilsa u to&apos;xtatiladi.
        </p>
      </Callout>

      <H3 id="brend">O&apos;z brendingiz bilan</H3>
      <P>
        Yorliqni boshqa burchakka ko&apos;chirib, yoniga o&apos;z nomingizni qo&apos;yishingiz
        mumkin. Atribut matni saqlanib qoladi:
      </P>
      <Code lang="js">{`const map = new maplibregl.Map({
  container: "map",
  style: "https://maps.ondex.uz/tiles/style.json",
  attributionControl: false,   // standart yorliq o'chiriladi
});

// ...va o'rniga o'zimiznikini qo'shamiz. Uslubdagi atribut MATNI
// baribir chiqadi — faqat ko'rinishi va joyi o'zgaradi.
map.addControl(
  new maplibregl.AttributionControl({
    // ⚠️ compact: false — SHART. \`true\` bo'lsa yorliq boshida
    // ko'rinadi, lekin foydalanuvchi xaritani surishi bilan «i»
    // tugmasi ortiga yig'iladi va OnDexMap krediti yo'qoladi.
    compact: false,
    customAttribution: "© Mening Kompaniyam",
  }),
  "bottom-left",
);`}</Code>
      <Callout kind="note">
        <p>
          <C>AttributionControl</C> uslubdagi <C>attribution</C> maydonlarini{" "}
          <C>customAttribution</C> bilan BIRGA ko&apos;rsatadi. Ya&apos;ni o&apos;z brendingizni
          qo&apos;shish mavjud kreditlarni o&apos;chirmaydi.
        </p>
        <p className="mt-2">
          <C>customAttribution</C> ro&apos;yxat <strong className="text-foreground">boshiga</strong>{" "}
          qo&apos;shiladi — sizning nomingiz OnDexMap kreditidan oldin turadi.
        </p>
      </Callout>
      <Callout kind="warn">
        <p>
          <C>customAttribution</C> ga{" "}
          <strong className="text-foreground">foydalanuvchi matnini qo&apos;ymang</strong>. MapLibre
          bu satrni HTML sifatida kiritadi. 6.18+ uni tozalaydi, lekin 6.4.0 gacha bu himoya chetlab
          o&apos;tilgan va <C>&lt;img onerror=...&gt;</C> ishlab ketgan (
          <A href="https://github.com/advisories/GHSA-jrc7-96c5-q579">GHSA-jrc7-96c5-q579</A>) —
          sanitizatorga yolg&apos;iz tayanmang.
        </p>
        <p className="mt-2">
          Faqat kodda yozilgan, sobit matn bering. Nomni ma&apos;lumotlar bazasidan yoki URL
          parametridan olayotgan bo&apos;lsangiz — avval HTML belgilarini ekranlang.
        </p>
      </Callout>

      <H2 id="masshtab">Nima qaysi masshtabda ko&apos;rinadi</H2>
      <P>
        Uslubdagi yozuv va chiziq qatlamlari masshtabga bog&apos;langan — bu xaritani tartibli
        saqlaydi. Agar «yozuvlar yo&apos;q» bo&apos;lib tuyulsa, birinchi navbatda masshtabni
        tekshiring:
      </P>
      <Table
        head={["Nima", "Qaysi masshtabdan", "Qatlam"]}
        rows={[
          [
            "Viloyat va tuman chegaralari",
            "hamma masshtabda",
            <C key="1">boundary</C>,
          ],
          ["Shahar, qishloq, mahalla nomlari", "z6+", <C key="2">place-label</C>],
          ["Yirik ob'ektlar", "z12+", <C key="3">poi-tier1</C>],
          ["Binolar", "z13+", <C key="4">ms-building-flat</C>],
          ["Ko'cha nomlari", "z14+", <C key="5">road-label</C>],
          ["O'rta ob'ektlar", "z14+ / z15+", <>
            <C>poi-tier2</C>, <C>poi-tier3</C>
          </>],
          ["3D binolar", "z15+", <C key="6">ms-building-3d</C>],
          ["Uy raqamlari", "z16+", <C key="7">housenumber</C>],
          ["Mayda ob'ektlar", "z16.5+", <C key="8">poi-tier4</C>],
        ]}
      />
      <Callout kind="tip">
        <p>
          Demo yoki skrinshot uchun <strong className="text-foreground">z14–z16</strong> oraliq eng
          to&apos;liq ko&apos;rinishni beradi. z13 da xarita deyarli bo&apos;sh tuyuladi: binolar
          endi paydo bo&apos;ladi, ko&apos;cha nomlari esa hali yo&apos;q.
        </p>
      </Callout>

      <H2 id="ozqatlam">O&apos;z qatlamingizni qo&apos;shish</H2>
      <P>
        Xaritaga o&apos;z ma&apos;lumotingizni qo&apos;shganda yozuv chiqishi uchun{" "}
        <C>text-font</C> uslubdagi shriftlardan biri bo&apos;lishi SHART. OnDexMap uslubida ikkitasi
        bor:
      </P>
      <Code lang="json">{`"text-font": ["Noto Sans Regular"]
"text-font": ["Noto Sans Bold"]`}</Code>
      <Callout kind="warn">
        <p>
          Boshqa nom yozilsa (masalan <C>Open Sans Regular</C>) gliflar 404 qaytaradi va{" "}
          <strong className="text-foreground">yozuv umuman chizilmaydi</strong> — qatlam esa xatosiz
          qo&apos;shilaveradi, shuning uchun sabab darhol ko&apos;rinmaydi.
        </p>
      </Callout>
      <Code lang="js">{`map.addSource("mening-nuqtalarim", { type: "geojson", data: fc });

map.addLayer({
  id: "mening-nomlarim",
  type: "symbol",
  source: "mening-nuqtalarim",
  minzoom: 12,
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
  },
  paint: {
    "text-color": "#9a3412",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.6,
  },
});`}</Code>
      <P>
        Qatlam tartibi ham muhim: <C>addLayer</C> ning ikkinchi argumenti sifatida mavjud qatlam{" "}
        <C>id</C> sini bersangiz, yangi qatlam o&apos;shaning OSTIGA qo&apos;yiladi. Poligon
        qatlamlarini yozuvlar ostiga tushirish uchun shu kerak:
      </P>
      <Code lang="js">{`const birinchiYozuv = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
map.addLayer({ id: "mening-fonim", type: "fill", source: "…", paint: { … } }, birinchiYozuv);`}</Code>

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

// Ma'lumotni keyin almashtirish. ⚠️ Bu qatorni yuqori darajada
// (skript tanasida) YOZMANG: manba faqat \`load\` dan KEYIN mavjud
// bo'ladi va undan oldin \`getSource\` \`undefined\` qaytarib,
// "Cannot read properties of undefined" xatosini beradi.
function natijalarniKorsat(yangiGeoJSON) {
  const manba = map.getSource("topilganlar");
  if (!manba) return;           // xarita hali yuklanmagan
  manba.setData(yangiGeoJSON);
}`}</Code>

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
