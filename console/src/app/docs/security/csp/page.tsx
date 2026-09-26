import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { KeyIcon, PlugIcon, ShieldIcon } from "@/components/docs/icons";

export const metadata = {
  title: "CSP va HTTPS — Security — OnDexMap",
  description:
    "Qat'iy Content-Security-Policy ostida OnDexMap xaritasini ishlatish: kerakli direktivalar, nonce va aralash tarkib.",
};

export default function CspPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="CSP va HTTPS"
        desc="Saytingizda Content-Security-Policy yoqilgan bo'lsa, xarita bir nechta direktivaga muhtoj bo'ladi. Ularsiz xarita ko'pincha jimgina buziladi: oq maydon, yozuvsiz tile yoki bo'sh ekran."
        pills={[
          { href: "#siyosat", label: "Tayyor siyosat", icon: <ShieldIcon size={15} /> },
          { href: "/docs/integration", label: "Integratsiya", icon: <PlugIcon size={15} /> },
          { href: "/docs/security/keys", label: "API kalitlar", icon: <KeyIcon size={15} /> },
        ]}
      />

      <H2 id="siyosat">Kerakli direktivalar</H2>
      <P>Kutubxona bundler orqali ulanganda:</P>
      <Code lang="csp">{`Content-Security-Policy:
  default-src 'self';
  script-src  'self';
  style-src   'self' 'unsafe-inline';
  worker-src  'self' blob:;
  img-src     'self' data: blob:;
  connect-src 'self' https://maps.ondex.uz https://tiles.ondex.uz;`}</Code>
      <P>CDN orqali ulaganda skript manbasini ham qo&apos;shing:</P>
      <Code lang="csp">{`  script-src 'self' https://unpkg.com;`}</Code>

      <H2 id="nega">Har bir direktiva nega kerak</H2>
      <Table
        head={["Direktiva", "Sabab", "Bo'lmasa"]}
        rows={[
          [
            <code key="1" className="whitespace-nowrap font-mono text-xs text-brand">
              worker-src blob:
            </code>,
            "Tile'lar fon oqimida (web worker) ochiladi, worker esa blob'dan yaratiladi",
            "Xarita bo'sh: hech qanday tile chizilmaydi",
          ],
          [
            <code key="2" className="whitespace-nowrap font-mono text-xs text-brand">
              connect-src maps.ondex.uz
            </code>,
            "Uslub (style.json), shriftlar (.pbf) va REST API so'rovlari",
            "Uslub yuklanmaydi — butunlay oq ekran",
          ],
          [
            <code key="3" className="whitespace-nowrap font-mono text-xs text-brand">
              connect-src tiles.ondex.uz
            </code>,
            "PMTiles fayllari Range so'rovlari bilan o'qiladi",
            "Fon bor, lekin ko'chalar va binolar yo'q",
          ],
          [
            <code key="4" className="whitespace-nowrap font-mono text-xs text-brand">
              img-src data: blob:
            </code>,
            "Marker belgilari, sprite va canvas tasvirlari",
            "Belgilar ko'rinmaydi",
          ],
          [
            <code key="5" className="whitespace-nowrap font-mono text-xs text-brand">
              style-src &apos;unsafe-inline&apos;
            </code>,
            "Kutubxona boshqaruv va marker elementlariga inline uslub qo'yadi",
            "Tugmalar va markerlar joyidan siljiydi",
          ],
        ]}
      />
      <Callout kind="warn">
        <p>
          <C>worker-src</C> direktivasini <C>script-src</C> qamrab olmaydi. U ko&apos;rsatilmasa xarita
          bo&apos;sh qoladi va brauzer konsolida <C>Refused to create a worker</C> xabari chiqadi.
        </p>
      </Callout>

      <H2 id="nonce">Nonce va strict-dynamic</H2>
      <P>
        Siyosatingiz <C>&apos;strict-dynamic&apos;</C> va nonce&apos;ga tayansa (Next.js&apos;dagi odatiy
        naqsh), kutubxonani <strong className="text-foreground">bundler orqali</strong> ulang — u holda
        skript sizning domeningizdan keladi va alohida ruxsat kerak bo&apos;lmaydi. CDN&apos;dagi{" "}
        <C>&lt;script&gt;</C> tegiga esa har so&apos;rovdagi nonce&apos;ni qo&apos;yish kerak
        bo&apos;ladi.
      </P>
      <Code lang="csp">{`script-src  'self' 'nonce-\${nonce}' 'strict-dynamic';
worker-src  'self' blob:;
img-src     'self' data: blob:;
connect-src 'self' https://maps.ondex.uz https://tiles.ondex.uz;`}</Code>
      <Callout kind="note">
        <p>
          <C>&apos;strict-dynamic&apos;</C> yoqilganda <C>&apos;self&apos;</C> va domen ro&apos;yxatlari{" "}
          <C>script-src</C> ichida e&apos;tiborga olinmaydi — faqat nonce ishlaydi. Shuning uchun CDN
          usuli bilan birga ishlatish noqulay.
        </p>
      </Callout>

      <H2 id="https">HTTPS va aralash tarkib</H2>
      <P>
        Sayt <C>https://</C> orqali ochilsa, barcha xarita manbalari ham <C>https://</C> bo&apos;lishi
        kerak. <C>http://</C> manzillar «aralash tarkib» sifatida bloklanadi va xarita
        ko&apos;rinmay qoladi.
      </P>
      <UL>
        <li>
          Uslub manzilini <C>https://maps.ondex.uz/tiles/style.json</C> ko&apos;rinishida yozing.
        </li>
        <li>
          O&apos;z uslubingizni ishlatsangiz, uning ichidagi <C>sprite</C>, <C>glyphs</C> va tile
          manzillari ham HTTPS bo&apos;lsin.
        </li>
        <li>
          Reverse proxy ortida ishlayotgan bo&apos;lsangiz, u manzillarni <C>http://</C> bilan
          shakllantirmasligiga ishonch hosil qiling.
        </li>
      </UL>

      <H2 id="joriy-qilish">Bosqichma-bosqich joriy qilish</H2>
      <P>
        Mavjud saytga qat&apos;iy siyosat qo&apos;shayotgan bo&apos;lsangiz, avval kuzatuv rejimida ishga
        tushiring — sayt ishlashda davom etadi, buzilishlar esa konsolda ko&apos;rinadi:
      </P>
      <Code lang="csp">{`Content-Security-Policy-Report-Only:
  default-src 'self';
  worker-src  'self' blob:;
  connect-src 'self' https://maps.ondex.uz https://tiles.ondex.uz;`}</Code>

      <H2 id="nosozlik">Nosozlikni topish</H2>
      <Table
        head={["Konsoldagi xabar", "Qaysi direktiva"]}
        rows={[
          [
            <C key="1">Refused to create a worker</C>,
            <>
              <C>worker-src &apos;self&apos; blob:</C>
            </>,
          ],
          [
            <C key="2">Refused to connect to …</C>,
            <>
              <C>connect-src</C> ga manzilni qo&apos;shing
            </>,
          ],
          [
            <C key="3">Refused to load the image …</C>,
            <>
              <C>img-src &apos;self&apos; data: blob:</C>
            </>,
          ],
          [
            <C key="4">Refused to apply inline style</C>,
            <>
              <C>style-src &apos;unsafe-inline&apos;</C>
            </>,
          ],
          [
            <C key="5">Mixed Content: … over HTTPS …</C>,
            <>
              Manba <C>http://</C> — HTTPS&apos;ga o&apos;tkazing
            </>,
          ],
        ]}
      />
      <P>
        Xarita oq bo&apos;lsa, birinchi navbatda <C>worker-src</C> va <C>connect-src</C> direktivalarini
        tekshiring — qolgan xatolar xaritani butunlay to&apos;xtatmaydi.
      </P>

      <Callout kind="note">
        <p>
          CSP brauzerni chegaralaydi, API kalit cheklovlari esa serverda ishlaydi — ular bir-biridan
          MUSTAQIL. Brauzer kaliti baribir faqat siz ko&apos;rsatgan domenlardan qabul qilinadi (
          <A href="/docs/security/domains">Domain restrictions</A>).
        </p>
      </Callout>

      <PrevNext current="/docs/security/csp" />
    </div>
  );
}
