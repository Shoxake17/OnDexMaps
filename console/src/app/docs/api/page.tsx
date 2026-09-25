import Link from "next/link";
import { PrevNext } from "@/components/docs/parts";

export const metadata = { title: "REST API — OnDex Console" };

function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-brand-dark text-slate-100 p-4 text-sm overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  id,
  method,
  path,
  desc,
  params,
  example,
}: {
  id: string;
  method: string;
  path: string;
  desc: string;
  params: [string, string][];
  example: string;
}) {
  return (
    <div id={id} className="scroll-mt-20 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-xs font-mono font-bold">{method}</span>
        <code className="text-sm font-semibold">{path}</code>
      </div>
      <p className="text-sm text-muted mb-3">{desc}</p>
      <table className="w-full text-sm mb-3">
        <tbody>
          {params.map(([name, d]) => (
            <tr key={name} className="border-b border-border/60 last:border-0">
              <td className="py-1 pr-3 font-mono text-brand whitespace-nowrap">{name}</td>
              <td className="py-1 text-muted">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Code>{example}</Code>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-3">REST API</h1>
        <p className="text-muted">
          OnDexMap REST API'si Google Maps Platform'ga o'xshab ishlaydi: geokodlash (nom → koordinata), teskari
          geokodlash (koordinata → manzil), A → B yo'l ko'rsatish va ob'ekt ma'lumoti. Boshqa hech qanday amal
          (ob'ekt qo'shish, o'chirish, moderatsiya) API orqali MAVJUD EMAS — bu faqat OnDexMap jamoasi tomonidan
          boshqariladi.
        </p>
      </div>

      <>
        <section id="key" className="scroll-mt-24">
          <h2 className="text-xl font-semibold mb-3">1. API kalit</h2>
          <p className="text-sm text-muted mb-3">
            <Link href="/keys" className="text-brand hover:underline">
              Boshqaruv panelida
            </Link>{" "}
            ikki turdagi kalit yaratishingiz mumkin:
          </p>
          <ul className="text-sm space-y-2 list-disc pl-5 text-muted">
            <li>
              <strong className="text-foreground">Server kaliti</strong> — o'z serveringizdan chaqirish uchun.
              Faqat <code>X-API-Key</code> sarlavhasida yuboriladi (URL'da hech qachon emas). Ixtiyoriy ravishda IP
              manzillarga cheklanadi.
            </li>
            <li>
              <strong className="text-foreground">Brauzer kaliti</strong> — sahifangizdan to'g'ridan-to'g'ri
              chaqirish uchun. Ruxsat etilgan domen(lar) MAJBURIY (Google Maps'dagi "HTTP referrers" kabi); shu
              domenlardan tashqarida ishlamaydi.
            </li>
          </ul>
          <p className="text-sm text-muted mt-3">
            Kalit sir bir marta ko'rsatiladi — uni saqlab qo'ying. Yo'qotsangiz "Almashtirish" bilan yangi kalit
            oling (eskisi 24 soat davomida ham ishlaydi — uzilishsiz o'tish uchun).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. So'rov yuborish</h2>
          <Code>{`curl -H "X-API-Key: omk_s_..." \\
  "https://console.ondex.uz/v2/geocode?q=Chust"`}</Code>
          <p className="text-sm text-muted mt-2">
            Brauzer kaliti bilan (sahifangizdan): <code>?key=omk_b_...</code> parametri orqali ham yuborish mumkin.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Endpointlar</h2>

          <Endpoint
            id="geocode"
            method="GET"
            path="/v2/geocode"
            desc="Nom bo'yicha joy qidirish (shahar, ko'cha, mahalla, ob'ekt)."
            params={[
              ["q", "qidiruv matni (2–100 belgi)"],
              ["limit", "natijalar soni, 1–25 (standart 10)"],
              ["lat, lng", "ixtiyoriy: xarita markazi — yaqin natija oldin chiqadi"],
            ]}
            example={`{
  "status": "OK",
  "results": [
    { "id": "...", "type": "poi", "name": "Chust bozori", "lat": 41.0, "lng": 71.24 }
  ]
}`}
          />
          <Endpoint
            id="reverse"
            method="GET"
            path="/v2/reverse"
            desc="Koordinata bo'yicha manzil."
            params={[
              ["lat, lng", "koordinata (xizmat hududi ichida)"],
            ]}
            example={`{ "status": "OK", "result": { "text": "Chust, Bobur ko'chasi" } }`}
          />
          <Endpoint
            id="directions"
            method="GET"
            path="/v2/directions"
            desc="Ikki nuqta orasidagi haqiqiy yo'l (masofa, vaqt, chiziq)."
            params={[
              ["origin", "`lat,lng`"],
              ["destination", "`lat,lng`"],
            ]}
            example={`{
  "status": "OK",
  "routes": [{ "distance_m": 1240, "duration_s": 180, "geometry": { "type": "LineString", "coordinates": [...] } }]
}`}
          />
          <Endpoint
            id="places"
            method="GET"
            path="/v2/places"
            desc="To'rtburchak ichidagi tasdiqlangan ob'ektlar (GeoJSON)."
            params={[["bbox", "g'arb,janub,sharq,shimol"]]}
            example={`{ "status": "OK", "result": { "type": "FeatureCollection", "features": [...] } }`}
          />
          <Endpoint
            id="places-by-id"
            method="GET"
            path="/v2/places/{id}"
            desc="Bitta ob'ektning to'liq ma'lumoti."
            params={[["id", "ob'ekt identifikatori"]]}
            example={`{ "status": "OK", "result": { "id": "...", "name": "...", "lat": 41.0, "lng": 71.24 } }`}
          />
        </section>

        <section id="errors" className="scroll-mt-24">
          <h2 className="text-xl font-semibold mb-3">4. Xatolar</h2>
          <p className="text-sm text-muted mb-3">
            Har bir xato javob <code>status</code> va <code>error.code</code> bilan keladi:
          </p>
          <Code>{`{ "status": "REQUEST_DENIED", "error": { "code": "quota_exceeded", "message": "..." } }`}</Code>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="pb-2 font-medium">Holat</th>
                <th className="pb-2 font-medium">Kod</th>
                <th className="pb-2 font-medium">Sabab</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["401", "missing_key / invalid_key", "kalit yo'q yoki noto'g'ri"],
                ["403", "key_restricted", "domen/IP ro'yxatiga mos kelmadi"],
                ["403", "api_not_allowed", "bu funksiya kalitda yoqilmagan yoki umuman mavjud emas"],
                ["429", "rate_limited", "tezlik chegarasi (Retry-After sarlavhasiga qarang)"],
                ["429", "quota_exceeded", "oylik bepul chegara tugadi — obuna oling"],
                ["503", "service_unavailable", "vaqtincha; qayta urinib ko'ring"],
              ].map(([s, c, d]) => (
                <tr key={c} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 font-mono">{s}</td>
                  <td className="py-1.5 font-mono text-brand">{c}</td>
                  <td className="py-1.5 text-muted">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="pricing" className="scroll-mt-20">
          <h2 className="text-xl font-semibold mb-3">5. Tarif rejalari</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {[
              ["Bepul", "10 so'rov/s", "200 000 so'rov/oy", "0 so'm"],
              ["Obuna", "100 so'rov/s", "Chegarasiz", "50 000 so'm/oy"],
              ["OnDex ekotizimi", "500 so'rov/s", "Chegarasiz", "0 so'm"],
            ].map(([name, rps, cap, price]) => (
              <div key={name} className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold">{name}</div>
                <div className="text-muted mt-1">{rps}</div>
                <div className="text-muted">{cap}</div>
                <div className="mt-2 font-bold">{price}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            Obuna narxi ishlatilgan so'rov soniga bog'liq emas — oyiga qat'iy 50 000 so'm. To'lov: hisob-faktura +
            qo'lda tasdiqlash (boshqaruv panelidagi "Hisob-faktura" bo'limi).
          </p>
        </section>

        <section id="faq" className="scroll-mt-20 space-y-4">
          <h2 className="text-xl font-semibold">6. Ko'p so'raladigan savollar</h2>
          {[
            ["API kalitni qanday olaman?", "Email va bir martalik kod bilan kiring, so'ng \"API kalitlar\" bo'limida yarating. Kalit FAQAT bir marta ko'rsatiladi."],
            ["Bepul va obuna reja farqi nimada?", "Bepul: 10 so'rov/s, oyiga 200 000. Obuna: 100 so'rov/s, oylik chegarasiz, oyiga qat'iy 50 000 so'm — ishlatilgan so'rov soniga bog'liq emas."],
            ["API orqali xaritaga joy qo'sha olamanmi?", "Yo'q. /v2 faqat O'QISH uchun (geocode, reverse, directions, places). Yozish funksiyasi API'da umuman yo'q."],
            ["Server va brauzer kaliti farqi?", "Server kaliti — faqat X-API-Key sarlavhasida, ixtiyoriy IP cheklovi bilan. Brauzer kaliti — ?key= orqali ham yuboriladi, lekin ruxsat etilgan domen(lar) MAJBURIY."],
            ["Kalitim oshkor bo'lib qolsa nima qilaman?", "\"Almashtirish\"ni bosing — yangi kalit darhol ishlaydi, eskisi 24 soat davomida ham ishlaydi (uzilishsiz o'tish), so'ng avtomatik bekor bo'ladi."],
            ["To'lovni qanday amalga oshiraman?", "Obuna yoqilgach har oy hisob-faktura chiqadi. To'lov qo'lda tasdiqlanadi — \"Hisob-faktura\" bo'limida ko'rsatma va holatni kuzatib borasiz."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-xl border border-border bg-card p-5">
              <div className="font-semibold mb-1">{q}</div>
              <p className="text-sm text-muted">{a}</p>
            </div>
          ))}
        </section>
      </>

      <PrevNext current="/docs/api" />
    </div>
  );
}
