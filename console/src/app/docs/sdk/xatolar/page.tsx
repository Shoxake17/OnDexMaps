import {
  A,
  C,
  Callout,
  Code,
  H2,
  P,
  PageHead,
  Panel,
  PrevNext,
  Split,
  Table,
  Terminal,
} from "@/components/docs/parts";
import { NpmMark, TsMark } from "@/components/docs/art";

export const metadata = {
  title: "SDK — Xatolar va kvota — OnDexMap",
  description:
    "OnDexMapError, qayta urinish qoidalari va kvota sarlavhalari: SDK xatolarni qanday qaytaradi.",
};

export default function SdkXatolarPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="SDK — Xatolar va kvota"
        desc="SDK har xatoni OnDexMapError qilib qaytaradi va qaysi holatda qayta urinish ma'noga ega ekanini o'zi biladi."
        pills={[
          { href: "#xatolar", label: "Xatolar", icon: <TsMark size={15} /> },
          { href: "#qayta-urinish", label: "Qayta urinish", icon: <NpmMark size={15} /> },
          { href: "#kvota", label: "Kvota", icon: <TsMark size={15} /> },
        ]}
      />

      <H2 id="xatolar">Xatoni ushlash</H2>
      <Code lang="js">{`import { OnDexMapError, isQuotaExceeded, isKeyProblem } from "@ondexmap/sdk";

try {
  await ondex.geocode("Chust");
} catch (e) {
  if (isQuotaExceeded(e)) {
    // Oylik chegara tugadi — tarifni oshirish kerak.
  } else if (isKeyProblem(e)) {
    // Kalit noto'g'ri, o'chirilgan yoki domen ruxsat etilmagan.
  } else if (e instanceof OnDexMapError) {
    console.error(e.status, e.code, e.message);
  } else {
    throw e;   // tarmoq xatosi yoki boshqa narsa
  }
}`}</Code>

      <Table
        head={["Maydon", "Turi", "Tavsif"]}
        rows={[
          [
            <C key="s">status</C>,
            <>number</>,
            <>
              HTTP holati: <C>400</C>, <C>401</C>, <C>403</C>, <C>429</C>, <C>503</C>.
            </>,
          ],
          [
            <C key="c">code</C>,
            <>string</>,
            <>
              Mashina o&apos;qiy oladigan kod: <C>quota_exceeded</C>, <C>rate_limited</C>,{" "}
              <C>key_restricted</C>, <C>invalid_request</C>.
            </>,
          ],
          [<C key="m">message</C>, <>string</>, <>O&apos;zbekcha tushuntirish.</>],
          [
            <C key="ra">retryAfter</C>,
            <>number | undefined</>,
            <>
              Server aytgan kutish vaqti (soniya), <C>Retry-After</C> sarlavhasidan.
            </>,
          ],
          [
            <C key="rt">retryable</C>,
            <>boolean</>,
            <>Qayta urinish ma&apos;noga egami.</>,
          ],
        ]}
      />

      <H2 id="qayta-urinish">Qayta urinish qoidalari</H2>
      <Split>
        <div>
          <P>
            SDK <C>429</C> va <C>503</C> da avtomatik qayta uradi — standart 2 marta.{" "}
            <C>Retry-After</C> sarlavhasi bo&apos;lsa aynan shuncha kutiladi, bo&apos;lmasa
            eksponensial ortadi.
          </P>
          <P>
            Kvota tugagan <C>429</C> esa <b>istisno</b>: u qayta urinilmaydi. Oylik chegara
            tugagan bo&apos;lsa kutish hech narsa bermaydi — faqat foydalanuvchini kutdiradi.
          </P>
          <Code lang="js">{`// Qayta urinishni butunlay o'chirish:
createClient({ key: "omk_b_...", retries: 0 });`}</Code>
        </div>
        <div>
          <Panel label="Qaysi xato qayta uriladi">
            <Table
              head={["Kod", "Qayta urinish"]}
              rows={[
                [<C key="a">429 rate_limited</C>, <>ha</>],
                [<C key="b">429 quota_exceeded</C>, <>yo&apos;q</>],
                [<C key="c">503</C>, <>ha</>],
                [<C key="d">400 / 401 / 403</C>, <>yo&apos;q</>],
              ]}
            />
          </Panel>
        </div>
      </Split>

      <Callout kind="note">
        <p>
          Tezlik chegarasiga tez-tez urilayotgan bo&apos;lsangiz, qayta urinishlar sonini
          oshirish yechim emas — u so&apos;rovlarni faqat kechiktiradi.{" "}
          <A href="/docs/billing/plans">Tarifni</A> ko&apos;ring yoki so&apos;rovlarni
          guruhlang.
        </p>
      </Callout>

      <H2 id="kvota">Kvotani kuzatish</H2>
      <P>
        Har javobdan keyin klient kvota sarlavhalarini saqlab qo&apos;yadi — alohida so&apos;rov
        kerak emas:
      </P>
      <Code lang="js">{`await ondex.geocode("Chust");

console.log(ondex.quota);
// { plan: "free", limit: 200000, used: 1234 }`}</Code>
      <P>
        Shu qiymat bilan foydalanuvchiga ogohlantirish ko&apos;rsatish mumkin — chegaraga
        yetganda birdan to&apos;xtab qolgandan yaxshiroq:
      </P>
      <Code lang="js">{`const { limit, used } = ondex.quota;

if (limit && used && used / limit > 0.9) {
  console.warn("Oylik kvotaning 90% ishlatildi");
}`}</Code>

      <H2 id="sinash">Xatolarni sinab ko&apos;rish</H2>
      <P>Ishlab chiqishda xato yo&apos;llarini terminal orqali tekshirish qulay:</P>
      <Terminal>{`# Noto'g'ri kalit -> 403
export NOTOGRI_KALIT=omk_b_bunday_kalit_yoq
curl -i -H "X-API-Key: $NOTOGRI_KALIT" \\
  "https://maps.ondex.uz/v2/geocode?q=Chust"

# Juda keng to'rtburchak -> 400 (SDK buni yubormaydi)
curl -i -H "X-API-Key: $ONDEX_KEY" \\
  "https://maps.ondex.uz/v2/places?bbox=69,40,72,42"`}</Terminal>
      <P>
        Barcha kodlarning to&apos;liq ro&apos;yxati — <A href="/docs/api/errors">Errors</A>{" "}
        sahifasida.
      </P>

      <PrevNext current="/docs/sdk/xatolar" />
    </div>
  );
}
