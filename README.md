# OnDexMap

Chust shahri uchun **o'z geoma'lumot bazasi**: mahallalar, ko'chalar va
ularning nomlari. Mapbox tuval (basemap) sifatida ishlatiladi, ustidagi
**ma'lumot esa bizniki**.

> **Holat:** Bosqich 0 — poydevor. Hali API ham, ma'lumot ham yo'q.

---

## 1. Nima uchun bu loyiha bor

OnDex ekotizimi hozir manzilni aniqlash uchun uchta tashqi provayderni
navbat bilan chaqiradi: **Google → Yandex → 2GIS**. Bu zanjirning
mavjudligining o'zi — Chust geoma'lumoti global xaritalarda yo'qligining
isboti (`ChustApp/internal/httpapi/geoext.go`, `shortAddress()` funksiyasi
ko'cha topilmaganini alohida qaytaradi).

OnDexMap shu bo'shliqni to'ldiradi va uchta natija beradi:

| Natija | Izoh |
|---|---|
| Chust'da Google'dan **aniqroq** manzil | mahalliy bilim global provayderda yo'q |
| Pullik geokodlash chaqiruvlari **kamayadi** | tashqi zanjir zaxiraga tushadi |
| Yetkazish narxini **mahalla bo'yicha** hisoblash | kichik shahar uchun eng to'g'ri model |

## 2. Nima BU EMAS

Bu ro'yxat qolgan hamma narsa kabi majburiy — "keyinchalik qo'shamiz"
bosimiga qarshi yozilgan.

- **Basemap almashtiruvchisi EMAS.** Xarita rasmini Mapbox chizadi. O'z
  tile serverimiz yo'q va rejada ham yo'q.
- **Marshrut hisoblagichi EMAS** (hozircha). Ko'chalar hozir NOMLAR uchun
  yig'iladi. Lekin geometriya kelajakda marshrutga yaroqli bo'lishi uchun
  QGIS'da **snapping va topological editing YOQILGAN holda** chiziladi —
  bu bugun bir tiyin turmaydi, keyin qayta chizishdan qutqaradi.
- **Panorama / Street View EMAS** (hozircha). U alohida bosqich va bu
  bazaning ustiga qo'yiladi.
- **Ikkinchi foydalanuvchi tizimi EMAS.** 4-bo'limga qarang.
- **Ikkinchi joylar katalogi EMAS.** Restoran/do'kon obyektlari
  ChustApp'ning `catalog` modulida qoladi. OnDexMap ular bilan `place_id`
  orqali bog'lanadi, nusxa saqlamaydi.

## 3. Izolyatsiya shartnomasi

OnDexMap ChustApp bilan bir mashinada, bir vaqtda ishlaydi. Fayllarga
tegmaslik yetarli emas — umumiy resurs ham buzadi.

| Resurs | ChustApp | OnDexMap |
|---|---|---|
| Postgres | `127.0.0.1:5432` | **`127.0.0.1:5433`** (alohida konteyner) |
| Redis | `127.0.0.1:6380` | — |
| Mongo | `127.0.0.1:27018` | — |
| API | `:8080` | **`:8090`** |
| Web | `:3000` | **`:3100`** |
| Docker project | `chustapp` | **`ondexmap`** |
| Volume | `chustapp_*` | **`ondexmap_pgdata`** |
| Git repo | alohida | **alohida** |
| Prod domen | `web-ondex.shoxpro.uz` | `map-ondex.shoxpro.uz` |

**INVARIANT:** OnDexMap ChustApp'ning bazasiga, Redis'iga yoki Mongo'siga
hech qachon ulanmaydi. Bog'lanish faqat HTTP orqali va faqat bitta
yo'nalishda (4-bo'lim).

## 4. Integratsiya modeli

### 4.1 Yo'nalish — bitta va faqat bitta

```
Brauzer / Flutter ilovalar
      │  (sessiya tokeni)
      ▼
ChustApp Go API          ← ONDEXMAP_READ_KEY FAQAT shu yerda yashaydi
      │  (API key, header'da)
      ▼
OnDexMap API
```

**INVARIANT:** OnDexMap hech qachon ChustApp'ni chaqirmaydi. Teskari
bog'lanish paydo bo'lsa — "alohida loyiha" tugaydi.

**INVARIANT:** Klientlar (brauzer, WebView, Flutter) OnDexMap'ga
to'g'ridan-to'g'ri murojaat qilmaydi. Sabab: kalit JS bundle'iga yoki
APK ichiga tushadi va u yerdan ko'chirib olinadi. ChustApp'da bu naqsh
allaqachon o'rnatilgan — `apps/web/app/api/proxy/[...path]/route.ts`
allowlist bilan.

### 4.2 Integratsiya IXTIYORIY — bu asosiy himoya

ChustApp tomonidagi butun o'zgarish: **1 ta yangi fayl + 2 ta env**.
Mavjud fayllarga tegilmaydi.

```
OnDexMap (sozlangan VA javob berdi)
   │ yo'q / timeout / topilmadi
   ▼
Google → Yandex → 2GIS      ← BUGUNGI zanjir, o'zgarishsiz
```

- `ONDEXMAP_URL` bo'sh → ChustApp **bugungidek** ishlaydi, bit-ma-bit
- OnDexMap o'lgan/sekin → 800 ms timeout → eski zanjir → mijoz sezmaydi
- Ma'lumot noto'g'ri → bitta env o'zgaruvchisi o'chiriladi, deploy shart emas

Bu — orqaga qaytish tugmasi. Usiz izolyatsiya xayoliy bo'lib qoladi.

### 4.2b Admin muharriri ChustApp panelida

Ma'lumot kiritish uchun alohida oyna ochish shart emas — OnDexMap
muharriri ChustApp admin panelining **"OnDexMap"** bo'limida ochiladi.

```
ChustApp admin paneli (Windows desktop)
   └─ "OnDexMap" bo'limi → WebView → http://127.0.0.1:8091
```

**INVARIANT:** ChustApp tomonida bu — faqat OYNA. Uch fayl qo'shildi
(`pages/ondexmap_page.dart`, `widgets/ondexmap_surface*.dart`) va
`shell.dart` ga uch qator. ChustApp OnDexMap bazasiga ham, uning
API'siga ham murojaat qilmaydi; bo'lim yangi so'rov yubormaydi va
`adminLive` soketiga tegmaydi.

**Nega WebView, nativ ekran emas:** geometriya chizish mantiqi
(poligon, chiziq, snapping) Flutter'da qaytadan yozilishi kerak
bo'lardi, va OnDexMap API'si o'zgarganda ikkala loyiha birga
o'zgartirilardi. WebView bilan OnDexMap mustaqil rivojlanaveradi.

**Admin kaliti Flutter binariga YOZILMAYDI.** Uni foydalanuvchi
OnDexMap'ning o'z kirish ekranida bir marta kiritadi (sessiya
davomida saqlanadi). Kalitni binarga joylash — uni har bir
o'rnatilgan nusxaga tarqatish degani; EXE esa ochib o'qiladi.

### 4.3 Kalitlar

Ikki xil kalit, ikki xil huquq — **aralashtirilmaydi**:

- `ONDEXMAP_READ_KEY` — faqat o'qish. ChustApp shuni ushlaydi.
- `ONDEXMAP_ADMIN_KEY` — yozish (import, moderatsiya). ChustApp'ga
  **hech qachon berilmaydi**.

Talablar:

- Header'da (`X-API-Key`), **URL query'da EMAS** — query string
  reverse-proxy loglariga, brauzer tarixiga va `Referer` sarlavhasiga
  tushadi (ChustApp'da bu dars `mini_app_webview.dart` izohida yozilgan)
- `subtle.ConstantTimeCompare` — oddiy `==` timing hujumiga ochiq
- `*_PREV` sloti bilan **to'xtovsiz rotatsiya**
- Hech qachon loglanmaydi — xato matnida ham
- Prod'da faqat HTTPS

## 5. Ma'lumot manbasi va litsenziya ⚠️

Bu — loyihaning eng oson e'tibordan qochadigan xavfi.

**Mapbox'ning basemap'i asosan OpenStreetMap'dan qurilgan.** Ya'ni
Mapbox xaritasidagi ko'cha chizig'i ustidan chizib olish — Mapbox'dan
emas, **OSM'dan nusxa olish**, ortiqcha qadam bilan. OSM esa **ODbL**
litsenziyasi ostida va u *share-alike* talab qiladi.

| Nima | Toza manba | Holat |
|---|---|---|
| Ko'cha/mahalla **nomi** | hokimlik, dala survey, mahalliy bilim | 🟢 fakt — bizniki |
| Mahalla markazi va chegarasi | hokimlik (rasmiy) | 🟢 |
| Ko'cha **geometriyasi** | GPS bilan yurib olingan | 🟢 |
| Ko'cha geometriyasi | basemap ustidan chizilgan | 🔴 OSM hosilasi |
| Har qanday ma'lumot | Google/Yandex/2GIS javobidan | 🔴 ToS taqiqlaydi |

**INVARIANT:** har bir geo-yozuvda `source` ustuni bo'ladi
(`official` \| `survey` \| `osm` \| `community`). Bu ustun bo'lmasa
manbalarni keyin **ajratib bo'lmaydi** — litsenziya qarori qanday
chiqsa ham, bazani tashlab qaytadan boshlashga to'g'ri keladi.

Bugun arzon, ertaga imkonsiz.

## 6. Autentifikatsiya — 1-bosqichda foydalanuvchi YO'Q

Faqat ikki daraja:

1. **Ommaviy o'qish** — auth yo'q, IP bo'yicha rate limit
2. **Admin yozish** — `ONDEXMAP_ADMIN_KEY`

Ma'lumot QGIS orqali kiritiladi va `cmd/geoimport` bilan yuklanadi.

**Nega foydalanuvchi yo'q:** "aholi aro boyitish" (crowdsourcing) —
keyingi bosqich. Agar hozir o'z `users` jadvalimizni qursak, ekotizimda
**ikkita identifikatsiya tizimi** paydo bo'ladi — bu aynan
`ChustApp/superapp.md` §2 ogohlantirgan muammo. Qaror keyinga
qoldiriladi; qaror qilmaslik ham qaror va bu holda to'g'ri qaror.

## 7. Bosqichlar

| # | Bosqich | Holat |
|---|---|---|
| 0 | Repo, izolyatsiya, xavfsizlik poydevori, PostGIS | 🔨 **joriy** |
| 1 | Go skeleti: config fail-fast, API key middleware, `/healthz` | ⏳ |
| 2 | Sxema + migratsiya (`mahallas`, `streets`, `street_aliases`) | ⏳ |
| 3 | `cmd/geoimport` (GeoJSON → PostGIS, provenans bilan) | ⏳ |
| 4 | Qidiruv: uzbek normalizatsiyasi + `pg_trgm` | ⏳ |
| 5 | `/v1/resolve`, `/v1/search`, `/v1/mahallas` | ⏳ |
| 6 | Ma'lumot kiritish (QGIS + hokimlik ro'yxati) | ⏳ |
| 7 | Sifatni Google bilan solishtirish (50 ta manzil) | ⏳ |
| 8 | ChustApp'ga ulash (`internal/geodata/client.go`) | ⏳ |
| — | Admin muharriri ChustApp panelida (§4.2b) | ✅ |
| — | Frontend viewer (Mapbox + o'z qatlamimiz) | keyin |
| — | Crowdsourcing + moderatsiya | keyin |
| — | Marshrut (OSRM), panorama | keyin |

**8-bosqich ataylab oxirida.** Baza bo'sh bo'lsa ulashning foydasi yo'q
(har so'rov "topilmadi" qaytaradi), zarari esa bor: integratsiya
xatolari bilan ma'lumot sifati muammolarini bir vaqtda debug qilishga
to'g'ri keladi.

## 8. Ishga tushirish

```powershell
Copy-Item .env.example .env
# .env ni to'ldiring: POSTGRES_PASSWORD, ONDEXMAP_READ_KEY, ONDEXMAP_ADMIN_KEY

# Kalit yaratish:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

docker compose up -d
docker compose ps          # postgis "healthy" bo'lishi kerak
```

Baza `127.0.0.1:5433` da ko'tariladi. ChustApp'ning 5432 dagi
Postgres'iga **tegmaydi**.
