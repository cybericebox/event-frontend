# event-frontend

The event site of the Cyber&nbsp;ICE&nbsp;Box platform. Participants use it to join an event, solve tasks, follow the
scoreboard and connect to their lab. Event managers use its `/manage` area to set the event up and watch it run.

## Where it sits

| Question | Answer |
|---|---|
| Who uses it | Participants, team captains and event managers |
| Backend | The platform API at `api.<DOMAIN>`. Sign-in goes through the ID site (`id.<DOMAIN>`) |
| Build output | Standalone Node server (`output: "standalone"`). Unlike the other sites it is not a static export |
| Hosts | One subdomain per event: `<tag>.<DOMAIN>`. Pages render on request |
| Dev port | 3003 |

## What it does

Participant pages:

| Route | Page |
|---|---|
| `/` | Event landing page, built from the event's own blocks |
| `/p/<slug>`, `/faq` | Custom pages and the FAQ |
| `/join`, `/invite`, `/forms` | Join an event, accept an invitation, fill in registration forms |
| `/participation` | The participant's registration and status |
| `/challenges` | Tasks to solve and flag submission |
| `/team` | Team members and invitations |
| `/vpn` | VPN access to the lab |
| `/scoreboard`, `/live` | Standings and the live board |

Manager pages under `/manage`:

| Area | What you do there |
|---|---|
| Content | Landing blocks, pages, banners, broadcasts, appearance (logo and accent colour) |
| Event setup | Settings, schedule, registration, participation, scoring, results, challenge settings |
| Tasks and labs | Task selection and groups, labs, resources, private registries, test mode |
| People | Participants, teams, submissions, surveys |
| Messages | Email and in-app notification templates, mail settings and journal |
| Analytics | Progress, tasks, participants, stands, usage, integrity, communications, report |

Text is Ukrainian by default, with English available. Event names, page blocks and other content written by the
organizers are data and are not translated.

## Run it locally

Tools are pinned in `mise.toml`: `mise install` puts Node.js in place, `mise tasks` lists the commands. You need a running platform backend; the site derives its API host from the base
domain.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3003
```

An event is chosen by the host name, so open the site on `<tag>.<DOMAIN>`.

## Configure

`.env.example` is the template. `NEXT_PUBLIC_DOMAIN` is the only host input: the API, the ID site and the event hosts
derive from it. A missing required value fails the build or the container start; there are no fallbacks.
`npm run check:cfg` checks that every config placeholder survives the build. Optional installation values mean "no
value, not shown":

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_MAIN_SITE_URL` | no | `https://` URL of the main site. Set: the logo leads there. Empty: the logo leads to `/` of this site. |
| `NEXT_PUBLIC_COOKIES_URL` | no | `https://` URL of the Cookie Policy. Empty: no link in the cookie banner. |
| `NEXT_PUBLIC_SHOW_ICE_DEPARTMENT_SUPPORT` | no | `true` shows the department support line. Default `false`. |
| `NEXT_PUBLIC_LAB_DOMAINS` | no | Comma list of extra lab base domains (agents with another lab domain), for example `labs.other.example`. The page posts the lab grant form to `<device>-<code>.<lab domain>`, so the CSP `form-action` allows `https://*.labs.<DOMAIN>` and `https://*.<each entry>`. Entries that are not plain domain names are ignored. |

## Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (standalone server) |
| `npm start` | `next start -p 3003` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest; the time zone is pinned to Europe/Kyiv) |
| `npm run check:cfg` | Checks that config placeholders survive the build |
| `npm run check:ds` | Fails if a copied design-system file was edited by hand |
| `npm run sync:errors` | Adds new backend error codes to `messages/errors.*.json` (needs a `daemon` checkout at `../daemon`) |

## Rules for changes

- Every user-visible string goes through `messages/uk.json` and `messages/en.json` and `t("key", { vars })`. Add each
  key to both files.
- On event sites the event logo is the loader, and the event logo replaces the crest in busy buttons.
- Instant controls update the cache before the server answers, and a pending save never disables a control.

## Container

nginx sits in front of the Node server (`deploy/Dockerfile`, `deploy/entrypoint.sh`): plain HTTP on 8080, a health
listener on 8081 (`/healthz` only), and TLS on 8443 when `/tls/tls.crt` and `/tls/tls.key` are mounted. The nginx config
is in `deploy/nginx/`.

## Releases and contributing

Branches, pull requests and releases: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
