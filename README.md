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
to'siq, darvoza (ilgari «kalitka»; kaliti `gate` o'zgarmagan), boshqa ob'ekt
(nom/tavsif/kontaktlar/ish vaqti + 4 tagacha rasm).

**Tashkilot: kontaktlar va ish vaqti.**
- «Kontaktlar» bo'limi: telefon, veb-sayt (`site`) va ijtimoiy tarmoq akkaunti
  (`social`). Bular hammaga HAVOLA bo'ladi, shuning uchun qat'iy tekshiriladi
  (`internal/places/contacts.go`, bazada ham CHECK — `0010`): faqat `http/https`
  (`javascript:` va h.k. rad), `user:parol@` yo'q, IP/`localhost`/ichki domen
  yo'q; ijtimoiy tarmoq — faqat ma'lum tarmoqlar (Instagram, Telegram, Facebook,
  YouTube, TikTok, X, LinkedIn, VK, OK, Threads, WhatsApp) va akkaunt yo'li bilan.
  Sayt tafsilotda `rel="noopener noreferrer nofollow ugc"` bilan ochiladi.
  JSON'da kalitlar `site`/`social` (`website` — asalari, sayt EMAS).
- «Ish vaqti» Yandex uslubida uch tanlagich (`WorkHoursField.tsx`): kunlar ·
  soatlar (kun bo'yi / aniq vaqt) · tanaffus. Natija bir xil matn
  («Du–Ju, 09:00–18:00, tanaffus 13:00–14:00») — `lib/workHours.ts`; ixtiyoriy
  («Ko'rsatilmagan» tanlansa hech narsa yuborilmaydi).

**Brend.** Brauzer belgisi (favicon, `icon.png`, `apple-icon.png`) va interfeysdagi
kichik logotip (`public/ondexmap-pin.png`) OnDexMap logotipidan `web/scripts/make-icons.mjs`
bilan yasaladi (`node scripts/make-icons.mjs` — logotip o'zgarsa qayta ishga tushiring).
«Ob'ekt qo'shish» paytida xaritadagi sudraladigan belgi shu logotip (`useAddMarker.ts`);
«Mening joylashuvim» tugmasi va joylashuv nuqtasi esa odatiy (Lucide `Navigation`, ko'k nuqta).
Pastki o'ng burchakda katta «OnDex» yozuvi (`OnDexMark`, 30 px ko'tarilgan) va uning
ostida, burchakning o'zida FAQAT «© OnDex map» (`MapCredits`). Boshqa manba kreditlari
(OpenStreetMap, OpenMapTiles, Microsoft, «Powered by Esri» — oxirgisi faqat sun'iy
yo'ldosh yoqilganda) shaffof va o'lchamsiz (`.ondex-credits-hidden`): DOM'da bor,
ko'zga ko'rinmaydi. ⚠️ Bu mahsulot qarori; ODbL/Esri ko'rinadigan kreditni talab
qilishi mumkin — ommaviy ochishdan oldin huquqiy tekshiring. MapLibre'ning o'z
`AttributionControl`i ataylab ulanmagan.

**Belgilar — LUCIDE.** Hamma belgi `lucide-react` dan; qo'lda chizilgan SVG yo'l YO'Q.
Interfeys — Lucide komponentlari; xarita belgilari (ob'ekt turlari `kindUi.tsx`,
POI `poiIcons.ts`) tuvalda chiziladi, ma'lumot xuddi shu Lucide modulidan
(`lucide-react/dist/esm/icons/<nom>.mjs` → `__iconData`, `lib/lucideCanvas.ts`) —
yon paneldagi va xaritadagi belgi hech qachon farq qilmaydi. Yangi belgi: Lucide'dan
nom toping va import qiling (tur `types/lucide-icons.d.ts`). O'lcham: barcha ob'ekt
belgilari POI (OSM) belgilariga TENG — 20 px doira, 12 px belgi (`components/map/markerBadge.ts`,
yagona chizuvchi); avtoturargoh — «P» harfi; faqat bino kirishi ataylab o'ta kichik (13 px).
YAGONA ISTISNO — shlagbaum: `image/shlagboun.png` ga birga bir o'xshash bo'lishi kerak,
Lucide'da bunday belgi yo'q, shuning uchun `kindUi.tsx` → `BARRIER` o'lchamlaridan
chiziladi (panel SVG va xarita tuvali bir xil). Qidiruv natijasi va «ob'ekt qo'shish»
sudraladigan belgisi — OnDexMap logotipi (`components/map/logoPin.ts`). Yon panelda hech
qanday «yo'l-yo'riq» matni yo'q (hech narsa tanlanmaganda «Tanlangan hudud» / «Manzil»
bloki chiqmaydi).

**OSM POI turkumlari — rasmiy OpenMapTiles ro'yxati bo'yicha, 53 ta + «boshqa».**
`poiIcons.ts`: manba —
[`openmaptiles/layers/poi/poi.yaml`](https://github.com/openmaptiles/openmaptiles/blob/master/layers/poi/poi.yaml)
(2026-09-22 tekshirilgan). ⚠️ Ilgari kodda `pub`, `supermarket`, `convenience`,
`marketplace` deb TAXMIN qilingan kalitlar bor edi — булар HAQIQIY klass nomlari
EMAS (OpenMapTiles ularni mos ravishda `beer`, `grocery`, `shop`, `grocery` ga
yig'adi) va HECH QACHON mos kelmasdi: shu turdagi haqiqiy joylar kulrang «boshqa»
belgisi bo'lib chiqib turardi. Tuzatilgach haqiqiy Chust plitkasida
(`map.querySourceFeatures`, 304 ta xususiyat) tasdiqlandi: eski xato nomlar
HAQIQATAN kelmaydi; shu tekshiruvda yana 3 ta ma'lumotda bor, kodda yo'q klass
(`sports_centre`, `swimming_pool`, `toilets`) ham topilib qo'shildi.

**OSM joylari (POI) = OnDexMap belgilari — BITTA ARXITEKTURA.** Ikkalasi bir chizuvchidan
(`components/map/markerBadge.ts`): 20 px doira, 12 px belgi, nom belgining O'NG yonida va belgi
rangining to'qroq tusida (`image/image.png` «Кафе» kabi). OSM avtobus bekati — «Transport bekati»
belgisi, OSM parking — «P». **Belgi va nom BITTA qatlamda** (`style-chust.json` → `poi-dot`;
ilgari `poi-dot` + `poi-label` ikkita edi va «belgi bor, nomi yo'q / nomi bor, belgisi yo'q»
chiqardi): belgi doim birinchi, nom sig'masa `text-optional` bilan FAQAT nom yashiriladi; nom
belgisiz chiqmaydi. Transport bekati nomi ko'rsatilmaydi (OnDexMap `stop` va OSM `bus`). Uslub
API ichiga `go:embed` — o'zgarganda API qayta quriladi/yoqiladi.

**To'qnashuv qoidasi ham BIR XIL** (`usePlacesLayer.ts`): `icon-allow-overlap: false` va
`icon-padding`/`text-padding` OSM bilan aynan bir xil qiymatlarda — ikkalasi BITTA umumiy
to'qnashuv hisobida qatnashadi. Joy torlashsa OnDexMap ob'ekti ham OSM joyi kabi yashirinadi
(imtiyozi yo'q): manbasi ko'rinishda umuman bilinmaydi. (Bino kirishi va to'siq o'rtasidagi
belgi — istisno, `icon-allow-overlap: true`: ular «joy» emas, doim ko'rinishi kerak.)

**Muhimlik darajalari — Google/Yandex kabi DINAMIK ko'rinish** (`components/map/importance.ts`,
yagona haqiqat manbai; OSM tomoni `style-chust.json` da qo'lda AYNAN shu sonlar bilan
takrorlangan — o'zgartirilsa ikkalasi ham yangilanadi). 4 daraja: 1 — shahar miqyosidagi kam
sonli/muhim (shifoxona, yoqilg'i, masjid, kasalxona...), 4 — kichik/ko'p sonli (do'kon, boshqa).
Har daraja ALOHIDA MapLibre qatlami (`poi-tier1..4` va `ondex-places-tier1..4`) — MapLibre'da
`minzoom` ma'lumotdan hisoblanmaydi, shuning uchun daraja boshqacha ilojda ajratib bo'lmaydi
(OpenMapTiles'ning o'z namunaviy uslublari ham shu yo'l bilan ishlaydi). Daraja 1 z12 dan,
daraja 4 z16.5 dan ko'rinadi; har biriga `symbol-sort-key` (`TIER_SORT_BASE`) biriktirilgan —
joy torlashsa past raqamli (muhimroq) daraja g'olib chiqadi, MANBASIDAN QAT'I NAZAR (tier-1
OnDexMap kasalxonasi tier-3 OSM kafesini yutadi). Natija: yaqinlashtirilganda ekranda bo'sh joy
ko'payib, avval yashirin turgan kam muhim belgilar ham paydo bo'ladi — STATIK emas, haqiqiy
xaritalardagi kabi DINAMIK. OnDexMap «Tashkilot» darajasi `category` bo'yicha (`ORG_CATEGORY_TIER`),
qolgan turlar `kind` bo'yicha (`KIND_TIER`) belgilanadi.

**Qidiruv natijasi va «ob'ekt qo'shish» belgisi** — ikkalasi ham OnDexMap logotipi
(`components/map/logoPin.ts`, `/ondexmap-pin.png`); ilgari qidiruv natijasi qizil tomchi edi.

**Turkumlar (sidebar).** Turkum tanlansa xaritada FAQAT shu turkumdagi joylar belgisi qoladi
(OSM `class` + OnDexMap «Tashkilot» turkumi/turi; `panels/categories.tsx`, filtr `usePlacesLayer`);
yana bosilsa yoki «Hammasini ko'rsatish» — filtr olib tashlanadi. «Barcha joylar» asosiy 10 ta
turkumga 12 ta qo'shimcha turkumni ochadi. Holat (`CategoryContext`) sidebar, sarlavha va mobil
chiplar orasida umumiy. Yangi turkum: `categories.tsx` ga qo'shing (OSM `class` lari va server
`places.Categories` dagi aynan shu nomlar).

**«Ob'ekt qo'shish» paneli ixcham:** turlar ro'yxati va tashkilot formasi (ish vaqti to'liq
to'ldirilganda ham) 1400×850 ekranda aylantirishsiz sig'adi.

**Izoh (tavsif) hech qaysi turda majburiy emas** — ixtiyoriy. Majburiylari faqat
turning o'z maydonlari: tashkilotda nom + turkum, manzilda uy raqami, bekatda
nom. Qoida `internal/places/kinds.go` da, `TestDescriptionIsNeverRequired` qulflaydi.

**Bino kirishi — o'ta kichik belgi** (`image/kirish.png` kabi kulrang eshik + oq
strelka, 16×14 px, yozuvsiz) va faqat yaqin masshtabda (`ENTRANCE_MIN_ZOOM = 17.5`,
masshtab chizg'ichi ≈30 m) ko'rinadi; uzoqroqda yashirin. Alohida qatlam:
`usePlacesLayer.ts` → `ondex-places-entrance`, rasm — `kindUi.tsx` → `makeEntranceIcon`.

**Chiziq turlari: yo'l, piyodalar o'tish joyi, to'siq** (qolganlari — NUQTA). Har
turning o'z chegarasi bor (`KindSpec.Line`, `/v1/places/meta` → `kinds[].line`):
yo'l 5 m…30 km · **piyodalar o'tish joyi 2…10 m, ≤4 nuqta** · to'siq 1 m…2 km.
Forma uzun chizishga yo'l qo'ymaydi: chiziq chegarada o'zi TO'XTAYDI
(`lib/geo.ts` → `extendLine`). Xaritada o'tish joyi ZEBRA (`line-dasharray`,
kengligi ≈3.5 m, masshtab bilan o'sadi), to'siq — ingichka chiziq + o'rtasida belgi.
Bazada `0010`: ikki tur ham LineString (eski NUQTA qatorlar `NOT VALID` bilan qoladi).

**Yo'l — CHIZIQ.** «Yo'l» tanlansa belgi o'rniga chizish
rejimi yoqiladi: xaritani bosib nuqta qo'shiladi, nuqtani surish, ikki marta
bosib o'chirish, «Ortga» / «Tozalash» mumkin; uzunlik jonli ko'rinadi. Shakl
tur bilan belgilanadi (`internal/places/kinds.go` → `Geometry`) va **uch joyda**
majburlanadi: forma (`meta.kinds[].geometry`), server (`places.Validate`) va
baza (`0009_place_lines.sql` — `road` = LineString 2..500 nuqta, 1..40 000 m;
qolganlari = Point). Kod chegaralari: 2..500 nuqta, 5 m..30 km, O'zbekiston
ichida; ketma-ket takror nuqtalar olib tashlanadi; o'zini kesib o'tuvchi/yopiq
yo'l MUMKIN. Yo'l `POST /v1/places` da `"line": [[lng, lat], ...]` bilan
yuboriladi (lat/lng BERILMAYDI, har nuqta AYNAN 2 son). Moderator ChustApp
panelida yo'lni xaritada ko'radi; tasdiqlangach saytda yo'lning CHIZIG'I
ko'rinmaydi (talab) — faqat NOMI yo'l bo'ylab yozuv bo'lib chiqadi; nomga (yo'l
ustiga) bosilsa tafsilot (uzunligi) ochiladi. Chizish paytidagi qoralama chiziq
ko'k va ko'rinadi. Yangi chiziq turi qo'shish:
`Geometry: GeomLine` + migratsiyadagi `kind = '...'` + `TestMigrationLineKindsMatchCode`.

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
