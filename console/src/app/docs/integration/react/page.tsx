import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, Tabs, Terminal, UL } from "@/components/docs/parts";
import { NextMark, ReactMark, TsMark } from "@/components/docs/art";

export const metadata = {
  title: "React integratsiyasi — OnDexMap",
  description: "OnDexMap xaritasini React ilovasida to'g'ri ulash: hayotiy tsikl, markerlar va hodisalar.",
};

export default function ReactPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="React integratsiyasi"
        desc="Xarita DOM elementi bilan ishlaydi, shuning uchun u useEffect ichida bir marta yaratiladi va komponent yo'q qilinganda map.remove() bilan tozalanadi."
        pills={[
          { href: "#komponent", label: "Komponent", icon: <ReactMark size={15} /> },
          { href: "/docs/integration/nextjs", label: "Next.js", icon: <NextMark size={15} /> },
          { href: "/docs/integration/typescript", label: "TypeScript", icon: <TsMark size={15} /> },
        ]}
      />

      <H2 id="ornatish">O&apos;rnatish</H2>
      <Terminal>{`npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Terminal>

      <H2 id="komponent">OnDexMap komponenti</H2>
      <Tabs
        files={[
          {
            name: "OnDexMap.jsx",
            code: `import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

// Protokol BIR MARTA, modul darajasida ro'yxatdan o'tadi.
maplibregl.addProtocol("pmtiles", new Protocol().tile);

export default function OnDexMap({ center = [69.2401, 41.2995], zoom = 12 }) {
  const container = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    map.current = new maplibregl.Map({
      container: container.current,
      style: "https://maps.ondex.uz/tiles/style.json",
      center,
      zoom,
      attributionControl: false,   // o'rniga pastdagisi qo'shiladi
    });
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    // \`compact: false\` SHART: usiz MapLibre 640px dan tor xaritada
    // yorliqni yig'adi va surilganda OnDexMap krediti yo'qoladi.
    map.current.addControl(
      new maplibregl.AttributionControl({ compact: false }),
      "bottom-right",
    );

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={container} style={{ width: "100%", height: "400px" }} />;
}`,
          },
          {
            name: "App.jsx",
            code: `import OnDexMap from "./OnDexMap";

export default function App() {
  return (
    <main>
      <h1>Xarita</h1>
      <OnDexMap center={[71.2394, 41.0004]} zoom={13} />
    </main>
  );
}`,
          },
        ]}
      />
      <Callout kind="warn">
        <p>
          React <C>StrictMode</C> ishlab chiqish rejimida effektni ikki marta ishga tushiradi. Bu
          yerda <strong className="text-foreground">tozalash funksiyasi</strong> hamma narsani hal
          qiladi: birinchi xarita <C>remove()</C> bilan o&apos;chiriladi, so&apos;ng ikkinchisi
          yaratiladi.
        </p>
        <p className="mt-2">
          Ya&apos;ni ishlab chiqishda xarita{" "}
          <strong className="text-foreground">haqiqatan ikki marta</strong> yaratiladi (o&apos;lchandi:
          2 ta yaratish, 1 ta o&apos;chirish, ekranda 1 ta canvas). Bu normal va sizib ketish emas;
          production build&apos;da bir marta yaratiladi.
        </p>
        <p className="mt-2">
          <C>if (map.current) return</C> kabi qo&apos;riqchi bu yerda{" "}
          <strong className="text-foreground">ishlamaydi</strong>: tozalash <C>map.current</C> ni{" "}
          <C>null</C> qilib qo&apos;yadi, shuning uchun ikkinchi chaqiruvda shart baribir
          bajarilmaydi. Duplikatni qo&apos;riqchi emas, <C>remove()</C> to&apos;xtatadi.
        </p>
      </Callout>

      <H2 id="hayot">Xarita hayoti</H2>
      <UL>
        <li>
          <strong className="text-foreground">Yaratish</strong> — faqat konteyner DOM&apos;da paydo
          bo&apos;lgandan keyin, ya&apos;ni <C>useEffect</C> ichida.
        </li>
        <li>
          <strong className="text-foreground">Yangilash</strong> — <C>setState</C> emas, xarita metodlari:{" "}
          <C>map.flyTo()</C>, <C>map.setZoom()</C>, <C>map.setStyle()</C>.
        </li>
        <li>
          <strong className="text-foreground">Tozalash</strong> — <C>map.remove()</C>. Bu bajarilmasa
          WebGL konteksti ochiq qoladi va bir necha marta almashgandan keyin brauzer xaritani chizishni
          to&apos;xtatadi.
        </li>
      </UL>
      <Table
        head={["Prop o'zgarsa", "Nima qilish kerak"]}
        rows={[
          [
            <C key="1">center</C>,
            <>
              <C>map.flyTo({"{ center }"})</C> — xaritani qayta yaratmang
            </>,
          ],
          [
            <C key="2">zoom</C>,
            <>
              <C>map.setZoom(zoom)</C>
            </>,
          ],
          [<C key="3">joylar</C>, "markerlarni alohida effektda qayta chizing"],
        ]}
      />
      <Code lang="jsx">{`// Prop o'zgarganda xaritani SURISH (qayta yaratmaslik).
//
// ⚠️ Bog'liqlik ro'yxatida \`center\` MASSIVINING o'zi EMAS, uning
// QIYMATLARI turadi. \`<OnDexMap center={[71.2394, 41.0004]} />\` har
// renderda YANGI massiv yaratadi va React uni o'zgargan deb biladi —
// natijada har renderda \`flyTo\` ishlaydi va foydalanuvchi surgan
// xarita boshlang'ich nuqtaga qaytib ketaveradi.
useEffect(() => {
  map.current?.flyTo({ center, zoom });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [center[0], center[1], zoom]);`}</Code>
      <Callout kind="warn">
        <p>
          Bu eng ko&apos;p uchraydigan xato va uni sezish qiyin: xarita{" "}
          <strong className="text-foreground">ishlaydi</strong>, lekin foydalanuvchi uni surganda
          bir necha soniyadan keyin o&apos;zi orqaga qaytadi.
        </p>
        <p className="mt-2">
          O&apos;lchangan misol: ota komponent 5 marta qayta render bo&apos;lganda{" "}
          <C>[center, zoom]</C> bilan <C>flyTo</C> 7 marta chaqirildi — holbuki na <C>center</C>,
          na <C>zoom</C> o&apos;zgargan edi.
        </p>
        <p className="mt-2">
          Muqobil yechim — ota komponentda <C>useMemo</C> bilan massivni barqaror qilish yoki{" "}
          <C>center</C> o&apos;rniga <C>lng</C> va <C>lat</C> ni alohida prop qilib uzatish.
        </p>
      </Callout>

      <H2 id="markerlar">Markerlar</H2>
      <P>Markerlar ham tozalanadi — aks holda ular xaritada to&apos;planib qoladi:</P>
      <Callout kind="note">
        <p>
          <C>joylar</C> ham massiv, ya&apos;ni yuqoridagi tuzoq bu yerga ham tegishli. Uni{" "}
          <C>useState</C> yoki <C>useMemo</C> da saqlang; JSX ichida{" "}
          <C>joylar={"{[...]}"}</C> deb yozsangiz markerlar har renderda o&apos;chirilib qayta
          chiziladi.
        </p>
      </Callout>
      <Code lang="jsx">{`useEffect(() => {
  if (!map.current || joylar.length === 0) return;

  const markerlar = joylar.map((j) =>
    new maplibregl.Marker()
      .setLngLat([j.lng, j.lat])
      .setPopup(new maplibregl.Popup().setText(j.name))
      .addTo(map.current),
  );

  return () => markerlar.forEach((m) => m.remove());
}, [joylar]);`}</Code>

      <H2 id="hodisalar">Hodisalar</H2>
      <P>
        Hodisa tinglovchilari xarita bilan birga qo&apos;shiladi va komponent yo&apos;q qilinganda olib
        tashlanadi:
      </P>
      <Callout kind="warn">
        <p>
          <strong className="text-foreground">Tartib muhim.</strong> React effektlarni yozilish
          tartibida ishga tushiradi, shuning uchun bu effekt xarita yaratadigan effektdan{" "}
          <strong className="text-foreground">KEYIN</strong> turishi kerak. Yuqoriga qo&apos;ysangiz{" "}
          <C>map.current</C> hali <C>null</C> bo&apos;ladi, <C>if (!m) return</C> ishlaydi va
          tinglovchilar <strong className="text-foreground">hech qachon ulanmaydi</strong> — xato
          ham, ogohlantirish ham chiqmaydi.
        </p>
      </Callout>
      <Code lang="jsx">{`useEffect(() => {
  const m = map.current;
  if (!m) return;

  const onClick = (e) => {
    const { lng, lat } = e.lngLat;
    console.log("bosilgan nuqta:", lat.toFixed(5), lng.toFixed(5));
  };
  const onMoveEnd = () => {
    const c = m.getCenter();
    console.log("markaz:", c.lat.toFixed(5), c.lng.toFixed(5), "zoom:", m.getZoom());
  };

  m.on("click", onClick);
  m.on("moveend", onMoveEnd);

  return () => {
    m.off("click", onClick);
    m.off("moveend", onMoveEnd);
  };
}, []);`}</Code>

      <H2 id="qidiruv">Qidiruv bilan</H2>
      <P>
        Brauzer kaliti komponent kodida ko&apos;rinadi — u domen ro&apos;yxati bilan cheklanadi (
        <A href="/docs/security/domains">Domain restrictions</A>). Server kaliti kerak bo&apos;lsa
        so&apos;rovni o&apos;z backend&apos;ingiz orqali o&apos;tkazing.
      </P>
      <Code lang="jsx">{`const [natijalar, setNatijalar] = useState([]);

async function qidir(matn) {
  const res = await fetch(
    \`https://maps.ondex.uz/v2/geocode?q=\${encodeURIComponent(matn)}&key=\${KEY}\`,
  );
  const data = await res.json();
  setNatijalar(data.status === "OK" ? data.results : []);
}`}</Code>

      <PrevNext current="/docs/integration/react" />
    </div>
  );
}
