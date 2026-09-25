import { CardGrid, H2, P, PrevNext } from "@/components/docs/parts";

export const metadata = {
  title: "OnDexMap API — Hujjatlar",
  description: "OnDexMap xarita platformasi hujjatlari: JavaScript API, REST API, kalitlar va tariflar.",
};

export default function DocsHome() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold">OnDexMap API</h1>
      <p className="mb-2 text-muted">
        OnDexMap — O'zbekiston uchun o'z xarita platformamiz: xarita ma'lumoti, geokodlash, marshrut va
        ob'ektlar bazasi. Hammasi o'z serverlarimizda ishlaydi.
      </p>
      <p className="text-muted">
        Quyidagi bo'limlar bilan tanishib chiqing — kalit olish uchun ro'yxatdan o'tish talab qilinadi, lekin
        hujjatlar hammaga ochiq.
      </p>

      <H2 id="products">Nimalar bor</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/js",
            title: "JavaScript API",
            desc: "Saytingizga interaktiv OnDexMap xaritasini joylashtirish: kutubxona, uslub, markerlar.",
          },
          {
            href: "/docs/api",
            title: "REST API",
            desc: "Geokodlash, teskari geokodlash, A → B marshrut va ob'ekt ma'lumoti — server yoki brauzerdan.",
          },
          {
            href: "/docs/api#key",
            title: "API kalitlar",
            desc: "Server va brauzer kalitlari, domen/IP cheklovlari, xavfsiz almashtirish.",
          },
          {
            href: "/docs/api#pricing",
            title: "Tariflar",
            desc: "Bepul reja chegaralari va obuna — oyiga qat'iy 50 000 so'm.",
          },
          {
            href: "/docs/api#errors",
            title: "Xatolar",
            desc: "Javob kodlari va ularning sabablari: kalit, cheklov, limit.",
          },
          {
            href: "/docs/api#faq",
            title: "Ko'p so'raladigan savollar",
            desc: "Kalit olish, to'lov, cheklovlar va xavfsizlik bo'yicha qisqa javoblar.",
          },
        ]}
      />

      <H2 id="start">Qayerdan boshlash</H2>
      <P>
        Saytingizda xarita ko'rsatmoqchi bo'lsangiz — «JavaScript API → Tezkor start». Faqat ma'lumot kerak
        bo'lsa (manzil qidirish, marshrut hisoblash) — «REST API».
      </P>

      <PrevNext current="/docs" />
    </div>
  );
}
