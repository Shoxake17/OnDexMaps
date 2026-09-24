"use client";
import { useEffect, useState } from "react";
import { api, ApiError, type BillingResponse } from "@/lib/api";
import { Card } from "@/components/Card";

const STATUS_LABEL: Record<string, string> = { open: "To'lanmagan", paid: "To'langan", void: "Bekor qilingan" };
const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600",
  paid: "bg-emerald-500/10 text-emerald-600",
  void: "bg-border text-muted",
};

export default function BillingPage() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function load() {
    api.billing().then(setData).catch(() => setErr("Hisob-faktura ma'lumoti yuklanmadi"));
  }
  useEffect(load, []);

  async function requestSubscription(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api.subscribeRequest(note.trim());
      setMsg("So'rovingiz qabul qilindi. Tez orada siz bilan bog'lanamiz.");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "So'rov yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-muted">{err || "Yuklanmoqda…"}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hisob-faktura</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Joriy holat">
          <p className="text-sm">
            Reja: <strong>{{ free: "Bepul", paid: "Obuna", ecosystem: "OnDex ekotizimi" }[data.plan]}</strong>
          </p>
          {data.ecosystem ? (
            <p className="mt-2 text-sm text-muted">OnDex ekotizimi hisobi — bepul va cheklovsiz.</p>
          ) : data.subscription ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Oyiga qat'iy <strong>{data.price_uzs.toLocaleString("uz-UZ")} so'm</strong>, ishlatishdan qat'i nazar.
              </p>
              {data.overdue && (
                <p className="mt-2 rounded-md bg-danger/10 text-danger px-3 py-2 text-sm">
                  To'lov muddati o'tgan — hisob vaqtincha bepul limitlarda. Hisob-fakturani to'lang, reja darhol tiklanadi.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                Bepul reja: 10 so'rov/s, oyiga 200 000 so'rov. Obunaga o'tsangiz — 100 so'rov/s, oylik chegarasiz, oyiga qat'iy{" "}
                {data.price_uzs.toLocaleString("uz-UZ")} so'm.
              </p>
              {data.subscription_request_open ? (
                <p className="mt-3 text-sm text-brand">So'rovingiz ko'rib chiqilmoqda.</p>
              ) : (
                <form onSubmit={requestSubscription} className="mt-3 space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Izoh (ixtiyoriy)"
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  />
                  <button disabled={busy} className="rounded-md bg-brand text-white px-4 py-2 text-sm disabled:opacity-50">
                    Obunaga so'rov yuborish
                  </button>
                </form>
              )}
              {msg && <p className="mt-2 text-sm text-emerald-600">{msg}</p>}
              {err && <p className="mt-2 text-sm text-danger">{err}</p>}
            </>
          )}
        </Card>

        <Card title="To'lov ko'rsatmasi">
          {data.instructions ? (
            <p className="text-sm whitespace-pre-wrap">{data.instructions}</p>
          ) : (
            <p className="text-sm text-muted">To'lov qabul qilingach qo'lda tasdiqlanadi.</p>
          )}
        </Card>
      </div>

      <Card title="Hisob-fakturalar">
        {data.invoices.length === 0 ? (
          <p className="text-sm text-muted">Hali hisob-faktura yo'q.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="pb-2 font-medium">№</th>
                <th className="pb-2 font-medium">Davr</th>
                <th className="pb-2 font-medium">Summa</th>
                <th className="pb-2 font-medium">Holat</th>
                <th className="pb-2 font-medium">Muddati</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={i.id} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 font-mono text-xs">{i.number}</td>
                  <td className="py-1.5">
                    {i.period_start} — {i.period_end}
                  </td>
                  <td className="py-1.5">{i.amount_uzs.toLocaleString("uz-UZ")} so'm</td>
                  <td className="py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[i.status]}`}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </td>
                  <td className="py-1.5 text-muted">{new Date(i.due_at).toLocaleDateString("uz-UZ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
