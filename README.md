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

### 4.2b Admin muharriri va moderatsiya ChustApp panelida (NATIV Flutter)

Ma'lumot kiritish uchun alohida oyna ochish shart emas — OnDexMap
muharriri va foydalanuvchi ob'ektlari moderatsiyasi ChustApp admin
panelining **"OnDexMap"** bo'limida, ikki tab bilan: **Muharrir | Takliflar (N)**.

```
ChustApp admin paneli (Windows desktop) — 100% nativ Flutter, WebView YO'Q
   └─ "OnDexMap" bo'limi ──HTTP (X-API-Key)──▶ cmd/admin (127.0.0.1:8091, faqat JSON)
        ├─ Muharrir  — flutter_map: mahalla/ko'cha chizish, tahrirlash, o'chirish, muqobil nom
        └─ Takliflar — foydalanuvchi ob'ektlarini tasdiqlash / rad etish
```

Ilgari muharrir OnDexMap serveri bergan Mapbox HTML sahifasi edi va panel
uni WebView2 ichida ochardi. U **o'chirildi**: admin serverda HTML sahifa,
statik fayl va Mapbox tokeniga bog'liqlik yo'q; `Content-Security-Policy:
default-src 'none'`. Kod: `apps/admin_panel/lib/ondexmap/`
(`editor_view.dart`, `editor_geometry.dart`, `moderation_view.dart`,
`moderation_api.dart`, `ondexmap_session*.dart`).

**Asos xarita** (muharrirda): *Sputnik* — OnDexMap API'ning o'z tile
proksisi (`/tiles/satellite/…`; provayder kaliti serverda qoladi,
`/api/config` faqat proksi manzilini beradi); *Xarita* — OpenStreetMap
raster tile'lari (kredit ko'rsatiladi; bu — admin uchun yengil yuk, ommaviy
sayt o'z PMTiles'ini ishlatadi). 3D binolar yo'q: chegara chizish uchun tik
ko'rinish aniqroq.

**INVARIANT:** ChustApp OnDexMap bazasiga ham, uning ommaviy API'siga ham
murojaat qilmaydi; bo'lim ChustApp API'siga so'rov yubormaydi va
`adminLive` soketiga tegmaydi — faqat lokal admin serveri bilan gaplashadi.

**Panelda kirish ekrani YO'Q.** Bo'lim ochilishi bilan ma'lumot ko'rinadi:
ekotizimda ikkinchi kirish nuqtasi bo'lmasligi kerak — foydalanuvchi
ChustApp paneliga allaqachon kirgan.

**Admin kaliti Flutter binariga ham, ChustApp env'iga ham
YOZILMAYDI** (§4.3 o'z kuchida qoladi). Uning o'rniga *lokal sessiya
qo'l berishi* ishlaydi:

```
cmd/admin ishga tushdi
   └─ tasodifiy token (32 bayt) → %LOCALAPPDATA%\OnDexMap\admin_session.json
                                        │  (faqat shu foydalanuvchi profili)
ChustApp paneli ────────────────────────┘
   └─ har so'rovda faylni QAYTA o'qiydi va tokenni `X-API-Key` sarlavhasida
      yuboradi (URL'da EMAS)
```

- token jarayon bilan birga **o'ladi** (server to'xtaganda fayl o'chiriladi);
- o'g'irlansa `ONDEXMAP_ADMIN_KEY` fosh bo'lmaydi, rotatsiya shart emas;
- kalit tekshiruvining o'zi **saqlanadi**: brauzerdagi zararli sahifa
  `127.0.0.1:8091` ga so'rov yuborishi mumkin, lekin lokal **faylni
  o'qiy olmaydi** — qo'l berish shu sababli haqiqiy chegara.

Panel har so'rovda manzilni tekshiradi: faqat `http` va faqat loopback
(aks holda sessiya faylini yozgan narsa panelni tashqi serverga burib,
unga tokenni yuborib qo'yardi). O'qish mantig'i BITTA joyda
(`ondexmap_session_io.dart`) va testlangan.

Kod: `internal/localsession` (OnDexMap), `apps/admin_panel/lib/ondexmap/` (ChustApp).

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

### 4.4 Foydalanuvchi qo'shgan ob'ektlar (moderatsiya bilan)

Xarita saytida o'ng tugma → **«Ob'ekt qo'shish»**: tashkilot, manzil, bino
kirishi, yo'l, shlagbaum, bekat, avtoturargoh, piyodalar o'tish joyi,
to'siq, kalitka, boshqa ob'ekt (nom/tavsif/telefon/ish vaqti + 4 tagacha rasm).

```
brauzer ─POST /v1/places─▶ place_submissions  (KARANTIN, status=pending)
                                  │  admin ko'radi, tuzatadi, tasdiqlaydi
                                  ▼  (ChustApp admin paneli → OnDexMap → «Takliflar»)
                           places ─GET /v1/places─▶ HAMMAGA ko'rinadi (xarita, qidiruv)
```

**INVARIANT:** yuborilgan hech narsa xaritaga to'g'ridan-to'g'ri tushmaydi.
Ommaviy API uchun §4 dagi "yozish yo'li yo'q" qoidasi **bitta tor istisno**
bilan: karantin jadvaliga INSERT. Uni uch narsa cheklaydi:

1. **Alohida rol** `ondexmap_submit` (`0007`, `0008` migratsiyalari): faqat
   `place_submissions` / `place_submission_photos` ga INSERT (moderatsiya
   ustunlariga — `status`, `created_at`, `reviewed_*` — **yozolmaydi**); jonli
   `places`, `mahallas` va h.k. ga tegolmaydi; karantinni o'qiy olmaydi (faqat
   soatlik chegara uchun 3 ta ustun).
2. **Alohida ulanish** `SUBMIT_DATABASE_URL` (`ondexmap_app` va egasi bilan
   bir xil bo'lsa server ishga tushmaydi). Bo'sh bo'lsa qabul qilish O'CHIQ.
3. **Tor kod interfeysi**: HTTP qatlami `*storage.Submitter` ni ushlaydi —
   faqat `Submit`, `RecentCount`, `PendingTotal`; o'zboshimchalik SQL yo'q.

Tekshiruv chuqurligi: turi bo'yicha maydon qoidalari (`internal/places`, bitta
manba — mijoz forma qoidalarini `/v1/places/meta` dan oladi), ko'rinmas/RTL
belgilar tozalanadi, rasm brauzerda kichraytiriladi **va serverda qaytadan
dekodlanib** JPEG'ga yoziladi (EXIF/GPS yo'qoladi, "rasm+skript" zararsiz),
piksel bombasi rad etiladi. Spam: IP bo'yicha rate limit, IP'ning **HMAC**i
bo'yicha soatiga 8 ta (xom IP saqlanmaydi), navbat 500 dan oshsa qabul yo'q,
asalari maydoni. Chiqishda hamma matn React matn tugunlari orqali —
`dangerouslySetInnerHTML` yo'q.

Ishga tushirish:

```powershell
# .env ga: ONDEXMAP_SUBMIT_DB_PASSWORD, SUBMIT_DATABASE_URL, SUBMIT_HINT_SECRET
go run ./cmd/migrate          # 0007 + 0008 (rol va jadvallar)
go run ./cmd/api              # qabul qilish yoqiladi
go run ./cmd/admin            # lokal admin serveri (127.0.0.1:8091)
```

**Moderatsiya UI — ChustApp admin panelida** (OnDexMap bo'limi → «Takliflar (N)»):
ko'rish, tuzatish, rasmni tanlash, tasdiqlash / rad etish, xaritadan olib
tashlash. UI nativ Flutter ekran (`apps/admin_panel/lib/ondexmap/`); u faqat
shu lokal admin serveri bilan gaplashadi (`/api/submissions*`, `/api/places*`;
hammasi admin kalitini talab qiladi). Token lokal sessiya faylidan olinadi
(§4.2b), manzil har so'rovda tekshiriladi (faqat `http://127.0.0.1`). Brauzer
sahifasi yo'q. Panel faqat Windows desktopda ishlaydi (web'da mixed content).
Jonli shartnoma testi: `$env:ONDEXMAP_LIVE='1'; flutter test test/moderation_live_test.dart`.

⚠️ **Prod'da `TRUSTED_PROXIES` SHART**: proksi (Cloudflare) ortida usiz hamma
foydalanuvchi bitta IP bo'lib sanaladi va soatlik chegara hammani bloklaydi.
`SUBMIT_DATABASE_URL` prod'da `sslmode=disable` bo'lmasligi va `SUBMIT_HINT_SECRET`
kamida 32 belgi bo'lishi shart (aks holda server ishga tushmaydi).

Foydalanuvchi jadvali baribir YO'Q (§6): yuboruvchi anonim, tasdiqlash — admin
(lokal). Ob'ektni tahrirlash/hisobga bog'lash — keyingi bosqich.

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
