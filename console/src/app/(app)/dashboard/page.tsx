"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type UsageResponse, type ApiKey } from "@/lib/api";
import { useMeContext } from "@/lib/MeContext";
import { Card, Stat } from "@/components/Card";

const PLAN_LABEL: Record<string, string> = { free: "Bepul", paid: "Obuna", ecosystem: "OnDex ekotizimi" };

export default function DashboardPage() {
  const { me } = useMeContext();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api.usage(30), api.listKeys()])
      .then(([u, k]) => {
        setUsage(u);
        setKeys(k.keys);
      })
      .catch(() => setErr("Ma'lumot yuklanmadi"));
  }, []);

  const activeKeys = keys?.filter((k) => k.status === "active").length ?? 0;
  const cap = usage?.month.cap ?? null;
  const used = usage?.month.requests ?? 0;
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Xush kelibsiz{me.account.name ? `, ${me.account.name}` : ""}</h1>
        <p className="text-muted mt-1">
          Joriy reja: <strong>{PLAN_LABEL[me.plan.id]}</strong> — {me.plan.rps} so'rov/s
          {cap ? `, oyiga ${cap.toLocaleString("uz-UZ")} so'rov` : ", oylik chegarasiz"}
        </p>
        {me.account.overdue && (
          <p className="mt-2 rounded-md bg-danger/10 text-danger px-3 py-2 text-sm">
            Hisob-faktura muddati o'tgan — hisobingiz vaqtincha bepul limitlarda ishlamoqda.{" "}
            <Link href="/billing" className="underline">
              Hisob-fakturani ko'rish
            </Link>
          </p>
        )}
      </div>

      {err && <p className="text-danger text-sm">{err}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Faol API kalitlar" value={String(activeKeys)} />
        <Stat label="Joriy oy so'rovlari" value={used.toLocaleString("uz-UZ")} sub={cap ? `${pct}% chegaradan` : undefined} />
        <Stat label="Bugungi xatolar" value={String(usage?.daily.at(-1)?.errors ?? 0)} />
      </div>

      {cap && (
        <Card title="Oylik chegara">
          <div className="h-2 w-full rounded-full bg-border overflow-hidden">
            <div
              className={`h-full ${pct >= 90 ? "bg-danger" : "bg-brand"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {used.toLocaleString("uz-UZ")} / {cap.toLocaleString("uz-UZ")} so'rov ishlatildi
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Tezkor havolalar">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/keys" className="text-brand hover:underline">
                → Yangi API kalit yaratish
              </Link>
            </li>
            <li>
              <Link href="/usage" className="text-brand hover:underline">
                → Batafsil foydalanish statistikasi
              </Link>
            </li>
            <li>
              <Link href="/docs" className="text-brand hover:underline">
                → API hujjatlari va misollar
              </Link>
            </li>
          </ul>
        </Card>
        <Card title="Reja">
          <p className="text-sm text-muted">
            Bepul reja: 10 so'rov/s, oyiga 200 000 so'rov. Obuna — 100 so'rov/s, oylik chegarasiz, oyiga qat'iy{" "}
            <strong>50 000 so'm</strong>, ishlatishdan qat'i nazar.
          </p>
          {me.plan.id === "free" && (
            <Link href="/billing" className="mt-3 inline-block rounded-md bg-brand text-white px-3 py-1.5 text-sm">
              Obunaga o'tish
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}
