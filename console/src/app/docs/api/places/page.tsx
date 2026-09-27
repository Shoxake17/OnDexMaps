import { A, C, Callout, Code, P } from "@/components/docs/parts";
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
        desc: "Berilgan to'rtburchak ichidagi tasdiqlangan ob'ektlarni GeoJSON FeatureCollection ko'rinishida qaytaradi. So'rov butun O'zbekiston bo'yicha qabul qilinadi, lekin jadval hozircha deyarli bo'sh — pastdagi «Ma'lumot qamrovi» ga qarang.",
        page: "places",
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
            code: `// Xizmat hududi va tomon chegarasi — ikkisi ham 400 beradi,
// shuning uchun so'rovdan OLDIN tekshiriladi.
const HUDUD = { minLng: 55.5, minLat: 37.0, maxLng: 73.5, maxLat: 45.8 };
const MAX_SPAN = 1.5;
const qirq = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

async function obyektlar(bounds) {
  // Ko'rinish juda keng bo'lsa so'rov yubormaymiz.
  if (bounds.getEast() - bounds.getWest() > MAX_SPAN) return null;
  if (bounds.getNorth() - bounds.getSouth() > MAX_SPAN) return null;

  // Chetlarini hududga qirqamiz: chegara yonida yaqinlashtirilgan
  // ko'rinishning bir qirrasi baribir hududdan chiqib ketadi.
  const w = qirq(bounds.getWest(), HUDUD.minLng, HUDUD.maxLng);
  const e = qirq(bounds.getEast(), HUDUD.minLng, HUDUD.maxLng);
  const s = qirq(bounds.getSouth(), HUDUD.minLat, HUDUD.maxLat);
  const n = qirq(bounds.getNorth(), HUDUD.minLat, HUDUD.maxLat);
  if (w >= e || s >= n) return null;   // butunlay hudud tashqarisida

  const url = new URL("https://maps.ondex.uz/v2/places");
  url.searchParams.set("bbox", [w, s, e, n].join(","));
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
  "result": {
    "type": "FeatureCollection",
    "features": [
      {
        "id": "a70e710c-d609-4865-9db4-d589ba33eb11",
        "type": "Feature",
        "geometry": { "type": "Point", "coordinates": [71.231142, 40.991814] },
        "properties": {
          "id": "a70e710c-d609-4865-9db4-d589ba33eb11",
          "kind": "organization",
          "name": "OnDexCompany",
          "category": "Idora / Ofis"
        }
      }
    ]
  },
  "status": "OK"
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
          [
            "features[].properties.id",
            <>
              Ob&apos;ektning UUID si — <A href="/docs/api/places-by-id">/v2/places/{"{id}"}</A> ga
              o&apos;zgartirmasdan beriladi
            </>,
          ],
          ["features[].properties.name", <>Ob&apos;ektning nomi</>],
          [
            "features[].properties.kind",
            <>
              Sinfi: <C>organization</C>, <C>shop</C>, <C>pharmacy</C> va boshqalar
            </>,
          ],
          ["features[].properties.category", <>Aniqroq toifa («Idora / Ofis»); bo&apos;lmasligi mumkin</>],
        ],
        notes: (
          <>
            <Callout kind="warn">
              <p className="font-semibold">Ma&apos;lumot qamrovi</p>
              <p className="mt-1.5">
                <C>/v2/places</C> — OnDexMap&apos;ning moderatsiyadan o&apos;tgan{" "}
                <strong className="text-foreground">o&apos;z</strong> ob&apos;ektlar jadvali va u
                production&apos;da hozircha <strong className="text-foreground">deyarli bo&apos;sh</strong>:
                2026-09-27 da butun xizmat hududi 1,4° li panjara bilan skanerlandi (91 so&apos;rov)
                va jami <strong className="text-foreground">1 ta</strong> ob&apos;ekt topildi.
              </p>
              <p className="mt-2">
                Ya&apos;ni ko&apos;p hududda bo&apos;sh <C>FeatureCollection</C> qaytadi va bu
                xato emas. Xaritadagi do&apos;kon, maktab, dorixona yozuvlari{" "}
                <strong className="text-foreground">tayllardan</strong> keladi — butunlay boshqa
                manba, ular butun mamlakat bo&apos;ylab ko&apos;rinadi va bu endpointga
                bog&apos;liq emas.
              </p>
            </Callout>
            <P>
              Javob faqat <strong className="text-foreground">tasdiqlangan</strong> ob&apos;ektlarni
              o&apos;z ichiga oladi. Moderatsiyadan o&apos;tmagan takliflar bu yerda ko&apos;rinmaydi.
            </P>
            <Callout kind="warn">
              <p>
                <C>bbox</C> tartibi xarita kutubxonalaridagidan farq qiladi: avval{" "}
                <strong className="text-foreground">uzunlik</strong>, keyin kenglik.
              </p>
              <p className="mt-2">
                Ko&apos;rinishni to&apos;g&apos;ridan-to&apos;g&apos;ri yuborish{" "}
                <strong className="text-foreground">yaramaydi</strong> — ikki qat&apos;iy shart bor
                va buzilganda <C>400 INVALID_REQUEST</C> qaytadi:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  tomonlari 1.5 gradusdan oshmasin (uzoqlashtirilgan xarita darhol oshib ketadi);
                </li>
                <li>
                  to&apos;rtta burchak ham xizmat hududida bo&apos;lsin — uzunlik{" "}
                  <C>55.5–73.5</C>, kenglik <C>37.0–45.8</C>.
                </li>
              </ol>
              <p className="mt-2">
                Ikkinchisi eng ko&apos;p adashtiradi: Termiz yoki Nukus yonida
                yaqinlashtirilgan bo&apos;lsangiz ham ko&apos;rinishning bir chekkasi hududdan
                chiqadi. Yuqoridagi <C>javascript</C> namunasi ikkisini ham hisobga oladi.
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
          [
            "400 INVALID_REQUEST",
            "bbox yo'q, to'rtta sondan iborat emas, chegaralar teskari, tomoni 1.5° dan katta " +
              "yoki burchagi xizmat hududidan tashqarida (lng 55.5–73.5, lat 37.0–45.8)",
          ],
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
