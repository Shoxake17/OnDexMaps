import { PublicNav } from "@/components/PublicNav";
import { DocsShell } from "@/components/docs/DocsShell";

/**
 * Hujjatlar bo'limi — KIRISHSIZ ochiq (login talab qilinmaydi): dasturchi
 * avval API bilan tanishib chiqadi, kalitni keyin oladi.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <DocsShell>{children}</DocsShell>
    </div>
  );
}
