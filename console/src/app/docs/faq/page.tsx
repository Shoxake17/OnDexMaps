import { A, C, H2, PageHead, PrevNext } from "@/components/docs/parts";
import { BookIcon, CardIcon, KeyIcon } from "@/components/docs/icons";

export const metadata = {
  title: "FAQ — OnDexMap",
  description: "OnDexMap bo'yicha ko'p so'raladigan savollar: kalit, tarif, cheklovlar va xavfsizlik.",
};

const GROUPS: { id: string; title: string; items: [string, React.ReactNode][] }[] = [
  {
    id: "boshlash",
    title: "Boshlash",
    items: [
      [
        "API kalitni qanday olaman?",
        <>
          Email va bir martalik kod bilan <A href="/login">kiring</A>, so&apos;ng{" "}
          <A href="/keys">API kalitlar</A> bo&apos;limida yarating. Kalit bir marta ko&apos;rsatiladi.
        </>,
      ],
      [
        "Xarita uchun kalit kerakmi?",
        <>
          Yo&apos;q. Xarita tile&apos;lari, uslub va shriftlar kalitsiz ochiq. Kalit faqat REST API
          chaqiruvlariga kerak.
        </>,
      ],
      [
        "Qaysi hududlarni qamrab oladi?",
        <>
          Xarita va qidiruv — butun O&apos;zbekiston. Manzil aniqlash va marshrut — 40.5–41.6° shimol,
          70.5–72.0° sharq oralig&apos;i.
        </>,
      ],
    ],
  },
  {
    id: "kalitlar",
    title: "Kalitlar",
    items: [
      [
        "Server va brauzer kaliti farqi nimada?",
        <>
          Server kaliti faqat <C>X-API-Key</C> sarlavhasida yuboriladi va ixtiyoriy IP cheklovi oladi.
          Brauzer kaliti <C>?key=</C> orqali ham yuboriladi, lekin ruxsat etilgan domenlar ro&apos;yxati
          majburiy.
        </>,
      ],
      [
        "Kalitim oshkor bo'lib qolsa nima qilaman?",
        <>
          «Almashtirish»ni bosing: yangi kalit darhol ishlaydi, eskisi 24 soat davomida ham ishlaydi
          (uzilishsiz o&apos;tish), so&apos;ng avtomatik bekor bo&apos;ladi.
        </>,
      ],
      [
        "Nechta kalit yaratish mumkin?",
        <>Bir hisob uchun 10 tagacha faol kalit. Bekor qilingan kalitlar bu songa kirmaydi.</>,
      ],
    ],
  },
  {
    id: "imkoniyatlar",
    title: "Imkoniyatlar",
    items: [
      [
        "API orqali xaritaga joy qo'sha olamanmi?",
        <>
          Yo&apos;q. API o&apos;qish amallarini taqdim etadi: <C>geocode</C>, <C>reverse</C>,{" "}
          <C>directions</C> va <C>places</C>.
        </>,
      ],
      [
        "Mobil ilova uchun SDK bormi?",
        <>
          Alohida mobil SDK yo&apos;q. Mobil ilovada REST API to&apos;g&apos;ridan-to&apos;g&apos;ri
          ishlatiladi, xarita esa WebView orqali ko&apos;rsatiladi.
        </>,
      ],
      [
        "Xaritani o'z uslubim bilan ko'rsata olamanmi?",
        <>
          Ha. <C>style.json</C> MapLibre uslub spetsifikatsiyasiga mos — uni nusxalab, qatlam ranglari va
          yozuvlarini o&apos;zgartirishingiz mumkin.
        </>,
      ],
    ],
  },
  {
    id: "tarif",
    title: "Tarif va to'lov",
    items: [
      [
        "Bepul va obuna reja farqi nimada?",
        <>
          Bepul: 10 so&apos;rov/s, oyiga 200 000. Obuna: 100 so&apos;rov/s, oylik chegarasiz, oyiga
          qat&apos;iy 50 000 so&apos;m — ishlatilgan so&apos;rov soniga bog&apos;liq emas. Batafsil —{" "}
          <A href="/docs/billing/plans">Tariflar</A>.
        </>,
      ],
      [
        "To'lovni qanday amalga oshiraman?",
        <>
          Obuna yoqilgach har oy hisob-faktura chiqadi. To&apos;lov qo&apos;lda tasdiqlanadi —{" "}
          <A href="/billing">Hisob-faktura</A> bo&apos;limida ko&apos;rsatma va holatni kuzatib borasiz.
        </>,
      ],
      [
        "Chegara tugasa xarita ham o'chadimi?",
        <>
          Yo&apos;q. Chegara faqat REST API'ga taalluqli: <C>429 quota_exceeded</C> qaytadi. Xarita
          ko&apos;rsatish davom etadi.
        </>,
      ],
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Ko'p so'raladigan savollar"
        desc="Kalit olish, cheklovlar, tarif va xavfsizlik bo'yicha qisqa javoblar."
        pills={[
          { href: "/docs/api", label: "REST API", icon: <BookIcon size={15} /> },
          { href: "/keys", label: "API kalitlar", icon: <KeyIcon size={15} /> },
          { href: "/docs/billing/plans", label: "Tariflar", icon: <CardIcon size={15} /> },
        ]}
      />

      {GROUPS.map((g) => (
        <section key={g.id}>
          <H2 id={g.id}>{g.title}</H2>
          <div className="space-y-3">
            {g.items.map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-border bg-card px-5 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold marker:content-none">
                  <span className="flex items-start justify-between gap-4">
                    {q}
                    <span className="mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <div className="mt-2.5 text-sm leading-relaxed text-muted">{a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <PrevNext current="/docs/faq" />
    </div>
  );
}
