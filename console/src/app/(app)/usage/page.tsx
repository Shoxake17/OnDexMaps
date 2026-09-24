"use client";
import { useEffect, useState } from "react";
import { api, type UsageResponse } from "@/lib/api";
import { Card, Stat } from "@/components/Card";
import { UsageChart } from "@/components/UsageChart";

const RANGES = [7, 30, 90];

export default function UsagePage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .usage(days)
      .then(setData)
      .catch(() => setErr("Foydalanish ma'lumoti yuklanmadi"));
  }, [days]);

  const totalReq = data?.daily.reduce((s, d) => s + d.requests, 0) ?? 0;
  const totalErr = data?.daily.reduce((s, d) => s + d.errors, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Foydalanish</h1>
        <div className="flex gap-1">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                days === d ? "bg-brand/10 text-brand font-medium" : "text-muted"
              }`}
            >
              {d} kun
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-danger text-sm">{err}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label={`So'rovlar (${days} kun)`} value={totalReq.toLocaleString("uz-UZ")} />
        <Stat label="Xatolar" value={totalErr.toLocaleString("uz-UZ")} />
        <Stat
          label="Joriy oy"
          value={data ? data.month.requests.toLocaleString("uz-UZ") : "—"}
          sub={data?.month.cap ? `chegara: ${data.month.cap.toLocaleString("uz-UZ")}` : "chegarasiz"}
        />
      </div>

      {data && (
        <Card title="Kunlik so'rovlar">
          <UsageChart data={data.daily} />
          <div className="mt-3 flex gap-4 text-xs text-muted">
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-brand mr-1" /> Hisoblangan so'rov
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-danger mr-1" /> Xato (hisoblanmaydi)
            </span>
          </div>
        </Card>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card title="Funksiya bo'yicha">
            <Table
              rows={data.by_api.map((r) => [r.api, r.requests.toLocaleString("uz-UZ"), r.errors.toLocaleString("uz-UZ")])}
              head={["API", "So'rov", "Xato"]}
            />
          </Card>
          <Card title="Kalit bo'yicha">
            <Table
              rows={data.by_key.map((r) => [
                `${r.name} (${r.prefix}…)`,
                r.requests.toLocaleString("uz-UZ"),
                r.errors.toLocaleString("uz-UZ"),
              ])}
              head={["Kalit", "So'rov", "Xato"]}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Ma'lumot yo'q</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted border-b border-border">
          {head.map((h) => (
            <th key={h} className="pb-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/60 last:border-0">
            {r.map((c, j) => (
              <td key={j} className="py-1.5">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
