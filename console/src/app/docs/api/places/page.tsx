import { C, Callout, Code, P } from "@/components/docs/parts";
import { EndpointPage } from "@/components/docs/endpoint";

export const metadata = {
  title: "Places — REST API — OnDexMap",
  description: "To'rtburchak ichidagi tasdiqlangan ob'ektlar, GeoJSON ko'rinishida.",
};

export default function PlacesPage() {
  return (
    <EndpointPage
      spec={{
        href: "/docs/api/places",
        title: "Places",
        method: "GET",
        path: "/v2/places",
        desc: "Berilgan to'rtburchak ichidagi tasdiqlangan ob'ektlarni GeoJSON FeatureCollection ko'rinishida qaytaradi. Qamrov — butun O'zbekiston.",
        params: [
          {
            name: "bbox",
            required: true,
            desc: (
              <>
                To&apos;rtburchak: <C>g&apos;arb,janub,sharq,shimol</C> (ya&apos;ni{" "}
                <C>minLng,minLat,maxLng,maxLat</C>)
              </>
            ),
          },
          { name: "key", desc: <>Brauzer kaliti (server kaliti faqat sarlavhada)</> },
        ],
        requests: [
          {
            name: "curl",
            lang: "terminal",
            code: `curl -H "X-API-Key: omk_s_..." \\
  "https://maps.ondex.uz/v2/places?bbox=71.20,40.98,71.28,41.02"`,
          },
          {
            name: "javascript",
            lang: "js",
            code: `async function obyektlar(bounds) {
  const url = new URL("https://maps.ondex.uz/v2/places");
  url.searchParams.set(
    "bbox",
    [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(","),
  );
  url.searchParams.set("key", "omk_b_...");

  const data = await (await fetch(url)).json();
  return data.status === "OK" ? data.result : null;
}`,
          },
          {
            name: "xarita bilan",
            lang: "js",
            code: `// Xarita to'xtaganda ko'rinayotgan hududdagi ob'ektlarni yuklash
map.on("load", () => {
  map.addSource("obyektlar", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "obyektlar-nuqta",
    type: "circle",
    source: "obyektlar",
    paint: { "circle-radius": 5, "circle-color": "#f97316" },
  });
});

map.on("moveend", async () => {
  const fc = await obyektlar(map.getBounds());
  if (fc) map.getSource("obyektlar").setData(fc);
});`,
          },
        ],
        response: `{
  "status": "OK",
  "result": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": { "type": "Point", "coordinates": [71.2394, 41.0004] },
        "properties": {
          "id": "p_01HR...",
          "name": "Chust bozori",
          "kind": "market"
        }
      }
    ]
  }
}`,
        fields: [
          ["status", <>«OK» yoki «ZERO_RESULTS»</>],
          [
            "result",
            <>
              GeoJSON <C>FeatureCollection</C> — manba sifatida to&apos;g&apos;ridan-to&apos;g&apos;ri
              ishlatiladi
            </>,
          ],
          ["features[].geometry", <>Nuqta; koordinata <C>[lng, lat]</C> tartibida</>],
          ["features[].properties.id", <>Ob&apos;ekt identifikatori</>],
          ["features[].properties.name", <>Ob&apos;ektning nomi</>],
          [
            "features[].properties.kind",
            <>
              Sinfi: <C>market</C>, <C>pharmacy</C>, <C>school</C> va boshqalar
            </>,
          ],
        ],
        notes: (
          <>
            <P>
              Javob faqat <strong className="text-foreground">tasdiqlangan</strong> ob&apos;ektlarni
              o&apos;z ichiga oladi. Moderatsiyadan o&apos;tmagan takliflar bu yerda ko&apos;rinmaydi.
            </P>
            <Callout kind="warn">
              <p>
                <C>bbox</C> tartibi xarita kutubxonalaridagidan farq qiladi: avval{" "}
                <strong className="text-foreground">uzunlik</strong>, keyin kenglik. Juda katta
                to&apos;rtburchak ko&apos;p ma&apos;lumot qaytaradi — xarita masshtabiga qarab
                so&apos;rang.
              </p>
            </Callout>
            <P>Yuklashni kamaytirish uchun so&apos;rovni kechiktirib yuboring:</P>
            <Code lang="js">{`let taymer;
map.on("moveend", () => {
  clearTimeout(taymer);
  taymer = setTimeout(async () => {
    const fc = await obyektlar(map.getBounds());
    if (fc) map.getSource("obyektlar").setData(fc);
  }, 300);
});`}</Code>
          </>
        ),
        errors: [
          ["400 INVALID_REQUEST", "bbox yo'q, to'rtta sondan iborat emas yoki chegaralar teskari"],
          ["401 missing_key / invalid_key", "kalit yuborilmagan yoki noto'g'ri"],
          ["403 key_restricted", "so'rov kalitning domen yoki IP ro'yxatiga mos kelmadi"],
          ["403 api_not_allowed", "kalitda places yoqilmagan"],
          ["429 rate_limited / quota_exceeded", "tezlik yoki oylik chegara"],
        ],
        next: [
          { href: "/docs/api/places-by-id", label: "Place by ID — bitta ob'ekt tafsiloti" },
          { href: "/docs/api/geocode", label: "Geocode — nom bo'yicha qidirish" },
        ],
      }}
    />
  );
}
