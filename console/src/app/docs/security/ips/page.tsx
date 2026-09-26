import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, UL } from "@/components/docs/parts";
import { GlobeIcon, KeyIcon, ServerIcon } from "@/components/docs/icons";

export const metadata = {
  title: "IP restrictions — Security — OnDexMap",
  description: "Server kalitini IP manzillar bilan cheklash.",
};

export default function IpsPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="IP restrictions"
        desc="Server kaliti uchun qo'shimcha qatlam: so'rov faqat siz ko'rsatgan IP manzillardan qabul qilinadi. Kalit oshkor bo'lsa ham boshqa mashinadan ishlamaydi."
        pills={[
          { href: "/keys", label: "Ro'yxatni tahrirlash", icon: <ServerIcon size={15} /> },
          { href: "/docs/security/keys", label: "API kalitlar", icon: <KeyIcon size={15} /> },
          { href: "/docs/security/domains", label: "Domenlar", icon: <GlobeIcon size={15} /> },
        ]}
      />

      <H2 id="qanday">Qanday tekshiriladi</H2>
      <P>
        Server so&apos;rovida <C>Origin</C> sarlavhasi bo&apos;lmaydi, shuning uchun manba so&apos;rov
        kelgan IP manzil bo&apos;yicha aniqlanadi. Ro&apos;yxat bo&apos;sh bo&apos;lsa cheklov
        qo&apos;llanmaydi; ro&apos;yxat to&apos;ldirilgan bo&apos;lsa, unga kirmagan manzil{" "}
        <C>403 key_restricted</C> oladi.
      </P>
      <Code lang="terminal">{`203.0.113.10
203.0.113.11
198.51.100.0/24`}</Code>
      <Table
        head={["Yozuv", "Nimaga mos keladi"]}
        rows={[
          [<C key="1">203.0.113.10</C>, "aynan shu manzil"],
          [<C key="2">198.51.100.0/24</C>, <>diapazon: <C>198.51.100.0</C> — <C>198.51.100.255</C></>],
          [<C key="3">2001:db8::1</C>, "IPv6 manzil"],
        ]}
      />

      <H2 id="qaysi-ip">Qaysi IP ni yozish kerak</H2>
      <P>
        Serveringizning <strong className="text-foreground">tashqi</strong> (chiquvchi) IP manzili
        yoziladi — ichki tarmoq manzili emas. Uni serverning o&apos;zidan tekshirib oling:
      </P>
      <Code lang="terminal">{`# Serverda ishga tushiring
curl -s https://api.ipify.org
# 203.0.113.10`}</Code>
      <Callout kind="warn">
        <p>
          Konteynerlar, Kubernetes pod&apos;lari va serverless funksiyalar odatda umumiy NAT chiqishidan
          foydalanadi va IP o&apos;zgarib turadi. Bunday muhitda IP cheklovi qo&apos;yish xizmatni
          kutilmaganda to&apos;xtatib qo&apos;yishi mumkin.
        </p>
      </Callout>

      <H2 id="qachon">Qachon ishlatiladi</H2>
      <UL>
        <li>
          <strong className="text-foreground">Mos keladi</strong> — doimiy IP li VPS, o&apos;z
          serveringiz, cron mashina, NAT gateway ortidagi barqaror chiqish.
        </li>
        <li>
          <strong className="text-foreground">Mos kelmaydi</strong> — Vercel, Netlify, Cloud Functions va
          boshqa dinamik IP li muhitlar; ular uchun ro&apos;yxatni bo&apos;sh qoldiring va kalitni faqat
          muhit o&apos;zgaruvchisida saqlang.
        </li>
      </UL>

      <H2 id="proksi">Proksi ortida</H2>
      <P>
        So&apos;rov reverse proxy orqali o&apos;tsa, OnDexMap proksi IP sini emas, haqiqiy chiqish IP
        sini ko&apos;radi — chunki proksi so&apos;rovni o&apos;zining nomidan yuboradi. Ro&apos;yxatga
        shu proksi (yoki NAT gateway) manzili yoziladi.
      </P>
      <Table
        head={["Tuzilma", "Ro'yxatga yoziladigan IP"]}
        rows={[
          ["Ilova to'g'ridan-to'g'ri chiqadi", "Server tashqi IP si"],
          ["Ilova NAT gateway orqali chiqadi", "NAT gateway IP si"],
          ["Bir nechta server", "Har birining tashqi IP si yoki umumiy diapazon"],
        ]}
      />

      <H2 id="tekshirish">Tekshirish</H2>
      <Code lang="terminal">{`# Serverning o'zidan — 200 kutiladi
curl -i -H "X-API-Key: omk_s_..." \\
  "https://maps.ondex.uz/v2/geocode?q=Chust"

# Boshqa mashinadan — 403 key_restricted kutiladi`}</Code>
      <P>
        Kutilmagan <C>403</C> kelsa, avval serverning joriy chiqish IP sini qayta tekshiring: provayder
        uni almashtirgan bo&apos;lishi mumkin. Xato kodlari —{" "}
        <A href="/docs/api/errors">Errors</A>.
      </P>

      <PrevNext current="/docs/security/ips" />
    </div>
  );
}
