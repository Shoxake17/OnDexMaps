"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, type Me } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Boshqaruv" },
  { href: "/keys", label: "API kalitlar" },
  { href: "/usage", label: "Foydalanish" },
  { href: "/billing", label: "Hisob-faktura" },
  { href: "/docs", label: "Hujjatlar" },
];

export function Shell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl flex items-center gap-6 px-4 h-14">
          <span className="font-extrabold tracking-tight">
            <span className="text-brand">On</span>
            <span className="text-brand-dark dark:text-white">Dex</span>{" "}
            <span className="text-muted font-medium">Console</span>
          </span>
          <nav className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded-md ${
                  pathname?.startsWith(n.href)
                    ? "bg-brand/10 text-brand font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">{me.account.email}</span>
            <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs font-semibold uppercase">
              {me.plan.id}
            </span>
            <button
              className="text-muted hover:text-danger"
              onClick={async () => {
                await api.logout();
                router.replace("/login");
              }}
            >
              Chiqish
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
