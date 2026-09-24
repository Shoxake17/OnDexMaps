"use client";
import { useMe } from "@/lib/useMe";
import { MeProvider } from "@/lib/MeContext";
import { Shell } from "@/components/Shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, refresh } = useMe();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Yuklanmoqda…</div>;
  }
  if (!me) return null; // useMe allaqachon /login ga yo'naltirdi

  return (
    <Shell me={me}>
      <MeProvider me={me} refresh={refresh}>
        {children}
      </MeProvider>
    </Shell>
  );
}
