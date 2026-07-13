# Event Frontend — Foundation + Shell (sub-project 1) — design

**Date:** 2026-07-13
**Status:** approved (design), pending implementation plan
**Repo/branch:** event-frontend, `redesign/event-frontend`
**Master spec:** `event-frontend/REDESIGN.md` (this doc scopes build-order steps §5.1–5.2 into one sub-project; it does not restate the master — read REDESIGN.md for theme tokens, brand, and full page map).
**Visual reference:** `ds-bundle/.event-app.html` (prototype the shell must match).

## Goal

Deliver the redesigned event-frontend **skeleton**: the Indigo-Frost theme, the base UI
primitive set, the mock data layer, and the App **shell** (top-band + left sidebar +
avatar/notification popovers) wired into `layout.tsx`, with a navigable routing skeleton whose
page bodies are placeholders. Every later sub-project (§5.3–5.8) fills a page body into this
shell. Nothing here needs a live backend — it is mock-first.

## Scope

### In scope
1. **Theme** — the Indigo-Frost shadcn HSL tokens from REDESIGN §1 added to `src/app/globals.css`
   (`:root` + mirrored `.dark`), including `--radius`, `--cyan`, `--success`, `--warning`, and
   the destructive/border/input/ring set. Geist Sans (UI) + Geist Mono (numbers/flags/code) via
   `next/font` wired to `--font-geist-sans` / `--font-geist-mono`. Keep the existing crest logo
   (`Logo.tsx`) — no IceMark.
2. **Base UI primitives** — the full REDESIGN §5.1 set as shadcn new-york components under
   `src/components/ui/` (Tailwind + CVA + Radix, `cn` from `@/utils/cn`): `button` (exists —
   align to the token palette), `input`, `card`, `badge`, `table`, `dialog`, `dropdown-menu`,
   `toggle`. Plus the primitives the shell itself needs: `avatar`, `popover`, `separator`. Add
   the missing Radix dependencies for each (only `@radix-ui/react-slot` is currently installed).
3. **Ice-cube Spinner** — copy `src/components/ui/spinner.tsx` + `src/components/ui/spinner.css`
   verbatim from admin-frontend (both apps import `cn` from `@/utils/cn`, so the copy is
   byte-identical). Replace the existing `src/components/Loader.tsx` usages with `Spinner` /
   `PageLoader`. Verify the `@layer components` color rule behaves under this repo's Tailwind v3
   (utilities still override the ice default; the `button .ice-loader` inherit rule still works).
4. **Mock layer** — `src/api/mock/` with one fixtures file per domain the shell needs now
   (`event`, `notifications`; more added by later page sub-projects), each shaped as the real
   `IResponse<T>` and validated against the existing zod schema in a dev assert. A mock axios
   adapter installed on `baseAPI` (or a `withMock(fn, fixture)` wrapper) gated by
   `NEXT_PUBLIC_USE_MOCKS=1`; when on, the relevant `*Fn` resolve fixtures (small latency) instead
   of hitting `/api`. `*Fn`/hooks/zod signatures unchanged (§4).
5. **App shell** (`src/components/event/`) — matches `.event-app.html`:
   - **Top-band** (full width): logo→home · event name (e.g. "Winter Arena") · standing chip
     (`#4 · 1 250`) · countdown timer · 🔔 notifications **popover** (not a page) · avatar menu
     **popover** (Профіль ↗ external · Форма фідбеку · Вийти — not a page).
   - **Left sidebar** (flat nav, no section headers for participants): Завдання · Результати ·
     Команди · Правила · custom pages · `+ Сторінка`; bottom block: Конфіг лабораторії (VPN
     status) · Кабінет команди.
   - Data (event name, standing, timer end, notification list/count) comes from the mock layer.
6. **Layout wiring** — `src/app/layout.tsx` keeps `<Providers>` (react-query) + `<Toaster>`,
   drops `<NavBar>`/`<Footer>`, and renders the shell around `{children}`. `generateMetadata`
   stays.
7. **Routing skeleton** — routes exist and render inside the shell with placeholder bodies
   ("coming soon" block): `/challenges`, `/scoreboard`, `/teams`, `/teams/[id]`, `/cabinet`,
   `/p/[slug]`. `/` redirects to `/challenges` when in-event (mock event → in-event true). The
   sidebar links navigate between them.

### Out of scope (later sub-projects)
- Real page content: challenges board + modal (§5.3), scoreboard (§5.4), teams + team detail
  (§5.5), cabinet (§5.6), custom pages/rules (§5.7), notifications feed content + Landing/public
  context (§5.8), admin.
- Removing Chakra: it stays installed and imported by not-yet-migrated pages; delete
  `@chakra-ui/*` per page as each page migrates (§0). Do not rip it out in this slice.

## Architecture / units

- `src/app/globals.css` — theme tokens (Indigo-Frost) + Geist font vars + the shadcn base layer.
- `src/app/layout.tsx` — providers + Toaster + shell wrapper.
- `src/components/ui/*` — primitives (one file per primitive, one responsibility each) +
  `spinner.tsx`/`spinner.css`.
- `src/components/event/AppShell.tsx` — composes top-band + sidebar around `{children}`.
- `src/components/event/TopBand.tsx` — top-band (event name, standing chip, timer, notif popover,
  avatar popover).
- `src/components/event/Sidebar.tsx` — flat nav + bottom block (VPN status, Кабінет).
- `src/components/event/NotificationsPopover.tsx`, `AvatarMenu.tsx` — the two popovers.
- `src/api/mock/*` — fixtures + the mock adapter/flag.
- `src/app/{challenges,scoreboard,teams,teams/[id],cabinet,p/[slug]}/page.tsx` — placeholder
  bodies (later sub-projects replace the body only).

Each unit has one clear responsibility and a small interface (props in, rendered UI out); the
shell reads its data through the mock layer so it is testable before real endpoints exist.

## Data flow

Mock-first (§0/§4): `component → react-query hook → *Fn → baseAPI (mock adapter when
NEXT_PUBLIC_USE_MOCKS=1) → fixture validated by the domain's zod schema`. Real endpoints later
replace only the adapter path; hooks/`*Fn`/schemas are unchanged. The shell's top-band consumes
an event-info fixture (name, timer end, standing) and a notifications fixture (count + list).

## States

- **Loading:** `Spinner`/`PageLoader` (ice cube) while a shell fixture resolves (mock latency).
- **Empty:** notifications popover shows an empty state when the fixture list is empty.
- **Error:** if a shell fixture fails zod validation in dev, the dev assert throws (loud in dev);
  in prod the shell degrades gracefully (e.g. hide the standing chip rather than crash).
- Placeholder page bodies render a neutral "coming soon" block — no data fetching yet.

## Testing / verification

This repo has **no unit-test runner** (no vitest/jest/testing-library) and REDESIGN §6 mandates
browser verification. Gate for this sub-project:
- `npx tsc --noEmit` clean for all new/changed files.
- `npm run build` succeeds (Next 15 App Router).
- **Browser visual check** with `NEXT_PUBLIC_USE_MOCKS=1`: the shell renders and matches
  `.event-app.html` — top-band items present, sidebar nav navigates between the placeholder
  routes, both popovers open, the ice-cube Spinner shows, Indigo-Frost theme applied (light), and
  Geist fonts load.
- Do NOT introduce a test runner in this slice (out of scope; not in the repo's conventions).

## Constraints (from REDESIGN.md — bind every task)

- Stack: Next 15 App Router, React 18, Tailwind v3 (shadcn HSL tokens), TypeScript strict, zod,
  react-query. New components Tailwind + CVA + Radix (shadcn new-york), `cn` from `@/utils/cn`.
- uk copy via JSON-lookup `t()` only (no i18n lib); mature-CTF tone; naming Учасники/Команди.
- Keep `*Fn` names/signatures stable (mock now, real later). One zod schema per payload in
  `types/*.ts`.
- Commit on branch `redesign/event-frontend`. Stage ONLY this slice's own paths (the working tree
  has pre-existing unrelated modifications — deploy/Dockerfile, challengeAPI.ts,
  challenges/scoreboard page.tsx, CopyToClipboard…); never `git add -A`.
- Code comments ENGLISH ONLY.
