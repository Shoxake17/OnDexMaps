import { A, C, Callout, CardGrid, CheckList, H2, PageHead, Panel, PrevNext, Split } from "@/components/docs/parts";
import { BrowserFrame, MapSketch } from "@/components/docs/art";
import { BoltIcon, BookIcon, CodeIcon, PlugIcon } from "@/components/docs/icons";

export const metadata = {
  title: "JavaScript API — OnDexMap",
  description:
    "OnDexMap JavaScript API — saytingizga interaktiv xarita joylashtirish uchun brauzer kutubxonasi.",
};

export default function JsApiPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="JavaScript API"
        desc="Saytingizga interaktiv OnDexMap xaritasini joylashtirish uchun brauzer kutubxonasi: vektor tile'lar, markerlar, qatlamlar va hodisalar. Xaritani ko'rsatish uchun API kalit talab qilinmaydi."
        pills={[
          { href: "/docs/js/quickstart", label: "Quick Start", icon: <BoltIcon size={15} /> },
          { href: "/docs/integration", label: "Integratsiya", icon: <PlugIcon size={15} /> },
          { href: "/docs/api", label: "REST API", icon: <BookIcon size={15} /> },
        ]}
        art={
          <BrowserFrame url="maps.ondex.uz">
            <div className="h-[180px]">
              <MapSketch />
            </div>
          </BrowserFrame>
        }
      />

      <H2 id="bolimlar">Bo&apos;limlar</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/js/general",
            title: "Umumiy ma'lumot",
            desc: "Arxitektura, versiyalar, endpointlar, API kalit, hududiy limitlar va Map obyektlari.",
            icon: <CodeIcon size={20} />,
          },
          {
            href: "/docs/js/quickstart",
            title: "Quick Start",
            desc: "Besh qadamda ishlaydigan xarita: kutubxona, konteyner, ishga tushirish, qidiruv.",
            icon: <BoltIcon size={20} />,
          },
          {
            href: "/docs/integration",
            title: "Integratsiya",
            desc: "CDN, NPM, React, Vue, TypeScript va Next.js uchun tayyor komponentlar.",
            icon: <PlugIcon size={20} />,
          },
        ]}
      />

      <H2 id="nima-olasiz">Nima olasiz</H2>
      <Split>
        <Panel label="Imkoniyatlar">
          <CheckList
            items={[
              <>Vektor tile&apos;lar — istalgan masshtabda aniq yozuv va chiziq</>,
              <>Butun O&apos;zbekiston bo&apos;yicha xarita ma&apos;lumoti</>,
              <>Markerlar, popup&apos;lar va boshqaruv elementlari</>,
              <>Sichqoncha va teginish hodisalari</>,
              <>
                <A href="/docs/api">REST API</A> bilan birga: qidiruv va marshrut
              </>,
            ]}
          />
        </Panel>
        <Panel label="Talablar">
          <CheckList
            items={[
              <>WebGL qo&apos;llab-quvvatlaydigan brauzer</>,
              <>
                <C>maplibre-gl</C> 4.7.x va <C>pmtiles</C> 3.2.x
              </>,
              <>Nolga teng bo&apos;lmagan o&apos;lchamli konteyner</>,
              <>HTTPS — aralash tarkib bloklanadi</>,
            ]}
          />
        </Panel>
      </Split>

      <Callout kind="note">
        <p>
          Xarita <A href="https://maplibre.org/">MapLibre GL JS</A> orqali chiziladi. Maxsus SDK
          o&apos;rnatish talab qilinmaydi — <C>style</C> parametrida OnDexMap uslub manzili
          ko&apos;rsatiladi.
        </p>
      </Callout>

      <PrevNext current="/docs/js" />
    </div>
  );
}
