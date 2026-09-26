import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, Tabs, Terminal } from "@/components/docs/parts";
import { ReactMark, TsMark, VueMark } from "@/components/docs/art";

export const metadata = {
  title: "TypeScript — OnDexMap",
  description: "OnDexMap'ni TypeScript loyihasida tiplar bilan ulash: map.ts, javob tiplari, tsconfig.",
};

export default function TypeScriptPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="TypeScript"
        desc="Alohida @types/… paket o'rnatish talab qilinmaydi: maplibre-gl va pmtiles tiplarni o'z ichida olib keladi."
        pills={[
          { href: "#tiplar", label: "Tiplar", icon: <TsMark size={15} /> },
          { href: "/docs/integration/react", label: "React bilan", icon: <ReactMark size={15} /> },
          { href: "/docs/integration/vue", label: "Vue bilan", icon: <VueMark size={15} /> },
        ]}
      />

      <H2 id="ornatish">O&apos;rnatish</H2>
      <Terminal>{`npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Terminal>

      <H2 id="tiplar">Xarita moduli</H2>
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
    center: [69.2401, 41.2995],
    zoom: 12,
    ...options,
  });
}`,
          },
          {
            name: "types.ts",
            code: `/** REST API javoblarining tiplari — haqiqiy javoblarga mos. */

export type Status =
  | "OK" | "ZERO_RESULTS" | "INVALID_REQUEST" | "REQUEST_DENIED" | "NOT_FOUND";

export interface GeocodeMatch {
  /** "p" + UUID (type === "place") yoki "g" + son (geografik nom). */
  id: string;
  type: string;
  name: string;
  /** Tur nomi — "Bozor", "Ko'cha". Manzil EMAS. */
  label?: string;
  /** Eng yaqin aholi punkti — "qayerda" degan savolga javob. */
  near?: string;
  lat?: number;
  lng?: number;
  /** [g'arb, janub, sharq, shimol] */
  bbox?: [number, number, number, number];
  score: number;
}

export interface GeocodeResponse {
  status: Status;
  results: GeocodeMatch[];
}

export interface Named {
  id: string;
  name: string;
}

/** Diqqat: reverse javobida lat/lng YO'Q. */
export interface ReverseResult {
  text: string;
  mahalla?: Named;
  street?: Named;
  street_distance_m?: number;
}

export interface ReverseResponse {
  status: Status;
  result?: ReverseResult;
}

export interface Route {
  distance_m: number;
  duration_s: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface DirectionsResponse {
  status: Status;
  routes: Route[];
}

export interface ApiError {
  status: Status;
  error: { code: string; message: string };
}`,
          },
          {
            name: "search.ts",
            code: `import type { GeocodeMatch, GeocodeResponse } from "./types";

const BASE = "https://maps.ondex.uz/v2";

export async function geocode(q: string, key: string): Promise<GeocodeMatch[]> {
  const url = new URL(BASE + "/geocode");
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

      <H2 id="talablar">Sozlama talablari</H2>
      <Table
        head={["Sozlama", "Nima uchun", "Bo'lmasa"]}
        rows={[
          [
            <C key="1">lib: [&quot;DOM&quot;]</C>,
            "Kutubxona brauzer tiplariga tayanadi",
            <>
              <C>HTMLElement</C>, <C>fetch</C> topilmaydi
            </>,
          ],
          [
            <C key="2">moduleResolution</C>,
            <>
              <C>bundler</C> yoki <C>node16</C> — paketning <C>exports</C> xaritasi o&apos;qilishi uchun
            </>,
            "Importlar topilmaydi",
          ],
          [
            <C key="3">skipLibCheck</C>,
            "Uchinchi tomon tiplari qayta tekshirilmaydi",
            "Kompilyatsiya sezilarli sekinlashadi",
          ],
        ]}
      />

      <H2 id="hodisalar">Hodisa tiplari</H2>
      <Code lang="ts">{`import type { MapMouseEvent, MapLibreEvent } from "maplibre-gl";

map.on("click", (e: MapMouseEvent) => {
  const { lng, lat } = e.lngLat;
  console.log(lat.toFixed(5), lng.toFixed(5));
});

map.on("moveend", (e: MapLibreEvent) => {
  const c = e.target.getCenter();
  console.log(c.lat, c.lng, e.target.getZoom());
});`}</Code>

      <H2 id="xato">Xatolarni tiplash</H2>
      <P>
        Javob <C>status</C> maydoniga qarab ajratiladi — shunda TypeScript qaysi maydonlar mavjudligini
        biladi:
      </P>
      <Code lang="ts">{`import type { GeocodeResponse, ApiError } from "./types";

type Result = GeocodeResponse | ApiError;

function isError(r: Result): r is ApiError {
  return "error" in r;
}

const data: Result = await res.json();
if (isError(data)) {
  console.warn(data.error.code, data.error.message);
} else {
  console.log(data.results.length);
}`}</Code>
      <Callout kind="note">
        <p>
          Xato kodlarining to&apos;liq ro&apos;yxati — <A href="/docs/api/errors">Errors</A>{" "}
          sahifasida. Rasmiy kontrakt: <A href="/openapi.yaml">openapi.yaml</A> — undan mijoz kodini
          generatsiya qilish ham mumkin.
        </p>
      </Callout>

      <PrevNext current="/docs/integration/typescript" />
    </div>
  );
}
