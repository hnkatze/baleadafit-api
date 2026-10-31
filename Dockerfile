# syntax=docker/dockerfile:1

# Imagen de producción de BaleadaFit API.
# Railway construye con este Dockerfile (si hay Dockerfile, lo usa siempre) y
# arranca con el CMD de la última etapa. No se usa railway.json: Config as Code
# está deprecado y los servicios nuevos ya no pueden adoptarlo.

# ─── Dependencias ─────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# --ignore-scripts: el postinstall del proyecto corre `prisma generate`, pero en
# esta capa todavía no existe prisma/schema.prisma. Se genera explícitamente en
# la etapa de build.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── Build ────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ─── Runtime ──────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# openssl: lo necesita el motor de migraciones de Prisma. ca-certificates: TLS
# hacia Postgres, Firebase y Bedrock.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# node_modules completo (incluye el CLI de Prisma y dotenv, que usa
# prisma.config.ts) para poder migrar al arrancar.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma

ENV PORT=3000
EXPOSE 3000
USER node

# S4: si la migración falla, el contenedor no arranca y Railway marca el deploy
# como fallido en vez de servir tráfico con el esquema viejo.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
