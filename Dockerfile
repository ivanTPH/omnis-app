# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Skip puppeteer Chrome download — we use system Chromium in the runner stage
ENV PUPPETEER_SKIP_DOWNLOAD=true

# prisma schema needed for postinstall (prisma generate)
COPY package*.json ./
COPY prisma ./prisma

RUN npm install

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Sentry source-map upload is optional; silenced in next.config.ts when
# SENTRY_AUTH_TOKEN is absent, so the build never fails without it.
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install system Chromium for PDF generation (puppeteer-core uses this via
# PUPPETEER_EXECUTABLE_PATH; avoids glibc-linked Chrome incompatibility on Alpine)
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Only copy the runtime artefacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "start"]
