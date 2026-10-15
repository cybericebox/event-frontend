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

- [ ] Add failing crypto and HTTP tests before implementation. Core invariants:
```go
// Fixed clock and key fixture; valid grant succeeds, then
// changing audience, challenge, algorithm, expiry or event ID fails.
// Anonymous public manifest is allowed; hidden and nonexistent return 404.
// Warm revision r1 -> publication -> manifest r2; old revision request returns 409.
// Withdrawn logo/favicon/preview/content image reads return not-found for strangers.
```
- [ ] Run focused tests and record expected red failures.
- [ ] Implement purpose-separated stable signer, exact typed render HTTP contract, current access check, revision and shared published-only projection. Ensure manifest does not compute statistics, grant is not accepted by unrelated endpoints, errors are not cacheable, and media guards match lifecycle withdrawal.
- [ ] Run focused tests, make vet, make build, full make test; generate swagger if route annotations changed. Commit backend implementation and return contract/test report to primary.

### Task 2: Event server session and common page cache

**Files:** event-frontend/src/api/commonPage.ts; src/utils/server/commonPageCache.ts; src/utils/server/eventRenderGrant.ts; src/app/api/event-session/{challenge,route}.ts equivalent route directories; src/app/api/event-content/revision/route.ts; src/api/{publicEventInfo,eventContent,publicFetch}.ts; src/app/layout.tsx and common page routes; src/components/event/common/*; src/proxy.ts; corresponding tests.
**Consumes:** Task 1 HTTP contract. The cache and browser adapters can be tested with fixtures before backend completion.

- [ ] Read installed Next fetch/cookie/route-handler/CSP docs. Add failing cache, session-validation, challenge/origin, and revision-refresh tests first.
```ts
// load({event:'a',revision:'1'}) twice -> one loader call;
// same common key with different user grants -> same bundle, access checked independently;
// advance manifest clock 1001ms and upstream404 -> no previous bundle returned;
// two page revisions -> distinct bundles;
// expired/cross-origin JWT -> cookie not installed;
// tasks/results/team routes -> common SSR loader never called.
```
- [ ] Run targeted Vitest red tests, implement bounded TTL/singleflight cache and grant verifier using cached public key. Authorize before shared cache hit; never key bundle by credential. Cookies are local host-only HttpOnly Secure; API calls carry signed read grant only on new render endpoints.
- [ ] Integrate root metadata/theme and common page reads with one React request cache. Private grant bootstrap creates challenge, obtains grant through existing API cookie, installs it and refreshes. Leave restricted custom pages and all personal page bodies on existing client path. Public cold entry does not wait for a login.
- [ ] Add 2-second visible-tab publication polling against event-local manifest cache; refresh only when revision changes. Keep live counts separate.
- [ ] Run focused tests and full npm test, lint, check:ds, typecheck, production build. Commit frontend implementation.

### Task 3: Integration verification and independent review

**Files:** temporary probe under /tmp; spec/plan evidence updates only.
- [ ] Run real Next production-runtime probe with a local fixture API: cold published success; reused common data; change revision; 404 after prior success; TTL expired while API down; second tenant and staff isolation. Verify zero private markers in denied responses.
- [ ] Verify guest and authorized common pages at 390px and desktop in browser with fixture accounts; no private mailbox/session inspection. Check theme initial HTML and ensure personal routes still use client path.
- [ ] Request a fresh code/security review over both complete diffs, fix important findings through RED->GREEN and rerun affected/full checks.
- [ ] Document remaining venue-only proposal in chat and give exact verification boundaries. Leave new feature on approved local branches unless owner explicitly asks to integrate/release it.
