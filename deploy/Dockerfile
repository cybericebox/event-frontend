FROM node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY ../package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY .. .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Placeholders substituted at container start by entrypoint.sh.
# Run with every key set (see .env.example); [-e NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=…] is optional.
ENV NEXT_PUBLIC_MAIN_HOST="NEXT_PUBLIC_MAIN_HOST"
ENV NEXT_PUBLIC_API_HOST="NEXT_PUBLIC_API_HOST"
ENV NEXT_PUBLIC_ID_HOST="NEXT_PUBLIC_ID_HOST"
ENV NEXT_PUBLIC_ADMIN_HOST="NEXT_PUBLIC_ADMIN_HOST"
ENV NEXT_PUBLIC_EXERCISES_HOST="NEXT_PUBLIC_EXERCISES_HOST"
ENV NEXT_PUBLIC_EVENT_DOMAIN="NEXT_PUBLIC_EVENT_DOMAIN"
ENV NEXT_PUBLIC_COOKIE_DOMAIN="NEXT_PUBLIC_COOKIE_DOMAIN"
ENV NEXT_PUBLIC_SUPPORT_EMAIL="NEXT_PUBLIC_SUPPORT_EMAIL"
ENV NEXT_PUBLIC_PARTNER_URL="NEXT_PUBLIC_PARTNER_URL"
ENV NEXT_PUBLIC_PARTNER_SITE_URL="NEXT_PUBLIC_PARTNER_SITE_URL"
ENV NEXT_PUBLIC_WIREGUARD_INSTALL_URL="NEXT_PUBLIC_WIREGUARD_INSTALL_URL"
ENV NEXT_PUBLIC_GOOGLE_ANALYTICS_ID="NEXT_PUBLIC_GOOGLE_ANALYTICS_ID"

# images.unoptimized is set in next.config.mjs, so the image optimizer never loads sharp: its native libvips
# (~45 MB, traced into standalone) is dead weight.
RUN npm run build && rm -rf .next/standalone/node_modules/sharp .next/standalone/node_modules/@img

# The node binary of the base image, without its symbol table and DWARF (about 22 MB); the runtime needs neither.
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS node-bin
RUN apk add --no-cache binutils
COPY --from=base /usr/local/bin/node /node
RUN strip --strip-all /node && /node -e "process.exit(0)"

# Production image, copy all the files and run next. It is plain alpine plus the node binary of the base image:
# the base image's npm, corepack and yarn are not needed to run server.js. The alpine digest is the one the
# laboratory Dockerfile pins.
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS runner
RUN apk add --no-cache libstdc++
COPY --from=node-bin /node /usr/local/bin/node
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs --chmod=0755 ../deploy/entrypoint.sh /usr/bin/

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT [ "entrypoint.sh" ]
