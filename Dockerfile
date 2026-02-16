# Clarion AI - Hugging Face Docker Space
# Builds the Next.js standalone server and runs it on port 7860.

# ---- build ----
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Toolchain for native deps (sharp / tesseract prebuilds), plus OCR runtime libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      graphicsmagick ghostscript ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7860 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/user
# OCR fallback (pdf2pic) shells out to graphicsmagick + ghostscript.
RUN apt-get update && apt-get install -y --no-install-recommends \
      graphicsmagick ghostscript ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 user
# Standalone output: server.js + traced node_modules, plus static assets and public/.
COPY --from=builder --chown=1000:1000 /app/public ./public
COPY --from=builder --chown=1000:1000 /app/.next/standalone ./
COPY --from=builder --chown=1000:1000 /app/.next/static ./.next/static
USER 1000
EXPOSE 7860
CMD ["node", "server.js"]
