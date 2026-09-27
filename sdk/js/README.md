# @ondexmap/sdk

OnDexMap'ning rasmiy JavaScript/TypeScript SDK'si — O'zbekiston xaritasi,
qidiruv, teskari geokodlash va marshrut uchun.

Tiplar **OpenAPI kontraktidan generatsiya qilinadi**, qo'lda yozilmaydi:
server o'zgarsa `npm run generate:check` CI'da yiqiladi, ya'ni SDK
hujjatdan yoki serverdan jimgina ortda qola olmaydi.

```bash
npm install @ondexmap/sdk
# xarita ham kerak bo'lsa:
npm install maplibre-gl pmtiles
```

API kalit: <https://console.ondex.uz>

---

## Nega SDK, oddiy `fetch` emas

SDK `fetch` ni qulayroq qilish uchun emas. U **sinovda haqiqatan ro'y
bergan** beshta nosozlikni imkonsiz qiladi:

| Nosozlik | Oddiy `fetch` bilan | SDK bilan |
|---|---|---|
| `bbox` xizmat hududidan chiqib ketadi (Termiz, Nukus yonida yaqinlashtirilgan bo'lsangiz ham) | `400`, sababi tushunarsiz | chekka qirqiladi, so'rov o'tadi |
| `bbox` juda keng | `400`, kvota sarflanadi | `null` qaytadi, so'rov **yuborilmaydi** |
| atribut mobil ekranda «i» ortiga yashirinadi | litsenziya buzilgan, siz bilmaysiz | `compact: false` majburiy |
| `geocode` natijasining `id` si `/places/{id}` ga to'g'ri kelmaydi (`p` prefiksi) | `404` | prefiks avtomatik olinadi |
| `429` da qayta urinish | qo'lda yoziladi yoki umuman yo'q | `Retry-After` hurmat qilinadi; kvota tugaganda **urinilmaydi** |

Bulardan tashqari: API kalit **doim sarlavhada** ketadi, hech qachon
so'rov qatorida — manzil brauzer tarixiga, proksi va server jurnallariga
tushadi.

---

## Xarita

```js
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { createMap } from "@ondexmap/sdk";
import "maplibre-gl/dist/maplibre-gl.css";

const map = createMap({
  container: "map",
  maplibregl,
  pmtilesProtocol: new Protocol().tile,
  center: [69.2401, 41.2995],
  zoom: 12,
});
```

`createMap` atributni **o'zi qo'yadi va uni o'chirib bo'lmaydi**. Bu
ataylab: atribut ODbL litsenziyasining va foydalanish shartlarining
talabi, va hujjatning 8 ta sahifasida u tor ekranda yashirinib qolgani
sinovda aniqlangan edi.

O'z brendingizni yoniga qo'shish mumkin:

<!-- kod-tekshirilmaydi -->
```js
createMap({ /* … qolgan parametrlar … */ customAttribution: "© Mening Kompaniyam" });
```

> ⚠️ Atribut yorlig'i HTML sifatida joylashtiriladi va MapLibre uni
> sanitizatsiya qilmaydi. Shuning uchun SDK `customAttribution` ni
> tekshiradi: skript, `on…=` hodisasi yoki `javascript:` uchrasa
> `throw` qiladi. **Bu qiymatni foydalanuvchi kiritmasidan olmang.**

### `createMap` parametrlari

| Nom | Turi | Standart |
|---|---|---|
| `container` | `HTMLElement \| string` | — (majburiy) |
| `maplibregl` | maplibre-gl moduli | — (majburiy) |
| `pmtilesProtocol` | `new Protocol().tile` | yo'q |
| `center` | `[lng, lat]` | `[69.2401, 41.2995]` |
| `zoom` | `number` | `12` |
| `style` | `string` | OnDexMap uslubi |
| `attributionPosition` | burchak | `"bottom-right"` |
| `customAttribution` | `string` | yo'q |
| `navigationControl` | `boolean` | `true` |
| `mapOptions` | `Record<string, unknown>` | `{}` |

`mapOptions` orqali berilgan `attributionControl` **e'tiborga
olinmaydi**.

---

## REST

```js
import { createClient } from "@ondexmap/sdk";

const ondex = createClient({ key: "omk_b_…" });
```

Xarita kerak bo'lmasa `maplibre-gl` ni o'rnatish shart emas — ikki qism
mustaqil.

### `geocode(q, opts?)`

Nom bo'yicha qidirish. Qamrov — butun O'zbekiston.

```js
const topilgan = await ondex.geocode("Chust", { limit: 5, near: [71.24, 41.0] });
for (const m of topilgan.results) console.log(m.name, m.label, m.lat, m.lng);
```

`results` `score` bo'yicha saralangan. `near` — natijalarni shu nuqtaga
yaqinlashtiradi, `[lng, lat]` tartibida.

`limit` serverning yuqori chegarasiga (25) avtomatik qirqiladi.

### `reverse(lat, lng)`

Koordinatadan manzil.

> ⚠️ Bu endpoint **butun mamlakatni qamramaydi** — faqat 40.5–41.6° N,
> 70.5–72.0° E ichida. Tashqarisi uchun SDK `null` qaytaradi va so'rov
> yubormaydi.

```js
const manzil = await ondex.reverse(41.0, 71.24);
if (manzil === null) console.log("nuqta qamrovdan tashqarida — so'rov yuborilmadi");
else if (manzil.result === null) console.log("qamrov ichida, lekin manzil topilmadi");
else console.log(manzil.result.text);
```

Ikkita `null` **bir xil emas**: birinchisi SDK'niki (so'rov umuman
ketmadi), ikkinchisi serverniki (so'rov ketdi, natija yo'q).

### `directions(from, to)`

```js
const marshrut = await ondex.directions([71.24, 41.0], [69.24, 41.3]);
const yol = marshrut.routes[0];
console.log(yol.distance_m, yol.duration_s);
console.log(yol.geometry);   // GeoJSON LineString
```

Nuqtalar `[lng, lat]` tartibida (GeoJSON kabi).

### `places(bounds)`

Ko'rinayotgan hududdagi ob'ektlar. `bounds` — `map.getBounds()`.

```js
map.on("moveend", async () => {
  const obyektlar = await ondex.places(map.getBounds());
  if (obyektlar === null) return;          // ko'rinish juda keng
  chizish(obyektlar.result.features);
});
```

To'rtburchak xizmat hududiga qirqiladi; tomoni tarif chegarasidan oshsa
`null` qaytadi va **so'rov yuborilmaydi**.

| Tarif | Tomon chegarasi |
|---|---|
| `free` | 0.25° |
| `paid` | 1.0° |
| `ecosystem` | 1.5° |

SDK tarifni bilmaydi (u serverda aniqlanadi), shuning uchun standart
holatda eng tor chegara olinadi. Obunachi bo'lsangiz:

```js
createClient({ key: "…", plan: "paid" });
```

### `place(id)`

Bitta ob'ekt tafsiloti.

```js
const qidiruv = await ondex.geocode("OnDexCompany");
const tafsilot = await ondex.place(qidiruv.results[0].id);   // `p` prefiksi avtomatik olinadi
```

---

## Xatolar

```js
import { OnDexMapError, isQuotaExceeded, isKeyProblem } from "@ondexmap/sdk";

try {
  await ondex.geocode("Chust");
} catch (e) {
  if (isQuotaExceeded(e)) { /* oylik chegara tugadi */ }
  else if (isKeyProblem(e)) { /* kalit noto'g'ri yoki domen ruxsat etilmagan */ }
  else if (e instanceof OnDexMapError) console.error(e.status, e.code, e.message);
}
```

`429` va `503` avtomatik qayta urinishga tushadi (standart 2 marta,
`Retry-After` hurmat qilinadi). Kvota tugagan `429` esa **qayta
urinilmaydi** — bu kutishdan boshqa hech narsa bermaydi.

```js
createClient({ key: "…", retries: 0 });   // o'chirish
```

### Kvotani kuzatish

```js
await ondex.geocode("Chust");
console.log(ondex.quota);   // { plan: "free", limit: 200000, used: 1234 }
```

---

## Kalit qayerda saqlanadi

| Kalit | Qayerda | Cheklov |
|---|---|---|
| `omk_b_…` | brauzerda ochiq bo'lishi mumkin | **konsolda domen ro'yxatini to'ldiring** |
| `omk_s_…` | faqat serverda | brauzerga hech qachon tushmasin |

Brauzer kaliti ko'rinadigan bo'lgani uchun uni himoya qiladigan yagona
narsa — konsoldagi domen ro'yxati. U bo'sh bo'lsa kalitni har kim
nusxalab ishlatishi mumkin.

Server kalitini frontend build'iga qo'ymang: `VITE_`, `NEXT_PUBLIC_` va
shunga o'xshash prefiksli o'zgaruvchilar **bundlega kiradi**.

---

## Atribut — majburiy

Xaritadagi kredit yorlig'ini o'chirish, yashirish yoki `opacity` bilan
ko'rinmas qilish foydalanish shartlarini buzadi. `createMap` uni siz
uchun to'g'ri qo'yadi.

Batafsil: <https://console.ondex.uz/copyright>

---

## Ishlab chiqish

```bash
npm install
npm run generate        # kontraktdan tiplarni qayta chiqarish
npm run generate:check  # tiplar eskirganini tekshirish (CI)
npm run typecheck
npm run build
npm test                # build'dan KEYIN: testlar dist/ ustida ishlaydi
```

Chegara raqamlari (`src/limits.ts`) serverda ham bor. Ikki nusxa
`internal/httpapi/sdk_sync_test.go` bilan qulflangan: server chegarasi
o'zgarsa Go testi yiqiladi.

## Litsenziya

MIT (SDK kodi). Xarita ma'lumotlari ODbL 1.0 —
<https://console.ondex.uz/copyright>.
