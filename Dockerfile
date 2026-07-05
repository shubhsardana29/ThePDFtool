# Production images. Build with:
#   docker compose -f docker-compose.prod.yml up -d --build

# ---- deps: install node_modules once ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the Next.js standalone server ----
FROM deps AS build
COPY . .
# Canonical URLs, the sitemap, and OG metadata are baked into the static
# pages at build time — the public site URL must be known here, not at runtime.
ARG NEXT_PUBLIC_SITE_URL=http://localhost
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- web: minimal runtime for the Next.js app ----
FROM node:22-bookworm-slim AS web
WORKDIR /app
# Next standalone binds to $HOSTNAME — force all interfaces inside the container.
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN mkdir -p /data/storage && chown -R node:node /data
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ---- worker: engines + job processor ----
FROM node:22-bookworm-slim AS worker
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    ocrmypdf \
    tesseract-ocr-eng \
    tesseract-ocr-deu \
    tesseract-ocr-fra \
    tesseract-ocr-spa \
    tesseract-ocr-hin \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-draw \
    fonts-liberation \
    fonts-dejavu \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOME=/tmp
RUN mkdir -p /data/storage && chown -R node:node /data
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node src ./src
USER node
CMD ["npx", "tsx", "src/worker/index.ts"]
