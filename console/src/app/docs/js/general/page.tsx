import { A, C, Callout, Code, H2, H3, P, PrevNext, UL } from "@/components/docs/parts";

export const metadata = {
  title: "Umumiy ma'lumot — JavaScript API — OnDexMap",
  description: "OnDexMap JavaScript API qanday qurilgan: kutubxonalar, manzillar, versiyalar va cheklovlar.",
};

export default function GeneralPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">Umumiy ma'lumot</h1>

      <H2 id="architecture">Nimadan iborat</H2>
      <P>
        OnDexMap JavaScript API alohida yopiq kutubxona EMAS. U uchta qismdan iborat va uchalasi ham ochiq
        standartlarga tayanadi:
      </P>
      <UL>
        <li>
          <strong className="text-foreground">MapLibre GL JS</strong> — xaritani chizadigan ochiq kutubxona
          (WebGL). Xarita obyekti, qatlamlar, markerlar, hodisalar — hammasi uning API'si.
        </li>
        <li>
          <strong className="text-foreground">PMTiles</strong> — bitta faylda saqlanadigan vektor tile
          formati. Brauzer faqat kerakli baytlarni <C>Range</C> so'rovi bilan oladi.
        </li>
        <li>
          <strong className="text-foreground">OnDexMap uslubi va ma'lumoti</strong> — <C>style.json</C>,
          shriftlar va O'zbekiston tile'lari bizning serverlarimizdan.
        </li>
      </UL>
      <Callout kind="note">
        <p>
          Shu sababli sizga maxsus SDK o'rnatish shart emas: MapLibre hujjatlaridagi har qanday misol
          OnDexMap bilan ham ishlaydi — faqat <C>style</C> manzilini biznikiga almashtirasiz.
        </p>
      </Callout>

      <H2 id="endpoints">Manzillar</H2>
      <P>Xarita quyidagi ochiq manzillardan foydalanadi:</P>
      <Code>{`Uslub (style):   https://maps.ondex.uz/tiles/style.json
Shriftlar:       https://maps.ondex.uz/fonts/{fontstack}/{range}.pbf
REST API:        https://maps.ondex.uz/v2/...`}</Code>
      <P>
        Uslub fayli tile manbalarini o'zi ko'rsatadi (<C>pmtiles://</C> sxemasi bilan) — ularni qo'lda
        yozish shart emas.
      </P>

      <H2 id="versions">Versiyalar</H2>
      <Callout kind="warn">
        <p>
          <strong className="text-foreground">MapLibre GL JS 4.7.x</strong> ishlating.{" "}
          <strong className="text-foreground">v6 ga ko'tarmang</strong> — u WebGL2'ni majburiy talab qiladi
          va qo'llab-quvvatlamaydigan qurilmalarda xarita <em>jimgina oq</em> bo'lib qoladi: konsolda xato
          ham chiqmaydi. Bu bizda haqiqiy sinovda aniqlangan.
        </p>
      </Callout>
      <Code>{`maplibre-gl  4.7.1
pmtiles      3.2.1`}</Code>

      <H2 id="key">API kalit qachon kerak</H2>
      <P>
        Xaritaning o'zini ko'rsatish uchun kalit talab qilinmaydi. Kalit <A href="/docs/api">REST API</A>{" "}
        chaqiruvlari uchun kerak — qidiruv, manzil aniqlash, marshrut va ob'ektlar.
      </P>
      <P>
        Brauzerdan chaqirayotgan bo'lsangiz <strong className="text-foreground">brauzer kaliti</strong>{" "}
        yarating va ruxsat etilgan domenlarni ko'rsating — kalit faqat o'sha domenlardan ishlaydi. Server
        kalitini sahifa kodiga HECH QACHON joylashtirmang: u ochiq ko'rinadi va IP cheklovidan boshqa
        himoyasi yo'q.
      </P>

      <H2 id="limits">Hududiy cheklovlar</H2>
      <P>Funksiyalarning qamrovi bir xil emas:</P>
      <UL>
        <li>
          <C>/v2/geocode</C> va <C>/v2/places</C> — butun O'zbekiston bo'yicha.
        </li>
        <li>
          <C>/v2/reverse</C> va <C>/v2/directions</C> — hozircha xizmat hududi: 40.5–41.6° shimol,
          70.5–72.0° sharq (Chust va atrofi). Tashqaridagi koordinata <C>INVALID_REQUEST</C> qaytaradi.
        </li>
        <li>Xarita tile'lari (ko'rinish) — butun O'zbekiston.</li>
      </UL>

      <H3 id="objects">Obyektlar ierarxiyasi</H3>
      <P>
        MapLibre atamalari bilan: <C>Map</C> (xarita) → <C>Source</C> (ma'lumot manbasi) → <C>Layer</C>{" "}
        (chizish qatlami). Bulardan tashqari <C>Marker</C>, <C>Popup</C> va boshqaruv elementlari
        (<C>NavigationControl</C>, <C>ScaleControl</C>) mavjud.
      </P>

      <PrevNext current="/docs/js/general" />
    </div>
  );
}
