import { C, Callout, P } from "@/components/docs/parts";
import { EndpointPage } from "@/components/docs/endpoint";

export const metadata = {
  title: "Reverse Geocode — REST API — OnDexMap",
  description: "Koordinata bo'yicha manzil aniqlash.",
};

export default function ReversePage() {
  return (
    <EndpointPage
      spec={{
        href: "/docs/api/reverse",
        title: "Reverse Geocode",
        method: "GET",
        path: "/v2/reverse",
        desc: "Koordinata bo'yicha eng yaqin manzilni qaytaradi. Xizmat hududi: 40.5–41.6° shimol, 70.5–72.0° sharq.",
        page: "reverse",
        requests: [
          {
            name: "curl",
            lang: "terminal",
            code: `curl -H "X-API-Key: omk_s_..." \\
  "https://maps.ondex.uz/v2/reverse?lat=41.0004&lng=71.2394"`,
          },
          {
            name: "javascript",
            lang: "js",
            code: `async function manzil(lat, lng) {
  const url = new URL("https://maps.ondex.uz/v2/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("key", "omk_b_...");

  const data = await (await fetch(url)).json();
  if (data.status !== "OK") return null;

  // text doim bor; mahalla va street bo'lmasligi mumkin
  return data.result.text;
}`,
          },
          {
            name: "xarita bilan",
            lang: "js",
            code: `// Foydalanuvchi xaritaga bosgan nuqtaning manzilini ko'rsatish.
// DIQQAT: popup koordinatasi javobdan emas, BOSILGAN nuqtadan olinadi —
// javobda lat/lng yo'q.
map.on("click", async (e) => {
  const { lat, lng } = e.lngLat;
  const text = await manzil(lat, lng);
  if (!text) return;

  new maplibregl.Popup()
    .setLngLat([lng, lat])
    .setText(text)
    .addTo(map);
});`,
          },
        ],
        response: `{
  "result": {
    "text": "Chust, Bobur ko'chasi",
    "mahalla": { "id": "8062195a-51cb-409c-96ad-1f0ab855f184", "name": "Serob" },
    "street": { "id": "s-9", "name": "Bobur ko'chasi" },
    "street_distance_m": 24
  },
  "status": "OK"
}`,
        fields: [
          ["status", <>«OK» yoki «ZERO_RESULTS»</>],
          ["result.text", <>Tayyor manzil matni — ko&apos;rsatish uchun shu maydon olinadi</>],
          ["result.mahalla", <>Nuqta joylashgan mahalla: <C>id</C> va <C>name</C></>],
          [
            "result.street",
            <>
              Eng yaqin ko&apos;cha: <C>id</C> va <C>name</C>. Ko&apos;cha topilmasa bo&apos;lmaydi
            </>,
          ],
          ["result.street_distance_m", <>Shu ko&apos;chagacha masofa, metrda</>],
        ],
        notes: (
          <>
            <Callout kind="warn">
              <p>
                Javobda <C>lat</C>/<C>lng</C> <strong className="text-foreground">yo&apos;q</strong>.
                Endpoint siz bergan koordinatani qaytarmaydi — u faqat o&apos;sha nuqtaning manzilini
                aytadi. Markerni qo&apos;yish uchun o&apos;zingiz yuborgan koordinatadan foydalaning.
              </p>
            </Callout>
            <P>
              Ba&apos;zi maydonlar bo&apos;lmasligi mumkin: nuqta ko&apos;chadan uzoqda bo&apos;lsa{" "}
              <C>street</C> va <C>street_distance_m</C> kelmaydi, mahalla chegarasidan tashqarida
              bo&apos;lsa <C>mahalla</C> kelmaydi. Faqat <C>text</C> doim bo&apos;ladi.
            </P>
            <P>
              Manzil topilmasa <C>status</C> qiymati <C>ZERO_RESULTS</C> bo&apos;ladi va <C>result</C>{" "}
              bo&apos;lmaydi — javobni o&apos;qishdan oldin doim <C>status</C> ni tekshiring.
            </P>
            <Callout kind="warn">
              <p>
                Xizmat hududidan tashqaridagi koordinata <C>400 INVALID_REQUEST</C> qaytaradi —{" "}
                <C>ZERO_RESULTS</C> emas. Xaritani <C>maxBounds</C> bilan cheklab, foydalanuvchini
                hududdan chiqarmaslik mumkin.
              </p>
            </Callout>
          </>
        ),
        errors: [
          ["400 INVALID_REQUEST", "lat yoki lng yo'q, son emas yoki xizmat hududidan tashqarida"],
          ["401 missing_key / invalid_key", "kalit yuborilmagan yoki noto'g'ri"],
          ["403 key_restricted", "so'rov kalitning domen yoki IP ro'yxatiga mos kelmadi"],
          ["403 api_not_allowed", "kalitda reverse yoqilmagan"],
          ["429 rate_limited / quota_exceeded", "tezlik yoki oylik chegara"],
        ],
        next: [
          { href: "/docs/api/geocode", label: "Geocode — nomdan koordinata" },
          { href: "/docs/api/directions", label: "Directions — ikki nuqta orasidagi yo'l" },
        ],
      }}
    />
  );
}
