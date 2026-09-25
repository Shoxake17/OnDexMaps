import { CardGrid, Callout, H2, P, PrevNext, A, C } from "@/components/docs/parts";

export const metadata = {
  title: "JavaScript API — OnDexMap",
  description: "Saytingizga OnDexMap interaktiv xaritasini joylashtirish uchun JavaScript API.",
};

export default function JsApiPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold">OnDexMap JavaScript API</h1>
      <p className="text-muted">
        JavaScript API — saytingizga yoki veb-ilovangizga interaktiv OnDexMap xaritasini joylashtirish uchun
        klient tomon kutubxonasi. Xarita ma'lumoti, shriftlar va uslub OnDexMap serverlaridan keladi.
      </p>

      <Callout kind="note">
        <p>
          OnDexMap JS API — ochiq <A href="https://maplibre.org/">MapLibre GL JS</A> kutubxonasi ustida
          ishlaydi. Ya'ni siz standart, hujjatlashtirilgan kutubxona bilan ishlaysiz, xarita manbasi
          (<C>style.json</C>, tile, shrift) esa bizniki. Alohida yopiq SDK o'rnatish shart emas.
        </p>
      </Callout>

      <H2 id="blocks">Bo'limlar</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/js/general",
            title: "Umumiy ma'lumot",
            desc: "API nimadan iborat, qaysi manzillar ishlatiladi, versiyalar va cheklovlar.",
          },
          {
            href: "/docs/js/quickstart",
            title: "Tezkor start",
            desc: "5 qadamda ishlaydigan xarita: kalit, kutubxona, konteyner, ishga tushirish, qidiruv.",
          },
        ]}
      />

      <H2 id="what-you-get">Nima olasiz</H2>
      <P>
        Xaritani ko'rsatish, masshtablash va surish; O'zbekiston bo'yicha vektor tile'lar va bino
        konturlari; o'z markerlaringiz va qatlamlaringiz; <A href="/docs/api">REST API</A> bilan birga —
        qidiruv, manzil aniqlash va marshrut chizish.
      </P>

      <PrevNext current="/docs/js" />
    </div>
  );
}
