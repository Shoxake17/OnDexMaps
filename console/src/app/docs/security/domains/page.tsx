import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { GlobeIcon, KeyIcon, ServerIcon } from "@/components/docs/icons";

export const metadata = {
  title: "Domain restrictions — Security — OnDexMap",
  description: "Brauzer kaliti qaysi domenlardan qabul qilinishini sozlash.",
};

export default function DomainsPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Domain restrictions"
        desc="Brauzer kaliti sahifa kodida ochiq ko'rinadi, shuning uchun uni faqat sizning domeningizdan kelgan so'rovlar uchun amal qiladigan qilib cheklash majburiy."
        pills={[
          { href: "/keys", label: "Ro'yxatni tahrirlash", icon: <GlobeIcon size={15} /> },
          { href: "/docs/security/keys", label: "API kalitlar", icon: <KeyIcon size={15} /> },
          { href: "/docs/security/ips", label: "IP restrictions", icon: <ServerIcon size={15} /> },
        ]}
      />

      <H2 id="qanday">Qanday tekshiriladi</H2>
      <P>
        Brauzer har bir cross-origin so&apos;rovga <C>Origin</C> sarlavhasini qo&apos;shadi. Server shu
        sarlavhani kalitning ro&apos;yxati bilan solishtiradi. Mos kelmasa —{" "}
        <C>403 key_restricted</C>.
      </P>
      <Code lang="terminal">{`GET /v2/geocode?q=Chust&key=omk_b_...
Origin: https://sayt.uz          ← shu qiymat tekshiriladi`}</Code>
      <Callout kind="note">
        <p>
          Tekshiruv <strong className="text-foreground">sxema + domen + port</strong> bo&apos;yicha
          bo&apos;ladi. <C>https://sayt.uz</C> va <C>http://sayt.uz</C> — ikki xil manba;{" "}
          <C>localhost:3000</C> va <C>localhost:5173</C> ham.
        </p>
      </Callout>

      <H2 id="yozilishi">Ro&apos;yxat yozilishi</H2>
      <Code lang="terminal">{`https://sayt.uz
https://www.sayt.uz
https://*.sayt.uz
http://localhost:3000`}</Code>
      <Table
        head={["Yozuv", "Nimaga mos keladi", "Nimaga mos kelmaydi"]}
        rows={[
          [
            <C key="1">https://sayt.uz</C>,
            "aynan shu manba",
            <>
              <C>https://www.sayt.uz</C>, <C>http://sayt.uz</C>
            </>,
          ],
          [
            <C key="2">https://*.sayt.uz</C>,
            <>
              <C>app.sayt.uz</C>, <C>admin.sayt.uz</C>
            </>,
            <>
              <C>sayt.uz</C> (pastki domensiz) — uni alohida qo&apos;shing
            </>,
          ],
          [
            <C key="3">http://localhost:3000</C>,
            "lokal ishlab chiqish",
            <>
              boshqa port (<C>:5173</C>)
            </>,
          ],
        ]}
      />

      <H2 id="tavsiya">Tavsiya etilgan sozlama</H2>
      <UL>
        <li>
          <strong className="text-foreground">Production</strong> — faqat haqiqiy domen va{" "}
          <C>www</C> varianti. <C>localhost</C> BO&apos;LMASIN.
        </li>
        <li>
          <strong className="text-foreground">Ishlab chiqish</strong> — alohida kalit, unda faqat{" "}
          <C>localhost</C> portlari.
        </li>
        <li>
          <strong className="text-foreground">Preview deploy</strong> — <C>https://*.vercel.app</C>{" "}
          kabi shablon, lekin uni production kalitiga qo&apos;shmang.
        </li>
      </UL>
      <Callout kind="warn">
        <p>
          Domen ro&apos;yxati brauzerdagi so&apos;rovlarni himoya qiladi. Kalitni nusxalab, uni{" "}
          <C>curl</C> orqali soxta <C>Origin</C> bilan yuborish mumkin — shuning uchun brauzer kalitiga
          faqat o&apos;qish amallari yoqiladi va u tarif chegarasi bilan cheklanadi. Jiddiy yuk ortidan
          <A href="/docs/security/ips"> server kaliti</A> ishlatiladi.
        </p>
      </Callout>

      <H2 id="nosozlik">Nosozlikni topish</H2>
      <Table
        head={["Belgisi", "Sabab", "Yechim"]}
        rows={[
          [
            "Lokal ishlaydi, saytda 403",
            "Ro'yxatda faqat localhost bor",
            "Production domenini qo'shing",
          ],
          [
            <>
              <C>www</C> bilan 403
            </>,
            <>
              <C>https://www.sayt.uz</C> alohida manba
            </>,
            "Ikkala variantni ham qo'shing",
          ],
          [
            "Faqat ba'zi sahifalarda 403",
            "Preview yoki staging boshqa domenda",
            "O'sha muhit uchun alohida kalit",
          ],
          [
            "Serverdan 403",
            "Server so'rovida Origin bo'lmaydi",
            <>
              Server uchun <A href="/docs/security/keys">server kaliti</A> ishlating
            </>,
          ],
        ]}
      />
      <P>
        Tekshirish uchun brauzer konsolining Network panelida so&apos;rovning <C>Origin</C> sarlavhasini
        ko&apos;ring va uni ro&apos;yxat bilan solishtiring.
      </P>
      <Code lang="terminal">{`# Soxta Origin bilan tekshirish
curl -i -H "Origin: https://sayt.uz" \\
  "https://maps.ondex.uz/v2/geocode?q=Chust&key=omk_b_..."`}</Code>

      <PrevNext current="/docs/security/domains" />
    </div>
  );
}
