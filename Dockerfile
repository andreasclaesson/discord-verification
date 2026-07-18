# Build stage: compile TypeScript, including better-sqlite3's native addon
FROM node:20-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 needs to compile a native addon at install time.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# copy just the manifests first so `npm ci` is cached across rebuilds that
# only change source files, not dependencies.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/bot/package.json packages/bot/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci

COPY . .
RUN npm run build
# drop devDependencies (typescript, tsx, @types/*) now that dist/ exists.
RUN npm prune --omit=dev

# runtime stage: no compilers, just the compiled output + prod deps
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/bot/package.json packages/bot/package.json
COPY --from=build /app/packages/bot/dist packages/bot/dist
COPY --from=build /app/packages/web/package.json packages/web/package.json
COPY --from=build /app/packages/web/dist packages/web/dist

# the actual command (bot vs web) is set per-service in docker-compose.yml.
CMD ["node", "packages/web/dist/index.js"]