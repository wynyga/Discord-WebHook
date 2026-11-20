# syntax=docker/dockerfile:1

# --- Build: compile TypeScript with dev dependencies ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Runtime: production dependencies, compiled code and migrations only ---
FROM node:24-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Applied at boot; resolved from dist/infrastructure/database as ../../../drizzle.
COPY drizzle ./drizzle

USER node
EXPOSE 3000
# SIGTERM reaches node directly (exec form), so graceful shutdown runs on `docker compose down`.
CMD ["node", "dist/server.js"]
