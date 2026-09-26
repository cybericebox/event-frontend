# Event Frontend — Redesign Specification

Branch: `redesign/event-frontend` (off `develop`).
Goal: rebuild the **participant-facing** event frontend to the new "Indigo Frost" design (sidebar shell, CTFd-parity), page by page, **mock-first** so the UI is testable before backend endpoints land. Reference prototype: `../ds-bundle/.event-app.html`.

## 0. Principles

- **Mock-first.** Keep the existing data flow (axios `baseAPI` → `*Fn` → react-query hook with **zod `safeParse` in `select`**). Add a mock adapter at the axios level so each endpoint returns fixed fixtures behind a flag. Real endpoints replace mocks later **without changing the hook/`*Fn` interface**.
- **One schema source.** Every payload is a zod schema in `types/*.ts` with `interface … extends z.infer<…>`. Validate every response.
- **Remove Chakra gradually.** New components are Tailwind + CVA + Radix (shadcn-style), using the token vars below. Delete `@chakra-ui/*` once a page no longer imports it.
- **Modern stack:** Next 15 App Router, React 18, Tailwind v3 (shadcn HSL tokens), TypeScript strict, zod, react-query.

## 1. Brand

- **Logo:** the old crest (`src/app/favicon.ico`) — already used by `src/components/Logo.tsx`. Keep it everywhere. No IceMark.
- **Fonts:** Geist Sans (UI) + Geist Mono (numbers, flags, code). Add via `next/font` (or `@/fonts`) and wire to `--font-geist-sans` / mono.
- **Theme — Indigo Frost** (light). shadcn HSL tokens for `globals.css` (`:root`, mirror in `.dark`):

```css
:root {
    --background: 207 77% 95%;
    --foreground: 230 65% 12%;
    --card: 0 0% 100%;
    --card-foreground: 230 65% 12%;
    --popover: 0 0% 100%;
    --popover-foreground: 230 65% 12%;
    --primary: 231 56% 27%;              /* indigo #1E2A6B */
    --primary-foreground: 0 0% 100%;
    --secondary: 210 82% 91%;
    --secondary-foreground: 225 61% 18%;
    --muted: 208 74% 93%;
    --muted-foreground: 212 30% 38%;
    --accent: 209 85% 90%;
    --accent-foreground: 203 83% 16%;
    --destructive: 347 77% 50%;          /* rose #E11D48 */
    --destructive-foreground: 0 0% 100%;
    --border: 207 59% 82%;
    --input: 206 56% 78%;
    --ring: 203 100% 46%;
    --cyan: 203 100% 46%;                /* accent cyan #0091EA */
    --radius: 0.75rem;
    --success: 152 60% 40%;              /* #10B981-ish for solved */
    --warning: 38 92% 55%;               /* #FFB020 */
}
```

- **Status colors:** solved = success green; warning amber; destructive rose. Charts hardcode hex (canvas can't read CSS vars): series `#1E2A6B, #0091EA, #8B5CF6, #94A3B8, #E11D48(me)`.
- **Tone:** mature student/professional CTF platform — no childish copy, no gamification.
- **Naming (uk):** Users → **Учасники**, Teams → **Команди**. Real facts only (no invented seasons/records).

## 2. App architecture & shell

- **Two contexts:** public **Landing** (no sidebar, own navbar) for non-registered; **App** (sidebar shell + top-band) for the event. Reload/login → `challenges`. Landing only for not-in-event.
- **Shell (App):** full-width top-band (logo→home · `Winter Arena` · standing chip `#4 · 1 250` · timer · 🔔 popover · avatar menu) over a **left sidebar** (flat nav: Завдання/Результати/Команди/Правила + custom + `+ Сторінка`; bottom: Конфіг лабораторії (VPN status) + Кабінет команди). No section headers for participants.
- **Avatar menu** (popover, not page): Профіль ↗ · Форма фідбеку · Вийти. **Notifications**: 🔔 popover (not page).
- **Routing (App Router):**
  - `/` landing (public) — redirects to `/challenges` when in-event
  - `/challenges` · `/scoreboard` · `/teams` · `/teams/[id]` · `/cabinet` (my team) · `/p/[slug]` (custom pages incl. rules) · `/profile` (external id-domain link)
- Keep `layout.tsx` providers (react-query) + Toaster; swap `NavBar`/`Footer` for the new shell.

## 3. Pages & data contracts (participant)

| Page | Route | Hook / `*Fn` (existing or new) | Schema |
|---|---|---|---|
| Завдання | `/challenges` | `useChallenge().useGetChallenges` · `getChallengesFn` | `ChallengeCategoryInfoSchema[]` (have) |
| Challenge modal | (in page) | `useChallengeSolvedBy` · `useSolveChallenge` | `TeamSolutionSchema[]`, `SolveChallengeSchema` (have) |
| Результати | `/scoreboard` | `useEvent`/`scoreboard` Fn | scoreboard schema (extend) — table + ECharts line |
| Команди | `/teams` | teams Fn | teams list schema (extend) |
| Деталь команди | `/teams/[id]` | team-by-id Fn | team detail schema (members + solved) |
| Кабінет команди | `/cabinet` | `useTeam` | my-team schema (members, invite code, submits) |
| Правила / custom | `/p/[slug]` | pages Fn | page (markdown) schema |
| Сповіщення | 🔔 popover | notifications Fn | announcement schema |

Map to existing `types/*.ts` first; extend with new schemas where missing (scoreboard timeline, teams list, team detail, my-team submits, pages, notifications).

## 4. Mock layer

- Add `src/api/mock/` with one fixtures file per domain (challenges, scoreboard, teams, cabinet, notifications, pages, event) shaped as the real `IResponse<T>` (`{ Data, … }`) and **validated against the same zod schemas** in a dev assert.
- Install a mock **axios adapter** on `baseAPI` (or a thin `withMock(fn, fixture)` wrapper) gated by `NEXT_PUBLIC_USE_MOCKS=1`. When on, `*Fn` resolve fixtures (with small latency) instead of hitting `/api`. Hooks/zod untouched.
- Each fixture mirrors the prototype data so screens look identical to `.event-app.html`.

## 5. Build order (page by page, visual-first)

1. **Foundation** — theme tokens in `globals.css`, Geist fonts, base UI primitives (button/input/card/badge/table/dialog/dropdown/toggle), mock adapter + flag.
2. **Shell** — top-band + sidebar + avatar/notif popovers; wire `layout.tsx`.
3. **Завдання** — grouped-by-category board (solved = green tint) + challenge modal (tabs Завдання/Розв'язали, highlighted terms, files, flag input w/ format). Real hooks + mock.
4. **Результати** — ECharts time-series + ranked table + freeze note.
5. **Команди** + **Деталь команди** (row → page).
6. **Кабінет команди** — summary, member contribution, submit history, invite/settings.
7. **Custom pages** (`/p/[slug]`) + **Правила**.
8. **Сповіщення** popover · **Landing** (public).

Admin (`/admin`) is a later phase — see prototype; mirror the same shell+mock approach.

## 6. Conventions

- Components: `src/components/ui/*` (primitives), `src/components/event/*` (shell + feature blocks).
- Keep `*Fn` names/signatures stable (mock now, real later).
- uk copy, JSON-lookup `t()` only (no i18n lib).
- Per page: build visual with mock → verify in browser → wire states (loading/empty/error) → next page.
