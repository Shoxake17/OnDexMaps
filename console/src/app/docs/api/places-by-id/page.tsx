import { A, C, Callout, P, Table } from "@/components/docs/parts";
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
        page: "places-by-id",
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
  "https://maps.ondex.uz/v2/geocode?q=OnDexCompany&key=omk_b_...",
)).json();

// 2. Faqat "place" natijalarida tafsilot bor va ularning
//    id'si "p" bilan boshlanadi — uni olib tashlaymiz.
const joy = results.find((r) => r.type === "place");
if (!joy) return;                    // geografik nom uchun tafsilot yo'q

const tafsilot = await obyekt(joy.id.slice(1));
if (!tafsilot) return;

new maplibregl.Popup()
  .setLngLat([tafsilot.lng, tafsilot.lat])
  .setText(tafsilot.name)
  .addTo(map);`,
          },
        ],
        response: `{
  "result": {
    "id": "a70e710c-d609-4865-9db4-d589ba33eb11",
    "kind": "organization",
    "kind_label": "Tashkilot",
    "name": "OnDexCompany",
    "category": "Idora / Ofis",
    "street": "Mustaqillik",
    "house": "15A",
    "lat": 40.991814,
    "lng": 71.231142,
    "photos": 0,
    "geometry": { "type": "Point", "coordinates": [71.231142, 40.991814] },
    "created_at": "2026-09-23T03:39:24.099216Z"
  },
  "status": "OK"
}`,
        fields: [
          ["status", <>«OK» — ob&apos;ekt topildi</>],
          ["result.id", <>So&apos;ralgan UUID</>],
          ["result.name", <>Ob&apos;ektning nomi</>],
          [
            "result.kind",
            <>
              Mashina o&apos;qiydigan sinf: <C>organization</C>, <C>shop</C>, <C>pharmacy</C> va
              boshqalar
            </>,
          ],
          ["result.kind_label", <>O&apos;sha sinfning o&apos;zbekcha nomi («Tashkilot»)</>],
          ["result.category", <>Aniqroq toifa («Idora / Ofis»); bo&apos;lmasligi mumkin</>],
          ["result.description", <>Ob&apos;ekt haqida matn; bo&apos;lmasligi mumkin</>],
          ["result.street, house", <>Manzil bo&apos;laklari; bo&apos;lmasligi mumkin</>],
          ["result.phone", <>Telefon raqami; bo&apos;lmasligi mumkin</>],
          ["result.hours", <>Ish vaqti matni; bo&apos;lmasligi mumkin</>],
          ["result.site", <>Veb-sayt manzili (URL); bo&apos;lmasligi mumkin</>],
          ["result.social", <>Ijtimoiy tarmoq havolasi (URL); bo&apos;lmasligi mumkin</>],
          ["result.lat, lng", <>Koordinata</>],
          ["result.geometry", <>GeoJSON geometriya — xaritaga to&apos;g&apos;ridan qo&apos;yiladi</>],
          [
            "result.length_m",
            <>
              Chiziqli ob&apos;ektning uzunligi, metrda. Nuqta ob&apos;ektlarda bo&apos;lmaydi
            </>,
          ],
          ["result.photos", <>Rasmlar soni</>],
          ["result.created_at", <>Ob&apos;ekt qo&apos;shilgan vaqt (ISO 8601)</>],
        ],
        notes: (
          <>
            <Callout kind="warn">
              <p>
                Bu endpoint <strong className="text-foreground">faqat UUID</strong> qabul qiladi.{" "}
                <A href="/docs/api/geocode">Geocode</A> qaytaradigan <C>id</C> to&apos;g&apos;ridan
                yaramaydi: <C>place</C> natijalarida u <C>p</C> bilan boshlanadi (olib tashlang),
                geografik nomlarda esa <C>g23278</C> ko&apos;rinishida bo&apos;ladi va bunday
                ob&apos;ektlar uchun tafsilot umuman yo&apos;q.
              </p>
            </Callout>
            <Table
              head={["Berilgan id", "Natija"]}
              rows={[
                [<C key="1">a70e710c-…</C>, <>200 — to&apos;g&apos;ri shakl</>],
                [<C key="2">pa70e710c-…</C>, <>404 — boshidagi «p» olib tashlanmagan</>],
                [<C key="3">g23278</C>, <>404 — geografik nom, ob&apos;ekt emas</>],
              ]}
            />
            <P>
              <A href="/docs/api/places">Places</A> qaytaradigan <C>properties.id</C> esa allaqachon
              toza UUID — uni o&apos;zgartirmasdan berish mumkin.
            </P>
            <P>
              Identifikator barqaror: ob&apos;ekt ma&apos;lumoti yangilansa ham u o&apos;zgarmaydi,
              shuning uchun uni o&apos;z bazangizda saqlash mumkin.
            </P>
            <Callout kind="note">
              <p>
                Mavjud bo&apos;lmagan yoki moderatsiyadan o&apos;tmagan ob&apos;ekt uchun{" "}
                <C>404</C> va <C>{`{"error":{"code":"not_found"},"status":"NOT_FOUND"}`}</C> qaytadi.
              </p>
            </Callout>
          </>
        ),
        errors: [
          ["400 INVALID_REQUEST", "identifikator bo'sh yoki UUID formatida emas"],
          ["401 missing_key / invalid_key", "kalit yuborilmagan yoki noto'g'ri"],
          ["403 key_restricted", "so'rov kalitning domen yoki IP ro'yxatiga mos kelmadi"],
          ["403 api_not_allowed", "kalitda places yoqilmagan"],
          ["404 not_found", "bunday ob'ekt yo'q, tasdiqlanmagan, yoki id noto'g'ri shaklda berilgan"],
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
