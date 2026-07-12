# ---- Builder: ставим все зависимости и компилируем TS -> dist ----
FROM node:20-alpine AS builder

WORKDIR /app

# Сначала манифесты — чтобы слой с npm ci кэшировался, пока они не менялись.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# tsc НЕ копирует .sql — переносим миграции вручную, иначе applySqlMigrations
# не найдёт их в dist/infrastructure/db/migrations на старте.
RUN mkdir -p dist/infrastructure/db/migrations \
    && cp src/infrastructure/db/migrations/*.sql dist/infrastructure/db/migrations/

# ---- Runtime: только прод-зависимости + собранный код ----
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=8000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Собранный JS (уже с .sql внутри) и CA-сертификат Aiven для TLS к БД.
COPY --from=builder /app/dist ./dist
COPY certs ./certs

# Не root.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 8000

CMD ["node", "dist/main.js"]
