"use client";

/**
 * Xaritadagi tasdiqlangan ob'ekt haqida ma'lumot paneli (desktop yon paneli
 * va mobil pastki panelida bir xil).
 *
 * ⚠️ Bu yerda ko'rsatiladigan HAR BIR matn foydalanuvchi yozgan (admin
 * tekshirgan bo'lsa ham). Hammasi React matn tugunlari orqali chiqadi —
 * `dangerouslySetInnerHTML` yo'q, shuning uchun `<script>` ham oddiy matn.
 * Telefon `tel:` havolasiga FAQAT raqam va «+» qoldirilib qo'yiladi.
 */

import { X } from "lucide-react";
import { useEffect, useState } from "react";
// maplibre-gl v6 `default` export'ni olib tashladi — nomlangan import.
import * as maplibregl from "maplibre-gl";

import { useMap } from "@/components/map/MapProvider";
import { prettyUrl, safeHref, socialName } from "@/lib/contactCheck";
import { formatDistance } from "@/lib/geo";
import { placePhotoUrl, placesApi, type PlaceDetail } from "@/lib/places";
import { KindIcon, kindUi } from "./kindUi";

type Loaded =
  | { id: string; data: PlaceDetail; error?: undefined }
  | { id: string; error: string; data?: undefined };

/** `tel:` uchun: faqat raqamlar va boshidagi «+». */
function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null;
}

export default function PlaceDetails({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { map } = useMap();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    placesApi
      .detail(id, ctl.signal)
      .then((data) => setLoaded({ id, data }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoaded({ id, error: e.message });
      });
    return () => ctl.abort();
  }, [id]);

  // Yo'l tanlanganda xarita uni TO'LIQ ko'rsatadi (uzun yo'lning bir qismi ko'rinib
  // qolmasin). Nuqta ob'ektlar uchun xarita joyida turadi.
  const geometry = loaded?.id === id ? loaded.data?.geometry : undefined;
  const lengthM = loaded?.id === id ? loaded.data?.length_m : undefined;
  useEffect(() => {
    if (!map || !geometry || geometry.type !== "LineString" || geometry.coordinates.length < 2) return;
    const b = new maplibregl.LngLatBounds();
    for (const c of geometry.coordinates) b.extend([c[0], c[1]]);
    // Qisqa chiziq (piyodalar o'tish joyi ~10 m) uchun yaqinroq: aks holda u xaritada nuqtadek qoladi.
    const maxZoom = lengthM !== undefined && lengthM < 60 ? 19 : 17;
    map.fitBounds(b, { padding: 90, maxZoom, duration: 600 });
  }, [map, geometry, lengthM]);

  // Rasm kattalashtirilganda Escape yopadi.
  useEffect(() => {
    if (zoom === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setZoom(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [zoom]);

  // Boshqa ob'ektga o'tilganda eski natija ko'rsatilmaydi.
  const cur = loaded?.id === id ? loaded : null;
  const d = cur?.data;

  const title = d ? (d.name || [d.street, d.house].filter(Boolean).join(" ") || d.kind_label) : "";
  const address = d ? [d.street, d.house].filter(Boolean).join(" ") : "";
  const tel = d?.phone ? telHref(d.phone) : null;
  // Havola FAQAT http/https bo'lsa chiqadi: server allaqachon tekshirgan, lekin
  // mijoz ham `javascript:` ni HECH QACHON href ga qo'ymaydi (ikki qatlam).
  const siteHref = safeHref(d?.site);
  const socialHref = safeHref(d?.social);

  return (
    <div className="flex flex-col gap-4 px-5 pb-6 pt-2">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 break-words text-[22px] font-semibold leading-tight text-zinc-900">
          {d ? title : cur?.error ? "Ob'ekt topilmadi" : "Yuklanmoqda…"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-white transition hover:bg-zinc-400"
        >
          <X size={16} strokeWidth={3} />
        </button>
      </div>

      {cur?.error && <p className="text-sm text-zinc-500">{cur.error}</p>}

      {d && (
        <>
          <div className="flex items-center gap-2 text-[15px] text-zinc-600">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: kindUi(d.kind).color }}
            >
              <KindIcon kind={d.kind} size={16} />
            </span>
            {/* Sarlavha o'zi tur nomi bo'lsa (nomsiz ob'ekt) takrorlanmaydi. */}
            <span>
              {title === d.kind_label
                ? d.category
                : d.category
                  ? `${d.kind_label} · ${d.category}`
                  : d.kind_label}
            </span>
          </div>

          {d.photos > 0 && (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: d.photos }).map((_, i) => (
                <li key={i} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setZoom(i)}
                    aria-label={`${i + 1}-rasmni kattalashtirish`}
                    className="block overflow-hidden rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- API'dan keladigan rasm */}
                    <img
                      src={placePhotoUrl(d.id, i)}
                      alt={`${title} — ${i + 1}-rasm`}
                      loading="lazy"
                      className="h-[112px] w-[150px] bg-zinc-100 object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <dl className="flex flex-col gap-3 text-[15px]">
            {address && d.name && <Row label="Manzil">{address}</Row>}
            {d.phone && (
              <Row label="Telefon">
                {tel ? (
                  <a href={tel} className="text-[#2f6bff] hover:underline">
                    {d.phone}
                  </a>
                ) : (
                  d.phone
                )}
              </Row>
            )}
            {siteHref && d.site && (
              <Row label="Veb-sayt">
                <ExternalLink href={siteHref}>{prettyUrl(d.site)}</ExternalLink>
              </Row>
            )}
            {socialHref && d.social && (
              <Row label={socialName(d.social)}>
                <ExternalLink href={socialHref}>{prettyUrl(d.social)}</ExternalLink>
              </Row>
            )}
            {d.hours && <Row label="Ish vaqti">{d.hours}</Row>}
            {d.length_m !== undefined && d.length_m > 0 && (
              <Row label="Uzunligi">{formatDistance(d.length_m)}</Row>
            )}
            {d.description && (
              <Row label="Tavsif">
                <span className="whitespace-pre-line">{d.description}</span>
              </Row>
            )}
          </dl>

          <p className="text-xs text-zinc-400">
            Foydalanuvchi qo&apos;shgan, moderator tasdiqlagan ma&apos;lumot ·{" "}
            {d.lat.toFixed(5)}, {d.lng.toFixed(5)}
          </p>
        </>
      )}

      {d && zoom !== null && (
        <div
          role="dialog"
          aria-label="Rasm"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- API'dan keladigan rasm */}
          <img
            src={placePhotoUrl(d.id, zoom)}
            alt={`${title} — ${zoom + 1}-rasm`}
            className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain"
          />
          <button
            type="button"
            aria-label="Yopish"
            onClick={() => setZoom(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Tashqi havola. `noopener noreferrer` — ochilgan sayt bizning oynaga tegolmaydi
 * va manzilimizni bilmaydi; `nofollow ugc` — foydalanuvchi yozgan havola bo'yicha
 * qidiruv tizimlariga ishonch berilmaydi.
 */
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="break-all text-[#2f6bff] hover:underline"
    >
      {children}
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-words text-zinc-900">{children}</dd>
    </div>
  );
}
