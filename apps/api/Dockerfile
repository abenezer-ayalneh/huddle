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
ENV NODE_ENV=production
# Copy the WHOLE workspace, not just apps/api/node_modules. pnpm uses a symlinked
# node_modules: apps/api/node_modules/<pkg> points into the root
# /repo/node_modules/.pnpm store. Copying only apps/api/node_modules leaves those
# symlinks dangling ("Cannot find module '@nestjs/common'"). Copying /repo
# preserves the root store, the symlinks, and the generated Prisma client.
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
