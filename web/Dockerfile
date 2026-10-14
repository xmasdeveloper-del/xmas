# NARAN storefront — Next.js 14 (standalone). Build context = this web/ directory.
#
# NEXT_PUBLIC_* values are inlined at BUILD time, so they must be passed as build
# args (Dokploy: set them in the app's Build Args). API_URL is ALSO build-time:
# next.config's rewrite destination for /api/* is baked into the routes manifest
# during `next build`, not read at runtime. When it was only a runtime env it
# baked the "http://localhost:4000" fallback, so in production the storefront
# proxied every /api/* call to its own container and got ECONNREFUSED — the
# payment API was unreachable through the site. It defaults to the compose
# service name so a normal build is correct without extra args.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public, build-time config (baked into the client bundle).
ARG NEXT_PUBLIC_MEDUSA_URL
ARG NEXT_PUBLIC_MEDUSA_PK
ARG NEXT_PUBLIC_MEDUSA_REGION
ARG NEXT_PUBLIC_USE_MEDUSA=1
ARG NEXT_PUBLIC_MEILISEARCH=1
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_SENTRY_DSN
# Internal URL of the Express payment API, baked into the /api/* rewrite.
ARG API_URL=http://api:4000
ENV API_URL=$API_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_MEDUSA_URL=$NEXT_PUBLIC_MEDUSA_URL \
    NEXT_PUBLIC_MEDUSA_PK=$NEXT_PUBLIC_MEDUSA_PK \
    NEXT_PUBLIC_MEDUSA_REGION=$NEXT_PUBLIC_MEDUSA_REGION \
    NEXT_PUBLIC_USE_MEDUSA=$NEXT_PUBLIC_USE_MEDUSA \
    NEXT_PUBLIC_MEILISEARCH=$NEXT_PUBLIC_MEILISEARCH \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# HOSTNAME matters: Next.js standalone binds to process.env.HOSTNAME, and Docker
# sets that to the container id. Next then listens on that one interface only —
# not on localhost, so the healthcheck can never pass, and not on the other
# networks the container is attached to, so only whichever network resolved the
# id can reach it. Bind everything instead.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Standalone server + the assets it does not bundle (static + public).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
