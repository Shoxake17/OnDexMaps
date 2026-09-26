import { A, C, Callout, Code, H2, P, PrevNext, Tabs } from "@/components/docs/parts";

export const metadata = {
  title: "API'ni ulash: TypeScript — OnDexMap",
  description: "OnDexMap JavaScript API'ni TypeScript loyihasida tiplar bilan ulash.",
};

export default function ConnectTsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">API&apos;ni ulash: TypeScript</h1>

      <Callout kind="note">
        <p>
          Alohida <C>@types/...</C> paket o&apos;rnatish talab qilinmaydi: <C>maplibre-gl</C> va <C>pmtiles</C>{" "}
          tiplarni o&apos;z ichida olib keladi.
        </p>
      </Callout>

      <H2 id="install">O&apos;rnatish</H2>
      <Code>{`npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Code>

      <H2 id="usage">Ishlatish</H2>
      <P>
        Xarita obyektini <C>maplibregl.Map</C> tipi bilan saqlang — shunda barcha metodlar va parametrlar
        tekshiriladi.
      </P>
      <Tabs
        files={[
          {
            name: "map.ts",
            code: `import maplibregl, { type Map as MapLibreMap, type MapOptions } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

export const ONDEX_STYLE = "https://maps.ondex.uz/tiles/style.json";

export function createMap(
  container: HTMLElement,
  options: Partial<MapOptions> = {},
): MapLibreMap {
  return new maplibregl.Map({
    container,
    style: ONDEX_STYLE,
    center: [71.2394, 41.0004],
    zoom: 13,
    ...options,
  });
}`,
          },
          {
            name: "search.ts",
            code: `/** REST API javobining tipi — faqat ishlatadigan maydonlar. */
export interface GeocodeMatch {
  id: string;
  type: string;
  name: string;
  label?: string;
  lat?: number;
  lng?: number;
}

interface GeocodeResponse {
  status: "OK" | "ZERO_RESULTS";
  results: GeocodeMatch[];
}

export async function geocode(q: string, key: string): Promise<GeocodeMatch[]> {
  const url = new URL("https://maps.ondex.uz/v2/geocode");
  url.searchParams.set("q", q);
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) throw new Error(\`geocode: \${res.status}\`);

  const data: GeocodeResponse = await res.json();
  return data.status === "OK" ? data.results : [];
}`,
          },
          {
            name: "tsconfig.json",
            code: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "strict": true,
    "skipLibCheck": true
  }
}`,
          },
        ]}
      />

      <H2 id="notes">Eslatmalar</H2>
      <P>
        <C>lib</C> ro&apos;yxatida <C>DOM</C> bo&apos;lishi shart — kutubxona brauzer tiplariga tayanadi.{" "}
        <C>moduleResolution: &quot;bundler&quot;</C> (yoki <C>node16</C>) bo&apos;lmasa, paketning{" "}
        <C>exports</C> xaritasi to&apos;g&apos;ri o&apos;qilmaydi va importlar topilmaydi.
      </P>
      <P>
        REST API javoblarining to&apos;liq shakli — <A href="/docs/api">REST API</A> bo&apos;limida.
      </P>

      <PrevNext current="/docs/js/connect/typescript" />
    </div>
  );
}
