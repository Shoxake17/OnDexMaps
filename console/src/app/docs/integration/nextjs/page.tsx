import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, Tabs, Terminal } from "@/components/docs/parts";
import { NextMark, ReactMark } from "@/components/docs/art";
import { ShieldIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Next.js — OnDexMap",
  description: "OnDexMap'ni Next.js ilovasida ulash: SSR/SSG, dynamic import, Route Handler va CSP.",
};

export default function NextjsPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Next.js"
        desc="Kutubxona window ga tayanadi, shuning uchun server tomonda render qilinmasligi kerak. Server kaliti esa Route Handler ichida qoladi va brauzerga chiqmaydi."
        pills={[
          { href: "#ssr", label: "SSR / SSG", icon: <NextMark size={15} /> },
          { href: "/docs/integration/react", label: "React asoslari", icon: <ReactMark size={15} /> },
          { href: "/docs/security/csp", label: "CSP", icon: <ShieldIcon size={15} /> },
        ]}
      />

      <H2 id="ornatish">O&apos;rnatish</H2>
      <Terminal>{`npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Terminal>

      <H2 id="ssr">SSR va SSG</H2>
      <P>Komponentni faqat klientda yuklang:</P>
      <Tabs
        files={[
          {
            name: "app/xarita/page.tsx",
            code: `"use client";
import dynamic from "next/dynamic";

// ssr: false — komponent faqat brauzerda yuklanadi
const OnDexMap = dynamic(() => import("@/components/OnDexMap"), {
  ssr: false,
  loading: () => <div style={{ height: 400 }}>Xarita yuklanmoqda…</div>,
});

export default function Page() {
  return (
    <main>
      <h1>Xarita</h1>
      <OnDexMap center={[69.2401, 41.2995]} zoom={12} />
    </main>
  );
}`,
          },
          {
            name: "components/OnDexMap.tsx",
            code: `"use client";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

export default function OnDexMap({
  center = [69.2401, 41.2995] as [number, number],
  zoom = 12,
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (map.current || !container.current) return;

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

  return <div ref={container} style={{ width: "100%", height: 400 }} />;
}`,
          },
        ]}
      />
      <Callout kind="warn">
        <p>
          <C>dynamic(..., {"{ ssr: false }"})</C> faqat klient komponentida ishlaydi. Server
          komponentidan chaqirilsa Next.js xato beradi — fayl boshiga <C>&quot;use client&quot;</C>{" "}
          qo&apos;ying.
        </p>
      </Callout>

      <H2 id="route-handler">Server tomonidan qidiruv</H2>
      <P>
        Server kaliti brauzerga tushmasligi kerak. Qidiruvni Route Handler orqali o&apos;tkazing — kalit
        faqat serverda qoladi:
      </P>
      <Tabs
        files={[
          {
            name: "app/api/geocode/route.ts",
            code: `import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ error: "q juda qisqa" }, { status: 400 });
  }

  const res = await fetch(
    \`https://maps.ondex.uz/v2/geocode?q=\${encodeURIComponent(q)}\`,
    {
      headers: { "X-API-Key": process.env.ONDEXMAP_KEY! },
      cache: "no-store",
    },
  );

  return NextResponse.json(await res.json(), { status: res.status });
}`,
          },
          {
            name: "components/Qidiruv.tsx",
            code: `"use client";
import { useState } from "react";

export default function Qidiruv({ onPick }: { onPick: (j: unknown) => void }) {
  const [q, setQ] = useState("");
  const [natijalar, setNatijalar] = useState<{ id: string; name: string }[]>([]);

  async function qidir() {
    // O'z domeningizga so'rov — kalit ko'rinmaydi
    const res = await fetch(\`/api/geocode?q=\${encodeURIComponent(q)}\`);
    const data = await res.json();
    setNatijalar(data.status === "OK" ? data.results : []);
  }

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} />
      <button onClick={qidir}>Qidirish</button>
      <ul>
        {natijalar.map((j) => (
          <li key={j.id} onClick={() => onPick(j)}>{j.name}</li>
        ))}
      </ul>
    </div>
  );
}`,
          },
          {
            name: ".env.local",
            lang: "terminal",
            code: `# Server kaliti — faqat serverda o'qiladi, brauzerga chiqmaydi.
# NEXT_PUBLIC_ prefiksi QO'YILMAYDI.
ONDEXMAP_KEY=omk_s_...`,
          },
        ]}
      />

      <H2 id="kalit-qaysi">Qaysi kalit qayerda</H2>
      <Table
        head={["Joy", "Kalit turi", "Sabab"]}
        rows={[
          [
            <>
              Klient komponenti (<C>&quot;use client&quot;</C>)
            </>,
            <>
              brauzer kaliti (<C>omk_b_</C>)
            </>,
            "Kod brauzerga yetkaziladi — kalit ochiq ko'rinadi",
          ],
          [
            <>
              Route Handler, Server Action, <C>generateMetadata</C>
            </>,
            <>
              server kaliti (<C>omk_s_</C>)
            </>,
            "Kod faqat serverda ishlaydi",
          ],
          [
            <>
              <C>NEXT_PUBLIC_*</C> o&apos;zgaruvchi
            </>,
            "faqat brauzer kaliti",
            "Bu prefiks qiymatni bundle ichiga yozadi",
          ],
        ]}
      />
      <Callout kind="warn">
        <p>
          Server kalitini <C>NEXT_PUBLIC_</C> prefiksi bilan yozmang — u JavaScript bundle ichiga
          tushadi va har bir tashrifchiga ko&apos;rinadi.
        </p>
      </Callout>

      <H2 id="csp">CSP bilan</H2>
      <P>
        Next.js&apos;ning odatiy qat&apos;iy siyosati nonce va <C>&apos;strict-dynamic&apos;</C> ga
        tayanadi. Kutubxona bundler orqali kelgani uchun skript sizning domeningizdan yuklanadi, lekin
        xarita worker&apos;lari <C>blob:</C> talab qiladi:
      </P>
      <Code lang="csp">{`script-src  'self' 'nonce-\${nonce}' 'strict-dynamic';
worker-src  'self' blob:;
img-src     'self' data: blob:;
connect-src 'self' https://maps.ondex.uz https://tiles.ondex.uz;`}</Code>
      <P>
        To&apos;liq ro&apos;yxat va nosozlikni topish — <A href="/docs/security/csp">CSP va HTTPS</A>.
      </P>

      <PrevNext current="/docs/integration/nextjs" />
    </div>
  );
}
