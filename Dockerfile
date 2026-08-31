# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Static HTML/JS assets (landing page, dashboard, widget, logo, knowledge)
COPY public/ ./public/

# Persist runtime configuration (config.json, secrets.json written to /app)
VOLUME ["/app"]

EXPOSE 8787

# Run as non-root for security
USER node

CMD ["node", "dist/server.js"]
