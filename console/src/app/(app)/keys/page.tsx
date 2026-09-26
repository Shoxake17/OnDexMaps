"use client";
import { useEffect, useState } from "react";
import { api, ApiError, type ApiKey } from "@/lib/api";
import { Card } from "@/components/Card";

const ALL_APIS = ["geocode", "reverse", "directions", "places"];
const API_LABEL: Record<string, string> = {
  geocode: "Geocode (nom → koordinata)",
  reverse: "Reverse (koordinata → manzil)",
  directions: "Directions (A → B yo'l)",
  places: "Places (ob'ekt ma'lumoti)",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [maxActive, setMaxActive] = useState(10);
  const [err, setErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [reveal, setReveal] = useState<{ name: string; secret: string } | null>(null);

  async function load() {
    try {
      const r = await api.listKeys();
      setKeys(r.keys);
      setMaxActive(r.max_active);
    } catch {
      setErr("Kalitlar ro'yxati yuklanmadi");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const activeCount = keys?.filter((k) => k.status === "active").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API kalitlar</h1>
          <p className="text-muted mt-1">
            {activeCount}/{maxActive} faol kalit
          </p>
        </div>
        <button
          disabled={activeCount >= maxActive}
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-brand text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          + Yangi kalit
        </button>
      </div>

      {err && <p className="text-danger text-sm">{err}</p>}

      <div className="space-y-3">
        {keys?.length === 0 && (
          <Card>
            <p className="text-muted text-sm">Hali kalit yo'q. "Yangi kalit" tugmasini bosing.</p>
          </Card>
        )}
        {keys?.map((k) => (
          <KeyRow key={k.id} k={k} onChanged={load} onSecret={setReveal} />
        ))}
      </div>

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(secret, name) => {
            setShowCreate(false);
            setReveal({ name, secret });
            void load();
          }}
        />
      )}
      {reveal && <SecretModal name={reveal.name} secret={reveal.secret} onClose={() => setReveal(null)} />}
    </div>
  );
}

function KeyRow({ k, onChanged, onSecret }: { k: ApiKey; onChanged: () => void; onSecret: (s: { name: string; secret: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const revoked = k.status !== "active";

  async function rotate() {
    setBusy(true);
    setErr("");
    try {
      const r = await api.rotateKey(k.id);
      onSecret({ name: k.name, secret: r.secret });
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!confirm(`"${k.name}" kalitini bekor qilasizmi? Bu qaytarilmaydi.`)) return;
    setBusy(true);
    setErr("");
    try {
      await api.revokeKey(k.id);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{k.name}</span>
            <span className="text-xs rounded-full bg-border px-2 py-0.5">{k.kind === "server" ? "Server" : "Brauzer"}</span>
            {revoked && <span className="text-xs rounded-full bg-danger/10 text-danger px-2 py-0.5">Bekor qilingan</span>}
          </div>
          <code className="text-xs text-muted">{k.prefix}…</code>
          <div className="mt-2 flex flex-wrap gap-1">
            {k.apis.map((a) => (
              <span key={a} className="text-xs rounded bg-brand/10 text-brand px-1.5 py-0.5">
                {a}
              </span>
            ))}
          </div>
          {k.kind === "browser" && k.origins.length > 0 && (
            <p className="mt-1 text-xs text-muted">Domenlar: {k.origins.join(", ")}</p>
          )}
          {k.kind === "server" && k.ips.length > 0 && (
            <p className="mt-1 text-xs text-muted">IP: {k.ips.join(", ")}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Yaratilgan: {fmtDate(k.created_at)} · Oxirgi ishlatilgan: {fmtDate(k.last_used_at)}
            {k.expires_at && ` · Muddati: ${fmtDate(k.expires_at)}`}
          </p>
        </div>
        {!revoked && (
          <div className="flex gap-2 shrink-0">
            <button disabled={busy} onClick={rotate} className="text-sm text-muted hover:text-brand">
              Almashtirish
            </button>
            <button disabled={busy} onClick={revoke} className="text-sm text-muted hover:text-danger">
              Bekor qilish
            </button>
          </div>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </Card>
  );
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (secret: string, name: string) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"server" | "browser">("server");
  const [apis, setApis] = useState<string[]>(["geocode"]);
  const [origins, setOrigins] = useState("");
  const [ips, setIps] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const spec: Parameters<typeof api.createKey>[0] = { name: name.trim(), kind, apis };
      if (kind === "browser") spec.origins = split(origins);
      else spec.ips = split(ips);
      const r = await api.createKey(spec);
      onCreated(r.secret, r.key.name);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Kalit yaratilmadi");
    } finally {
      setBusy(false);
    }
  }

  function toggleApi(a: string) {
    setApis((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  }

  return (
    <Modal onClose={onClose} title="Yangi API kalit">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1">Nom</label>
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2"
            placeholder="masalan: Production server"
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Turi</label>
          <div className="flex gap-2">
            {(["server", "browser"] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  kind === k ? "border-brand bg-brand/10 text-brand" : "border-border text-muted"
                }`}
              >
                {k === "server" ? "Server → Server" : "Brauzer (JS)"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            {kind === "server"
              ? "Faqat X-API-Key sarlavhasida yuboriladi; ixtiyoriy ravishda IP manzillarga cheklanadi."
              : "Sahifa manzilidan (?key=) ham yuboriladi; ruxsat etilgan domenlar majburiy."}
          </p>
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Ruxsat etilgan funksiyalar</label>
          <div className="space-y-1">
            {ALL_APIS.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={apis.includes(a)} onChange={() => toggleApi(a)} />
                {API_LABEL[a]}
              </label>
            ))}
          </div>
        </div>
        {kind === "browser" ? (
          <div>
            <label className="block text-sm text-muted mb-1">Ruxsat etilgan domenlar (vergul bilan)</label>
            <input
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2"
              placeholder="https://app.example.com, https://*.example.com"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm text-muted mb-1">IP manzillar (ixtiyoriy, vergul bilan)</label>
            <input
              value={ips}
              onChange={(e) => setIps(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2"
              placeholder="203.0.113.7, 203.0.113.0/24"
            />
          </div>
        )}
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted">
            Bekor qilish
          </button>
          <button disabled={busy || apis.length === 0} className="rounded-md bg-brand text-white px-4 py-2 text-sm disabled:opacity-50">
            Yaratish
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SecretModal({ name, secret, onClose }: { name: string; secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal onClose={onClose} title={`"${name}" kaliti yaratildi`}>
      <p className="text-sm text-danger font-medium mb-2">
        Bu kalit FAQAT HOZIR ko'rsatiladi. Uni xavfsiz joyga saqlang — keyinroq qayta ko'rsatib bo'lmaydi.
      </p>
      <div className="rounded-md bg-border/60 p-3 font-mono text-sm break-all select-all">{secret}</div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
          }}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          {copied ? "Nusxalandi ✓" : "Nusxalash"}
        </button>
        <button onClick={onClose} className="rounded-md bg-brand text-white px-4 py-2 text-sm">
          Yopish
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-lg">
        <h3 className="font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function split(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
