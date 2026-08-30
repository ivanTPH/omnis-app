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

# Bake git SHA into the image at build time so Sentry release tracking works.
# Coolify passes COMMIT_SHA as a build arg; defaults to "local" in dev builds.
ARG COMMIT_SHA=local
ENV NEXT_PUBLIC_COMMIT_SHA=${COMMIT_SHA}

# NEXT_PUBLIC_* vars are inlined into the client JS bundle at build time, not read
# at container runtime — so the client Sentry DSN must be passed in as a build arg
# (Coolify: Build Variables, marked "available at buildtime"), same mechanism as
# COMMIT_SHA above. Without this, Sentry.init() sees dsn=undefined in production
# and silently disables itself, even with the runtime env var set correctly.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

# Sentry source-map upload is optional; silenced in next.config.ts when
# SENTRY_AUTH_TOKEN is absent, so the build never fails without it.
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install system Chromium for PDF generation (puppeteer-core uses this via
# PUPPETEER_EXECUTABLE_PATH; avoids glibc-linked Chrome incompatibility on Alpine)
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Standalone output includes only the node_modules actually needed at runtime.
# This is ~150 MB instead of the full 1.1 GB node_modules, shrinking the image
# significantly and reducing Coolify pull + container start time.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
# standalone/server.js expects PORT and HOSTNAME env vars
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
