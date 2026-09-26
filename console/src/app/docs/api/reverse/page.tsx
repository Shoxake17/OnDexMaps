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
        params: [
          { name: "lat", required: true, desc: <>Kenglik, 40.5–41.6 oralig&apos;ida</> },
          { name: "lng", required: true, desc: <>Uzunlik, 70.5–72.0 oralig&apos;ida</> },
          { name: "key", desc: <>Brauzer kaliti (server kaliti faqat sarlavhada)</> },
        ],
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
  return data.status === "OK" ? data.result.text : null;
}`,
          },
          {
            name: "xarita bilan",
            lang: "js",
            code: `// Foydalanuvchi xaritaga bosgan nuqtaning manzilini ko'rsatish
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
  "status": "OK",
  "result": {
    "text": "Chust, Bobur ko'chasi",
    "lat": 41.0004,
    "lng": 71.2394
  }
}`,
        fields: [
          ["status", <>«OK» yoki «ZERO_RESULTS»</>],
          ["result.text", <>Inson o&apos;qiy oladigan manzil satri</>],
          ["result.lat, lng", <>Topilgan ob&apos;ektning koordinatasi (so&apos;ralganidan farq qilishi mumkin)</>],
        ],
        notes: (
          <>
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
