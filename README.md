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
| `NEXT_PUBLIC_DOMAIN` | yes | Platform apex domain; the other hosts derive from it. |
| `NEXT_PUBLIC_API_DOMAIN` | no | API host (bare host, no scheme). Defaults to `api.<domain>`. |
| `NEXT_PUBLIC_ID_DOMAIN` | no | ID app host. Defaults to `id.<domain>`. |
| `NEXT_PUBLIC_ADMIN_DOMAIN` | no | Admin app host. Defaults to `admin.<domain>`. |
| `NEXT_PUBLIC_EXERCISES_DOMAIN` | no | Exercises app host. Defaults to `exercises.<domain>`. |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | no | Google Analytics 4 measurement id. Analytics is off when unset. |
| `INTERNAL_API_ORIGIN` | no | API origin used for server-side requests; falls back to the public API origin. |

## i18n

All user-facing text lives in `messages/uk.json` and `messages/en.json` and is rendered through the translate function `t("key", { vars })`. Ukrainian is the default language. Every key must exist in both files.

## Deployment

Deployment and cluster configuration: see the infrastructure repository.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Copyright 2024-2026 CyberICEBox
