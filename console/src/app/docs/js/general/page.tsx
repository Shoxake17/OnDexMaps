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
      <P>JavaScript API uch qismdan tashkil topgan:</P>
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
          <strong className="text-foreground">OnDexMap xarita ma'lumoti</strong> — <C>style.json</C>,
          shriftlar va O'zbekiston bo'yicha vektor tile'lar.
        </li>
      </UL>
      <Callout kind="note">
        <p>
          Maxsus SDK o'rnatish talab qilinmaydi. MapLibre GL JS hujjatlaridagi misollar OnDexMap bilan
          ham ishlaydi — <C>style</C> parametrida OnDexMap uslub manzili ko'rsatiladi.
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
          Qo'llab-quvvatlanadigan versiya — <strong className="text-foreground">MapLibre GL JS 4.7.x</strong>.
          6-versiya WebGL2'ni majburiy talab qiladi va uni qo'llab-quvvatlamaydigan qurilmalarda xarita
          xato xabarisiz oq qoladi.
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
        Brauzerdan chaqirilganda <strong className="text-foreground">brauzer kaliti</strong> ishlatiladi:
        yaratishda ruxsat etilgan domenlar ko'rsatiladi va kalit faqat o'sha domenlardan qabul qilinadi.
        Server kaliti sahifa kodiga joylashtirilmaydi — u ochiq ko'rinadi.
      </P>

      <H2 id="limits">Hududiy qamrov</H2>
      <UL>
        <li>
          <C>/v2/geocode</C>, <C>/v2/places</C> va xarita tile'lari — butun O'zbekiston.
        </li>
        <li>
          <C>/v2/reverse</C> va <C>/v2/directions</C> — 40.5–41.6° shimol, 70.5–72.0° sharq.
          Bu hududdan tashqaridagi koordinata <C>INVALID_REQUEST</C> qaytaradi.
        </li>
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
