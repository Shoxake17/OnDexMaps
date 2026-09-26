import { A, C, Callout, Code, P, UL } from "@/components/docs/parts";
import { EndpointPage } from "@/components/docs/endpoint";

export const metadata = {
  title: "Mahallas — REST API — OnDexMap",
  description: "Mahalla, qishloq va daha chegaralari GeoJSON ko'rinishida.",
};

export default function MahallasPage() {
  return (
    <EndpointPage
      spec={{
        href: "/docs/api/mahallas",
        title: "Mahallas",
        method: "GET",
        path: "/v2/mahallas",
        desc: "Mahalla, qishloq va daha chegaralarini GeoJSON FeatureCollection sifatida qaytaradi. To'plam butunligicha keladi va bir soat keshlanadi — uni bir marta olib, xaritada qatlam sifatida ushlab turish kerak.",
        page: "mahallas",
        requests: [
          {
            name: "curl",
            lang: "terminal",
            code: `curl -H "X-API-Key: omk_s_..." \\
  "https://maps.ondex.uz/v2/mahallas"`,
          },
          {
            name: "javascript",
            lang: "js",
            code: `// BIR MARTA yuklanadi — har xarita harakatida emas.
let mahallalar;

async function mahallalarniOl(key) {
  if (mahallalar) return mahallalar;

  const res = await fetch(\`https://maps.ondex.uz/v2/mahallas?key=\${key}\`);
  const data = await res.json();
  mahallalar = data.status === "OK" ? data.result : null;
  return mahallalar;
}`,
          },
          {
            name: "xaritada chizish",
            lang: "js",
            code: `const fc = await mahallalarniOl("omk_b_...");

map.addSource("mahallalar", { type: "geojson", data: fc });

// 1. Ichki to'ldirish — juda shaffof
map.addLayer({
  id: "mahalla-fon",
  type: "fill",
  source: "mahallalar",
  paint: { "fill-color": "#f97316", "fill-opacity": 0.06 },
});

// 2. Chegara chizig'i
map.addLayer({
  id: "mahalla-chegara",
  type: "line",
  source: "mahallalar",
  paint: { "line-color": "#f97316", "line-width": 1.5, "line-opacity": 0.55 },
});

// 3. Nom — MARKAZ nuqtasida (pastdagi eslatmaga qarang)
map.addSource("mahalla-nomlari", {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      type: "Feature",
      geometry: f.properties.center,
      properties: { name: f.properties.name },
    })),
  },
});

map.addLayer({
  id: "mahalla-nom",
  type: "symbol",
  source: "mahalla-nomlari",
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
});`,
          },
        ],
        response: `{
  "result": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[71.23, 40.99], [71.24, 40.99], [71.24, 41.00], [71.23, 40.99]]]
        },
        "properties": {
          "id": "8062195a-51cb-409c-96ad-1f0ab855f184",
          "name": "Serob",
          "kind": "mahalla",
          "center": { "type": "Point", "coordinates": [71.235, 40.995] }
        }
      }
    ]
  },
  "status": "OK"
}`,
        fields: [
          ["status", <>«OK»</>],
          [
            "result",
            <>
              GeoJSON <C>FeatureCollection</C> — manba sifatida
              to&apos;g&apos;ridan-to&apos;g&apos;ri ishlatiladi
            </>,
          ],
          [
            "features[].geometry",
            <>
              Chegara: <C>Polygon</C> yoki <C>MultiPolygon</C>
            </>,
          ],
          ["features[].properties.id", <>Mahallaning UUID si</>],
          ["features[].properties.name", <>Nomi</>],
          [
            "features[].properties.kind",
            <>
              <C>mahalla</C>, <C>qishloq</C> yoki <C>daha</C> — turlicha chizish uchun
            </>,
          ],
          [
            "features[].properties.center",
            <>
              Nom <strong className="text-foreground">qayerga</strong> qo&apos;yilishi (GeoJSON
              Point) — quyidagi eslatmaga qarang
            </>,
          ],
        ],
        notes: (
          <>
            <Callout kind="warn">
              <p>
                Nomni poligonning o&apos;ziga chizmang. Xarita kutubxonasi poligonni tile
                chegaralari bo&apos;ylab bo&apos;laklarga bo&apos;ladi va{" "}
                <strong className="text-foreground">har bo&apos;lakka bitta nom</strong> chizadi —
                yaqinlashtirganda bitta mahalla nomi bir necha marta takrorlanadi. Shuning uchun
                javobda <C>center</C> maydoni bor: nom uchun alohida nuqtali manba yarating.
              </p>
            </Callout>
            <P>Boshqa e&apos;tiborga olinadigan narsalar:</P>
            <UL>
              <li>
                Chegarasi hali chizilmagan mahallalar javobga{" "}
                <strong className="text-foreground">tushmaydi</strong> — ular qidiruvda topiladi,
                lekin xaritada chizilmaydi.
              </li>
              <li>
                Javob bir soat keshlanadi (<C>Cache-Control: public, max-age=3600</C>). Xarita
                harakatlanganda qayta so&apos;ramang — bu keraksiz kvota sarfi.
              </li>
              <li>
                Nuqta qaysi mahallada ekanini bilish uchun poligonlarni o&apos;zingiz
                tekshirishingiz shart emas — <A href="/docs/api/reverse">Reverse Geocode</A> uni{" "}
                <C>result.mahalla</C> da qaytaradi.
              </li>
            </UL>
            <P>Chegaralarni faqat ma&apos;lum masshtabda ko&apos;rsatish:</P>
            <Code lang="js">{`map.setLayerZoomRange("mahalla-chegara", 11, 24);
map.setLayerZoomRange("mahalla-nom", 12, 24);`}</Code>
          </>
        ),
        errors: [
          ["401 missing_key / invalid_key", "kalit yuborilmagan yoki noto'g'ri"],
          ["403 key_restricted", "so'rov kalitning domen yoki IP ro'yxatiga mos kelmadi"],
          ["403 api_not_allowed", "kalitda places yoqilmagan — mahallas shu ruxsat ostida"],
          ["429 rate_limited / quota_exceeded", "tezlik yoki oylik chegara"],
          ["502 upstream_error", "baza so'rovi bajarilmadi"],
        ],
        next: [
          { href: "/docs/api/reverse", label: "Reverse Geocode — nuqta qaysi mahallada" },
          { href: "/docs/api/places", label: "Places — hududdagi ob'ektlar" },
        ],
      }}
    />
  );
}
