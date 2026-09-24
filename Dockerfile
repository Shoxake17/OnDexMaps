# OnDexMap Go API — production image.
#
# ChustApp'dagi bir xil naqsh (F:\ChustApp\Dockerfile): ikki bosqichli
# yig'ish, distroless yakuniy image, root'siz ishlash.
#
# ┌─ NEGA IKKI BOSQICH ───────────────────────────────────────────────┐
# Go kompilyatori, modul keshi va manba kod ~800 MB joy egallaydi va
# ularning HECH BIRI ishlash vaqtida kerak emas. Yakuniy image'da
# faqat bitta statik binar qoladi.
#
# Xavfsizlik nuqtai nazaridan bu asosiy narsa: image'ga tushmagan
# kutubxonada zaiflik ham bo'lmaydi.
# └───────────────────────────────────────────────────────────────────┘

# ---------- 1-bosqich: yig'ish ----------
FROM golang:1.26-alpine AS build

WORKDIR /src

# Bog'liqliklar ALOHIDA qatlamda: manba kod o'zgarganda ular qayta
# yuklab olinmaydi (Docker qatlam keshi).
COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

# CGO_ENABLED=0 — to'liq statik binar. Busiz distroless/scratch
# image'da `no such file or directory` chiqadi (libc yo'q).
#
# -trimpath — binardan qurish mashinasining fayl yo'llari olib
# tashlanadi. -s -w — debug belgilari olib tashlanadi (kichikroq binar).
#
# Migratsiyalar `go:embed` bilan binar ICHIDA (agar shunday sozlangan
# bo'lsa), aks holda `cmd/migrate` alohida ishga tushiriladi (compose'da).
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/api \
        ./cmd/api

# `cmd/migrate` ham SHU image ichida — deploy vaqtida bitta qo'shimcha
# konteyner (`migrate` xizmati, compose'da) shu binarni ishlatadi,
# alohida image yig'ish shart emas.
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/migrate \
        ./cmd/migrate

# `cmd/adminserver` — moderatsiya/muharrirlik uchun production admin
# serveri (Caddy ortida, `ONDEXMAP_ADMIN_KEY` bilan himoyalangan).
# `cmd/admin`dan farqli: operator kompyuteriga EMAS, shu image'ga
# kiradi — compose'da alohida `adminserver` xizmati sifatida ishga
# tushiriladi, tashqi portga chiqarilmaydi.
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/adminserver \
        ./cmd/adminserver

# `cmd/osmimport` — OSM `.pbf` dan qidiruv indeksini (`geo_names`) qayta qurish.
# Doimiy xizmat EMAS: kerak bo'lganda BIR MARTALIK ishga tushiriladi:
#   docker compose run --rm --entrypoint /osmimport migrate -file /data/uzbekistan.osm.pbf
# (fayl `-v` bilan ulanadi). `migrate` xizmati bilan bir xil muhit/tarmoq kerak
# (DATABASE_URL_MIGRATE — baza egasi), shuning uchun ALOHIDA xizmat qo'shilmadi.
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/osmimport \
        ./cmd/osmimport

# `cmd/console` — console.ondex.uz backend (dasturchi hisobi, API kalit,
# foydalanish, hisob-faktura). `ondexmap_console` roli bilan ulanadi;
# tashqi portga to'g'ridan-to'g'ri chiqarilmaydi — `console-web` (Next.js)
# uni ichki tarmoqdan proksilaydi.
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/console \
        ./cmd/console

# ---------- 2-bosqich: ishlash ----------
#
# distroless/static — ichida shell, paket menejeri, coreutils YO'Q.
# Hujumchi RCE topsa ham `sh`, `curl`, `wget` topa olmaydi.
#
# `:nonroot` tegi — konteyner root'dan EMAS, uid 65532 ostida ishlaydi.
FROM gcr.io/distroless/static-debian12:nonroot

# TLS sertifikatlari (R2, Esri/sputnik, Mapbox — hammasi HTTPS).
# distroless/static ularni o'zi olib keladi, lekin aniq yozib
# qo'yamiz: bazani almashtirganda unutilmasin.
COPY --from=build /out/api /api
COPY --from=build /out/migrate /migrate
COPY --from=build /out/adminserver /adminserver
COPY --from=build /out/osmimport /osmimport
COPY --from=build /out/console /console

# ⚠️ `cmd/migrate` migratsiyalarni `go:embed` bilan EMAS, oddiy
# `os.ReadDir("migrations")` bilan o'qiydi (nisbiy yo'l, ishchi
# papkaga nisbatan) — shuning uchun `.sql` fayllar ham image'ga
# qo'shiladi. `WORKDIR /` bilan birga `migrations/` shu yerda turadi,
# `migrate -dir migrations` (standart) to'g'ri topadi.
COPY --from=build /src/migrations /migrations
WORKDIR /

USER nonroot:nonroot
EXPOSE 8090

# ENTRYPOINT (CMD emas) — `docker run <image> sh` bilan buyruqni
# almashtirib bo'lmaydi.
ENTRYPOINT ["/api"]
