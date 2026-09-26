import { CardGrid, H2, P, PageHead, PrevNext, Table } from "@/components/docs/parts";
import { HeroArt } from "@/components/docs/art";
import {
  BoltIcon,
  BookIcon,
  CardIcon,
  CodeIcon,
  HelpIcon,
  KeyIcon,
  PlugIcon,
  ServerIcon,
  ShieldIcon,
} from "@/components/docs/icons";

export const metadata = {
  title: "OnDexMap API — Hujjatlar",
  description:
    "OnDexMap xarita platformasi hujjatlari: JavaScript API, REST API, integratsiya, xavfsizlik va tariflar.",
};

export default function DocsHome() {
  return (
    <div className="max-w-none">
      <PageHead
        title="OnDexMap API"
        desc="O'zbekiston bo'yicha xarita platformasi: xarita ma'lumoti, geokodlash, marshrutlash va ob'ektlar bazasi. Hujjatlar ochiq — kalit faqat REST API chaqiruvlariga kerak."
        pills={[
          { href: "/docs/js/quickstart", label: "Quick Start", icon: <BoltIcon size={15} /> },
          { href: "/docs/integration", label: "Integratsiya", icon: <PlugIcon size={15} /> },
          { href: "/keys", label: "API kalit olish", icon: <KeyIcon size={15} /> },
        ]}
        art={<HeroArt />}
      />

      <H2 id="bolimlar">Bo&apos;limlar</H2>
      <CardGrid
        cards={[
          {
            href: "/docs/js",
            title: "JavaScript API",
            desc: "Saytingizga interaktiv xarita: arxitektura, endpointlar, limitlar va Map obyektlari.",
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
          {
            href: "/docs/api",
            title: "REST API",
            desc: "Geocode, reverse geocode, directions va places — server yoki brauzerdan.",
            icon: <ServerIcon size={20} />,
          },
          {
            href: "/docs/api/reference",
            title: "API Reference",
            desc: "Rasmiy OpenAPI kontrakti: barcha parametrlar va brauzerdan sinash.",
            icon: <BookIcon size={20} />,
          },
          {
            href: "/docs/security",
            title: "Security & Limits",
            desc: "Kalitlar, domen va IP cheklovlari, CSP va so'rov limitlari.",
            icon: <ShieldIcon size={20} />,
          },
          {
            href: "/docs/billing",
            title: "Usage & Billing",
            desc: "Nima hisoblanadi, tarif rejalari va hisob-fakturalar.",
            icon: <CardIcon size={20} />,
          },
          {
            href: "/docs/faq",
            title: "FAQ",
            desc: "Kalit, tarif, cheklovlar va xavfsizlik bo'yicha qisqa javoblar.",
            icon: <HelpIcon size={20} />,
          },
        ]}
      />

      <H2 id="nimadan-boshlash">Nimadan boshlash</H2>
      <Table
        head={["Vazifa", "Bo'lim"]}
        rows={[
          ["Saytda xarita ko'rsatish", "JavaScript API → Quick Start"],
          ["React, Vue yoki Next.js loyihasiga ulash", "Integratsiya"],
          ["Manzil qidirish, marshrut hisoblash", "REST API"],
          ["Parametr va javob shaklini aniqlash", "API Reference"],
          ["Kalitni domen yoki IP bilan cheklash", "Security & Limits"],
          ["Chegara va to'lovni tushunish", "Usage & Billing"],
        ]}
      />

      <H2 id="asosiy-manzillar">Asosiy manzillar</H2>
      <Table
        head={["Manzil", "Nima uchun", "Kalit"]}
        rows={[
          [
            <code key="1" className="font-mono text-xs text-brand">
              https://maps.ondex.uz/tiles/style.json
            </code>,
            "Xarita uslubi",
            "kerak emas",
          ],
          [
            <code key="2" className="font-mono text-xs text-brand">
              https://maps.ondex.uz/v2/…
            </code>,
            "REST API",
            "kerak",
          ],
          [
            <code key="3" className="font-mono text-xs text-brand">
              https://maps.ondex.uz/v2/openapi.yaml
            </code>,
            "Rasmiy kontrakt",
            "kerak emas",
          ],
        ]}
      />
      <P>
        Boshqaruv paneli — kalitlar, foydalanish statistikasi va hisob-fakturalar uchun. Kirish{" "}
        <a className="font-medium text-brand hover:underline" href="/login">
          email va bir martalik kod
        </a>{" "}
        orqali.
      </P>

      <PrevNext current="/docs" />
    </div>
  );
}
