import { A, C, Callout, Code, H2, H3, P, PrevNext, Tabs } from "@/components/docs/parts";

export const metadata = {
  title: "API'ni ulash: React — OnDexMap",
  description: "OnDexMap xaritasini React va Next.js ilovasida to'g'ri ulash: hayotiy tsikl va tozalash.",
};

export default function ConnectReactPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">API&apos;ni ulash: React</h1>

      <P>
        React&apos;da asosiy qoida: xarita DOM elementi bilan ishlaydi, shuning uchun uni{" "}
        <C>useEffect</C> ichida BIR MARTA yaratamiz va komponent yo&apos;q qilinganda{" "}
        <C>map.remove()</C> bilan tozalaymiz.
      </P>

      <H2 id="component">Komponent</H2>
      <Tabs
        files={[
          {
            name: "OnDexMap.jsx",
            code: `import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

// Protokol BIR MARTA, modul darajasida ro'yxatdan o'tadi —
// har render'da qayta chaqirish shart emas.
maplibregl.addProtocol("pmtiles", new Protocol().tile);

export default function OnDexMap({ center = [71.2394, 41.0004], zoom = 13 }) {
  const container = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return; // StrictMode ikkinchi chaqiruvida qayta yaratmaymiz

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
      <OnDexMap center={[69.2401, 41.2995]} zoom={12} />
    </main>
  );
}`,
          },
        ]}
      />

      <Callout kind="warn">
        <p>
          React <C>StrictMode</C> (dev rejimda) effektlarni IKKI MARTA ishga tushiradi. Yuqoridagi{" "}
          <C>if (map.current) return</C> va tozalash funksiyasi bo&apos;lmasa, ikkita xarita yaratiladi va
          biri &quot;osilib&quot; qoladi: xotira sarfi ortadi, tile so&apos;rovlari ikki barobar bo&apos;ladi.
        </p>
      </Callout>

      <H2 id="nextjs">Next.js</H2>
      <P>
        Kutubxona <C>window</C> ga tayanadi, shuning uchun server tomonda render qilinmasligi kerak.
        Komponentni faqat klientda yuklang:
      </P>
      <Code lang="jsx">{`"use client";
import dynamic from "next/dynamic";

// ssr: false — komponent faqat brauzerda yuklanadi
const OnDexMap = dynamic(() => import("./OnDexMap"), {
  ssr: false,
  loading: () => <div style={{ height: 400 }}>Xarita yuklanmoqda…</div>,
});

export default function Page() {
  return <OnDexMap />;
}`}</Code>
      <Callout kind="note">
        <p>
          Next.js&apos;ning qat&apos;iy CSP sozlamasi bilan ishlayotgan bo&apos;lsangiz — MapLibre web
          worker&apos;larni <C>blob:</C> orqali ishga tushiradi, shuning uchun{" "}
          <A href="/docs/js/connect/csp">CSP bilan ulash</A> sahifasidagi direktivalar kerak bo&apos;ladi.
        </p>
      </Callout>

      <H3 id="markers">Marker qo&apos;shish</H3>
      <P>
        Markerlarni ham xuddi shunday tozalash kerak — aks holda ular xaritada to&apos;planib qoladi:
      </P>
      <Code lang="jsx">{`useEffect(() => {
  if (!map.current || !joylar.length) return;

  const markerlar = joylar.map((j) =>
    new maplibregl.Marker().setLngLat([j.lng, j.lat]).addTo(map.current),
  );

  return () => markerlar.forEach((m) => m.remove());
}, [joylar]);`}</Code>

      <PrevNext current="/docs/js/connect/react" />
    </div>
  );
}
