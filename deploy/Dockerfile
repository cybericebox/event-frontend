# The standalone runtime is JavaScript (sharp is excluded in next.config.mjs).
# Install and compile natively: emulated ARM64 npm can crash QEMU and hang.
FROM --platform=$BUILDPLATFORM mirror.gcr.io/library/node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS base

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
# Optional, defaulted by entrypoint.sh: NEXT_PUBLIC_GOOGLE_ANALYTICS_ID, NEXT_PUBLIC_SHOW_INTEGRITY, NEXT_PUBLIC_WIREGUARD_INSTALL_URL and the installation settings
# NEXT_PUBLIC_MAIN_SITE_URL, NEXT_PUBLIC_COOKIES_URL, NEXT_PUBLIC_SHOW_ICE_DEPARTMENT_SUPPORT (empty or unset = not shown).
ENV NEXT_PUBLIC_DOMAIN="__NEXT_PUBLIC_DOMAIN__"
ENV NEXT_PUBLIC_SUPPORT_EMAIL="__NEXT_PUBLIC_SUPPORT_EMAIL__"
ENV NEXT_PUBLIC_SHOW_INTEGRITY="__NEXT_PUBLIC_SHOW_INTEGRITY__"
ENV NEXT_PUBLIC_WIREGUARD_INSTALL_URL="__NEXT_PUBLIC_WIREGUARD_INSTALL_URL__"
ENV NEXT_PUBLIC_GOOGLE_ANALYTICS_ID="__NEXT_PUBLIC_GOOGLE_ANALYTICS_ID__"
ENV NEXT_PUBLIC_MAIN_SITE_URL="__NEXT_PUBLIC_MAIN_SITE_URL__"
ENV NEXT_PUBLIC_COOKIES_URL="__NEXT_PUBLIC_COOKIES_URL__"
ENV NEXT_PUBLIC_SHOW_ICE_DEPARTMENT_SUPPORT="__NEXT_PUBLIC_SHOW_ICE_DEPARTMENT_SUPPORT__"

RUN npm run build \
    && if find -L .next/standalone -name '*.node' -print -quit | grep -q .; then \
         echo 'Native addons require target-platform dependency installation; refusing a cross-platform runtime.' >&2; \
         exit 1; \
       fi

# The runtime binary must still match the requested output architecture.
FROM mirror.gcr.io/library/node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS target-node

# The node binary of the base image, without its symbol table and DWARF (about 22 MB); the runtime needs neither.
FROM mirror.gcr.io/library/alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS node-bin
# libatomic: the amd64 node binary links it since node 26.13.
RUN apk add --no-cache binutils libatomic
COPY --from=target-node /usr/local/bin/node /node
RUN strip --strip-all /node && /node -e "process.exit(0)"

# Production image, copy all the files and run next. It is plain alpine plus the node binary of the base image:
# the base image's npm, corepack and yarn are not needed to run server.js. The alpine digest is the one the
# laboratory Dockerfile pins.
FROM mirror.gcr.io/library/alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS runner
RUN apk add --no-cache libstdc++ libatomic nginx tini gettext-envsubst
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
# The rule for the optional installation settings (URLs and the flag), sourced by entrypoint.sh.
COPY deploy/cfg-check.sh /usr/local/lib/cfg-check.sh
COPY deploy/nginx /etc/cybericebox/nginx

USER nextjs

# nginx listens on HTTP_PORT (default 8080, plain) and, when /tls/tls.crt and /tls/tls.key exist (or TLS_CERT_FILE and
# TLS_KEY_FILE are set), on HTTPS_PORT (default 8443), requiring client certificates when /aop/ca.crt exists;
# HEALTH_PORT (default 8081) is a plain health-only listener. Next.js itself is internal on 127.0.0.1:3001
# (entrypoint.sh sets PORT and HOSTNAME for it). tini is PID 1. The variables are documented in README.md.
EXPOSE 8080 8443 8081

ENV PORT=3001
ENV HOSTNAME="localhost"

ENTRYPOINT [ "/sbin/tini", "--", "entrypoint.sh" ]
