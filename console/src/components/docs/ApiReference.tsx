"use client";
import { ApiReferenceReact } from "@scalar/api-reference-react";

/**
 * ApiReference — OpenAPI kontraktining interaktiv ko'rinishi (Scalar).
 *
 * Kontrakt `/openapi.yaml` dan olinadi — bu konsolning O'Z domeni
 * (`next.config.ts` uni `cmd/api` ning `/v2/openapi.yaml` iga proksilaydi).
 * Shu sabab qat'iy CSP (`connect-src 'self'`) buzilmaydi va tashqi domenga
 * ruxsat berish shart emas.
 *
 * ⚠️ Scalar paket sifatida (CDN'dan EMAS) ulangan: skript o'z domenimizdan
 * keladi va nonce asosidagi `script-src` siyosatiga to'g'ri keladi.
 */
export function ApiReference() {
  return (
    <div className="-mx-4 -my-8">
      <ApiReferenceReact
        configuration={{
          url: "/openapi.yaml",
          // Hujjat o'z navbarini ko'rsatmasin — bizda allaqachon bor.
          hideClientButton: true,
          hideDarkModeToggle: true,
          // "Try it" uchun standart server (kontraktdagi `servers` dan).
          defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
        }}
      />
    </div>
  );
}
