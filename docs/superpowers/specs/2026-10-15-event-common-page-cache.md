# Event common-page cache and scoped render sessions

Approved in chat 2026-10-15. Scope is daemon plus event-frontend only. Static ID/admin/catalog/main applications retain their existing architecture. The owner chose feat/event-common-page-cache in both current directories. No release or deployment of this new feature is authorized yet.

## Behavior

Only the published landing and published custom pages with PUBLIC audience use the shared server cache. Participant/manager-only custom pages, tasks, scoreboard, team, forms and management remain browser-rendered. A staff preview of an unpublished event may read the PUBLISHED landing/public custom document; drafts never enter this cache. Public pages need no event registration. Hidden/withdrawn/missing events without permission expose the same neutral behavior.

The shared cache stores the complete published page bundle (document, common values, branding), separate from request-specific nonce/account chrome. No global Next Full Route Cache, no caching of personal HTML, no nonce replay. General CSS ships normally. Authorized private common pages receive event colors from the server before content is shown.

## Access and API contract

Owner clarification: grants are for nonpublic access/staff preview only; public pages use no grant. Anonymous and authenticated unauthorized readers receive the same neutral screen, with sign-in offered when needed.

Session cookies on API remain host-only. Event obtains a distinct 60-second signed read grant through a browser credentialed API request and installs it as an HttpOnly Secure host-only cookie. Grant is only for common-page rendering, never task submission or mutations. It may retain withdrawn user rights for at most its remaining lifetime; event publication/withdrawal is checked independently through the manifest. Cookie issuance is bound to a challenge created on the event server, exact same-origin JSON POST, and verified token audience. No primary API cookie, signing key, refresh credential or generic bearer token is distributed to the browser/event server.

New endpoints, all ordinary API envelopes with PascalCase Data:

- GET /api/auth/event-render-key -> {KeyID: string, PublicKey: string}; public Ed25519 key as base64url raw 32 bytes. Stable across API replicas. Signing key must be purpose-separated from existing shared session encryption material, not random per replica, and never exposed. No deployment secret change is necessary.
- POST /api/events/self/render-grant, existing authenticated permission gate plus tenant resolver. JSON {Challenge: string}; challenge is 43-character base64url SHA-256 digest. -> {Token: string, ExpiresAt: number}, Unix seconds. Issue only to authorized staff for nonpublic previews. Public common pages remain anonymous and do not request grants. An authenticated account without explicit event permissions receives no grant. Before login, no identity-based entitlement is inferred. Denied/unknown is neutral 404.
- GET /api/events/self/render-manifest?page=<slug>, omitted/empty page = landing. Optional Authorization: EventRender <grant>. -> {Event: PublicEventInfo, Revision: string, Audience: 'public'|'staff', Page: {Slug: string, Title: string}, CacheUntil: number}. CacheUntil is Unix milliseconds, no later than the next scheduled publish/withdraw/archive transition, otherwise now+1000ms. Identity, allowed-public page visibility and publication state are checked before response; no live statistics. Participant/manager-only custom pages return 404 so the existing client path takes over.
- GET /api/events/self/render-page?page=<slug>&revision=<revision>, same grant/policy checks. -> {Revision: string, Event: PublicEventInfo, Page: {Slug: string, Title: string, Document: ContentDocument}, Variables: Record<string, string|number|boolean|null>}. Return neutral 404 if missing/denied, 409 on revision mismatch. Return only published document and PUBLIC variable projection, including staff preview. No drafts, operational/private counters or per-user state.

Grant compact JWS header: {alg:'EdDSA',kid:KeyID,typ:'cib-event-render+jwt'}.
Payload: {iss:'cybericebox:event-render',aud:<canonical https event origin>,sub:<user UUID>,sid:<API session UUID>,event_id:<event UUID>,scope:'common-pages',preview:boolean,challenge:<digest>,iat:<Unix seconds>,exp:<Unix seconds>}. Reject wrong algorithm/type/issuer/audience/event, future issue time, invalid UUIDs, malformed/oversized payload, lifetime above 60s or expiration. An unknown key ID may trigger one coalesced public-key refresh, globally throttled to one attempt per 5 seconds (including failed attempts). Inspect only a bounded purpose-specific header before this retry; authorization still requires full signature and claims verification. Authenticator/source remains API, with central account switching and logout bounded by grant expiration. Existing account/session actions stay untouched; event session synchronization must clear/replace a grant when a renewal observes browser identity changes. A verified read cookie is reused across reloads without API reissuance until renewal is due (15 seconds before expiry); its nonidentity expiry may be passed to the client coordinator. A first private visit performs challenge/grant/install. New issuance always checks the current API session and staff rights.

## Cache and publication freshness

Manifest is a hard TTL maximum 1000ms, per canonical host/audience; no stale-while-revalidate for authorization or visibility. Fail closed after expiration if API cannot answer. A shared singleflight prevents visitor bursts from multiplying calls. Page bundle key includes event ID, slug, revision, audience and renderer build; no user cookie/token in this common key. The signed grant's user identity is not part of the bundle or rendered props. Revision includes event lifecycle/branding/config/content/page changes; drafts may invalidate extra, but no successful publication may retain the prior revision. Bundle 5-minute cap, maximum 256 entries, maximum total serialized bytes 64MiB; bounded key and inflight maps. Never cache errors or signed-reader denied responses. Owner clarification (2026-10-15): only normalized anonymous 404 manifests may share a bounded hard TTL of at most 1000ms, using the same bounded map/bytes/singleflight limits. Hidden and missing events share this neutral result. Signed contexts bypass that anonymous partition; 401/403/5xx/network failures are never negative-cached.

A new request observes publication within one second plus network time on every replica. Existing open common pages poll the event server every 2 seconds for a revision; that endpoint shares the manifest cache, so it does not cause one backend lookup per visitor. On new revision router.refresh preserves the surrounding app state. Page closure refreshes to the neutral screen. Pause polling while hidden. Dynamic countdowns/counts retain existing behavior and are not frozen forever in document cache. Stat-count refresh is distinct from document publication.

## Known regressions to fix

1. Next fetch revalidation retains a successful cached body after upstream switches to 404. Root landing and values endpoint must no longer bypass fresh visibility checks.
2. Event media guard currently rejects not-published but permits withdrawn media. Make both private to authorized event staff; publicly immutable caching of access-controlled media must be removed so previous public responses do not outlive withdrawal in shared caches.

## Verification

Meaningful RED->GREEN tests: cache reuse across users; isolation across event/audience/page/revision; publication replace on next manifest tick; 404/5xx after prior success fails closed; cold concurrent requests share one fetch; wrong/expired grants rejected; challenge swap and cross-origin cookie installation rejected; private pages remain client-only; no private draft/variable projection; all four media types withdrawn unavailable. Integration probe must use real production Next fetch runtime, not only mocked fetch. Full Go/frontend suites, lint, typecheck, build, design-system check; browser mobile+desktop common-page behavior. Local commits only for new feature. Preserve existing old API routes for mixed-version rollout.

## Venue-only mode (discussion only)

A separate optional network mode uses a site router VPN to private ingress, with event API/media/lab routes equally isolated and explicit operator access for updates. VPN transports packets; CI publishes signed/pinned images and the deployment operator reaches Kubernetes over the private management path. No infrastructure mutation or VPN deployment in this feature.

## Future closed-mode options (discussion only; not implemented)

Owner clarification (2026-10-15): retain two future variants. (1) An event visible to authenticated platform users; this does not mean approved event participants or an allowlist. (2) An event reachable only from a designated network segment/site VPN, with no access from the public network. Both variants retain the same shared published landing/custom-page cache per page for all eligible readers, with an independent authorization or network gate before delivery. This change implements only the existing public lifecycle and staff preview of nonpublic events. No new schema, UI, closed-mode access policy or network deployment is authorized here.
