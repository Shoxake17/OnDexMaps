import { A, C, Callout, Code, H3, P, Table, UL } from "@/components/docs/parts";
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
        page: "geocode",
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
  "results": [
    {
      "id": "g23278",
      "type": "poi",
      "name": "Chust dehqon bozori",
      "label": "Bozor",
      "near": "Chust",
      "lat": 40.997464,
      "lng": 71.226467,
      "bbox": [71.22558, 40.99593, 71.22794, 40.99871],
      "score": 93
    },
    {
      "id": "pa70e710c-d609-4865-9db4-d589ba33eb11",
      "type": "place",
      "name": "OnDexCompany",
      "label": "Idora / Ofis",
      "lat": 40.991814,
      "lng": 71.231142,
      "score": 100
    }
  ],
  "status": "OK"
}`,
        fields: [
          ["status", <>«OK» yoki «ZERO_RESULTS»</>],
          [
            "results[].id",
            <>
              Identifikator. Ikki turi bor — quyidagi «Identifikatorlar» bo&apos;limiga qarang
            </>,
          ],
          [
            "results[].type",
            <>
              Turi: <C>region</C>, <C>district</C>, <C>city</C>, <C>town</C>, <C>village</C>,{" "}
              <C>street</C>, <C>poi</C>, <C>building</C>, <C>address</C>, <C>mahalla</C>,{" "}
              <C>place</C> va boshqalar
            </>,
          ],
          ["results[].name", <>Ob&apos;ektning nomi</>],
          [
            "results[].label",
            <>
              <strong className="text-foreground">Tur nomi</strong> o&apos;zbekcha: «Bozor»,
              «Ko&apos;cha», «Maktab». Bu manzil EMAS
            </>,
          ],
          [
            "results[].near",
            <>
              Eng yaqin aholi punkti — «qayerda» degan savolga javob shu maydonda
            </>,
          ],
          ["results[].lat, lng", <>Koordinata; ba&apos;zi ma&apos;muriy natijalarda bo&apos;lmasligi mumkin</>],
          [
            "results[].bbox",
            <>
              Chegara to&apos;rtburchagi <C>[g&apos;arb, janub, sharq, shimol]</C>; faqat maydonli
              ob&apos;ektlarda
            </>,
          ],
          ["results[].score", <>Moslik bahosi — ro&apos;yxat shu bo&apos;yicha saralangan</>],
          [
            "results[].kind",
            <>
              Aholi punkti turi — faqat mahalla jadvalidan kelgan natijalarda
            </>,
          ],
          [
            "results[].matched_via",
            <>
              Qaysi nom orqali topilgani. Ob&apos;ekt muqobil nom (alias) bilan topilsa shu yerda
              rasmiy nomi keladi — «Katta ko&apos;cha (rasmiy: Navoiy ko&apos;chasi)» deb
              ko&apos;rsatish uchun
            </>,
          ],
        ],
        notes: (
          <>
            <H3 id="identifikatorlar">Identifikatorlar</H3>
            <P>
              Qidiruv ikki manbadan natija qaytaradi va ularning identifikatorlari{" "}
              <strong className="text-foreground">bir xil emas</strong>:
            </P>
            <Table
              head={["Ko'rinishi", "Nimadan", "Tafsilot olish"]}
              rows={[
                [
                  <>
                    <C>p</C> + UUID
                    <br />
                    <span className="text-xs">pa70e710c-…</span>
                  </>,
                  <>
                    OnDexMap ob&apos;ektlar bazasi (<C>type: &quot;place&quot;</C>)
                  </>,
                  <>
                    Bor: <C>p</C> harfini OLIB TASHLAB{" "}
                    <A href="/docs/api/places-by-id">/v2/places/{"{uuid}"}</A> ga bering
                  </>,
                ],
                [
                  <>
                    <C>g</C> + son
                    <br />
                    <span className="text-xs">g23278</span>
                  </>,
                  "Geografik nomlar indeksi (OSM asosida)",
                  <>
                    <strong className="text-foreground">Yo&apos;q</strong> — bunday natijalar uchun
                    alohida tafsilot endpointi mavjud emas
                  </>,
                ],
              ]}
            />
            <Callout kind="warn">
              <p>
                <C>results[].id</C> ni <C>/v2/places/{"{id}"}</C> ga o&apos;zgartirmasdan berish{" "}
                <C>404</C> qaytaradi. Faqat <C>type: &quot;place&quot;</C> natijalarida tafsilot bor
                va ularda boshidagi <C>p</C> harfi olib tashlanadi.
              </p>
            </Callout>
            <Code lang="js">{`const joy = data.results[0];

if (joy.type === "place") {
  const uuid = joy.id.slice(1);            // "p" olib tashlanadi
  const r = await fetch(\`\${BASE}/places/\${uuid}?key=\${KEY}\`);
  const tafsilot = (await r.json()).result;
}`}</Code>

            <H3 id="saralash">Saralash</H3>
            <UL>
              <li>nomning so&apos;rovga mos kelish darajasi (aniq moslik eng yuqori);</li>
              <li>
                ob&apos;ekt turining vazni — shahar tumandan, tuman ko&apos;chadan yuqori turadi;
              </li>
              <li>
                <C>lat</C>/<C>lng</C> berilgan bo&apos;lsa — xarita markazigacha masofa.
              </li>
            </UL>
            <P>
              Tartib <C>score</C> maydonida ko&apos;rinadi. Uning shkalasi qat&apos;iy belgilanmagan —
              faqat taqqoslash uchun ishlatiladi, chegara sifatida emas.
            </P>
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
          { href: "/docs/api/places-by-id", label: "Place by ID — place natijasining tafsiloti" },
        ],
      }}
    />
  );
}
