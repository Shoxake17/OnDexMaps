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
    if (map.current) return; // StrictMode ikkinchi chaqiruvida qayta yaratilmaydi

    map.current = new maplibregl.Map({
      container: container.current,
      style: "https://maps.ondex.uz/tiles/style.json",
      center,
      zoom,
    });
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

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
          React <C>StrictMode</C> ishlab chiqish rejimida effektlarni ikki marta ishga tushiradi.{" "}
          <C>if (map.current) return</C> tekshiruvi va tozalash funksiyasi ikkinchi nusxa yaratilishining
          oldini oladi.
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
      <Code lang="jsx">{`// Prop o'zgarganda xaritani SURISH (qayta yaratmaslik)
useEffect(() => {
  map.current?.flyTo({ center, zoom });
}, [center, zoom]);`}</Code>

      <H2 id="markerlar">Markerlar</H2>
      <P>Markerlar ham tozalanadi — aks holda ular xaritada to&apos;planib qoladi:</P>
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
