import { A, C, Callout, ChoiceCards, H2, P, PageHead, PrevNext, Table } from "@/components/docs/parts";
import { CdnMark, FlowDiagram, HeroArt, NextMark, NpmMark, ReactMark, TsMark, VueMark } from "@/components/docs/art";
import { BookIcon, BoltIcon, ShieldIcon, SupportIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Integratsiya — OnDexMap",
  description:
    "OnDexMap'ni loyihangizga ulash: CDN, NPM, React, Vue, TypeScript, Next.js va CSP ostida ishlash.",
};

export default function IntegrationPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Integratsiya"
        desc="OnDexMap'ni o'zingizning loyihangizga ulashning turli usullari. JavaScript, React, Vue, TypeScript va Next.js uchun tayyor yechimlar."
        pills={[
          { href: "/docs/js/quickstart", label: "Tez integratsiya", icon: <BoltIcon size={15} /> },
          { href: "/docs/api", label: "Hujjatlar va misollar", icon: <BookIcon size={15} /> },
          { href: "/docs/faq", label: "Qo'llab-quvvatlash", icon: <SupportIcon size={15} /> },
        ]}
        art={<HeroArt />}
      />

      <H2 id="usullar">Usulni tanlang</H2>
      <P>OnDexMap&apos;ni loyihangizga ulash uchun quyidagi usullardan birini tanlang.</P>
      <ChoiceCards
        cards={[
          { href: "/docs/integration/cdn", title: "CDN", desc: "Eng tez va oson usul", icon: <CdnMark /> },
          { href: "/docs/integration/npm", title: "NPM", desc: "Yirik loyiha uchun", icon: <NpmMark /> },
          { href: "/docs/integration/react", title: "React", desc: "React ilovalari uchun", icon: <ReactMark /> },
          { href: "/docs/integration/vue", title: "Vue", desc: "Vue ilovalari uchun", icon: <VueMark /> },
          {
            href: "/docs/integration/typescript",
            title: "TypeScript",
            desc: "Tipli kod uchun",
            icon: <TsMark />,
          },
          { href: "/docs/integration/nextjs", title: "Next.js", desc: "SSR / SSG uchun", icon: <NextMark /> },
        ]}
      />

      <Callout kind="note">
        <p>
          Xaritaning o&apos;zini ko&apos;rsatish uchun API kalit talab qilinmaydi. Kalit faqat{" "}
          <A href="/docs/api">REST API</A> chaqiruvlariga kerak — qidiruv, manzil aniqlash, marshrut va
          ob&apos;ektlar.
        </p>
      </Callout>

      <H2 id="taqqoslash">Qaysi usul sizga to&apos;g&apos;ri keladi</H2>
      <Table
        head={["Usul", "Qachon", "Nimaga e'tibor berish kerak"]}
        rows={[
          [
            <A key="1" href="/docs/integration/cdn">
              CDN
            </A>,
            "Oddiy sayt, landing, tezkor prototip",
            "Tashqi CDN'ga bog'liqlik; versiya URL'da qulflanadi",
          ],
          [
            <A key="2" href="/docs/integration/npm">
              NPM
            </A>,
            "Vite, Webpack yoki boshqa bundler bor loyiha",
            <>
              Versiya <C>package-lock.json</C> da qulflanadi
            </>,
          ],
          [
            <A key="3" href="/docs/integration/react">
              React
            </A>,
            "React ilovasi",
            <>
              <C>StrictMode</C> effektni ikki marta chaqiradi — tozalash shart
            </>,
          ],
          [
            <A key="4" href="/docs/integration/vue">
              Vue
            </A>,
            "Vue 3 yoki Nuxt",
            <>
              Xarita obyekti <C>shallowRef</C> da saqlanadi
            </>,
          ],
          [
            <A key="5" href="/docs/integration/typescript">
              TypeScript
            </A>,
            "Tipli loyiha",
            <>
              Tiplar paket ichida; <C>lib: DOM</C> shart
            </>,
          ],
          [
            <A key="6" href="/docs/integration/nextjs">
              Next.js
            </A>,
            "SSR yoki SSG",
            <>
              Komponent faqat klientda: <C>ssr: false</C>
            </>,
          ],
        ]}
      />

      <H2 id="qanday-ishlaydi">Qanday ishlaydi</H2>
      <P>
        OnDexMap ikkita mustaqil qismdan iborat: brauzerda ishlaydigan xarita kutubxonasi va server
        tomonidan chaqiriladigan REST API. Ularni birga ham, alohida ham ishlatish mumkin.
      </P>
      <FlowDiagram />

      <H2 id="csp">Qat&apos;iy CSP ostida</H2>
      <P>
        Saytingizda <C>Content-Security-Policy</C> yoqilgan bo&apos;lsa, xarita bir nechta direktivaga
        muhtoj bo&apos;ladi. Ularsiz xarita ko&apos;pincha jimgina buziladi: oq maydon, yozuvsiz tile yoki
        bo&apos;sh ekran. Kerakli direktivalar va nosozlikni topish —{" "}
        <A href="/docs/security/csp">CSP va HTTPS</A> sahifasida.
      </P>
      <div className="mt-5">
        <ChoiceCards
          cards={[
            {
              href: "/docs/security/csp",
              title: "CSP va HTTPS",
              desc: "Direktivalar, nonce, nosozlik",
              icon: <ShieldIcon size={22} />,
            },
          ]}
        />
      </div>

      <PrevNext current="/docs/integration" />
    </div>
  );
}
