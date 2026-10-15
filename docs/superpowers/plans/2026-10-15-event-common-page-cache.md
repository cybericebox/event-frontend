# Event Common Page Cache Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the isolated backend implementation and task review; primary implements frontend integration. Steps use checkbox tracking.

**Goal:** Cache published shared event pages while bounding read-session trust and refreshing publication without per-visitor heavy API work.
**Architecture:** A purpose-scoped read grant authenticates event SSR. A hard-TTL lightweight manifest gates a revision-keyed page bundle cache. Existing personal routes remain CSR and existing API/session clients stay compatible.
**Tech Stack:** Go 1.26/Gin/pgx; Next 16.3.6/React 19/TypeScript; Ed25519/WebCrypto; Vitest/Go tests.
**Spec:** docs/superpowers/specs/2026-10-15-event-common-page-cache.md

## Global Constraints

- Only daemon and event-frontend application changes; no shared root session cookie, no static frontend backend, no deployment.
- Grant max 60 seconds; manifest hard TTL max 1000ms; page bundle max 256 entries/64MiB/5 minutes.
- All frontend strings UK+EN i18n; existing crest/event loader and error/empty states.
- Tasks, results, team and restricted custom-page payloads stay out of shared SSR cache.
- Commit locally only. Owner's previous-branch merge/worktree cleanup is already verified separately.

## Review Focus

- Warm old success followed by 404 must stop disclosing content rather than retain stale data.
- Cross-tenant or cross-browser challenge/grant swap must never install an authorized event cookie.
- Concurrent publication during bundle load must not store old content under a new revision.
- API outage or expired grant must not extend private authorization indefinitely.
- Staff preview must never leak draft content or variables into anonymous common cache.

### Task 1: Backend grants, lightweight revision manifest, common projection and media guard

**Files:** daemon/internal/eventrender/{grant.go,grant_test.go}; internal/delivery/controller/http/handler/eventself/render.go; handler/auth render key route or equivalent handler wiring; internal/useCase/event/render.go; corresponding tests; existing HTTP route/CORS registries and swagger. Preserve DDD ownership. New source may use narrower additional files if each has one responsibility.
**Interfaces:** Exact API/JWS definitions are in the spec. Frontend consumes all four endpoints unchanged.

- [x] Add failing crypto and HTTP tests before implementation. Core invariants:
```go
// Fixed clock and key fixture; valid grant succeeds, then
// changing audience, challenge, algorithm, expiry or event ID fails.
// Anonymous public manifest is allowed; hidden and nonexistent return 404.
// Warm revision r1 -> publication -> manifest r2; old revision request returns 409.
// Withdrawn logo/favicon/preview/content image reads return not-found for strangers.
```
- [x] Run focused tests and record expected red failures.
- [x] Implement purpose-separated stable signer, exact typed render HTTP contract, current access check, revision and shared published-only projection. Ensure manifest does not compute statistics, grant is not accepted by unrelated endpoints, errors are not cacheable, and media guards match lifecycle withdrawal.
- [x] Run focused tests, make vet, make build, full make test; generate swagger if route annotations changed. Commit backend implementation and return contract/test report to primary.

### Task 2: Event server session and common page cache

**Files:** event-frontend/src/api/commonPage.ts; src/utils/server/commonPageCache.ts; src/utils/server/eventRenderGrant.ts; src/app/api/event-session/{challenge,route}.ts equivalent route directories; src/app/api/event-content/revision/route.ts; src/api/{publicEventInfo,eventContent,publicFetch}.ts; src/app/layout.tsx and common page routes; src/components/event/common/*; src/proxy.ts; corresponding tests.
**Consumes:** Task 1 HTTP contract. The cache and browser adapters can be tested with fixtures before backend completion.

- [x] Read installed Next fetch/cookie/route-handler/CSP docs. Add failing cache, session-validation, challenge/origin, and revision-refresh tests first.
```ts
// load({event:'a',revision:'1'}) twice -> one loader call;
// same common key with different user grants -> same bundle, access checked independently;
// advance manifest clock 1001ms and upstream404 -> no previous bundle returned;
// two page revisions -> distinct bundles;
// expired/cross-origin JWT -> cookie not installed;
// tasks/results/team routes -> common SSR loader never called.
```
- [x] Run targeted Vitest red tests, implement bounded TTL/singleflight cache and grant verifier using cached public key. Authorize before shared cache hit; never key bundle by credential. Cookies are local host-only HttpOnly Secure; API calls carry signed read grant only on new render endpoints.
- [x] Integrate root metadata/theme and common page reads with one React request cache. Private grant bootstrap creates challenge, obtains grant through existing API cookie, installs it and refreshes. Leave restricted custom pages and all personal page bodies on existing client path. Public cold entry does not wait for a login.
- [x] Add 2-second visible-tab publication polling against event-local manifest cache; refresh only when revision changes. Keep live counts separate.
- [x] Run focused tests and full npm test, lint, check:ds, typecheck, production build. Commit frontend implementation.

### Task 3: Integration verification and independent review

**Files:** temporary probe under /tmp; spec/plan evidence updates only.
- [x] Run real Next production-runtime probe with a local fixture API: cold published success; reused common data; change revision; 404 after prior success; TTL expired while API down; second tenant and staff isolation. Verify zero private markers in denied responses.
- [x] Verify guest and authorized common pages at 390px and desktop in browser with fixture accounts; no private mailbox/session inspection. Check theme initial HTML and ensure personal routes still use client path.
- [x] Request a fresh code/security review over both complete diffs, fix important findings through RED->GREEN and rerun affected/full checks.
- [x] Document remaining venue-only proposal in chat and give exact verification boundaries. Leave new feature on approved local branches unless owner explicitly asks to integrate/release it.

## Owner clarifications and frontend review fixes (2026-10-15)

- Anonymous normalized 404 manifests may be cached for at most 1000ms in the existing bounded cache/singleflight; all signed denials and API errors remain uncached. Warm guest denial must not block staff preview, and publication is observed after expiry.
- Reuse verified event read cookies on reload; pass only their expiry to the client and renew 15 seconds before expiration. A current API session and staff rights are required for every new issuance.
- The root coordinator follows the live pathname across retained layouts. Neutral common routes keep watching the manifest, and fresh readable server verdicts recover the neutral screen.
- Publication revisions select matching initial variables in the values query without remounting the shell; live counts continue their independent polling.

## Owner-requested capacity assessment (local measurements, not a production capacity claim)

Measured 2026-10-15 on Apple M2 Pro / Node 26.5.0 / Go darwin-arm64, concurrently with development checks:

| Check | Result | Boundary |
|---|---|---|
| Actual frontend full grant verifier, 10,000 valid checks | median 0.143ms/check | Includes parse/schema/key construction/signature; no HTTP, DB, TLS |
| Actual Go grant Issue, two 1s benchmarks | 0.044–0.052ms/token | Crypto/claims serialization only, not authenticated issuance HTTP path |
| Actual Go grant Verify, two 1s benchmarks | 0.075–0.081ms/token | No HTTP/session/DB |
| Real Next production revision route, public | 2,500/2,500 HTTP200; ~498req/s; p50 3.6ms, p95 14.3ms | 5s window, fixture API, local HTTP |
| Same route, signed staff audience | 2,500/2,500 HTTP200; ~500req/s; p50 5.4ms, p95 112.3ms | 5s window, fixture API, local HTTP; shared-machine tail latency |

Model, not measurement: renewing 60s grants 15s before expiry costs active visible common-page visitors /45 API renewals per second: five staff ~0.11/s, 300 future authenticated readers ~6.7/s, 1,000 ~22.2/s. Current ordinary public visitors request no grant. Revision polling is readers /2 event-local requests/s, paused in hidden tabs. Upstream successful and anonymous404 manifest reads coalesce separately by host/page/audience with max1s hard TTL, multiplied by active replicas/pages/audiences rather than visitors. Never cache API5xx/network failures.

The main risks for a future participant-wide hidden mode are synchronized login/renewal bursts, actual primary-session/tenant database work and pool pressure, and event-local HTTP/polling/SSR overhead. Signing cost is small in this local probe. A 5s fixture test does not establish sustained1,000-user production readiness: no full issuance endpoint with real primary sessions/database, production CPU/RAM/TLS/network, large real content, cold-start burst or long soak was measured. Keep participant-wide hidden mode disabled/unimplemented until that separate staging test. Fixed per-request TTL preserves the <=60s personal-right revocation window; increasing TTL would change that security tradeoff.

Evidence: /tmp/cib-hidden-event-local-crypto.json; /tmp/cib-hidden-event-go-crypto-benchmark.log; /tmp/cib-hidden-event-local-route-load.json. Parent real Next functional probe also checks cold/warm/revision/denial/outage/cross-host/expired-grant/challenge binding and client publication/withdrawal/recovery at390px/1366px.

## Final verification evidence

Final application commits: daemon `f77eb3ed`; event frontend `7d016fe`. Backend full vet/build/test and focused crypto, production middleware, SQL projection/revision/media and admission-race checks passed. Frontend full 276 files/1,989 tests, typecheck, design-system check and production build passed; lint has zero errors and 29 existing warnings. No deployment or production load claim.

Whole-branch review found public live-value cache reuse and staff freshness regressions plus a conditional neutral/outage overlay; one final fix wave addresses them. Values now share an independent bounded 30s cache behind fresh access gates, and neutral fallback remains recoverable. Final scoped re-review approved all three findings as addressed, with no new actionable regression; focused24/24 tests passed. Report: `/tmp/cib-common-page-final-rereview.md`.

Actual final Next production fixture probe: five sequential public values readers caused one values fill (plus one independently refreshed manifest); changed revision replaced values; warm withdrawal rejected values; staff counts changed after31s without a document revision; expired grants could not read warmed values. Prior cold/warm/revision/outage/cross-host/challenge checks also passed, including five warm document reads with zero API calls. Evidence: `/tmp/cib-event-common-postreview-build.log`, `/tmp/cib-final-full-tests.log`, `/tmp/cib-common-page-final-fix-report.md`, `/tmp/cib-common-page-final-review.md`, and `/var/folders/8p/yl0zgzlj5ssdmpskq22wxw540000gn/T/cib-event-common-probe-3nupiglg/results.json`. The first final probe counted a fresh manifest as an extra values fill; its counter was corrected to distinguish those two operations, without an application change.

Limits: local fixture/API and synthetic identities, no real primary-session/database end-to-end capacity test, TLS/replica test, long soak or production deployment. Cold no-read-cookie private first-paint timing remains a browser verification gap; valid-cookie private HTML and reload reuse, common-page recovery and390px/1366px layouts were verified. Future hidden-participant and VPN modes remain notes only.
