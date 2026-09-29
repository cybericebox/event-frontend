# event-frontend

The event sites of Cyber ICE Box, served on `<tag>.<domain>` for each event. A Next.js standalone server renders the event landing, the participant area, the live screen and the manager area.

## Environment variables

The Docker image reads these at container start.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_DOMAIN` | yes | — | Platform apex domain, e.g. `cybericebox.com`; event sites are `<tag>.<domain>`. |
| `NEXT_PUBLIC_API_DOMAIN` | no | `api.<domain>` | API host (bare host, no scheme). |
| `NEXT_PUBLIC_ID_DOMAIN` | no | `id.<domain>` | ID app host. |
| `NEXT_PUBLIC_EXERCISES_DOMAIN` | no | `exercises.<domain>` | Exercises app host. |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | no | analytics off | Google Analytics 4 measurement id (`G-…`). |
| `INTERNAL_API_ORIGIN` | no | public API origin | In-cluster API origin for server-side requests. |

## Commands

```bash
npm install
npm run dev          # http://localhost:3003
npm run build
npm run lint
npx vitest run

docker build -f deploy/Dockerfile -t cybericebox/event-frontend .
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_DOMAIN=cybericebox.local cybericebox/event-frontend
```

## Deployment

- **Docker images** — a push to `develop` builds `cybericebox/event-frontend:<commit sha>` (`develop-image.yml`); a published release builds `:latest` and `:<release tag>` (`publish-image.yml`).
- **Kubernetes** — manifests are in `deploy/manifests`. Put the values in `config.yaml`; an empty key uses the default.
