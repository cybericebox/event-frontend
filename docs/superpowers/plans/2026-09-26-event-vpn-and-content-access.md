# Event VPN and Content Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver early VPN access and enforce the agreed four-level field policy in event API responses and the page constructor, including actually resolvable variables in rendered pages.

**Architecture:** `UseVPN` is persisted on the event configuration and exposed only after approved participation or in management; mere login is insufficient. The API provisions the team's deterministic LabGroup and personal WireGuard client independently of Lab creation. A permanent test endpoint runs on the group's VPN server, while laboratory ACLs remain default deny. After the VPN path works, the API projects fields and variables by page audience and event policy; the page editor lists only values the matching renderer can actually resolve.

**Tech Stack:** Go API (`AP Backend`), PostgreSQL/sqlc, Laboratory Go operator and VPN image, Next.js 16/React/TanStack Query (`event-frontend`).

**Spec:** `/Volumes/Projects/My/CyberICEBox/docs/EVENT-SITE-SPEC.md`, sections 3, 4, 5 and 7. This is one execution plan: VPN first, then the complete access matrix and page-builder variables. Page versioning and the visual block catalog beyond the existing types remain later site-redesign work.

## Global Constraints

- The API session cookie stays on `api.<domain>`; authenticated browser requests use `credentials: "include"`.
- No exercise, laboratory, or event start is required to enable VPN or issue a config after approved participation and team membership. Normal registration remains unavailable before first publication.
- Public landing, signed-in applicant, approved participant and moderator configuration are separate server-side projections. `UseVPN` must not enter `public-info`, an applicant response or a public cache.
- The page-builder catalog follows the page audience. `viewer.*` variables require approved participation and user-specific browser rendering; solution aggregates follow scoreboard visibility. The field catalog and renderer must change in the same plan.
- Notification and email template duplication, variable catalogs, renaming and editors are deferred. Their existing per-signal variable contracts remain intact.
- Page version/history storage is a later site-redesign slice. This plan projects the currently visitor-visible persisted document; unsaved local editor changes never enter visitor responses. The future versioned read must use the published revision under the same projection rules.
- In team mode no config or VPN menu item is available before joining a team. Individual mode uses its internal one-person team.
- The VPN test endpoint is reachable through the tunnel before start; labs stay default deny until their own access rules open.
- The new event frontend uses its local `ds-v2` copy. Do not add Chakra to new UI.
- Preserve all pre-existing uncommitted changes in the three repositories. Before editing `AP Backend` or `laboratory`, follow the user-provided branch/worktree convention for each repository; the choice already made for `event-frontend` is its current `redesign/event-frontend` branch.

## Review Focus

1. Existing events with no new database value: default `UseVPN=false`, preserving no early VPN exposure.
2. Approved participant without a team: API denies config even if `UseVPN=true`; UI hides the route.
3. Disabled VPN after a config exists: API denies further issuance and revokes the existing route through the lifecycle reconciliation.
4. Group exists before labs: later lab deployment reuses the same group and leaves the test endpoint reachable.
5. Runtime closed: VPN test still works, while client-to-lab traffic remains denied.
6. A page editor offers a variable that the matching runtime cannot resolve: prevent this with one server-owned catalog and a render contract test.
7. A moderator previews a public page containing privileged data: reject the invalid binding and use the guest projection for public preview.

---

### Task 1: Persist explicit event VPN intent

**Files:** `AP Backend/internal/delivery/repository/postgres/migrations/0064_event_use_vpn.up.sql`, `.down.sql`; `internal/delivery/repository/postgres/queries/event_configs.sql`; generated `event_configs.sql.go` and `models.go`; `internal/delivery/repository/eventConfigRepo/repository.go`; `internal/model/eventConfig/config.go`; `internal/useCase/event/input.go`, `config.go`, `views.go`; `internal/delivery/controller/http/handler/event/dto.go`; affected model, use case, repository and handler tests.

**Interfaces:** Add `UseVPN bool` to `EventConfig`, `ConfigInput`, `UpdateConfigInput`, `EventConfigView`, management request and response. Do not repurpose `EventInfrastructurePlan.RequiresVPN`: it still describes exercise topology for infrastructure readiness.

- [ ] Add a failing model test: `NewEventConfig` has `UseVPN=false`; `Update(ConfigInput{UseVPN:true,...})` saves true; a subsequent update saves false.
- [ ] Add `ALTER TABLE event_configs ADD COLUMN use_vpn boolean NOT NULL DEFAULT false` and a down migration dropping only that column. Extend create and optimistic-lock update SQL; regenerate sqlc through the repository's existing generation command.
- [ ] Thread `UseVPN` through domain, repository, use case and management DTO. Keep `UseVPN` independently mutable; do not infer it from `RequiresVPN`.
- [ ] Test GET/PUT round trip, old-row default, and concurrent update behavior. Inspect migration SQL offline and run the affected Go packages.
- [ ] Commit only this task's files in `AP Backend` after reviewing the diff.

### Task 2: Keep public, applicant, participant and moderator projections separate

**Files:** `AP Backend/internal/useCase/event/views.go`; `internal/delivery/controller/http/handler/eventself/dto.go`; `internal/delivery/controller/http/handler/eventself/handler.go`; eventself handler tests; `event-frontend/src/types/publicEventInfo.ts`; new `src/types/participantEventInfo.ts`, `src/api/participantEventInfo.ts`; `src/components/event/AppShell.tsx`.

**Interfaces:** Add `UseVPN bool` to an approved-participant projection exposed through `GET /events/self/participant-info`, which checks approved participation. Do not add it to `/events/self/public-info` or the existing `/events/self/info` response usable by a signed-in applicant. `/events/:id/manage/config` has the full editable field. Existing `Infrastructure.RequiresVPN` remains distinct.

- [ ] Write handler tests with `UseVPN=true` and zero exercises: `public-info` and applicant `/events/self/info` omit `UseVPN`, lab plan and secrets; approved participant info includes `UseVPN:true`; management config includes the editable field. A signed-in but pending participant gets no approved projection.
- [ ] Add the field only to the approved-participant and management DTOs. Give the frontend approved-participant response its own Zod schema and browser fetch with `credentials: "include"`; retain `PublicEventInfoSchema` for server rendering and public cache. The endpoint must verify the caller's event participation, not just a global session.
- [ ] Make `AppShell` fetch participant info after authentication and use that protected response for participant-only navigation. Do not infer VPN intent from `Infrastructure.RequiresVPN`.
- [ ] Run affected Go handler tests and frontend type check. Inspect serialized anonymous responses for `UseVPN` absence.
- [ ] Commit task files in their owning repositories after reviewing each diff.

### Task 3: Issue a personal config before any lab exists

**Files:** `AP Backend/internal/useCase/event/lab_binding.go`; `internal/useCase/event/useCase.go`; `internal/model/labBinding/binding.go`; `internal/delivery/infrastructure/labagent/deploy.go`; `internal/useCase/event/participant_vpn_test.go`; `internal/delivery/infrastructure/labagent/deploy_test.go`.

**Interfaces:** Extend `Infrastructure` with `EnsureVPNGroup(ctx context.Context, group string) error`. Reuse `labBindingModel.Names(eventID, teamID, challengeID)`'s group component through a single exported group-name helper, rather than inventing a second naming rule. `GetOwnLabVPNConfig(ctx,eventID,userID)` remains the public use case signature.

- [ ] Add tests: enabled VPN plus approved team member with zero exercises calls `EnsureVPNGroup`, then `EnsureLabClient`, stores the config in event scope, and returns it; a repeat call returns the stored config without creating another client. Disabled VPN, pending member and approved member without a team are denied.
- [ ] Make `EnsureVPNGroup` idempotently create a LabGroup without a Lab; use the existing agent client and tolerate its AlreadyExists result. Ensure a group created here is reused when `DeployLab` later runs.
- [ ] Change config issuance to check persisted `UseVPN` and approved team membership, not `RequiresVPN`, attached lab binding or runtime-open. Preserve capability-form gates only where they truly apply to a VPN config; a form gate intended for lab entry must not prevent the agreed early VPN check.
- [ ] Run targeted use case and labagent tests and review the stored secret scope. Never send another member's config to the caller.
- [ ] Commit task files in `AP Backend`.

### Task 4: Keep the test tunnel alive and labs closed

**Files:** `laboratory/internal/vpn/server.go`, `cmd/vpn/main.go`, `internal/vpn/` test files; `AP Backend/internal/useCase/event/lab_access.go` and its tests; if required, `laboratory/internal/controller/laboratory/labgroup_controller.go` and its tests.

**Interfaces:** The VPN process binds a stable test HTTP endpoint to the group's WireGuard gateway IP and serves a short Ukrainian success page. The address is derived from the group's client subnet and returned to the frontend by a narrow event-self VPN status response; ping uses that gateway IP. No public network route to the endpoint is added.

- [ ] Test that the HTTP handler returns `200`, Ukrainian success text and no event data. Test that it listens on the WireGuard gateway address only; an unauthenticated public interface must not serve it.
- [ ] Start the endpoint after WireGuard assigns its gateway IP. Make its shutdown follow VPN process cleanup. Keep ICMP to the gateway available through the tunnel.
- [ ] Add a lifecycle test where a group has zero labs and runtime is closed: the group/VPN deployment stays running, ACL is empty, and the test endpoint remains reachable. After a lab appears, closed runtime still denies lab traffic. Reconcile group presence rather than skipping solely because there are no lab bindings.
- [ ] Test disabling `UseVPN`: stop or revoke the participant VPN path without leaving a previously issued config usable; preserve ordinary laboratory cleanup semantics.
- [ ] Run affected Laboratory and API package tests. Check the actual network policy/iptables path for both test endpoint allow and lab deny, not just handler output.
- [ ] Commit each repository's task files separately.

### Task 5: Add the management checkbox and participant route

**Files:** `event-frontend/src/api/manage.ts`; `src/app/manage/settings/page.tsx`; `src/components/event/ParticipantShell.tsx` or its replacement common navbar; `src/api/clientAuth.ts`; new `src/app/vpn/page.tsx` and focused VPN API/UI modules; affected CSS and tests.

**Interfaces:** Management GET/PUT carries `UseVPN`. The participant VPN route appears only when `participantInfo.UseVPN && approved && hasTeam`; in individual mode `hasTeam` becomes true after the automatic internal team is created. The route calls the existing event-self personal config endpoint with browser credentials. A status endpoint supplies the private test gateway address.

- [ ] Test that the settings checkbox can be enabled with zero exercises, persists after reload and is not tied to `Infrastructure.RequiresVPN`.
- [ ] Add a team-membership query rather than treating approved participation alone as sufficient. Test team mode with and without membership, individual mode after internal team creation, and disabled VPN.
- [ ] Place «Підключення VPN» in the avatar menu, with a post-join prompt and a link from «Моя команда» / «Моя участь». Use the agreed common navbar design; do not add a permanent top-level VPN tab or retain a competing participant sidebar.
- [ ] On `/vpn`, offer personal config download, «Перевірити VPN», test address and copyable `ping` command. Automatic check must reach the tunnel-only endpoint from the participant's browser; a public API health check is not sufficient. Show explicit states for no tunnel, pending group, denied access and API outage without exposing config in logs or local storage.
- [ ] Run frontend type check, lint and focused tests. Manually verify the route on desktop and narrow viewport after an approved team joins, before any exercise is attached.
- [ ] Commit only reviewed task files in `event-frontend`.

### Task 6: Audit and project the four event API views

**Files:** `AP Backend/internal/delivery/controller/http/handler/eventself/dto.go`, `handler.go` and handler tests; `internal/useCase/event/views.go`; `event-frontend/src/types/publicEventInfo.ts`, `src/types/participantEventInfo.ts`, `src/components/event/GuestShell.tsx`, `src/components/event/AppShell.tsx`.

**Interfaces:** The four server projections are guest, signed-in applicant, approved participant and event moderator. `public-info` has only identity, published branding, public timing/rules and derived navigation capability; applicant info adds only own application state; `participant-info` adds `UseVPN` and participant capabilities; management reads retain edit fields. Public and applicant DTOs never contain `Infrastructure` or `UseVPN`.

- [ ] Add response-shape tests for the same event in all four roles. Assert exact field presence/absence, including no `publishAt`, `withdrawAt`, `manualFinishAt`, raw visibility enums, infrastructure plan or `UseVPN` in guest/applicant JSON. Assert `UseVPN` is present only for approved participant and moderator.
- [ ] Replace public navigation's use of raw `ScoreboardVisibility`/`ParticipantsVisibility` with server-derived `CanViewResults` and `CanViewParticipants`. Derive from the saved policy and caller role; a hidden result is never exposed by a stale client setting.
- [ ] Remove operational fields from the applicant response and supply its own status/action projection. Check event-specific approved status in the participant endpoint and event-specific moderator permission in management endpoints.
- [ ] Update frontend Zod schemas and callers to match each exact response. Keep the public server-rendered response cacheable and make all personal reads browser-only with the API cookie.
- [ ] Run affected Go handler/use-case tests and frontend type check. Inspect the serialized envelopes, not just internal model structs.
- [ ] Commit the reviewed API and frontend files in their own repositories.

### Task 7: Resolve only permitted page variables

**Files:** `AP Backend/internal/model/eventContent/variables.go` (new catalog and audience types); `internal/useCase/event/content_variables.go`, `content.go`; `internal/delivery/controller/http/handler/eventself/handler.go`; `internal/useCase/event/content_variables_test.go` and eventself handler tests.

**Interfaces:** The server-owned catalog maps each `event.*` or `viewer.*` variable to format, minimum audience and policy gate. `ProjectContentVariables(ctx,eventID,userID,audience,document)` returns only variables referenced by the visitor-visible persisted document's bindings, text or visibility conditions and permitted to that exact audience. `viewer.*` values are calculated for the approved caller only. Notification signal variables remain separate.

- [ ] Write a failing table test for every variable in the approved spec matrix. Check guest, applicant, participant and moderator eligibility, plus hidden/private/public results for `event.solveCount`, `event.solvedChallengeCount` and `viewer.score`.
- [ ] Write a content test where the document references `event.name` but not `event.maxTeams`: only `event.name` is serialized. A public document referencing `event.publishAt` or `viewer.teamName` fails validation, including when referenced solely in a condition.
- [ ] Implement `event.availableChallengeCount` from the challenge set visible to the requested audience at the current phase. It must not count unopened exercises for a guest. Keep the full raw challenge count moderator-only.
- [ ] Implement approved-caller providers for `viewer.displayName`, `viewer.teamName`, `viewer.teamRole`, `viewer.score`, `viewer.solvedCount`, `viewer.hasTeam`, `viewer.canAccessVPN`; apply the event's nickname and scoreboard rules. Do not include another person's private values in the response.
- [ ] Make the landing and public page routes use guest projection; participant-only pages require approved membership and use a personal response with `Cache-Control: private, no-store`. Management preview receives definitions and safe sample `viewer.*` values, not another real participant's data.
- [ ] Run focused domain, use-case and HTTP tests. Assert anonymous content JSON omits `publishAt`, `withdrawAt`, `manualFinishAt`, raw counts and unused allowed variables.
- [ ] Commit only this task's API files.

### Task 8: Make page templates use the server variable contract

**Files:** `AP Backend/internal/delivery/controller/http/handler/event/handler.go` and DTO/tests for `GET /events/:id/manage/content/variables`; `event-frontend/src/components/event/content/variableCatalog.ts`; `src/components/event/manage/LandingBlockEditor.tsx`, `validateLanding.ts`; `src/app/manage/content/landing/page.tsx`; new `src/app/manage/content/pages/[slug]/page.tsx`; `src/components/event/content/ClientContentPage.tsx`; frontend API/types and focused tests.

**Interfaces:** The management variable-catalog response lists each supported name, format, label and allowed page audience. The editor filters that server catalog by the page's saved audience: landing is always guest, additional pages are guest/participant/moderator. A catalog entry must have a runtime provider from Task 7. Notification/email template catalogs and existing names are untouched.

- [ ] Test that the landing editor offers public variables only. A participant page offers public and participant variables; a moderator page adds manager variables. `event.publishAt` is rejected for a public page even if a moderator edits it.
- [ ] Fetch the catalog for the editor and use it for insertions, variable bindings and visibility conditions; remove the hard-coded public list as an authorization source. Validate on the server again at save/publish.
- [ ] Ensure the runtime supplies values for every offered field or shows an explicit unavailable value when the event setting is legitimately null. Preview uses the same audience projection; personalized preview uses labeled sample values unless an authorized own-user context exists.
- [ ] Render participant-only pages through credentialed client requests, with no shared/server cache. Keep public landing SSR and its permitted cache. Test 401, pending applicant, approved participant and moderator preview.
- [ ] Run frontend type check, focused editor/renderer tests and manual wide/narrow preview. Compare editor catalog with the backend provider list to catch missing values.
- [ ] Commit reviewed API/frontend files in their owning repositories.

### Task 9: Integrated verification

**Files:** Integration tests/fixtures in the owning repositories; update `/Volumes/Projects/My/CyberICEBox/docs/EVENT-SITE-SPEC.md` only if the approved contract changes.

- [ ] Start an event with `UseVPN=true`, zero exercises and a future start time. Approve a participant, create or join a team, issue a config, connect through it, ping the gateway and open its HTML page.
- [ ] Confirm a guest, a pending participant and an approved participant without a team cannot obtain a config. Confirm laboratory traffic is denied before its own access opens.
- [ ] Compare anonymous landing, signed-in applicant, approved participant info and management config JSON for the same event. Confirm guest and applicant see no VPN flag or private calendar, approved participant sees only needed capabilities, and moderator sees all editable fields.
- [ ] Publish a public page and a participant page using every field offered by their variable pickers. Confirm values resolve at runtime, the public response contains only referenced guest-safe variables, and personal values never appear in the public cache. Hide results and verify solution counts disappear from guest/participant projections.
- [ ] Confirm notification and email templates still validate and render with their existing per-signal names; no template copy or rename migration belongs to this plan.
- [ ] Attach a VPN lab later and confirm the group and personal config are reused. Check repeated config requests and service restarts.
- [ ] Toggle VPN off and verify the UI hides the route and the old config can no longer pass traffic. Toggle on only after deciding and implementing the reactivation policy for stored configs.
- [ ] Report exact commands, test results and any environment-dependent gate that could not be exercised; do not describe unit tests as full tunnel verification.
