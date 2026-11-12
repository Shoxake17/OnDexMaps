import {
  A,
  C,
  Callout,
  Code,
  H2,
  P,
  PageHead,
  Panel,
  ParamTable,
  PrevNext,
  Split,
  Tabs,
  Terminal,
} from "@/components/docs/parts";
import { NpmMark, TsMark } from "@/components/docs/art";

export const metadata = {
  title: "SDK — Xarita — OnDexMap",
  description:
    "createMap(): OnDexMap xaritasini SDK bilan yaratish. Atribut avtomatik to'g'ri qo'yiladi.",
};

export default function SdkXaritaPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="SDK — Xarita"
        desc="createMap() xaritani to'g'ri sozlab yaratadi: uslub, PMTiles protokoli va atribut yorlig'i o'z joyida bo'ladi."
        pills={[
          { href: "#boshlash", label: "Boshlash", icon: <NpmMark size={15} /> },
          { href: "#parametrlar", label: "Parametrlar", icon: <TsMark size={15} /> },
          { href: "#atribut", label: "Atribut", icon: <TsMark size={15} /> },
        ]}
      />

      <H2 id="boshlash">Boshlash</H2>
      <Tabs
        files={[
          {
            name: "map.js",
            code: `import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { createMap } from "@ondexmap/sdk";
import "maplibre-gl/dist/maplibre-gl.css";

const map = createMap({
  container: "map",
  maplibregl,
  pmtilesProtocol: new Protocol().tile,
  center: [69.2401, 41.2995],
  zoom: 12,
});

// \`map\` — maplibre'ning O'Z Map obyekti: hamma metodi joyida.
map.on("moveend", () => console.log(map.getBounds()));`,
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
  <script type="module" src="/map.js"></script>
</body>
</html>`,
          },
        ]}
      />
      <P>
        <C>maplibregl</C> parametr sifatida beriladi, SDK uni o&apos;zi import qilmaydi. Shuning
        uchun paket versiyasini <b>siz</b> boshqarasiz va SDK&apos;ning REST qismini
        maplibre&apos;siz ishlatish mumkin.
      </P>

      <Callout kind="note">
        <p>
          <C>createMap</C> siz bergan <C>maplibregl.Map</C> turini qaytaradi — <C>map.on</C>,{" "}
          <C>map.getBounds</C>, <C>map.addLayer</C> va qolgan hammasi TypeScript&apos;da ham
          ko&apos;rinadi.
        </p>
      </Callout>

      <H2 id="parametrlar">Parametrlar</H2>
      <ParamTable
        rows={[
          {
            name: "container",
            required: true,
            children: (
              <>
                Xarita joylashadigan element yoki uning <C>id</C>&apos;si. Balandligi noldan katta
                bo&apos;lishi shart.
              </>
            ),
          },
          {
            name: "maplibregl",
            required: true,
            children: (
              <>
                <C>import * as maplibregl from &quot;maplibre-gl&quot;</C> natijasi (v6 da default eksport yo&apos;q).
              </>
            ),
          },
          {
            name: "pmtilesProtocol",
            children: (
              <>
                <C>new Protocol().tile</C>. Berilmasa uslubdagi <C>pmtiles://</C> manbalari
                yuklanmaydi va xarita bo&apos;sh qoladi.
              </>
            ),
          },
          {
            name: "center",
            children: (
              <>
                <C>[lng, lat]</C>. Standart — Toshkent, <C>[69.2401, 41.2995]</C>.
              </>
            ),
          },
          { name: "zoom", children: <>Standart 12.</> },
          {
            name: "style",
            children: (
              <>
                Uslub manzili. Standart — <C>https://maps.ondex.uz/tiles/style.json</C>.
              </>
            ),
          },
          {
            name: "attributionPosition",
            children: (
              <>
                Atribut yorlig&apos;ining burchagi. Standart <C>bottom-right</C>.
              </>
            ),
          },
          {
            name: "customAttribution",
            children: <>Kredit yoniga qo&apos;shiladigan o&apos;z brendingiz.</>,
          },
          {
            name: "navigationControl",
            children: (
              <>
                Yaqinlashtirish tugmalari. Standart — qo&apos;shiladi. <C>false</C> bilan
                o&apos;chiriladi.
              </>
            ),
          },
          {
            name: "mapOptions",
            children: (
              <>
                Qolgan <C>maplibregl.Map</C> parametrlari. Bu yerdagi{" "}
                <C>attributionControl</C> e&apos;tiborga <b>olinmaydi</b> — pastga qarang.
              </>
            ),
          },
        ]}
      />

      <H2 id="atribut">Atribut — majburiy va o&apos;chirilmaydi</H2>
      <Split>
        <div>
          <P>
            <C>createMap</C> atribut yorlig&apos;ini o&apos;zi qo&apos;yadi va uni o&apos;chirib
            bo&apos;lmaydi. Bu ataylab: kredit ODbL litsenziyasining va{" "}
            <A href="/shartlar">foydalanish shartlarining</A> talabi.
          </P>
          <P>
            Yorliq <C>compact: false</C> bilan qo&apos;yiladi. Usiz MapLibre 640px dan tor ekranda
            yorliqni yig&apos;adi va foydalanuvchi xaritani birinchi surishida kredit «i» tugmasi
            ortida yo&apos;qoladi — buni hujjatni sinash paytida o&apos;lchab ko&apos;rdik.
          </P>
          <Code lang="js">{`// Bu ishlamaydi — atribut baribir qo'shiladi:
createMap({
  container: "map",
  maplibregl,
  mapOptions: { attributionControl: false },
});`}</Code>
        </div>
        <div>
          <Panel label="O'z brendingiz">
            <p className="text-sm text-muted">
              Kredit yoniga o&apos;z yozuvingizni qo&apos;shish mumkin — uni almashtirish emas:
            </p>
            <Code lang="js">{`createMap({
  container: "map",
  maplibregl,
  customAttribution: "© Mening Kompaniyam",
});`}</Code>
          </Panel>
          <Callout kind="warn">
            <p>
              Atribut yorlig&apos;i HTML sifatida joylashtiriladi va MapLibre uni sanitizatsiya
              qilmaydi. SDK <C>customAttribution</C>&apos;ni tekshiradi: skript, <C>on…=</C>{" "}
              hodisasi yoki <C>javascript:</C> uchrasa xato tashlaydi.{" "}
              <b>Bu qiymatni foydalanuvchi kiritmasidan olmang.</b>
            </p>
          </Callout>
        </div>
      </Split>

      <H2 id="tekshirish">Ishlayotganini tekshirish</H2>
      <P>
        Xarita oq qolsa, sabab deyarli doim shu uchtadan biri bo&apos;ladi:
      </P>
      <Terminal>{`# 1. Konteyner balandligi nolga teng emasmi
document.getElementById("map").getBoundingClientRect()

# 2. Uslub yuklandimi
curl -I https://maps.ondex.uz/tiles/style.json

# 3. pmtiles protokoli ro'yxatdan o'tganmi
#    (createMap'ga pmtilesProtocol berilmagan bo'lsa — yo'q)`}</Terminal>
      <Callout kind="warn">
        <p>
          SDK 0.2.0 <C>peerDependencies</C>&apos;da <C>maplibre-gl ^6.18.0</C> talab qiladi: 6.4.0
          va undan eski versiyalarda kritik XSS zaifligi bor (GHSA-jrc7-96c5-q579). MapLibre 6
          WebGL2 talab qiladi — u yo&apos;q brauzerda <C>createMap</C> xato beradi, uni ushlab
          foydalanuvchiga xabar ko&apos;rsating. Next.js (Turbopack) da ishchi faylni{" "}
          <C>setWorkerUrl</C> bilan bering (SDK README&apos;siga qarang).
        </p>
      </Callout>

      <PrevNext current="/docs/sdk/xarita" />
    </div>
  );
}
