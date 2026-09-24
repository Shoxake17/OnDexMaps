"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setCsrf, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.requestCode(email.trim());
      setStep("code");
      setInfo(`Kod ${email} manziliga yuborildi (10 daqiqa amal qiladi).`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Kod yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const me = await api.verify(email.trim(), code.trim());
      setCsrf(me.csrf);
      router.replace("/dashboard");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Kod noto'g'ri");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center font-extrabold text-xl">
          <span className="text-brand">On</span>
          <span className="text-brand-dark dark:text-white">Dex</span>{" "}
          <span className="text-muted font-medium text-base">Console</span>
        </div>

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2"
                placeholder="siz@misol.com"
              />
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <button
              disabled={busy}
              className="w-full rounded-md bg-brand text-white py-2 font-medium disabled:opacity-50"
            >
              Kod yuborish
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-muted">{info}</p>
            <div>
              <label className="block text-sm text-muted mb-1">6 xonali kod</label>
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 tracking-[0.4em] text-center text-lg"
                placeholder="000000"
              />
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <button
              disabled={busy || code.length !== 6}
              className="w-full rounded-md bg-brand text-white py-2 font-medium disabled:opacity-50"
            >
              Kirish
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setErr("");
              }}
              className="w-full text-sm text-muted"
            >
              Boshqa email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
