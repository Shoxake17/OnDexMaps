import { C, Callout, P } from "@/components/docs/parts";
import { EndpointPage } from "@/components/docs/endpoint";

export const metadata = {
  title: "Place by ID — REST API — OnDexMap",
  description: "Bitta ob'ektning to'liq ma'lumoti identifikator bo'yicha.",
};

export default function PlaceByIdPage() {
  return (
    <EndpointPage
      spec={{
        href: "/docs/api/places-by-id",
        title: "Place by ID",
        method: "GET",
        path: "/v2/places/{id}",
        desc: "Identifikator bo'yicha bitta ob'ektning to'liq ma'lumotini qaytaradi. Identifikator Geocode yoki Places javobidan olinadi.",
        params: [
          {
            name: "id",
            required: true,
            desc: (
              <>
                Ob&apos;ekt identifikatori — yo&apos;lning bir qismi (<C>query</C> emas). Geocode yoki
                Places javobidagi <C>id</C>
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
  "https://maps.ondex.uz/v2/places/p_01HR8Z9QWERTY"`,
          },
          {
            name: "javascript",
            lang: "js",
            code: `async function obyekt(id) {
  const res = await fetch(
    \`https://maps.ondex.uz/v2/places/\${encodeURIComponent(id)}?key=omk_b_...\`,
  );
  if (res.status === 404) return null;

  const data = await res.json();
  return data.status === "OK" ? data.result : null;
}`,
          },
          {
            name: "qidiruvdan keyin",
            lang: "js",
            code: `// 1. Nom bo'yicha topamiz
const { results } = await (await fetch(
  "https://maps.ondex.uz/v2/geocode?q=Chust bozori&key=omk_b_...",
)).json();

// 2. Tanlangan natijaning to'liq ma'lumotini olamiz
const tafsilot = await obyekt(results[0].id);

new maplibregl.Popup()
  .setLngLat([tafsilot.lng, tafsilot.lat])
  .setText(tafsilot.name)
  .addTo(map);`,
          },
        ],
        response: `{
  "status": "OK",
  "result": {
    "id": "p_01HR...",
    "name": "Chust bozori",
    "kind": "market",
    "lat": 41.0004,
    "lng": 71.2394
  }
}`,
        fields: [
          ["status", <>«OK» — ob&apos;ekt topildi</>],
          ["result.id", <>So&apos;ralgan identifikator</>],
          ["result.name", <>Ob&apos;ektning nomi</>],
          [
            "result.kind",
            <>
              Sinfi: <C>market</C>, <C>pharmacy</C>, <C>school</C> va boshqalar
            </>,
          ],
          ["result.lat, lng", <>Koordinata</>],
        ],
        notes: (
          <>
            <P>
              Identifikator barqaror: ob&apos;ekt ma&apos;lumoti yangilansa ham u o&apos;zgarmaydi,
              shuning uchun uni o&apos;z bazangizda saqlash mumkin.
            </P>
            <Callout kind="note">
              <p>
                Mavjud bo&apos;lmagan yoki moderatsiyadan o&apos;tmagan ob&apos;ekt uchun{" "}
                <C>404</C> qaytadi. Javobni o&apos;qishdan oldin <C>res.status</C> ni tekshiring.
              </p>
            </Callout>
          </>
        ),
        errors: [
          ["400 INVALID_REQUEST", "identifikator bo'sh yoki formati noto'g'ri"],
          ["401 missing_key / invalid_key", "kalit yuborilmagan yoki noto'g'ri"],
          ["403 key_restricted", "so'rov kalitning domen yoki IP ro'yxatiga mos kelmadi"],
          ["403 api_not_allowed", "kalitda places yoqilmagan"],
          ["404", "bunday ob'ekt yo'q yoki u tasdiqlanmagan"],
          ["429 rate_limited / quota_exceeded", "tezlik yoki oylik chegara"],
        ],
        next: [
          { href: "/docs/api/places", label: "Places — hudud bo'yicha ro'yxat" },
          { href: "/docs/api/reference", label: "API Reference — to'liq kontrakt" },
        ],
      }}
    />
  );
}
