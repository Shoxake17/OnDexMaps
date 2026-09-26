import { C, Callout, P, UL } from "@/components/docs/parts";
import { EndpointPage } from "@/components/docs/endpoint";

export const metadata = {
  title: "Geocode — REST API — OnDexMap",
  description: "Nom bo'yicha joy qidirish: shahar, ko'cha, mahalla yoki ob'ekt.",
};

export default function GeocodePage() {
  return (
    <EndpointPage
      spec={{
        href: "/docs/api/geocode",
        title: "Geocode",
        method: "GET",
        path: "/v2/geocode",
        desc: "Nom bo'yicha joy qidirish: shahar, tuman, ko'cha, mahalla yoki ob'ekt. Qamrov — butun O'zbekiston.",
        params: [
          { name: "q", required: true, desc: <>Qidiruv matni, 2–100 belgi</> },
          { name: "limit", desc: <>Natijalar soni, 1–25 (standart 10)</> },
          {
            name: "lat",
            desc: <>Xarita markazi kengligi — yaqin natija ro&apos;yxat boshida chiqadi</>,
          },
          {
            name: "lng",
            desc: (
              <>
                Xarita markazi uzunligi; <C>lat</C> bilan birga beriladi
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
  "https://maps.ondex.uz/v2/geocode?q=Chust%20bozori&limit=5"`,
          },
          {
            name: "javascript",
            lang: "js",
            code: `const url = new URL("https://maps.ondex.uz/v2/geocode");
url.searchParams.set("q", "Chust bozori");
url.searchParams.set("limit", "5");
url.searchParams.set("key", "omk_b_...");

const res = await fetch(url);
const data = await res.json();
if (data.status === "OK") {
  console.log(data.results[0].name);
}`,
          },
          {
            name: "markaz bilan",
            lang: "js",
            code: `// Xarita markazi berilsa, yaqin natijalar oldin chiqadi
const c = map.getCenter();

const url = new URL("https://maps.ondex.uz/v2/geocode");
url.searchParams.set("q", "bozor");
url.searchParams.set("lat", String(c.lat));
url.searchParams.set("lng", String(c.lng));
url.searchParams.set("key", "omk_b_...");

const { results } = await (await fetch(url)).json();`,
          },
        ],
        response: `{
  "status": "OK",
  "results": [
    {
      "id": "p_01HR...",
      "type": "poi",
      "name": "Chust bozori",
      "label": "Chust, Namangan viloyati",
      "lat": 41.0004,
      "lng": 71.2394
    },
    {
      "id": "s_01HR...",
      "type": "street",
      "name": "Bozor ko'chasi",
      "label": "Chust",
      "lat": 41.0011,
      "lng": 71.2402
    }
  ]
}`,
        fields: [
          ["status", <>«OK» yoki «ZERO_RESULTS»</>],
          ["results[].id", <>Ob&apos;ekt identifikatori — <C>/v2/places/{"{id}"}</C> uchun</>],
          [
            "results[].type",
            <>
              Turi: <C>city</C>, <C>district</C>, <C>street</C>, <C>poi</C>, <C>address</C> va boshqalar
            </>,
          ],
          ["results[].name", <>Ob&apos;ektning nomi</>],
          ["results[].label", <>Qayerda joylashgani (viloyat, tuman)</>],
          ["results[].lat, lng", <>Koordinata; ba&apos;zi ma&apos;muriy natijalarda bo&apos;lmasligi mumkin</>],
        ],
        notes: (
          <>
            <P>Natijalar quyidagi tartibda saralanadi:</P>
            <UL>
              <li>nomning so&apos;rovga mos kelish darajasi (aniq moslik eng yuqori);</li>
              <li>
                ob&apos;ekt turining vazni — shahar tumandan, tuman ko&apos;chadan yuqori turadi;
              </li>
              <li>
                <C>lat</C>/<C>lng</C> berilgan bo&apos;lsa — xarita markazigacha masofa.
              </li>
            </UL>
            <Callout kind="note">
              <p>
                Qidiruv kirill va lotin yozuvlarini bir xil qabul qiladi: «Ташкент» va «Toshkent» bir xil
                natija beradi. Imlo xatosi bo&apos;lsa taxminiy moslik ishlaydi.
              </p>
            </Callout>
          </>
        ),
        errors: [
          ["400 INVALID_REQUEST", "q yo'q, 2 belgidan qisqa yoki 100 belgidan uzun; limit oralig'dan tashqarida"],
          ["401 missing_key / invalid_key", "kalit yuborilmagan yoki noto'g'ri"],
          ["403 key_restricted", "so'rov kalitning domen yoki IP ro'yxatiga mos kelmadi"],
          ["403 api_not_allowed", "kalitda geocode yoqilmagan"],
          ["429 rate_limited / quota_exceeded", "tezlik yoki oylik chegara"],
        ],
        next: [
          { href: "/docs/api/reverse", label: "Reverse Geocode — koordinatadan manzil" },
          { href: "/docs/api/places-by-id", label: "Place by ID — topilgan ob'ekt tafsiloti" },
        ],
      }}
    />
  );
}
