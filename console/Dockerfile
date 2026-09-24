# console.ondex.uz — Next.js frontend. `web/Dockerfile` bilan bir xil naqsh.
#
# ⚠️ Bu yerda NEXT_PUBLIC_* YO'Q: barcha so'rovlar SAME-ORIGIN
# (`next.config.ts` `/api/*` ni backend'ga proksilaydi, `CONSOLE_API_INTERNAL_URL`
# ISHLASH vaqtida o'qiladi) — build vaqtida hech narsa "singdirilmaydi",
# bitta image har qanday muhitda ishlaydi (Go image'lari kabi).

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- Ishlash bosqichi ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk upgrade --no-cache

RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# ⚠️ `web/Dockerfile`dan farqli: bu loyihada HALI `public/` papkasi yo'q
# (statik rasm/favicon yo'q) — `COPY --from=builder .../public` shu sababli
# YO'Q (bo'lmagan manbadan COPY buildni yiqitadi). `console/public/` paydo
# bo'lsa shu qatorni qaytaring: `COPY --from=builder --chown=node:node /app/public ./public`
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

RUN mkdir -p .next/cache && chown -R node:node .next

USER node

ENV PORT=3200
EXPOSE 3200
CMD ["node", "server.js"]
