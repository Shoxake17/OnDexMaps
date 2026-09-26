import Link from "next/link";
import { C, Code, H2, P, PageHead, PrevNext, Table, Tabs } from "./parts";
import { BookIcon, KeyIcon, ServerIcon } from "./icons";
import { SPEC_PARAMS } from "./generated/params";

/**
 * EndpointPage — REST API'ning bitta endpoint sahifasi.
 *
 * Oltita endpoint sahifasi bir xil tuzilishga ega (yo'l → parametrlar →
 * so'rov → javob → xatolar → keyingi qadam). Shu qolip bitta joyda turadi:
 * sahifalar faqat MA'LUMOT beradi, ko'rinish esa hamma joyda bir xil bo'ladi.
 */

export interface EndpointSpec {
  /** `PrevNext` uchun sahifa yo'li. */
  href: string;
  title: string;
  method: "GET";
  path: string;
  desc: string;
  /**
   * `SPEC_PARAMS` dagi kalit — parametr jadvali kontraktdan olinadi,
   * sahifada qo'lda yozilmaydi (`cmd/docsgen`).
   */
  page: keyof typeof SPEC_PARAMS;
  /** So'rov misollari — `Tabs` bo'lib chiqadi. */
  requests: { name: string; code: string; lang?: string }[];
  response: string;
  /** Javob maydonlari jadvali. */
  fields: [string, React.ReactNode][];
  errors: [string, string][];
  notes?: React.ReactNode;
  next?: { href: string; label: string }[];
}

const METHOD_CLASS = "rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600";

/**
 * ticks — kontrakt tavsiflaridagi `matn` bo'laklarini kod ko'rinishiga
 * o'tkazadi. `openapi.yaml` da tavsiflar Markdown bilan yoziladi, bu yerda
 * esa shundayligicha chiqsa teskari tirnoqlar ko'rinib qolardi.
 */
function ticks(text: string): React.ReactNode {
  const parts = text.split("`");
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <C key={i}>{p}</C> : p));
}

export function EndpointPage({ spec }: { spec: EndpointSpec }) {
  return (
    <div className="max-w-none">
      <PageHead
        title={spec.title}
        desc={spec.desc}
        pills={[
          { href: "/docs/api", label: "REST API", icon: <ServerIcon size={15} /> },
          { href: "/docs/api/reference", label: "API Reference", icon: <BookIcon size={15} /> },
          { href: "/keys", label: "API kalit olish", icon: <KeyIcon size={15} /> },
        ]}
      />

      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <span className={METHOD_CLASS}>{spec.method}</span>
        <code className="font-mono text-sm font-semibold">{spec.path}</code>
      </div>

      <H2 id="parametrlar">Parametrlar</H2>
      <Table
        head={["Parametr", "Holati", "Tavsif"]}
        rows={[
          ...(SPEC_PARAMS[spec.page] ?? []).map((p) => [
            <code key={p.name} className="whitespace-nowrap font-mono text-brand">
              {p.name}
            </code>,
            p.required ? "majburiy" : "ixtiyoriy",
            <div key={`${p.name}-d`}>
              {ticks(p.desc)}
              {(p.constraints || p.example) && (
                <div className="mt-1 text-xs">
                  {p.constraints && <span className="text-muted">{p.constraints}</span>}
                  {p.constraints && p.example && <span className="text-border"> · </span>}
                  {p.example && (
                    <span className="text-muted">
                      misol: <C>{p.example}</C>
                    </span>
                  )}
                </div>
              )}
            </div>,
          ]),
          // `key` — yo'l parametri emas, xavfsizlik sxemasi; shuning uchun
          // kontraktning `parameters` ro'yxatida yo'q va barcha endpointlar
          // uchun bir xil.
          [
            <code key="key" className="whitespace-nowrap font-mono text-brand">
              key
            </code>,
            "ixtiyoriy",
            <div key="key-d">
              Brauzer kaliti. Server kaliti faqat <C>X-API-Key</C> sarlavhasida yuboriladi —{" "}
              <Link href="/docs/security/keys" className="font-medium text-brand hover:underline">
                API kalitlar
              </Link>
            </div>,
          ],
        ]}
      />

      <H2 id="sorov">So&apos;rov</H2>
      <Tabs files={spec.requests} />

      <H2 id="javob">Javob</H2>
      <Code lang="json">{spec.response}</Code>
      {spec.fields.length > 0 && (
        <Table head={["Maydon", "Ma'nosi"]} rows={spec.fields.map(([k, v]) => [<C key={k}>{k}</C>, v])} />
      )}

      {spec.notes && (
        <>
          <H2 id="eslatmalar">Eslatmalar</H2>
          {spec.notes}
        </>
      )}

      <H2 id="xatolar">Xatolar</H2>
      <Table
        head={["Kod", "Qachon"]}
        rows={spec.errors.map(([code, when]) => [
          <code key={code} className="whitespace-nowrap font-mono text-brand">
            {code}
          </code>,
          when,
        ])}
      />
      <P>
        Barcha xato kodlari va qayta urinish qoidalari —{" "}
        <Link href="/docs/api/errors" className="font-medium text-brand hover:underline">
          Errors
        </Link>
        .
      </P>

      {spec.next && spec.next.length > 0 && (
        <>
          <H2 id="keyingi">Keyingi qadam</H2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {spec.next.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition hover:border-brand/50"
              >
                {n.label} →
              </Link>
            ))}
          </div>
        </>
      )}

      <PrevNext current={spec.href} />
    </div>
  );
}
