"use client";

/**
 * «Xaritaga ob'ekt qo'shish» — yon panel (Yandex `obyektSidebar.png` va
 * `bo'shqaobyekt.png`).
 *
 * Uch bosqich:
 *   1. RO'YXAT — ob'ekt turi tanlanadi (Tashkilot, Manzil, ..., Boshqa ob'ekt);
 *   2. FORMA   — tanlangan turning maydonlari, rasmlar va «Yuborish»;
 *   3. TAYYOR  — «yuborildi, tekshiruvdan keyin xaritada chiqadi».
 *
 * ┌─ MODERATSIYA ──────────────────────────────────────────────────────
 * «Yuborish» ob'ektni xaritaga TO'G'RIDAN-TO'G'RI qo'ymaydi: u karantinga
 * tushadi va admin tasdiqlagach hamma uchun ko'rinadi. Foydalanuvchiga
 * buni OCHIQ aytamiz («tekshiruvdan keyin»): "xaritada ko'rinmadi" deb
 * xato deb o'ylab, bir ob'ektni ko'p marta yubormasin.
 * └────────────────────────────────────────────────────────────────────
 *
 * Forma qoidalari (qaysi turda qaysi maydon, majburiylik, chegaralar) serverdan
 * keladi (`PlacesMeta`). Bu yerdagi tekshiruv — faqat qulaylik: HAQIQIY
 * tekshiruv serverda, shuning uchun server rad etsa uning xabari ko'rsatiladi.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import type { LngLat } from "@/lib/geo";
import {
  placesApi,
  type KindMeta,
  type PlaceField,
  type PlacesMeta,
} from "@/lib/places";
import { ImageError, prepareImage } from "@/lib/prepareImage";
import { KindIcon } from "./kindUi";

type Step = { t: "list" } | { t: "form"; kind: string } | { t: "done" };

type Values = Record<PlaceField, string>;

const BLANK: Values = {
  name: "",
  category: "",
  description: "",
  phone: "",
  hours: "",
  street: "",
  house: "",
};

/** Formadagi maydonlar tartibi. */
const ORDER: PlaceField[] = [
  "name",
  "category",
  "street",
  "house",
  "phone",
  "hours",
  "description",
];

const BASE_LABEL: Record<PlaceField, string> = {
  name: "Nomi",
  category: "Turkum",
  description: "Tavsif",
  phone: "Telefon",
  hours: "Ish vaqti",
  street: "Ko'cha",
  house: "Uy raqami",
};

/** Ayrim turlarda «Nomi» boshqacha atalishi kerak. */
const NAME_LABEL: Record<string, string> = {
  organization: "Tashkilot nomi",
  entrance: "Kirish raqami yoki nomi",
  road: "Yo'l nomi",
  stop: "Bekat nomi",
  parking: "Turargoh nomi",
};

const DESC_HINT: Record<string, string> = {
  other:
    "Bu qanday ob'ekt ekanini yozing. Masalan: ko'l, o'rmon massivi, orol",
  organization: "Nima bilan shug'ullanadi? Qo'shimcha ma'lumot",
  road: "Nima o'zgargan? Masalan: yo'l yopilgan, bir tomonlama",
  barrier: "Turi va ochiq vaqti. Masalan: avtomatik, 8:00–20:00",
  entrance: "Qaysi bino/podyezd, qavat va h.k.",
  address: "Qo'shimcha ma'lumot (ixtiyoriy)",
};

const PLACEHOLDER: Partial<Record<PlaceField, string>> = {
  name: "",
  phone: "+998 90 123-45-67",
  hours: "Du–Sh 09:00–18:00",
  street: "Masalan: Navoiy ko'chasi",
  house: "12/A",
};

/** Mijoz tomonidagi qulay tekshiruv (server baribir qayta tekshiradi). */
function findProblem(
  kind: KindMeta,
  v: Values,
  limits: PlacesMeta["limits"],
): string | null {
  const t = (f: PlaceField) => v[f].trim();
  for (const f of kind.required) {
    if (t(f) === "") return `«${BASE_LABEL[f]}» to'ldirilishi shart`;
  }
  if (kind.any_of.length > 0 && kind.any_of.every((f) => t(f) === "")) {
    return "Kamida bitta maydonni to'ldiring";
  }
  for (const f of ["name", "description", "hours", "street", "house"] as const) {
    if (v[f].length > limits[f]) return `«${BASE_LABEL[f]}» juda uzun`;
  }
  const phone = t("phone");
  if (phone !== "") {
    const digits = phone.replace(/\D/g, "").length;
    if (!/^[0-9+() -]+$/.test(phone) || digits < 7 || digits > 15) {
      return "Telefon raqami noto'g'ri";
    }
  }
  return null;
}

function friendlyError(e: unknown): string {
  // `fetch` tarmoq uzilganda TypeError beradi ("Failed to fetch").
  if (e instanceof TypeError) {
    return "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring.";
  }
  return e instanceof Error && e.message ? e.message : "Yuborib bo'lmadi";
}

interface Photo {
  id: number;
  blob: Blob;
  url: string;
}

export default function AddObjectPanel({
  meta,
  point,
  onClose,
}: {
  meta: PlacesMeta;
  /** Belgining hozirgi joyi (xarita bilan sinxron). */
  point: LngLat;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ t: "list" });
  const [values, setValues] = useState<Values>(BLANK);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Asalari: odam ko'rmaydi va to'ldirmaydi (server bo'sh bo'lmasa rad etadi).
  const [trap, setTrap] = useState("");

  const nextId = useRef(1);
  const ctl = useRef<AbortController | null>(null);
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  });

  // Komponent yopilganda: so'rovni bekor qilish va rasm URL'larini bo'shatish.
  useEffect(
    () => () => {
      ctl.current?.abort();
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [],
  );

  const kind =
    step.t === "form" ? meta.kinds.find((k) => k.key === step.kind) : undefined;

  const reset = useCallback(() => {
    setValues(BLANK);
    setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setError(null);
    setPhotoError(null);
    setTrap("");
  }, []);

  const pickKind = (key: string) => {
    reset();
    setStep({ t: "form", kind: key });
  };

  const addFiles = async (files: FileList | File[]) => {
    setPhotoError(null);
    const room = meta.max_photos - photosRef.current.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (Array.from(files).length > list.length) {
      setPhotoError(`Ko'pi bilan ${meta.max_photos} ta rasm qo'shish mumkin`);
    }
    for (const f of list) {
      setPreparing((n) => n + 1);
      try {
        const blob = await prepareImage(f);
        const p: Photo = {
          id: nextId.current++,
          blob,
          url: URL.createObjectURL(blob),
        };
        setPhotos((prev) => [...prev, p]);
      } catch (e) {
        setPhotoError(
          e instanceof ImageError ? e.message : "Rasmni tayyorlab bo'lmadi",
        );
      } finally {
        setPreparing((n) => n - 1);
      }
    }
  };

  const removePhoto = (id: number) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const problem = kind ? findProblem(kind, values, meta.limits) : null;
  const canSend = !!kind && problem === null && !busy && preparing === 0;

  const send = async () => {
    if (!kind || !canSend) return;
    setBusy(true);
    setError(null);
    const c = new AbortController();
    ctl.current = c;
    try {
      // Faqat shu turda RUXSAT ETILGAN maydonlar yuboriladi.
      const pick = (f: PlaceField) => (kind.allowed.includes(f) ? values[f] : "");
      await placesApi.submit(
        {
          kind: kind.key,
          lat: point.lat,
          lng: point.lng,
          name: pick("name"),
          category: pick("category"),
          description: pick("description"),
          phone: pick("phone"),
          hours: pick("hours"),
          street: pick("street"),
          house: pick("house"),
          website: trap,
        },
        photos.map((p) => p.blob),
        c.signal,
      );
      reset();
      setStep({ t: "done" });
    } catch (e) {
      if (c.signal.aborted) return;
      setError(friendlyError(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  };

  // ── 1. Ro'yxat ─────────────────────────────────────────────────────
  if (step.t === "list") {
    return (
      <Shell>
        <Header title="Xaritaga ob'ekt qo'shish" onClose={onClose} />
        <ul className="px-5 pb-6">
          {meta.kinds.map((k, i) => (
            <li key={k.key} className="border-b border-zinc-200 last:border-b-0">
              <button
                type="button"
                onClick={() => pickKind(k.key)}
                className={`flex h-[71px] w-full items-center gap-5 text-left text-[17px] font-medium transition hover:bg-zinc-50 ${
                  i === 0 ? "text-[#2f6bff]" : "text-zinc-900"
                }`}
              >
                <span
                  className={`flex w-6 shrink-0 justify-center ${
                    i === 0 ? "text-[#2f6bff]" : "text-zinc-500"
                  }`}
                >
                  <KindIcon kind={k.key} />
                </span>
                {k.label}
              </button>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  // ── 3. Tayyor ──────────────────────────────────────────────────────
  if (step.t === "done") {
    return (
      <Shell>
        <Header title="Rahmat!" onClose={onClose} />
        <div className="flex flex-col items-start gap-4 px-5 pb-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <p className="text-[16px] leading-relaxed text-zinc-900">
            Ob&apos;ekt yuborildi. Moderator tekshirib chiqqach, u xaritada{" "}
            <b>hamma uchun</b> ko&apos;rinadi.
          </p>
          <p className="text-sm text-zinc-500">
            Tekshiruv biroz vaqt olishi mumkin — shu ob&apos;ektni qayta yuborish shart emas.
          </p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStep({ t: "list" })}
              className="h-11 rounded-xl bg-[#2f6bff] px-5 text-[15px] font-semibold text-white hover:bg-[#2559d6]"
            >
              Yana qo&apos;shish
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl bg-zinc-100 px-5 text-[15px] font-semibold text-zinc-800 hover:bg-zinc-200"
            >
              Yopish
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── 2. Forma ───────────────────────────────────────────────────────
  if (!kind) return null; // noma'lum tur (server ro'yxatidan chiqib ketgan) — hech narsa chizilmaydi

  const descHint = DESC_HINT[kind.key] ?? "Qo'shimcha ma'lumot";

  return (
    <Shell>
      <Header
        title={`${kind.label} qo'shish`}
        onBack={() => setStep({ t: "list" })}
        onClose={onClose}
        center
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <p className="mb-5 text-[15px] leading-snug text-zinc-500">
          Belgini ob&apos;ektga to&apos;g&apos;ri qo&apos;ying: uni surib qo&apos;ying yoki xaritani bosing.
          <span className="mt-1 block font-mono text-xs text-zinc-400">
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </span>
        </p>

        <div className="flex flex-col gap-5">
          {ORDER.filter((f) => kind.allowed.includes(f)).map((f) => {
            const required = kind.required.includes(f);
            const label = f === "name" ? (NAME_LABEL[kind.key] ?? BASE_LABEL.name) : BASE_LABEL[f];
            const id = `add-${f}`;
            return (
              <div key={f}>
                <label htmlFor={id} className="mb-1.5 block text-[16px] font-semibold text-zinc-900">
                  {label}
                  {required && <span className="ml-0.5 text-red-500">*</span>}
                </label>
                {f === "description" ? (
                  <textarea
                    id={id}
                    rows={3}
                    maxLength={meta.limits.description}
                    value={values.description}
                    placeholder={descHint}
                    onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                    className={`${INPUT} resize-none py-3`}
                  />
                ) : f === "category" ? (
                  <select
                    id={id}
                    value={values.category}
                    onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
                    className={`${INPUT} h-12 appearance-none bg-white`}
                  >
                    <option value="">Turkumni tanlang</option>
                    {meta.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={f === "phone" ? "tel" : "text"}
                    inputMode={f === "phone" ? "tel" : undefined}
                    maxLength={f === "phone" ? 24 : meta.limits[f]}
                    value={values[f]}
                    placeholder={PLACEHOLDER[f]}
                    onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                    className={`${INPUT} h-12`}
                  />
                )}
              </div>
            );
          })}

          {/* Rasmlar */}
          <div>
            <div className="mb-1.5 text-[16px] font-semibold text-zinc-900">Fotosuratlar</div>
            <PhotoDrop
              disabled={photos.length + preparing >= meta.max_photos}
              onFiles={addFiles}
            />
            {(photos.length > 0 || preparing > 0) && (
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <li key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image kerak emas */}
                    <img src={p.url} alt="Tanlangan rasm" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      aria-label="Rasmni olib tashlash"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </li>
                ))}
                {Array.from({ length: preparing }).map((_, i) => (
                  <li key={`w${i}`} className="flex aspect-[4/3] animate-pulse items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">
                    Tayyorlanmoqda…
                  </li>
                ))}
              </ul>
            )}
            {photoError && <p role="alert" className="mt-2 text-sm text-red-600">{photoError}</p>}
          </div>
        </div>

        {/* Asalari: odamga ko'rinmaydi, klaviatura bilan ham yetib bo'lmaydi. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Veb-sayt
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white px-5 py-4">
        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className={`h-12 rounded-xl px-6 text-[16px] font-semibold transition ${
              canSend
                ? "bg-[#2f6bff] text-white hover:bg-[#2559d6] active:bg-[#1f4cbd]"
                : "cursor-not-allowed bg-zinc-100 text-zinc-400"
            }`}
          >
            {busy ? "Yuborilmoqda…" : "Yuborish"}
          </button>
          {problem && !busy && (
            <span className="text-xs text-zinc-400">{problem}</span>
          )}
        </div>
      </div>
    </Shell>
  );
}

const INPUT =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 text-[16px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#2f6bff] focus:ring-2 focus:ring-[#2f6bff]/15";

/** Panelning umumiy qobig'i: balandlik to'liq, pastki tugma yopishib turadi. */
function Shell({ children }: { children: ReactNode }) {
  return <div className="relative flex h-full min-h-0 flex-col">{children}</div>;
}

function Header({
  title,
  onBack,
  onClose,
  center = false,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  center?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 pb-4 pt-2">
      {onBack && (
        <RoundButton label="Orqaga" onClick={onBack}>
          <path d="M15 5l-7 7 7 7" />
        </RoundButton>
      )}
      <h2
        className={`min-w-0 flex-1 text-[24px] font-semibold leading-tight text-zinc-900 ${
          center ? "text-center text-[22px]" : ""
        }`}
      >
        {title}
      </h2>
      <RoundButton label="Yopish" onClick={onClose}>
        <path d="M6 6l12 12M18 6L6 18" />
      </RoundButton>
    </div>
  );
}

/** Kulrang doira tugma, ichida oq belgi (Yandex «×» va «‹»). */
function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-white transition hover:bg-zinc-400"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/** Punktir chegarali rasm qo'shish maydoni (bosish yoki sudrab tashlash). */
function PhotoDrop({
  onFiles,
  disabled,
}: {
  onFiles: (f: FileList) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled && e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={`flex h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center transition ${
        over ? "border-[#2f6bff] bg-blue-50" : "border-zinc-300"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="flex items-center gap-2 text-[16px] font-medium text-[#2f6bff] disabled:cursor-not-allowed"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 4 7.6 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.6L15 4zm3 4.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
        </svg>
        Foto qo&apos;shish
      </button>
      <span className="px-4 text-[15px] text-zinc-500">
        Rasmni shu maydonga sudrab tashlash mumkin
      </span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          // Bir xil faylni qayta tanlash mumkin bo'lishi uchun.
          e.target.value = "";
        }}
      />
    </div>
  );
}
