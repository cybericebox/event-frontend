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
| `NEXT_PUBLIC_MAIN_HOST` | yes | Platform landing host (bare host, no scheme). |
| `NEXT_PUBLIC_API_HOST` | yes | API host. |
| `NEXT_PUBLIC_ID_HOST` | yes | ID app host. |
| `NEXT_PUBLIC_ADMIN_HOST` | yes | Admin app host. |
| `NEXT_PUBLIC_EXERCISES_HOST` | yes | Exercises app host. |
| `NEXT_PUBLIC_EVENT_DOMAIN` | yes | Event sites are `<tag>.<domain>`. |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | yes | Parent domain of the theme/consent cookies (e.g. `example.com`); no implicit parent. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | yes | Support mailbox of the «Send feedback» `mailto:` link shown on every page (the subject carries the app and page path only). |
| `NEXT_PUBLIC_PARTNER_URL` | yes | Partner department link in the footer credit. |
| `NEXT_PUBLIC_PARTNER_SITE_URL` | yes | Partner institution link in the footer credit. |
| `NEXT_PUBLIC_WIREGUARD_INSTALL_URL` | yes | WireGuard install link in the VPN dialog. |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | no | Google Analytics 4 measurement id. Analytics is off when unset. |
| `INTERNAL_API_ORIGIN` | no | API origin used for server-side requests; falls back to the public API origin. |
| `DEV_ALLOWED_ORIGINS` | no | Dev only: comma list for Next `allowedDevOrigins`; default is derived from the hosts. Missing required keys fail the build and the container start. |

## Content-Security-Policy

`src/proxy.ts` sets a strict CSP on every page request with a fresh nonce per request (policy built in `src/utils/csp.ts`, tested in `csp.test.ts`). The nonce reaches the render through the `x-nonce` request header; Next stamps its own scripts, the layout stamps the theme boot script and the Google Analytics scripts. Pages are rendered per request, so nonces work.

- `script-src 'self' 'nonce-…'`: no `unsafe-inline`, no `strict-dynamic`. Google Analytics hosts are added only when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is set.
- `connect-src 'self'` plus the API origin from `NEXT_PUBLIC_API_HOST` (fetch and SSE). No other origin is contacted from the browser; sign-in is a redirect to the ID app.
- `img-src 'self' data: blob: https:`: organizer logos, banners and Markdown images come from any https host; QR codes and previews use data/blob.
- `style-src 'self' 'nonce-…'` with `style-src-attr 'unsafe-inline'` (React renders `style=""` attributes for theme variables and text alignment).
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `frame-src 'none'`.
- Development only: `unsafe-eval`, `ws:`/`wss:` for HMR and `unsafe-inline` styles.

Organizer Markdown is rendered by `react-markdown` without `rehype-raw`, so raw HTML is escaped and unsafe URL schemes are dropped. Notification HTML goes through DOMPurify. A new third-party host must be added through env in `csp.ts` and covered by a test. Check the browser console for CSP violations after adding any script, font or remote resource.

## i18n

All user-facing text lives in `messages/uk.json` and `messages/en.json` and is rendered through the translate function `t("key", { vars })`. Ukrainian is the default language. Every key must exist in both files.

## Deployment

Deployment and cluster configuration: see the infrastructure repository.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Copyright 2024-2026 CyberICEBox
