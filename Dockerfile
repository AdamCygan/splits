# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Cała aplikacja Timeblame w jednym obrazie: strony (TanStack Start, SSR) + API (/api/v1)
# na Node 24. Migracje bazy wykonuje serwer przy starcie (katalog drizzle/).
# ---------------------------------------------------------------------------

# Wersja pnpm taka sama jak w package.json (packageManager).
ARG PNPM_VERSION=12.16.1

# --- 1. Zależności (cache'owane, dopóki nie zmieni się pnpm-lock.yaml)
FROM node:24-alpine AS deps
ARG PNPM_VERSION
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- 2. Build. Zmienne VITE_* trafiają do kodu przeglądarki w czasie budowania (są publiczne).
FROM node:24-alpine AS build
ARG PNPM_VERSION
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app
ARG VITE_APP_URL=http://localhost:3000
ARG VITE_POSTHOG_KEY=
ENV VITE_APP_URL=$VITE_APP_URL \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- 3. Runtime: wynik builda (.output ma własne node_modules) + migracje SQL
FROM node:24-alpine AS runtime
# Łatki bezpieczeństwa systemu z Alpine, nawet gdy obraz bazowy jest starszy niż ostatnie poprawki.
RUN apk upgrade --no-cache
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    MIGRATIONS_DIR=/app/drizzle
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["wget", "-qO-", "http://127.0.0.1:3000/api/v1/health"]
CMD ["node", ".output/server/index.mjs"]
