# OnDexMap — Next.js frontend (xarita, qidiruv, marshrut, ob'ekt qo'shish).
#
# ChustApp'dagi (`apps/web/Dockerfile`) bilan bir xil naqsh.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` — `npm install` EMAS: u package-lock.json ga QAT'IY amal
# qiladi. `install` esa lock faylni jimgina yangilashi mumkin, ya'ni
# CI'da va mahalliy mashinada boshqa-boshqa versiyalar yig'ilardi.
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ┌─ NEXT_PUBLIC_* BUILD VAQTIDA SINGDIRILADI ────────────────────────┐
# Go API'da barcha sozlamalar ISHLASH vaqtida o'qiladi, shuning uchun
# bitta image har qanday muhitda ishlaydi. Next.js'da bunday EMAS:
# `NEXT_PUBLIC_*` qiymatlari kompilyatsiya paytida klient paketiga
# MATN sifatida yoziladi — `docker run -e ...` bilan berish MUMKIN
# EMAS, ular allaqachon paket ichida.
#
# OnDexMap'da BITTA shunday o'zgaruvchi bor: `web/src/lib/config.ts`
# (API_BASE) va `middleware.ts` (CSP connect-src) ikkalasi ham shundan
# o'qiydi. Berilmasa `http://localhost:8090`ga tushadi — production'da
# bu WEB brauzerdan API'ga UMUMAN ULANOLMASLIGI degani (CORS/mixed
# content), shovqinsiz.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# `SITE_URL` — NEXT_PUBLIC_ EMAS (server-only), lekin `npm run build`
# statik generatsiya bosqichida (`/maps/[id]/[slug]` sahifa ma'lumotini
# yig'ish) `src/lib/site.ts` ni MODUL yuklanish vaqtida baholaydi —
# shuning uchun runtime env yetarli emas, build vaqtida ham SHART
# (ondexmap-seo-urls xotirasi: "prod'da SITE_URL SHART").
ARG SITE_URL
ENV SITE_URL=${SITE_URL}

RUN npm run build

# ---------- Ishlash bosqichi ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# ┌─ BAZANI YAMOQLASH ────────────────────────────────────────────────┐
# `node:20-alpine` Alpine'ning xavfsizlik yangilanishlaridan ORQADA
# qoladi: image haftada bir marta qayta yig'iladi, Alpine esa
# yamoqlarni kunlik chiqaradi. `apk upgrade` yamoqni build vaqtida
# oladi — har qurilishda bajariladi, image doim eng so'nggi yamoqlar
# bilan chiqadi.
RUN apk upgrade --no-cache

# ┌─ NPM, YARN, COREPACK OLIB TASHLANADI ─────────────────────────────┐
# Next.js `standalone` chiqishi FAQAT `node` ni talab qiladi. Paket
# menejerlarini qoldirish ikki narsani beradi: (1) ularning ICHIDAGI
# bog'liqliklarda (tar, glob, cross-spawn) CVE'lar — biz ishlatmasak
# ham skaner ko'radi; (2) konteynerga kirgan hujumchi uchun tayyor
# "kod tortib olish" vositasi (`npm install`).
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# ┌─ NEGA `USER node` ────────────────────────────────────────────────┐
# Rasmiy node image'idagi tayyor foydalanuvchi (uid 1000). Root'dan
# ishlash — RCE topilsa hujumchi darhol konteyner ichida root bo'ladi.
# `--chown` MAJBURIY: usiz fayllar root'ga tegishli bo'lib qoladi.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Next.js ish vaqtida rasm optimizatsiyasi keshini shu yerga yozadi.
# Papka oldindan `node` egaligida yaratilmasa, `read_only: true`
# compose'da birinchi so'rovda "EACCES: permission denied" chiqadi.
RUN mkdir -p .next/cache && chown -R node:node .next

USER node

# `server.js` (standalone) `PORT` o'zgaruvchisini o'qiydi — ATAYLAB
# 3100 (ChustApp'niki 3000 da, OnDexMap'ning o'zi ham lokalda shu
# portda ishlaydi). `EXPOSE` yolg'iz hujjat, portni O'ZGARTIRMAYDI —
# shuning uchun `ENV PORT` SHART.
ENV PORT=3100
EXPOSE 3100
CMD ["node", "server.js"]
