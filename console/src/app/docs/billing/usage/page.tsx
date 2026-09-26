import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { CardIcon, ChartIcon, ServerIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Statistika — Usage & Billing — OnDexMap",
  description: "Qaysi so'rovlar hisoblanadi, ko'rsatkichlar qayerda va chegarani qanday kuzatish.",
};

export default function UsageDocsPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Statistika"
        desc="Har bir muvaffaqiyatli REST API so'rovi hisobga olinadi va boshqaruv panelida kunlik, funksiya hamda kalit kesimida ko'rinadi."
        pills={[
          { href: "/usage", label: "Statistikani ochish", icon: <ChartIcon size={15} /> },
          { href: "/docs/billing/plans", label: "Tariflar", icon: <CardIcon size={15} /> },
          { href: "/docs/api", label: "REST API", icon: <ServerIcon size={15} /> },
        ]}
      />

      <H2 id="nima-hisoblanadi">Nima hisoblanadi</H2>
      <Table
        head={["Amal", "Hisoblanadimi", "Izoh"]}
        rows={[
          ["Xarita tile'lari, uslub, shriftlar", "yo'q", "Kalitsiz va bepul"],
          [
            <>
              <C>/v2/geocode</C>, <C>/v2/reverse</C>, <C>/v2/directions</C>, <C>/v2/places</C>
            </>,
            "ha",
            "Har bir muvaffaqiyatli so'rov — bitta birlik",
          ],
          [
            <>
              <C>/v2/places/{"{id}"}</C>
            </>,
            "ha",
            <>
              <C>places</C> hisobiga kiradi
            </>,
          ],
          [
            "Xato bilan tugagan so'rov (4xx, 5xx)",
            "yo'q",
            "Rad etilgan yoki muvaffaqiyatsiz so'rov hisoblanmaydi",
          ],
          [
            <>
              <C>ZERO_RESULTS</C> qaytgan so&apos;rov
            </>,
            "ha",
            "So'rov bajarildi, natija bo'sh bo'lsa ham",
          ],
        ]}
      />
      <Callout kind="note">
        <p>
          Bitta sahifada bir nechta chaqiruv bo&apos;lsa, har biri alohida hisoblanadi. Masalan yozish
          davomida qidiruv (autocomplete) har tugma bosilganda so&apos;rov yuborsa — ular ham
          hisoblanadi.
        </p>
      </Callout>

      <H2 id="qayerda">Ko&apos;rsatkichlarni ko&apos;rish</H2>
      <P>
        <A href="/usage">Foydalanish</A> bo&apos;limida uchta kesim bor:
      </P>
      <UL>
        <li>
          <strong className="text-foreground">Kunlik so&apos;rovlar</strong> — 7, 30 yoki 90 kunlik
          grafik: so&apos;rovlar va xatolar.
        </li>
        <li>
          <strong className="text-foreground">Funksiya bo&apos;yicha</strong> — qaysi API qancha
          ishlatilgan.
        </li>
        <li>
          <strong className="text-foreground">Kalit bo&apos;yicha</strong> — qaysi kalit qancha
          so&apos;rov yuborgan.
        </li>
      </UL>
      <P>
        <A href="/dashboard">Boshqaruv panelida</A> joriy oyning umumiy soni va chegaraning necha foizi
        ishlatilgani ko&apos;rinadi.
      </P>

      <H2 id="chegara">Chegarani kuzatish</H2>
      <P>
        Bepul rejada oylik chegara <strong className="text-foreground">200 000 so&apos;rov</strong>. U
        tugaganda REST API <C>429 quota_exceeded</C> qaytaradi:
      </P>
      <Code lang="json">{`{
  "status": "REQUEST_DENIED",
  "error": { "code": "quota_exceeded", "message": "oylik chegara tugadi" }
}`}</Code>
      <Table
        head={["Holat", "Xarita", "REST API"]}
        rows={[
          ["Chegara ichida", "ishlaydi", "ishlaydi"],
          ["Oylik chegara tugagan", "ishlaydi", <><C>429 quota_exceeded</C></>],
          ["Tezlik chegarasi", "ishlaydi", <><C>429 rate_limited</C> + <C>Retry-After</C></>],
        ]}
      />
      <P>
        Chegara har oyning boshida tiklanadi. Kutmasdan davom etish uchun —{" "}
        <A href="/docs/billing/plans">obuna</A>.
      </P>

      <H2 id="sarlavhalar">Dastur ichidan kuzatish</H2>
      <P>
        Panelga kirmasdan ham holatni bilish mumkin: har bir javob uni sarlavhalarda qaytaradi va
        ular brauzerdan ham o&apos;qiladi.
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
            "Shu oyda ishlatilgan so'rovlar",
            <C key="v">16</C>,
          ],
        ]}
      />
      <Code lang="js">{`const res = await fetch(url);

const limit = Number(res.headers.get("X-Quota-Limit"));
const used  = Number(res.headers.get("X-Quota-Used"));

if (Number.isFinite(limit) && used / limit > 0.9) {
  ogohlantir("Oylik chegaraning 90% i ishlatildi");
}`}</Code>
      <P>
        To&apos;liq ro&apos;yxat va <C>Retry-After</C> — <A href="/docs/api/errors">Errors</A>{" "}
        sahifasida.
      </P>

      <H2 id="kamaytirish">So&apos;rovlar sonini kamaytirish</H2>
      <UL>
        <li>
          <strong className="text-foreground">Qidiruvni kechiktiring</strong> — foydalanuvchi yozishni
          to&apos;xtatgandan keyin 250–300 ms kutib so&apos;rov yuboring.
        </li>
        <li>
          <strong className="text-foreground">Natijani keshlang</strong> — bir xil so&apos;rov qayta
          yuborilmasin (shahar nomlari kamdan-kam o&apos;zgaradi).
        </li>
        <li>
          <strong className="text-foreground">Xarita harakatiga bog&apos;langan so&apos;rovlarni
          cheklang</strong> — <C>moveend</C> hodisasida darhol emas, kechikish bilan.
        </li>
        <li>
          <strong className="text-foreground">Server tomonda birlashtiring</strong> — bir necha
          foydalanuvchi bir xil ma&apos;lumot so&apos;rasa, uni o&apos;z backend&apos;ingizda keshlang.
        </li>
      </UL>
      <Code lang="js">{`let taymer;
input.addEventListener("input", () => {
  clearTimeout(taymer);
  taymer = setTimeout(() => qidir(input.value), 300);
});`}</Code>

      <PrevNext current="/docs/billing/usage" />
    </div>
  );
}
