import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { DocsShell } from "@/components/docs/DocsShell";

/**
 * Hujjatlar bo'limi — KIRISHSIZ ochiq (login talab qilinmaydi): dasturchi
 * avval API bilan tanishib chiqadi, kalitni keyin oladi.
 *
 * Futer SHU YERDA: ilgari hujjatlarning 30 ta sahifasida birorta aloqa
 * manzili va huquqiy hujjatga havola yo'q edi.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <DocsShell>{children}</DocsShell>
      <PublicFooter />
    </div>
  );
}
