import { A, C, Callout, CardGrid, Code, H2, P, PageHead, PrevNext, Table } from "@/components/docs/parts";
import { BookIcon, KeyIcon, ServerIcon, PinIcon, LayersIcon, HelpIcon, CodeIcon } from "@/components/docs/icons";

export const metadata = {
  title: "REST API — OnDexMap",
  description:
    "OnDexMap REST API: geocode, reverse geocode, directions va places. Autentifikatsiya, javob shakli va xatolar.",
};

export default function RestApiPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="REST API"
        desc="To'rtta amal: geokodlash (nom → koordinata), teskari geokodlash (koordinata → manzil), ikki nuqta orasidagi marshrut va ob'ekt ma'lumoti. Barcha so'rovlar faqat o'qish uchun."
        pills={[
          { href: "/docs/api/reference", label: "API Reference", icon: <BookIcon size={15} /> },
          { href: "/keys", label: "API kalit olish", icon: <KeyIcon size={15} /> },
          { href: "/openapi.yaml", label: "openapi.yaml", icon: <ServerIcon size={15} /> },
        ]}
      />

      <H2 id="endpointlar">Endpointlar</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/api/geocode",
            title: "Geocode",
            desc: "Nom bo'yicha joy qidirish: shahar, ko'cha, mahalla, ob'ekt.",
            icon: <PinIcon size={20} />,
          },
          {
            href: "/docs/api/reverse",
            title: "Reverse Geocode",
            desc: "Koordinata bo'yicha manzil aniqlash.",
            icon: <PinIcon size={20} />,
          },
          {
            href: "/docs/api/directions",
            title: "Directions",
            desc: "Ikki nuqta orasidagi haqiqiy yo'l: masofa, vaqt, chiziq.",
            icon: <CodeIcon size={20} />,
          },
          {
            href: "/docs/api/places",
            title: "Places",
            desc: "To'rtburchak ichidagi tasdiqlangan ob'ektlar (GeoJSON).",
            icon: <LayersIcon size={20} />,
          },
          {
            href: "/docs/api/places-by-id",
            title: "Place by ID",
            desc: "Bitta ob'ektning to'liq ma'lumoti.",
            icon: <LayersIcon size={20} />,
          },
          {
            href: "/docs/api/errors",
            title: "Errors",
            desc: "Xato kodlari, sabablari va qayta urinish qoidalari.",
            icon: <HelpIcon size={20} />,
          },
        ]}
      />

      <H2 id="asosiy-manzil">Asosiy manzil</H2>
      <Code lang="terminal">{`https://maps.ondex.uz/v2`}</Code>
      <P>
        Barcha endpointlar <C>GET</C> usulini qabul qiladi. Ro&apos;yxatda yo&apos;q yo&apos;l yoki boshqa
        usul <C>api_not_allowed</C> bilan rad etiladi.
      </P>

      <H2 id="autentifikatsiya">Autentifikatsiya</H2>
      <P>Kalit har bir so&apos;rovda yuboriladi. Server tomonidan:</P>
      <Code lang="terminal">{`curl -H "X-API-Key: omk_s_..." \\
  "https://maps.ondex.uz/v2/geocode?q=Chust"`}</Code>
      <P>Brauzerdan (sahifangizdan):</P>
      <Code lang="js">{`const res = await fetch(
  "https://maps.ondex.uz/v2/geocode?q=Chust&key=omk_b_...",
);
const data = await res.json();`}</Code>
      <Table
        head={["", "Server kaliti", "Brauzer kaliti"]}
        rows={[
          [
            <strong key="a" className="text-foreground">
              Prefiks
            </strong>,
            <C key="b">omk_s_</C>,
            <C key="c">omk_b_</C>,
          ],
          [
            <strong key="a" className="text-foreground">
              Yuborish
            </strong>,
            <>
              faqat <C>X-API-Key</C> sarlavhasi
            </>,
            <>
              <C>X-API-Key</C> yoki <C>?key=</C>
            </>,
          ],
          [
            <strong key="a" className="text-foreground">
              Cheklov
            </strong>,
            "IP ro'yxati (ixtiyoriy)",
            "domen ro'yxati (majburiy)",
          ],
        ]}
      />
      <Callout kind="warn">
        <p>
          Server kaliti hech qachon sahifa kodiga joylashtirilmaydi — u brauzerda ochiq
          ko&apos;rinadi. Batafsil — <A href="/docs/security/keys">API kalitlar</A>.
        </p>
      </Callout>

      <H2 id="javob-shakli">Javob shakli</H2>
      <P>
        Barcha javoblarda <C>status</C> maydoni bo&apos;ladi. Natija <C>results</C> (ro&apos;yxat),{" "}
        <C>result</C> (bitta obyekt) yoki <C>routes</C> maydonida keladi:
      </P>
      <Code lang="json">{`{ "status": "OK", "results": [ … ] }      // geocode
{ "status": "OK", "result": { … } }      // reverse, places, places/{id}
{ "status": "OK", "routes": [ … ] }      // directions
{ "status": "ZERO_RESULTS" }             // topilmadi — xato EMAS`}</Code>
      <P>
        Xato javoblari va qayta urinish qoidalari — <A href="/docs/api/errors">Errors</A> sahifasida.
      </P>

      <H2 id="limitlar">Limitlar</H2>
      <Table
        head={["Reja", "Tezlik", "Oylik chegara"]}
        rows={[
          ["Bepul", "10 so'rov/sekund", "200 000 so'rov"],
          ["Obuna", "100 so'rov/sekund", "chegara yo'q"],
          ["OnDex ekotizimi", "500 so'rov/sekund", "chegara yo'q"],
        ]}
      />
      <P>
        Joriy holat <A href="/usage">Foydalanish</A> bo&apos;limida; rejalar —{" "}
        <A href="/docs/billing/plans">Tariflar</A>.
      </P>

      <H2 id="kontrakt">Rasmiy kontrakt</H2>
      <P>
        Barcha parametrlar, javob sxemalari va brauzerdan sinash —{" "}
        <A href="/docs/api/reference">API Reference</A>. Mashina o&apos;qiydigan OpenAPI 3.1 fayli:{" "}
        <A href="/openapi.yaml">openapi.yaml</A> — undan mijoz kodini generatsiya qilish mumkin.
      </P>

      <PrevNext current="/docs/api" />
    </div>
  );
}
