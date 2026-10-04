FROM node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Placeholders substituted at container start by entrypoint.sh. Each value is the variable name wrapped in double
# underscores: the bare name also appears as an object key in the compiled server code, and only the value may be replaced.
# Required at start: NEXT_PUBLIC_DOMAIN (the only host input, every host derives from it) and NEXT_PUBLIC_SUPPORT_EMAIL.
# Optional, defaulted by entrypoint.sh: NEXT_PUBLIC_GOOGLE_ANALYTICS_ID, NEXT_PUBLIC_SHOW_PARTNERS, NEXT_PUBLIC_WIREGUARD_INSTALL_URL.
ENV NEXT_PUBLIC_DOMAIN="__NEXT_PUBLIC_DOMAIN__"
ENV NEXT_PUBLIC_SUPPORT_EMAIL="__NEXT_PUBLIC_SUPPORT_EMAIL__"
ENV NEXT_PUBLIC_SHOW_PARTNERS="__NEXT_PUBLIC_SHOW_PARTNERS__"
ENV NEXT_PUBLIC_WIREGUARD_INSTALL_URL="__NEXT_PUBLIC_WIREGUARD_INSTALL_URL__"
ENV NEXT_PUBLIC_GOOGLE_ANALYTICS_ID="__NEXT_PUBLIC_GOOGLE_ANALYTICS_ID__"

RUN npm run build

# The node binary of the base image, without its symbol table and DWARF (about 22 MB); the runtime needs neither.
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS node-bin
RUN apk add --no-cache binutils
COPY --from=base /usr/local/bin/node /node
RUN strip --strip-all /node && /node -e "process.exit(0)"

# Production image, copy all the files and run next. It is plain alpine plus the node binary of the base image:
# the base image's npm, corepack and yarn are not needed to run server.js. The alpine digest is the one the
# laboratory Dockerfile pins.
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS runner
RUN apk add --no-cache libstdc++ nginx tini gettext-envsubst
COPY --from=node-bin /node /usr/local/bin/node
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir .next \
    && chown nextjs:nodejs .next

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs --chmod=0755 deploy/entrypoint.sh /usr/bin/
# The base-domain derivation (the NEXT_PUBLIC_DOMAIN check), sourced by entrypoint.sh.
COPY deploy/base-domain.sh /usr/local/lib/base-domain.sh
COPY deploy/nginx /etc/cybericebox/nginx

USER nextjs

# nginx listens on HTTP_PORT (default 3000, plain) and, when /tls/tls.crt and /tls/tls.key exist (or TLS_CERT_FILE and
# TLS_KEY_FILE are set), on HTTPS_PORT (default 8443), requiring client certificates when /aop/ca.crt exists;
# HEALTH_PORT (default 8081) is a plain health-only listener. Next.js itself is internal on 127.0.0.1:3001
# (entrypoint.sh sets PORT and HOSTNAME for it). tini is PID 1. The variables are documented in README.md.
EXPOSE 3000 8443 8081

ENV PORT=3001
ENV HOSTNAME="127.0.0.1"

ENTRYPOINT [ "/sbin/tini", "--", "entrypoint.sh" ]
