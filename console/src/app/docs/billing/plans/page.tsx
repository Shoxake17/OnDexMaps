import { A, C, Callout, H2, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { CardIcon, ChartIcon, KeyIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Tariflar — Usage & Billing — OnDexMap",
  description: "OnDexMap tarif rejalari: bepul chegara, obuna va OnDex ekotizimi.",
};

const PLANS = [
  {
    name: "Bepul",
    price: "0 so'm",
    note: "Ro'yxatdan o'tgan har bir hisob uchun",
    rows: ["10 so'rov/sekund", "Oyiga 200 000 so'rov", "10 tagacha faol kalit", "Barcha REST API funksiyalari"],
  },
  {
    name: "Obuna",
    price: "50 000 so'm/oy",
    note: "Ishlatilgan so'rov soniga bog'liq emas",
    rows: ["100 so'rov/sekund", "Oylik chegara yo'q", "10 tagacha faol kalit", "Barcha REST API funksiyalari"],
    accent: true,
  },
  {
    name: "OnDex ekotizimi",
    price: "0 so'm",
    note: "OnDex mahsulotlari uchun ichki reja",
    rows: ["500 so'rov/sekund", "Oylik chegara yo'q", "10 tagacha faol kalit", "Barcha REST API funksiyalari"],
  },
];

export default function PlansPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Tariflar"
        desc="Xaritani ko'rsatish har doim bepul va kalitsiz. Tarif faqat REST API chaqiruvlariga — geocode, reverse, directions va places — taalluqli."
        pills={[
          { href: "/billing", label: "Obuna so'rash", icon: <CardIcon size={15} /> },
          { href: "/usage", label: "Statistika", icon: <ChartIcon size={15} /> },
          { href: "/keys", label: "API kalitlar", icon: <KeyIcon size={15} /> },
        ]}
      />

      <H2 id="rejalar">Rejalar</H2>
      <div className="my-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`rounded-xl border bg-card p-5 ${p.accent ? "border-brand/50 shadow-sm" : "border-border"}`}
          >
            <div className="text-sm font-semibold">{p.name}</div>
            <div className="mt-2 text-2xl font-bold">{p.price}</div>
            <div className="mt-1 text-xs text-muted">{p.note}</div>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {p.rows.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <H2 id="taqqoslash">Farqi nimada</H2>
      <Table
        head={["", "Bepul", "Obuna", "Ekotizim"]}
        rows={[
          [
            <strong key="a" className="text-foreground">
              Tezlik
            </strong>,
            "10 so'rov/s",
            "100 so'rov/s",
            "500 so'rov/s",
          ],
          [
            <strong key="a" className="text-foreground">
              Oylik chegara
            </strong>,
            "200 000",
            "yo'q",
            "yo'q",
          ],
          [
            <strong key="a" className="text-foreground">
              Narx
            </strong>,
            "0",
            "50 000 so'm/oy",
            "0",
          ],
          [
            <strong key="a" className="text-foreground">
              Kimga
            </strong>,
            "Kichik sayt, prototip",
            "Doimiy yuk bo'lgan mahsulot",
            "OnDex mahsulotlari",
          ],
        ]}
      />
      <Callout kind="note">
        <p>
          Obuna narxi qat&apos;iy: oyiga 50 000 so&apos;m. So&apos;rovlar soni narxga ta&apos;sir
          qilmaydi — kutilmagan hisob chiqmaydi.
        </p>
      </Callout>

      <H2 id="otish">Obunaga o&apos;tish</H2>
      <UL>
        <li>
          <A href="/billing">Hisob-faktura</A> bo&apos;limida so&apos;rov qoldiriladi.
        </li>
        <li>So&apos;rov ko&apos;rib chiqilgandan keyin reja yoqiladi va chegara olib tashlanadi.</li>
        <li>Keyingi oydan boshlab har oy hisob-faktura chiqadi.</li>
      </UL>
      <P>
        To&apos;lov tartibi va holatlar — <A href="/docs/billing/invoices">Hisob-fakturalar</A>.
      </P>

      <H2 id="chegara">Chegara tugaganda</H2>
      <P>
        Bepul rejada oylik chegara tugasa, REST API <C>429 quota_exceeded</C> qaytaradi. Xarita
        ko&apos;rsatish to&apos;xtamaydi — u chegaraga kirmaydi. Tezlik chegarasiga urilganda esa{" "}
        <C>429 rate_limited</C> va <C>Retry-After</C> sarlavhasi keladi (
        <A href="/docs/api/errors">Errors</A>).
      </P>
      <P>
        So&apos;rovlar sonini kamaytirish usullari —{" "}
        <A href="/docs/billing/usage">Statistika</A> sahifasida.
      </P>

      <PrevNext current="/docs/billing/plans" />
    </div>
  );
}
