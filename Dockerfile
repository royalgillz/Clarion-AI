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
# The node base image already ships a "node" user at UID 1000, which is the user
# Hugging Face Spaces run containers as. Reuse it instead of creating one.
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
      graphicsmagick ghostscript ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN chown node:node /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7860 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/node
# Standalone output: server.js + traced node_modules, plus static assets and public/.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 7860
CMD ["node", "server.js"]
