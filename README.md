# event-frontend

The event site of the Cyber ICE Box platform, for participants and for event managers. Unlike the other frontends it is server-rendered.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI, TanStack Query, Lexical editor, dnd-kit, ECharts. Tests: Vitest with Testing Library. Lint: ESLint 10.

## Prerequisites

Node.js 26 or newer (see `.nvmrc`).

## Commands

```bash
npm install
npm run dev      # dev server on http://localhost:3003
npm run build    # production build (standalone server output)
npm start        # next start -p 3003
npm run lint
npm run typecheck
npm test         # Vitest (time zone pinned to Europe/Kyiv)
```

## SSR, not a static export

The app builds with `output: "standalone"` and runs as a Node server (`next start` or the standalone `server.js`). Event sites are served on per-event subdomains of the platform domain, so pages are rendered on request.

## Configuration

Read at runtime by the server.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_DOMAIN` | yes, unless every host below is set | Base domain: a bare lower case host name (no scheme, port or path). Every host below that is not set is derived from it (`deploy/base-domain.sh` at container start, `next.config` in dev and local builds, the Pages workflow). |
| `NEXT_PUBLIC_MAIN_HOST` | no | Platform landing host (bare host, no scheme). Default: `<DOMAIN>`; a value that is set wins. |
| `NEXT_PUBLIC_API_HOST` | no | API host. Default: `api.<DOMAIN>`; a value that is set wins. |
| `NEXT_PUBLIC_ID_HOST` | no | ID app host. Default: `id.<DOMAIN>`; a value that is set wins. |
| `NEXT_PUBLIC_ADMIN_HOST` | no | Admin app host. Default: `admin.<DOMAIN>`; a value that is set wins. |
| `NEXT_PUBLIC_EXERCISES_HOST` | no | Exercises app host. Default: `exercises.<DOMAIN>`; a value that is set wins. |
| `NEXT_PUBLIC_EVENT_DOMAIN` | no | Event sites are `<tag>.<domain>`. Default: `<DOMAIN>`; a value that is set wins. |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | no | Parent domain of the theme/consent cookies (e.g. `example.com`). Default: `<DOMAIN>`; a value that is set wins. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | yes | Support mailbox of the «Send feedback» `mailto:` link shown on every page (the subject carries the app and page path only). |
| `NEXT_PUBLIC_PARTNER_ICE_NURE_URL` | yes | Partner department link in the footer credit. |
| `NEXT_PUBLIC_PARTNER_NURE_URL` | yes | Partner institution link in the footer credit. |
| `NEXT_PUBLIC_WIREGUARD_INSTALL_URL` | yes | WireGuard install link in the VPN dialog. |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | no | Google Analytics 4 measurement id. Analytics is off when unset. |
| `INTERNAL_API_ORIGIN` | no | API origin used for server-side requests; falls back to the public API origin. |
| `DEV_ALLOWED_ORIGINS` | no | Dev only: comma list for Next `allowedDevOrigins`; default is derived from the hosts. Missing required keys fail the build and the container start. |

## Container listeners and TLS

The image runs tini, nginx and Next.js. nginx is the only listener; Next.js is internal on `127.0.0.1:3001`. The nginx config is in `deploy/nginx/` (`nginx.conf`, `server.conf` with the proxy to Next, and the snippets `listen-http.conf`, `listen-https.conf`, `client-auth.conf`, `health.conf`). `entrypoint.sh` only picks the active snippets from the env (an inactive one becomes an empty file) and fills the values with `envsubst` over a fixed variable list into `/tmp/nginx`, then runs `nginx -t`, so a bad combination fails the start. Plain HTTP on port 3000 with no TLS is the default.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HTTP_PORT` | `3000` | Plain HTTP listener. Empty = off. |
| `HTTPS_PORT` | `8443` | TLS listener, on only when the certificate and key are set. |
| `TLS_CERT_FILE`, `TLS_KEY_FILE` | empty | PEM server certificate chain and key. Both set = TLS on; exactly one = start error. |
| `TLS_MIN_VERSION` | `1.2` | `1.2` or `1.3`. |
| `TLS_CLIENT_CA_FILE` | empty | PEM bundle of the CAs that signed the client certificates. |
| `TLS_CLIENT_AUTH` | `off` | `off`, `optional` (verify if presented; a presented invalid certificate is refused) or `require`. `optional` and `require` need TLS and the CA file, else start error. |
| `HEALTH_PORT` | empty | If set, an extra plain listener that serves only `/api/health` (kubelet probes), bound to `HEALTH_BIND` (default `0.0.0.0`). If empty, probes use `HTTP_PORT`. |
| `TLS_RELOAD_INTERVAL` | `60` | Seconds between checks of the cert, key and CA files; a change runs `nginx -t` and then reloads nginx (a config that does not load keeps the old one). `0` = off. Polling, not inotify, because Kubernetes swaps Secret mounts by symlink. |

With both `HTTP_PORT` empty and no certificate there is nothing to listen on: start error. With client auth on, nginx passes the verification result to Next in `X-SSL-Client-Verify` (`SUCCESS`, `FAILED:<reason>`, `NONE`); a missing or invalid certificate closes the connection (444). Tests: `tests/docker/nginx.sh` (needs docker; runs in CI).

## Content-Security-Policy

`src/proxy.ts` sets a strict CSP on every page request with a fresh nonce per request (policy built in `src/utils/csp.ts`, tested in `csp.test.ts`). The nonce reaches the render through the `x-nonce` request header; Next stamps its own scripts, the layout stamps the theme boot script and the Google Analytics scripts. Pages are rendered per request, so nonces work.

- `script-src 'self' 'nonce-…'`: no `unsafe-inline`, no `strict-dynamic`. Google Analytics hosts are added only when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is set.
- `connect-src 'self'` plus the API origin from `NEXT_PUBLIC_API_HOST` (fetch and SSE). No other origin is contacted from the browser; sign-in is a redirect to the ID app.
- `img-src 'self' data: blob: https:`: organizer logos, banners and Markdown images come from any https host; QR codes and previews use data/blob.
- `style-src 'self' 'nonce-…'` with `style-src-attr 'unsafe-inline'` (React renders `style=""` attributes for theme variables and text alignment).
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `frame-src 'none'`.
- Development only: `unsafe-eval`, `ws:`/`wss:` for HMR and `unsafe-inline` styles.

Notification HTML goes through DOMPurify. A new third-party host must be added through env in `csp.ts` and covered by a test. Check the browser console for CSP violations after adding any script, font or remote resource.

## i18n

All user-facing text lives in `messages/uk.json` and `messages/en.json` and is rendered through the translate function `t("key", { vars })`. Ukrainian is the default language. Every key must exist in both files.

## Deployment

Deployment and cluster configuration: see the infrastructure repository.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Copyright 2024-2026 CyberICEBox

### One base domain

`deploy/base-domain.sh` (sourced by the container entrypoint) and the host block of `next.config` implement one rule: `NEXT_PUBLIC_DOMAIN` is a bare lower case host name and every host that is empty or unset becomes `MAIN_HOST=DOMAIN`, `API_HOST=api.DOMAIN`, `ID_HOST=id.DOMAIN`, `ADMIN_HOST=admin.DOMAIN`, `EXERCISES_HOST=exercises.DOMAIN`, `EVENT_DOMAIN=DOMAIN`, `COOKIE_DOMAIN=DOMAIN`; a value that is set always wins; neither `DOMAIN` nor an explicit host is a start error. `tests/base-domain-vectors.json` holds the shared test vectors that `tests/base-domain.test.ts` runs against both; `deploy/base-domain.sh` and the vector file are copies kept identical in every frontend repository (the daemon and infrastructure have the same rule and the same vector file).
