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

import { Camera, Check, ChevronLeft, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import { formatDistance, pathLengthMeters, round6, type LngLat } from "@/lib/geo";
import { siteProblem, socialProblem } from "@/lib/contactCheck";
import {
  placesApi,
  type KindMeta,
  type LineRule,
  type PlaceField,
  type PlaceGeometry,
  type PlacesMeta,
} from "@/lib/places";
import { ImageError, prepareImage } from "@/lib/prepareImage";
import {
  DEFAULT_HOURS,
  formatHours,
  hoursProblem,
  type HoursState,
} from "@/lib/workHours";
import { KindIcon } from "./kindUi";
import WorkHoursField from "./WorkHoursField";

type Step = { t: "list" } | { t: "form"; kind: string } | { t: "done" };

type Values = Record<PlaceField, string>;

const BLANK: Values = {
  name: "",
  category: "",
  description: "",
  phone: "",
  site: "",
  social: "",
  hours: "",
  street: "",
  house: "",
};

/**
 * Formadagi bloklar tartibi. «contacts» — telefon, sayt va ijtimoiy tarmoq
 * bitta «Kontaktlar» bo'limida; «hours» — Yandex uslubidagi ish vaqti tanlagichlari.
 */
type Block = "name" | "category" | "street" | "house" | "contacts" | "hours" | "description";
const ORDER: Block[] = ["name", "category", "street", "house", "contacts", "hours", "description"];

/** Kontaktlar bo'limidagi maydonlar (tartib bilan). */
const CONTACT_FIELDS = ["phone", "site", "social"] as const;

const BASE_LABEL: Record<PlaceField, string> = {
  name: "Nomi",
  category: "Turkum",
  description: "Tavsif",
  phone: "Telefon raqami",
  site: "Veb-sayt",
  social: "Ijtimoiy tarmoq",
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

/** Chiziq turlari uchun yon paneldagi ko'rsatma (qanday chizish kerak). */
const LINE_HELP: Record<string, { title: string; text: string }> = {
  road: {
    title: "Yo'lni xaritada chizing.",
    text: "Yo'lning boshidan boshlab har burilishni bosing. Nuqtani surib tuzatish, ikki marta bosib o'chirish mumkin.",
  },
  crossing: {
    title: "Piyodalar o'tish joyini chizing.",
    text: "Yo'lni bir chetidan qarama-qarshi chetigacha KESIB o'tadigan chiziq: boshini va oxirini bosing. Chiziq 10 m dan oshmaydi — uzunroq bosilsa o'zi chegarada to'xtaydi. Xaritada zebra (yo'l-yo'l) bo'lib ko'rinadi.",
  },
  fence: {
    title: "To'siqni uning bo'ylab chizing.",
    text: "To'siqning boshidan boshlab har burilishni bosing. Nuqtani surib tuzatish, ikki marta bosib o'chirish mumkin. To'siq o'rtasida belgi turadi.",
  },
};
const LINE_HELP_DEFAULT = LINE_HELP.road;

// Izoh HECH QAYSI turda majburiy emas (server ham shuni talab qiladi), shuning
// uchun har bir maslahat «ixtiyoriy» deb boshlanadi.
const DESC_HINT: Record<string, string> = {
  other: "Ixtiyoriy. Masalan: ko'l, o'rmon massivi, orol",
  organization: "Ixtiyoriy. Nima bilan shug'ullanadi?",
  road: "Ixtiyoriy. Masalan: asfalt, bir tomonlama, ta'mirlanmoqda",
  barrier: "Ixtiyoriy. Masalan: avtomatik, 8:00–20:00",
  entrance: "Ixtiyoriy. Qaysi bino/podyezd, qavat va h.k.",
};
const DESC_HINT_DEFAULT = "Ixtiyoriy. Qo'shimcha ma'lumot";

const PLACEHOLDER: Partial<Record<PlaceField, string>> = {
  name: "",
  phone: "Telefon: +998 90 123-45-67",
  site: "Veb-sayt: example.uz",
  social: "Ijtimoiy tarmoq: instagram.com/nomi",
  street: "Masalan: Navoiy ko'chasi",
  house: "12/A",
};

/** Mijoz tomonidagi qulay tekshiruv (server baribir qayta tekshiradi). */
function findProblem(
  kind: KindMeta,
  v: Values,
  hours: HoursState,
  meta: PlacesMeta,
  line: LngLat[],
): string | null {
  const limits = meta.limits;
  const t = (f: PlaceField) => v[f].trim();
  // Chiziq: avval chizilgan bo'lishi kerak (formadagi matn maydonlaridan oldin).
  if (kind.geometry === "line") {
    const p = lineProblem(line, kind);
    if (p) return p;
  }
  for (const f of kind.required) {
    if (t(f) === "") return `«${BASE_LABEL[f]}» to'ldirilishi shart`;
  }
  if (kind.any_of.length > 0 && kind.any_of.every((f) => t(f) === "")) {
    return "Kamida bitta maydonni to'ldiring";
  }
  for (const f of ["name", "description", "street", "house"] as const) {
    if (v[f].length > limits[f]) return `«${BASE_LABEL[f]}» juda uzun`;
  }
  const phone = t("phone");
  if (phone !== "") {
    const digits = phone.replace(/\D/g, "").length;
    if (!/^[0-9+() -]+$/.test(phone) || digits < 7 || digits > 15) {
      return "Telefon raqami noto'g'ri";
    }
  }
  if (kind.allowed.includes("site")) {
    const p = siteProblem(v.site, limits.site);
    if (p) return p;
  }
  if (kind.allowed.includes("social")) {
    const p = socialProblem(v.social, meta.social_hosts, limits.social);
    if (p) return p;
  }
  if (kind.allowed.includes("hours")) {
    const p = hoursProblem(hours);
    if (p) return p;
    if (formatHours(hours).length > limits.hours) return "Ish vaqti juda uzun";
  }
  return null;
}

/**
 * Chizilgan chiziq uchun qulay tekshiruv. Chegaralar TURNIKI (server metadan:
 * yo'l kilometrlab, piyodalar o'tish joyi 10 m gacha) — bu yerda qattiq yozilmagan.
 */
export function lineProblem(line: LngLat[], kind: Pick<KindMeta, "label" | "line">): string | null {
  const rule = kind.line;
  const what = kind.label.toLowerCase();
  if (line.length < 2) return `Xaritani bosib ${what}ni chizing (kamida 2 nuqta)`;
  if (!rule) return null;
  if (line.length > rule.max_points) return `Nuqtalar juda ko'p (ko'pi bilan ${rule.max_points})`;
  const len = pathLengthMeters(line);
  if (len < rule.min_m) return `Chiziq juda qisqa (kamida ${formatDistance(rule.min_m)})`;
  if (len > rule.max_m) {
    return `Chiziq juda uzun: ${formatDistance(len)} (${formatDistance(rule.max_m)} dan oshmasin)`;
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
  line,
  onLineChange,
  onShape,
  onClose,
}: {
  meta: PlacesMeta;
  /** Belgining hozirgi joyi (xarita bilan sinxron) — nuqta turlari uchun. */
  point: LngLat;
  /** Chizilayotgan yo'l nuqtalari (xarita bilan sinxron) — chiziq turlari uchun. */
  line: LngLat[];
  onLineChange: (next: LngLat[]) => void;
  /**
   * Hozirgi tur qanday shaklda: xarita shunga qarab belgi ko'rsatadi yoki
   * bosishlarni chiziq nuqtasi sifatida qabul qiladi. `rule` — chiziq turining
   * chegarasi (eng uzun/ko'p nuqta): xarita uzun chizishga yo'l qo'ymay, chiziqni
   * chegarada to'xtatadi.
   */
  onShape: (shape: PlaceGeometry, rule: LineRule | null) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ t: "list" });
  const [values, setValues] = useState<Values>(BLANK);
  const [hours, setHours] = useState<HoursState>(DEFAULT_HOURS);
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
    setHours(DEFAULT_HOURS);
    setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setError(null);
    setPhotoError(null);
    setTrap("");
  }, []);

  // Xaritaga shakl haqida xabar: chiziq turi (yo'l, o'tish joyi, to'siq) tanlansa
  // belgi o'rniga chizish rejimi yoqiladi, ro'yxatga qaytilsa yoki panel
  // yopilsa — yana belgi.
  const shape: PlaceGeometry = kind?.geometry ?? "point";
  const lineRule = kind?.line ?? null;
  useEffect(() => {
    onShape(shape, lineRule);
  }, [shape, lineRule, onShape]);
  useEffect(() => () => onShape("point", null), [onShape]);

  const pickKind = (key: string) => {
    reset();
    // Yangi yo'l boshidan chiziladi (oldingi tur qoldig'i qolmasin).
    onLineChange([]);
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

  const problem = kind ? findProblem(kind, values, hours, meta, line) : null;
  const canSend = !!kind && problem === null && !busy && preparing === 0;
  const isLine = kind?.geometry === "line";
  const lineLength = pathLengthMeters(line);

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
          // Shakl turga qarab: yo'l — chiziq (lat/lng YUBORILMAYDI), qolgani — nuqta.
          ...(kind.geometry === "line"
            ? { line: line.map((p): [number, number] => [round6(p.lng), round6(p.lat)]) }
            : { lat: point.lat, lng: point.lng }),
          name: pick("name"),
          category: pick("category"),
          description: pick("description"),
          phone: pick("phone"),
          site: pick("site").trim(),
          social: pick("social").trim(),
          // Ish vaqti tanlagichlardan bir xil matnga aylanadi (`lib/workHours.ts`).
          hours: kind.allowed.includes("hours") ? formatHours(hours) : "",
          street: pick("street"),
          house: pick("house"),
          website: trap,
        },
        photos.map((p) => p.blob),
        c.signal,
      );
      reset();
      onLineChange([]);
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
        <ul className="px-4 pb-2">
          {meta.kinds.map((k, i) => (
            <li key={k.key} className="border-b border-zinc-200 last:border-b-0">
              <button
                type="button"
                onClick={() => pickKind(k.key)}
                className={`flex h-[43px] w-full items-center gap-3.5 text-left text-[15px] font-medium transition hover:bg-zinc-50 ${
                  i === 0 ? "text-[#2f6bff]" : "text-zinc-900"
                }`}
              >
                <span
                  className={`flex w-5 shrink-0 justify-center ${
                    i === 0 ? "text-[#2f6bff]" : "text-zinc-500"
                  }`}
                >
                  <KindIcon kind={k.key} size={20} />
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
            <Check size={28} strokeWidth={2.4} />
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

  const descHint = DESC_HINT[kind.key] ?? DESC_HINT_DEFAULT;
  const help = LINE_HELP[kind.key] ?? LINE_HELP_DEFAULT;
  const overLimit = !!kind.line && lineLength > kind.line.max_m;
  const set = (f: PlaceField, value: string) => setValues((v) => ({ ...v, [f]: value }));
  const has = (b: Block): boolean =>
    b === "contacts"
      ? CONTACT_FIELDS.some((f) => kind.allowed.includes(f))
      : kind.allowed.includes(b);

  return (
    <Shell>
      <Header
        title={`${kind.label} qo'shish`}
        onBack={() => setStep({ t: "list" })}
        onClose={onClose}
        center
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {isLine ? (
          // ── Chiziq turi (yo'l, o'tish joyi, to'siq): xaritada CHIZILADI ─────
          <div className="mb-3 rounded-xl bg-blue-50 p-3" data-testid="road-draw-help">
            <p className="text-[13px] leading-snug text-zinc-700">
              <b>{help.title}</b> {help.text}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Uzunligi
                </div>
                <div
                  className={`text-lg font-semibold ${overLimit ? "text-red-600" : "text-zinc-900"}`}
                  data-testid="road-length"
                >
                  {line.length < 2 ? "—" : formatDistance(lineLength)}
                  {kind.line && (
                    <span className="ml-1 text-sm font-medium text-zinc-400">
                      / {formatDistance(kind.line.max_m)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {line.length} nuqta
                  {kind.line ? ` (ko'pi bilan ${kind.line.max_points})` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onLineChange(line.slice(0, -1))}
                  disabled={line.length === 0}
                  className="h-8 rounded-lg bg-white px-3 text-[13px] font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Ortga
                </button>
                <button
                  type="button"
                  onClick={() => onLineChange([])}
                  disabled={line.length === 0}
                  className="h-8 rounded-lg bg-white px-3 text-[13px] font-semibold text-red-600 shadow-sm ring-1 ring-zinc-200 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Tozalash
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mb-2 text-[12px] leading-snug text-zinc-500">
            Belgini suring yoki xaritani bosing ·{" "}
            <span className="font-mono text-zinc-400">
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </span>
          </p>
        )}

        <div className="flex flex-col gap-2">
          {ORDER.filter(has).map((f) => {
            // ── Kontaktlar: telefon, veb-sayt, ijtimoiy tarmoq ─────────────
            if (f === "contacts") {
              return (
                <fieldset key="contacts" className="flex flex-col gap-2" data-testid="contacts">
                  <legend className="mb-1 text-[13px] font-semibold text-zinc-900">
                    Kontaktlar
                  </legend>
                  {CONTACT_FIELDS.filter((c) => kind.allowed.includes(c)).map((c) => (
                    <label key={c} className="block">
                      
                      <input
                        id={`add-${c}`}
                        aria-label={BASE_LABEL[c]}
                        type={c === "phone" ? "tel" : "text"}
                        inputMode={c === "phone" ? "tel" : c === "site" ? "url" : undefined}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={c === "phone" ? 24 : meta.limits[c]}
                        value={values[c]}
                        placeholder={PLACEHOLDER[c]}
                        onChange={(e) => set(c, e.target.value)}
                        className={`${INPUT} h-8`}
                      />
                    </label>
                  ))}
                </fieldset>
              );
            }
            // ── Ish vaqti: Yandex uslubidagi tanlagichlar ───────────────────
            if (f === "hours") {
              return <WorkHoursField key="hours" value={hours} onChange={setHours} />;
            }
            // Uy raqami ko'chaning YONIDA (bir qatorda): panel ixcham bo'lishi uchun.
            if (f === "house" && kind.allowed.includes("street")) return null;
            if (f === "street" && kind.allowed.includes("house")) {
              return (
                <div key="street-house" className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                  {(["street", "house"] as const).map((sf) => (
                    <div key={sf}>
                      <label htmlFor={`add-${sf}`} className="mb-1 block text-[13px] font-semibold text-zinc-900">
                        {BASE_LABEL[sf]}
                        {kind.required.includes(sf) && <span className="ml-0.5 text-red-500">*</span>}
                      </label>
                      <input
                        id={`add-${sf}`}
                        type="text"
                        maxLength={meta.limits[sf]}
                        value={values[sf]}
                        placeholder={PLACEHOLDER[sf]}
                        onChange={(e) => set(sf, e.target.value)}
                        className={`${INPUT} h-8`}
                      />
                    </div>
                  ))}
                </div>
              );
            }
            const required = kind.required.includes(f);
            const label = f === "name" ? (NAME_LABEL[kind.key] ?? BASE_LABEL.name) : BASE_LABEL[f];
            const id = `add-${f}`;
            return (
              <div key={f}>
                <label htmlFor={id} className="mb-1 block text-[13px] font-semibold text-zinc-900">
                  {label}
                  {required && <span className="ml-0.5 text-red-500">*</span>}
                </label>
                {f === "description" ? (
                  <textarea
                    id={id}
                    rows={1}
                    maxLength={meta.limits.description}
                    value={values.description}
                    placeholder={descHint}
                    onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                    className={`${INPUT} resize-none py-2`}
                  />
                ) : f === "category" ? (
                  <select
                    id={id}
                    value={values.category}
                    onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
                    className={`${INPUT} h-8 appearance-none bg-white`}
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
                    type="text"
                    maxLength={meta.limits[f as "name" | "street" | "house"]}
                    value={values[f]}
                    placeholder={PLACEHOLDER[f]}
                    onChange={(e) => set(f, e.target.value)}
                    className={`${INPUT} h-8`}
                  />
                )}
              </div>
            );
          })}

          {/* Rasmlar */}
          <div>
            <PhotoDrop
              disabled={photos.length + preparing >= meta.max_photos}
              onFiles={addFiles}
            />
            {(photos.length > 0 || preparing > 0) && (
              <ul className="mt-2 grid grid-cols-4 gap-1.5">
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
                      <X size={12} strokeWidth={3} />
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

      <div className="border-t border-zinc-200 bg-white px-4 py-2.5">
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
            className={`h-10 rounded-xl px-5 text-[15px] font-semibold transition ${
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
  "w-full rounded-lg border border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#2f6bff] focus:ring-2 focus:ring-[#2f6bff]/15";

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
    <div className="flex items-center gap-2.5 px-4 pb-2 pt-1">
      {onBack && (
        <RoundButton label="Orqaga" onClick={onBack}>
          <ChevronLeft size={14} strokeWidth={3} />
        </RoundButton>
      )}
      <h2
        className={`min-w-0 flex-1 text-[20px] font-semibold leading-tight text-zinc-900 ${
          center ? "text-center text-[18px]" : ""
        }`}
      >
        {title}
      </h2>
      <RoundButton label="Yopish" onClick={onClose}>
        <X size={14} strokeWidth={3} />
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-white transition hover:bg-zinc-400"
    >
      {children}
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
      className={`flex h-[44px] flex-row items-center justify-center gap-3 rounded-lg border border-dashed text-center transition ${
        over ? "border-[#2f6bff] bg-blue-50" : "border-zinc-300"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="flex items-center gap-1.5 text-[14px] font-medium text-[#2f6bff] disabled:cursor-not-allowed"
      >
        <Camera size={20} strokeWidth={1.9} />
        Foto qo&apos;shish
      </button>
      <span className="text-[12px] text-zinc-500">yoki sudrab tashlang</span>
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
