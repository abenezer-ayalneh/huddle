# Production image for the NestJS API. Build from the REPO ROOT so the pnpm
# workspace manifests are in context:
#   docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml build api
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
# Install deps for the api (and its workspace deps) using just the manifests
# first, so the layer caches when only source changes.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @huddle/api... --frozen-lockfile
COPY apps/api apps/api
# Generate the Prisma client, then compile to dist/.
RUN pnpm --filter @huddle/api exec prisma generate \
  && pnpm --filter @huddle/api build

FROM node:20-alpine AS run
WORKDIR /repo/apps/api
ENV NODE_ENV=production
# Carry over the compiled output, Prisma schema/migrations, and node_modules
# (which include the generated Prisma client). Migrations are applied separately
# at deploy time — see docs/SETUP.md.
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/api/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
