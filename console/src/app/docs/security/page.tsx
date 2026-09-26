import { A, C, Callout, CardGrid, H2, P, PageHead, PrevNext, Table } from "@/components/docs/parts";
import { GlobeIcon, KeyIcon, ServerIcon, ShieldIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Security & Limits — OnDexMap",
  description: "API kalitlar, domen va IP cheklovlari, CSP va HTTPS, so'rov limitlari.",
};

export default function SecurityPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Security & Limits"
        desc="Kalit oshkor bo'lsa ham undan boshqa birov foydalana olmasligi kerak. Buning uchun har bir kalit uch qatlam bilan chegaralanadi: turi, manbasi va yoqilgan funksiyalari."
        pills={[
          { href: "/docs/security/keys", label: "API kalitlar", icon: <KeyIcon size={15} /> },
          { href: "/docs/security/domains", label: "Domenlar", icon: <GlobeIcon size={15} /> },
          { href: "/docs/security/csp", label: "CSP", icon: <ShieldIcon size={15} /> },
        ]}
      />

      <H2 id="bolimlar">Bo&apos;limlar</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/security/keys",
            title: "API kalitlar",
            desc: "Kalit turlari, yaratish, saqlash va almashtirish.",
            icon: <KeyIcon size={20} />,
          },
          {
            href: "/docs/security/domains",
            title: "Domain restrictions",
            desc: "Brauzer kaliti qaysi domenlardan qabul qilinadi.",
            icon: <GlobeIcon size={20} />,
          },
          {
            href: "/docs/security/ips",
            title: "IP restrictions",
            desc: "Server kalitini IP manzillar bilan cheklash.",
            icon: <ServerIcon size={20} />,
          },
          {
            href: "/docs/security/csp",
            title: "CSP va HTTPS",
            desc: "Content-Security-Policy direktivalari va aralash tarkib.",
            icon: <ShieldIcon size={20} />,
          },
        ]}
      />

      <H2 id="qatlamlar">Uch qatlam</H2>
      <Table
        head={["Qatlam", "Nima tekshiriladi", "Xato"]}
        rows={[
          [
            <strong key="1" className="text-foreground">
              Kalit
            </strong>,
            "Kalit mavjudmi, bekor qilinmaganmi, muddati o'tmaganmi",
            <C key="e">401</C>,
          ],
          [
            <strong key="2" className="text-foreground">
              Manba
            </strong>,
            "So'rov ruxsat etilgan domen yoki IP dan kelganmi",
            <C key="e">403 key_restricted</C>,
          ],
          [
            <strong key="3" className="text-foreground">
              Funksiya
            </strong>,
            "Shu API kalitda yoqilganmi",
            <C key="e">403 api_not_allowed</C>,
          ],
        ]}
      />
      <P>
        Uchala tekshiruv har so&apos;rovda bajariladi. Shuning uchun yangi kalit yaratganda faqat
        kerakli funksiyalarni yoqing: kalit oshkor bo&apos;lsa ham zarar chegaralangan bo&apos;ladi.
      </P>

      <H2 id="limitlar">So&apos;rov limitlari</H2>
      <Table
        head={["Reja", "Tezlik", "Oylik chegara", "Chegara tugaganda"]}
        rows={[
          [
            "Bepul",
            "10 so'rov/sekund",
            "200 000 so'rov",
            <>
              <C>429 quota_exceeded</C>
            </>,
          ],
          ["Obuna", "100 so'rov/sekund", "chegara yo'q", "—"],
          ["OnDex ekotizimi", "500 so'rov/sekund", "chegara yo'q", "—"],
        ]}
      />
      <Callout kind="note">
        <p>
          Xarita tile&apos;lari, uslub va shriftlar limitga kirmaydi — ular kalitsiz va bepul. Chegara
          faqat <A href="/docs/api">REST API</A> chaqiruvlariga taalluqli.
        </p>
      </Callout>
      <P>
        Tezlik chegarasiga urilganda javob <C>429 rate_limited</C> va <C>Retry-After</C> sarlavhasi bilan
        keladi — <A href="/docs/api/errors">Errors</A>.
      </P>

      <PrevNext current="/docs/security" />
    </div>
  );
}
