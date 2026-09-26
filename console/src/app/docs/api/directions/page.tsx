import { C, Callout, Code, P } from "@/components/docs/parts";
import { EndpointPage } from "@/components/docs/endpoint";

export const metadata = {
  title: "Directions — REST API — OnDexMap",
  description: "Ikki nuqta orasidagi haqiqiy yo'l: masofa, vaqt va chiziq geometriyasi.",
};

export default function DirectionsPage() {
  return (
    <EndpointPage
      spec={{
        href: "/docs/api/directions",
        title: "Directions",
        method: "GET",
        path: "/v2/directions",
        desc: "Ikki nuqta orasidagi haqiqiy yo'l bo'ylab marshrut: masofa (metr), davomiylik (sekund) va chiziq geometriyasi. Xizmat hududi: 40.5–41.6° shimol, 70.5–72.0° sharq.",
        page: "directions",
        requests: [
          {
            name: "curl",
            lang: "terminal",
            code: `curl -H "X-API-Key: omk_s_..." \\
  "https://maps.ondex.uz/v2/directions?origin=41.0004,71.2394&destination=41.0061,71.2450"`,
          },
          {
            name: "javascript",
            lang: "js",
            code: `async function marshrut(a, b) {
  const url = new URL("https://maps.ondex.uz/v2/directions");
  url.searchParams.set("origin", \`\${a.lat},\${a.lng}\`);
  url.searchParams.set("destination", \`\${b.lat},\${b.lng}\`);
  url.searchParams.set("key", "omk_b_...");

  const data = await (await fetch(url)).json();
  return data.status === "OK" ? data.routes[0] : null;
}`,
          },
          {
            name: "xaritada chizish",
            lang: "js",
            code: `const yol = await marshrut(boshlanish, tugash);
if (!yol) return;

if (map.getSource("marshrut")) {
  map.getSource("marshrut").setData({
    type: "Feature",
    geometry: yol.geometry,
  });
} else {
  map.addSource("marshrut", {
    type: "geojson",
    data: { type: "Feature", geometry: yol.geometry },
  });
  map.addLayer({
    id: "marshrut-chiziq",
    type: "line",
    source: "marshrut",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#f97316", "line-width": 5 },
  });
}

console.log(
  (yol.distance_m / 1000).toFixed(1) + " km,",
  Math.round(yol.duration_s / 60) + " daqiqa",
);`,
          },
        ],
        response: `{
  "routes": [
    {
      "distance_m": 1048.7,
      "duration_s": 166.7,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [71.238906, 41.000529],
          [71.240333, 41.001125],
          [71.243978, 41.003489]
        ]
      }
    }
  ],
  "status": "OK"
}`,
        fields: [
          ["status", <>«OK» yoki «ZERO_RESULTS»</>],
          [
            "routes[].distance_m",
            <>
              Marshrut uzunligi, metrda. <strong className="text-foreground">Kasrli son</strong> —
              ko&apos;rsatishdan oldin yaxlitlang
            </>,
          ],
          [
            "routes[].duration_s",
            <>
              Taxminiy vaqt, sekundda; kasrli. Tirbandlik hisobga olinmaydi
            </>,
          ],
          [
            "routes[].geometry",
            <>
              GeoJSON <C>LineString</C>; koordinatalar <C>[lng, lat]</C> tartibida
            </>,
          ],
        ],
        notes: (
          <>
            <P>
              Geometriya to&apos;g&apos;ridan-to&apos;g&apos;ri GeoJSON manba sifatida ishlatilishi mumkin
              — qo&apos;shimcha o&apos;girish talab qilinmaydi. Marshrutni ekranga sig&apos;dirish uchun:
            </P>
            <Code lang="js">{`const lon = yol.geometry.coordinates.map((c) => c[0]);
const lat = yol.geometry.coordinates.map((c) => c[1]);

map.fitBounds(
  [
    [Math.min(...lon), Math.min(...lat)],
    [Math.max(...lon), Math.max(...lat)],
  ],
  { padding: 48 },
);`}</Code>
            <Callout kind="note">
              <p>
                Marshrut avtomobil yo&apos;llari bo&apos;yicha hisoblanadi. Nuqta yo&apos;ldan uzoqda
                bo&apos;lsa, u eng yaqin yo&apos;lga bog&apos;lanadi — shuning uchun chiziq boshlanishi
                so&apos;ralgan koordinatadan biroz farq qilishi mumkin.
              </p>
            </Callout>
          </>
        ),
        errors: [
          [
            "400 INVALID_REQUEST",
            "origin yoki destination yo'q, format noto'g'ri yoki nuqta xizmat hududidan tashqarida",
          ],
          ["401 missing_key / invalid_key", "kalit yuborilmagan yoki noto'g'ri"],
          ["403 key_restricted", "so'rov kalitning domen yoki IP ro'yxatiga mos kelmadi"],
          ["403 api_not_allowed", "kalitda directions yoqilmagan"],
          ["429 rate_limited / quota_exceeded", "tezlik yoki oylik chegara"],
          ["503 service_unavailable", "marshrut xizmati vaqtincha javob bermayapti"],
        ],
        next: [
          { href: "/docs/api/geocode", label: "Geocode — nuqtalarni nomdan topish" },
          { href: "/docs/api/errors", label: "Errors — qayta urinish qoidalari" },
        ],
      }}
    />
  );
}
