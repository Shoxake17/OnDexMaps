// ⚠️ GENERATSIYA QILINGAN FAYL — QO'LDA TAHRIRLAMANG.
//
// Manba:     internal/httpapi/openapi.yaml
// Yangilash: go run ./cmd/docsgen
// Tekshirish: go run ./cmd/docsgen -check   (CI shuni ishlatadi)
//
// Endpoint sahifalari parametrlarni SHU YERDAN oladi — shuning uchun ular
// kontraktdan ajralib keta olmaydi.

export interface SpecParam {
  name: string;
  required: boolean;
  /** Kontraktdagi tavsif. */
  desc: string;
  /** Chegaralar: "2–100 belgi", "1–25, standart 10". Bo'sh bo'lishi mumkin. */
  constraints: string;
  /** Kontraktdagi misol qiymat. Bo'sh bo'lishi mumkin. */
  example: string;
}

export const SPEC_PARAMS: Record<string, SpecParam[]> = {
  "directions": [
    { name: "origin", required: true, desc: "Boshlanish nuqtasi, `lat,lng` ko'rinishida.", constraints: "shakl: ^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$", example: "41.0004,71.2394" },
    { name: "destination", required: true, desc: "Tugash nuqtasi, `lat,lng` ko'rinishida.", constraints: "shakl: ^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$", example: "41.0096,71.2325" },
  ],
  "geocode": [
    { name: "q", required: true, desc: "Qidiruv matni.", constraints: "2–100 belgi", example: "Chust bozori" },
    { name: "limit", required: false, desc: "Natijalar soni.", constraints: "1–25, standart 10", example: "" },
    { name: "lat", required: false, desc: "Xarita markazi (kenglik) — teng natijalardan yaqini oldin chiqadi. `lng` bilan BIRGA berilishi shart.", constraints: "37.0–45.8", example: "" },
    { name: "lng", required: false, desc: "Xarita markazi (uzunlik). `lat` bilan birga.", constraints: "55.5–73.5", example: "" },
  ],
  "places": [
    { name: "bbox", required: true, desc: "`g'arb,janub,sharq,shimol` (uzunlik, kenglik, uzunlik, kenglik). Tomonlari 1.5 gradusdan oshmasligi kerak.", constraints: "shakl: ^-?\\d+(\\.\\d+)?(,-?\\d+(\\.\\d+)?){3}$", example: "71.20,40.98,71.28,41.03" },
  ],
  "places-by-id": [
    { name: "id", required: true, desc: "Ob'ekt identifikatori (UUID).", constraints: "", example: "7b1f2c33-0000-4000-8000-00000000abcd" },
  ],
  "reverse": [
    { name: "lat", required: true, desc: "Kenglik (xizmat hududi ichida).", constraints: "40.5–41.6", example: "41.0004" },
    { name: "lng", required: true, desc: "Uzunlik (xizmat hududi ichida).", constraints: "70.5–72.0", example: "71.2394" },
  ],
};
