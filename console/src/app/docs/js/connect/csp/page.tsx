import { A, C, Callout, Code, H2, H3, P, PrevNext, UL } from "@/components/docs/parts";

export const metadata = {
  title: "API'ni ulash: CSP bilan — OnDexMap",
  description: "Qat'iy Content-Security-Policy ostida OnDexMap xaritasini ishlatish uchun kerakli direktivalar.",
};

export default function ConnectCspPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">API&apos;ni ulash: CSP bilan</h1>

      <P>
        Saytingizda <C>Content-Security-Policy</C> yoqilgan bo&apos;lsa, xarita bir nechta direktivaga
        muhtoj bo&apos;ladi. Ularsiz xarita ko&apos;pincha <strong className="text-foreground">jimgina</strong>{" "}
        buziladi: oq maydon, yozuvsiz tile yoki umuman bo&apos;sh ekran.
      </P>

      <H2 id="policy">Kerakli direktivalar</H2>
      <P>Kutubxonani paket sifatida (bundler orqali) ulaganda:</P>
      <Code>{`Content-Security-Policy:
  default-src 'self';
  script-src  'self';
  style-src   'self' 'unsafe-inline';
  worker-src  'self' blob:;
  img-src     'self' data: blob:;
  connect-src 'self' https://maps.ondex.uz https://tiles.ondex.uz;`}</Code>

      <P>CDN orqali ulagan bo&apos;lsangiz, skript manbasini ham qo&apos;shing:</P>
      <Code>{`  script-src 'self' https://unpkg.com;`}</Code>

      <H2 id="why">Har bir direktiva nega kerak</H2>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-2 font-medium">Direktiva</th>
              <th className="pb-2 font-medium">Sabab</th>
              <th className="pb-2 font-medium">Bo&apos;lmasa nima bo&apos;ladi</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "worker-src blob:",
                "MapLibre tile'larni fon oqimida (web worker) ochadi, worker esa blob'dan yaratiladi",
                "Xarita bo'sh: hech qanday tile chizilmaydi",
              ],
              [
                "connect-src maps.ondex.uz",
                "Uslub (style.json), shriftlar (.pbf) va REST API so'rovlari",
                "Uslub yuklanmaydi — butunlay oq ekran",
              ],
              [
                "connect-src tiles.ondex.uz",
                "PMTiles fayllari Range so'rovlari bilan o'qiladi",
                "Fon bor, lekin ko'chalar/binolar yo'q",
              ],
              [
                "img-src data: blob:",
                "Marker belgilari, sprite va canvas tasvirlari",
                "Belgilar ko'rinmaydi",
              ],
              [
                "style-src 'unsafe-inline'",
                "Kutubxona boshqaruv va marker elementlariga inline uslub qo'yadi",
                "Tugmalar va markerlar joyidan siljiydi",
              ],
            ].map(([d, why, fail]) => (
              <tr key={d} className="border-b border-border/60 last:border-0 align-top">
                <td className="py-2 pr-3">
                  <code className="font-mono text-xs text-brand">{d}</code>
                </td>
                <td className="py-2 pr-3 text-muted">{why}</td>
                <td className="py-2 text-muted">{fail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout kind="warn">
        <p>
          <C>worker-src</C> ni <C>script-src</C> qamrab olmaydi. Ko&apos;p saytlarda aynan shu direktiva
          unutiladi va xarita hech qanday xato xabarisiz bo&apos;sh qoladi — brauzer konsolidagi yagona
          belgi <C>Refused to create a worker</C> qatori bo&apos;ladi.
        </p>
      </Callout>

      <H2 id="nonce">Nonce bilan ishlatish</H2>
      <P>
        Agar siyosatingiz <C>&apos;strict-dynamic&apos;</C> va nonce&apos;ga tayansa (Next.js&apos;dagi
        odatiy naqsh), kutubxonani <strong className="text-foreground">bundler orqali</strong> ulang — u
        holda skript sizning domeningizdan keladi va alohida ruxsat kerak bo&apos;lmaydi. CDN&apos;dagi{" "}
        <C>&lt;script&gt;</C> tegiga esa har so&apos;rovdagi nonce&apos;ni qo&apos;yish kerak bo&apos;ladi.
      </P>
      <Code>{`# Next.js middleware'da (har so'rovga yangi nonce)
script-src 'self' 'nonce-\${nonce}' 'strict-dynamic';
worker-src 'self' blob:;
connect-src 'self' https://maps.ondex.uz https://tiles.ondex.uz;`}</Code>

      <H2 id="https">HTTPS va aralash tarkib</H2>
      <P>
        Sayt <C>https://</C> da bo&apos;lsa, barcha xarita manbalari ham <C>https://</C> bo&apos;lishi
        SHART. Bitta <C>http://</C> manzil ham brauzer tomonidan &quot;aralash tarkib&quot; sifatida
        bloklanadi va natija xuddi CSP xatosidek ko&apos;rinadi — oq xarita, tushunarsiz sabab.
      </P>

      <H3 id="debug">Nosozlikni topish</H3>
      <UL>
        <li>
          Brauzer konsolidagi <C>Refused to ...</C> qatorlarini o&apos;qing — CSP qaysi direktivani
          bloklaganini aniq aytadi.
        </li>
        <li>
          Avval siyosatni <C>Content-Security-Policy-Report-Only</C> rejimida sinang: sayt ishlashda davom
          etadi, buzilishlar esa konsolda ko&apos;rinadi.
        </li>
        <li>
          Xarita oq bo&apos;lsa, birinchi navbatda <C>worker-src</C> va <C>connect-src</C> ni tekshiring —
          amaliyotda xatolarning aksariyati shu ikkitasida.
        </li>
      </UL>

      <P>
        REST API chaqiruvlari uchun kalit cheklovlari ham CSP&apos;dan MUSTAQIL ishlaydi: brauzer kaliti
        faqat siz ko&apos;rsatgan domenlardan qabul qilinadi (<A href="/docs/api#key">API kalitlar</A>).
      </P>

      <PrevNext current="/docs/js/connect/csp" />
    </div>
  );
}
