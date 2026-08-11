# syntax=docker/dockerfile:1
# Production image for the Next.js frontend (standalone output). Build from the
# REPO ROOT so the pnpm workspace manifests are in context:
#   docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml build web
#
# NEXT_PUBLIC_* are baked at BUILD time (they ship in the browser bundle), so
# they're passed as build args, not runtime env. Set them in .env.prod (the
# prod compose forwards them as args).
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @huddle/web... --frozen-lockfile
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_OPERATOR_NAME
ARG NEXT_PUBLIC_OPERATOR_CONTACT_URL
ARG NEXT_PUBLIC_PROJECT_REPOSITORY_URL
ARG NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL
ARG NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL
ARG NEXT_PUBLIC_CONTROL_AGENT_ISSUES_URL
ARG NEXT_PUBLIC_CONTROL_AGENT_UPDATE_PUBLIC_KEY
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT_WEB
ARG SENTRY_RELEASE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_OPERATOR_NAME=$NEXT_PUBLIC_OPERATOR_NAME \
    NEXT_PUBLIC_OPERATOR_CONTACT_URL=$NEXT_PUBLIC_OPERATOR_CONTACT_URL \
    NEXT_PUBLIC_PROJECT_REPOSITORY_URL=$NEXT_PUBLIC_PROJECT_REPOSITORY_URL \
    NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL=$NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL \
    NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL=$NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL \
    NEXT_PUBLIC_CONTROL_AGENT_ISSUES_URL=$NEXT_PUBLIC_CONTROL_AGENT_ISSUES_URL \
    NEXT_PUBLIC_CONTROL_AGENT_UPDATE_PUBLIC_KEY=$NEXT_PUBLIC_CONTROL_AGENT_UPDATE_PUBLIC_KEY \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT_WEB=$SENTRY_PROJECT_WEB \
    SENTRY_RELEASE=$SENTRY_RELEASE
# The optional Sentry token is exposed only to this build instruction. BuildKit
# never stores it in an image layer or runtime environment.
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN,required=false \
    pnpm --filter @huddle/web build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Next standalone in a monorepo emits the server under apps/web/, with a shared
# node_modules at the bundle root. Static assets and public/ are copied beside it.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
