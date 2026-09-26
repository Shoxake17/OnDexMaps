import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { BookIcon, KeyIcon, ServerIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Errors — REST API — OnDexMap",
  description: "OnDexMap REST API xato javoblari: kodlar, sabablar va qayta urinish qoidalari.",
};

export default function ErrorsPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Errors"
        desc="Har bir xato javob bir xil shaklda keladi: status va error.code. Kod bo'yicha nima qilish kerakligi aniq belgilangan."
        pills={[
          { href: "/docs/api", label: "REST API", icon: <ServerIcon size={15} /> },
          { href: "/docs/api/reference", label: "API Reference", icon: <BookIcon size={15} /> },
          { href: "/keys", label: "API kalitlar", icon: <KeyIcon size={15} /> },
        ]}
      />

      <H2 id="shakl">Javob shakli</H2>
      <Code lang="json">{`{
  "status": "REQUEST_DENIED",
  "error": {
    "code": "quota_exceeded",
    "message": "oylik chegara tugadi"
  }
}`}</Code>
      <Table
        head={["Maydon", "Ma'nosi"]}
        rows={[
          [
            <C key="1">status</C>,
            <>
              Umumiy holat: <C>OK</C>, <C>ZERO_RESULTS</C>, <C>INVALID_REQUEST</C>,{" "}
              <C>REQUEST_DENIED</C>, <C>UNAVAILABLE</C>
            </>,
          ],
          [<C key="2">error.code</C>, <>Mashina o&apos;qiydigan aniq sabab — mantiq shunga qaraladi</>],
          [<C key="3">error.message</C>, <>Odam o&apos;qishi uchun izoh; matni o&apos;zgarishi mumkin</>],
        ]}
      />
      <Callout kind="warn">
        <p>
          Dasturda <C>error.message</C> matniga tayanmang — u o&apos;zgarishi mumkin. Har doim{" "}
          <C>error.code</C> qiymatini tekshiring.
        </p>
      </Callout>

      <H2 id="kodlar">Xato kodlari</H2>
      <Table
        head={["HTTP", "Kod", "Sabab", "Nima qilish kerak"]}
        rows={[
          [
            <code key="a" className="font-mono">
              400
            </code>,
            <code key="b" className="font-mono text-brand">
              INVALID_REQUEST
            </code>,
            "Parametr yo'q, formati noto'g'ri yoki oraliqdan tashqarida",
            "So'rovni tuzating; qayta urinish yordam bermaydi",
          ],
          [
            <code key="a" className="font-mono">
              401
            </code>,
            <code key="b" className="font-mono text-brand">
              missing_key
            </code>,
            "Kalit umuman yuborilmagan",
            <>
              <C>X-API-Key</C> sarlavhasini yoki <C>?key=</C> ni qo&apos;shing
            </>,
          ],
          [
            <code key="a" className="font-mono">
              401
            </code>,
            <code key="b" className="font-mono text-brand">
              invalid_key
            </code>,
            "Kalit noto'g'ri yoki bekor qilingan",
            <>
              Konsolda holatini tekshiring — <A href="/keys">API kalitlar</A>
            </>,
          ],
          [
            <code key="a" className="font-mono">
              403
            </code>,
            <code key="b" className="font-mono text-brand">
              key_restricted
            </code>,
            "So'rov manbasi kalitning domen yoki IP ro'yxatiga kirmaydi",
            <>
              Ro&apos;yxatga domen yoki IP qo&apos;shing —{" "}
              <A href="/docs/security/domains">Domain restrictions</A>
            </>,
          ],
          [
            <code key="a" className="font-mono">
              403
            </code>,
            <code key="b" className="font-mono text-brand">
              api_not_allowed
            </code>,
            "Bu funksiya kalitda yoqilmagan",
            "Kalitni tahrirlab, kerakli API'ni belgilang",
          ],
          [
            <code key="a" className="font-mono">
              404
            </code>,
            <code key="b" className="font-mono text-brand">
              not_found
            </code>,
            <>
              So&apos;ralgan ob&apos;ekt yo&apos;q, tasdiqlanmagan yoki id noto&apos;g&apos;ri
              shaklda. <C>status</C> qiymati — <C>NOT_FOUND</C>
            </>,
            <>
              Identifikator shaklini tekshiring —{" "}
              <A href="/docs/api/places-by-id">Place by ID</A>
            </>,
          ],
          [
            <code key="a" className="font-mono">
              429
            </code>,
            <code key="b" className="font-mono text-brand">
              rate_limited
            </code>,
            "Sekundiga ruxsat etilgan so'rov soni oshib ketdi",
            <>
              <C>Retry-After</C> sarlavhasidagi vaqtdan keyin qayta urining
            </>,
          ],
          [
            <code key="a" className="font-mono">
              429
            </code>,
            <code key="b" className="font-mono text-brand">
              quota_exceeded
            </code>,
            "Oylik bepul chegara tugadi",
            <>
              Keyingi oygacha kutiladi yoki <A href="/docs/billing/plans">obuna</A> olinadi
            </>,
          ],
          [
            <code key="a" className="font-mono">
              503
            </code>,
            <code key="b" className="font-mono text-brand">
              service_unavailable
            </code>,
            "Xizmat vaqtincha javob bermayapti",
            "Kechikish bilan qayta urining",
          ],
        ]}
      />

      <H2 id="zero-results">ZERO_RESULTS — xato emas</H2>
      <P>
        Hech narsa topilmaganda HTTP holati <C>200</C> bo&apos;lib qoladi, <C>status</C> esa{" "}
        <C>ZERO_RESULTS</C> bo&apos;ladi. Bu xato emas: so&apos;rov to&apos;g&apos;ri, natija esa bo&apos;sh.
      </P>
      <Code lang="js">{`const res = await fetch(url);
const data = await res.json();

if (!res.ok) {
  // Haqiqiy xato: 4xx yoki 5xx
  throw new Error(data.error?.code ?? String(res.status));
}

if (data.status === "ZERO_RESULTS") {
  ko'rsat("Hech narsa topilmadi");
  return;
}

ishlat(data.results);`}</Code>

      <H2 id="qayta-urinish">Qayta urinish qoidalari</H2>
      <UL>
        <li>
          <strong className="text-foreground">400 va 403</strong> — qayta urinmang. So&apos;rov yoki kalit
          sozlamasi noto&apos;g&apos;ri, u o&apos;zidan tuzalmaydi.
        </li>
        <li>
          <strong className="text-foreground">429 rate_limited</strong> —{" "}
          <C>Retry-After</C> sarlavhasiga rioya qiling.
        </li>
        <li>
          <strong className="text-foreground">429 quota_exceeded</strong> — qayta urinish foydasiz, chegara
          oy oxirigacha tiklanmaydi.
        </li>
        <li>
          <strong className="text-foreground">503</strong> — eksponensial kechikish bilan bir necha marta
          urinib ko&apos;rish mumkin.
        </li>
      </UL>
      <Code lang="js">{`async function soraw(url, urinish = 0) {
  const res = await fetch(url);
  if (res.ok) return res.json();

  const data = await res.json().catch(() => ({}));
  const code = data.error?.code;

  // Faqat vaqtinchalik xatolarda qayta urinamiz
  const vaqtinchalik = res.status === 503 || code === "rate_limited";
  if (!vaqtinchalik || urinish >= 3) {
    throw new Error(code ?? String(res.status));
  }

  const kutish = code === "rate_limited"
    ? Number(res.headers.get("Retry-After") ?? 1) * 1000
    : 2 ** urinish * 500;

  await new Promise((r) => setTimeout(r, kutish));
  return soraw(url, urinish + 1);
}`}</Code>

      <H2 id="sarlavhalar">Javob sarlavhalari</H2>
      <P>
        Har bir muvaffaqiyatli javob joriy holatni sarlavhalarda qaytaradi. Ular CORS orqali
        ochilgan, ya&apos;ni brauzerdan ham o&apos;qiladi:
      </P>
      <Table
        head={["Sarlavha", "Ma'nosi", "Misol"]}
        rows={[
          [
            <code key="1" className="font-mono text-brand">
              X-Plan
            </code>,
            "Joriy tarif rejasi",
            <C key="v">free</C>,
          ],
          [
            <code key="2" className="font-mono text-brand">
              X-Quota-Limit
            </code>,
            "Oylik chegara (obunada bo'lmaydi)",
            <C key="v">200000</C>,
          ],
          [
            <code key="3" className="font-mono text-brand">
              X-Quota-Used
            </code>,
            "Shu oyda ishlatilgan so'rovlar soni",
            <C key="v">16</C>,
          ],
          [
            <code key="4" className="font-mono text-brand">
              Retry-After
            </code>,
            <>
              Faqat <C>429</C> da: necha sekund kutish kerak
            </>,
            <C key="v">2</C>,
          ],
        ]}
      />
      <Code lang="js">{`const res = await fetch(url);

const qolgan = Number(res.headers.get("X-Quota-Limit"))
             - Number(res.headers.get("X-Quota-Used"));

if (Number.isFinite(qolgan) && qolgan < 1000) {
  console.warn("oylik chegara tugayapti:", qolgan);
}`}</Code>
      <Callout kind="note">
        <p>
          Brauzerdan o&apos;qish uchun qo&apos;shimcha sozlama shart emas — server bu sarlavhalarni{" "}
          <C>Access-Control-Expose-Headers</C> ro&apos;yxatiga o&apos;zi qo&apos;shadi.
        </p>
      </Callout>

      <H2 id="tez-uchraydigan">Tez uchraydigan sabablar</H2>
      <Table
        head={["Belgisi", "Aslida nima bo'lgan"]}
        rows={[
          [
            <>
              Lokal ishlaydi, saytda <C>key_restricted</C>
            </>,
            "Kalit domen ro'yxatida faqat localhost bor",
          ],
          [
            <>
              Brauzerdan <C>401 invalid_key</C>
            </>,
            "Server kaliti ishlatilgan — brauzerdan faqat omk_b_ qabul qilinadi",
          ],
          [
            <>
              <C>api_not_allowed</C>, lekin kalit yangi
            </>,
            "Yaratishda faqat geocode belgilangan, boshqalari yoqilmagan",
          ],
          [
            <>
              <C>400 INVALID_REQUEST</C> reverse&apos;da
            </>,
            "Koordinata xizmat hududidan tashqarida (40.5–41.6 / 70.5–72.0)",
          ],
          [
            <>
              <C>400 INVALID_REQUEST</C> places&apos;da
            </>,
            "bbox tartibi teskari: to'g'risi g'arb,janub,sharq,shimol",
          ],
          [
            <>
              <C>404 not_found</C>, lekin id geocode&apos;dan olingan
            </>,
            <>
              Geocode id&apos;si boshqa shaklda: <C>place</C> uchun boshidagi «p» olib tashlanadi,
              <C>g…</C> uchun esa tafsilot yo&apos;q
            </>,
          ],
          [
            <>
              Reverse javobida <C>lat</C>/<C>lng</C> yo&apos;q
            </>,
            "Shunday bo'lishi kerak — endpoint faqat manzil qaytaradi, koordinatani siz bergansiz",
          ],
        ]}
      />

      <PrevNext current="/docs/api/errors" />
    </div>
  );
}
