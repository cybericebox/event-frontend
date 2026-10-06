# Event Frontend — Slice 3: Завдання (Challenges Board) Design

> Sub-project 3 of REDESIGN §5. Fills the Завдання page body into the existing AppShell (Slice 2). Visual-first, mock-first.

**Goal:** Redesign `/challenges` as an Indigo-Frost, token/shadcn board — challenges grouped by category (solved = green tint) with a challenge modal (tabs Завдання / Розв'язали, attached files, flag input) — fully replacing the old Chakra implementation.

**Spec source:** `REDESIGN.md` §5.3 · **Visual reference:** `../ds-bundle/.event-app.html` (`pageChallenges` / `challengeCard` / `challengeBody`).

**Stack:** Next 15 App Router, React 18, Tailwind v3 (shadcn HSL tokens), TypeScript strict, zod 3, @tanstack/react-query 5, react-hot-toast. No i18n lib (uk copy hardcoded inline). No unit-test runner.

## Scope decisions (locked)

1. **YAGNI — real data only.** The board/modal render ONLY fields the backend returns. The prototype's `difficulty` badge, per-card `solve count`, `hints (−N балів)`, tech-term `highlightDesc`, and flag-`format` instruction are **dropped** — the real schema has no such fields. No fabricated fixtures/schema for them.
2. **Full replacement.** The old Chakra impl (`ChallengesView`, `ChallengeModal`, `ChallengeTile`, `ChallengeForm`, `ChallengeSolvesTable`) is replaced by new token/shadcn components; `challenges/page.tsx` is rewritten (its uncommitted foreign WIP is intentionally discarded — user-authorized). Old components are deleted once no importer remains. The challenges page no longer imports `@chakra-ui/*`.
3. **Full states + new token gates.** Rebuild the event-window and team gates in token style for THIS page. The shared Chakra `WithEventForm`/`WithTeamForm` stay untouched (scoreboard still uses them; they migrate in a later slice).
4. **Local modal state.** The open challenge is `useState` in the board (as the prototype). No URL param / deep-link this slice.

## Data layer (exists — reuse unchanged)

All hooks/`*Fn`/zod already follow the mock-first `safeParse`-in-`select` pattern. Do NOT change their interfaces.

| Concern | `*Fn` (path) | Hook | Schema |
|---|---|---|---|
| Board | `getChallengesFn` (`GET events/self/challenges/info`) | `useChallenge().useGetChallenges(enabled)` | `ChallengeCategoryInfoSchema[]` |
| Solved-by | `challengeSolvedByFn(id)` (`GET events/self/challenges/{id}/solvedBy`) | `useChallenge().useChallengeSolvedBy(id)` | `TeamSolutionSchema[]` |
| Submit flag | `solveChallengeFn(id, {Solution})` (`POST events/self/challenges/{id}/solve`) | `useChallenge().useSolveChallenge(id)` | `SolveChallengeResultSchema` (`{Solved}`) |
| Team gate | `getTeamFn` (`GET /events/self/teams/self`) | `useTeam().useGetTeam()` | `ITeam` (has `Name` ⇒ has team) |
| Event window | `getEventInfoFn` | `useEvent().useGetEventInfo()` | `IEventInfo` (`StartTime`/`FinishTime`/`Participation`) |

`useSolveChallenge` already invalidates `['challenges']` + `['challengeSolved', id]` on success — the board and Розв'язали tab refresh automatically.

Existing `ChallengeInfoSchema` = `{ ID, Name, Points, Description, AttachedFiles: [{ID,Name}], Solved }`. `ChallengeCategoryInfoSchema` = `{ ID, Name, Challenges[] }`. No schema changes needed.

## Mock fixtures (new)

`src/api/mock/fixtures/challenges.ts` — shaped as real `IResponse<T>`, validated by the same zod schemas in a dev assert. Mirror the prototype so screens look identical to `.event-app.html`. Add matchers to the Task-4 `src/api/mock/adapter.ts` `ROUTES` (method-aware):

- `GET events/self/challenges/info` → `challengesFixture` (`ChallengeCategoryInfoSchema[]`): 2–3 categories (e.g. Web / Crypto / Pwn), a mix of solved/unsolved challenges, at least one with `AttachedFiles`.
- `GET events/self/challenges/{id}/solvedBy` (suffix `/solvedBy`) → `solvedByFixture` (`TeamSolutionSchema[]`): a few team solutions with `SolvedAt`.
- `POST events/self/challenges/{id}/solve` → `{ Solved }`: `true` when the submitted `Solution` equals a known correct flag baked into the fixture (e.g. `CTF{...}`), else `false`.
- `GET /events/self/teams/self` (match `events/self/teams/self`, NOT the `.../vpn-config` suffix) → `teamFixture` (`ITeam` with a `Name`) so the team gate passes under mocks by default.

## Components (new — `src/components/event/challenges/`)

- **`ChallengesBoard.tsx`** (`"use client"`) — orchestrator. Resolves the gates (below), renders category sections, holds `const [selected, setSelected] = useState<IChallengeInfo | null>(null)`, and renders `<ChallengeModal challenge={selected} open={!!selected} onOpenChange=…/>`. Enables `useGetChallenges` only once past the gates.
- **`ChallengeCategory` section** (inline in board or small component) — colored bar + category `Name` + count "N завдань"; grid `repeat(auto-fill, minmax(290px, 1fr))`.
- **`ChallengeCard.tsx`** — presentational: `Name`, `Points`, solved state. Solved ⇒ green-tinted border+bg (`border-success`/tint) + "Вирішено"; unsolved ⇒ neutral card. Click ⇒ `setSelected(challenge)`.
- **`ChallengeModal.tsx`** — shadcn `Dialog`. Header: `Name` · `Points` · category · solved `Badge`. Body via shadcn **`tabs`** (new primitive): **Завдання** = plain `Description` + `AttachedFiles` (download links) + `<FlagSubmit/>`; **Розв'язали** = `<ChallengeSolvedBy/>`. Solved ⇒ green "Прапор уже прийнято — завдання вирішено вашою командою" in place of the input.
- **`FlagSubmit.tsx`** — `Input` + submit `Button`, uses `useSolveChallenge(id)`; on result toast success ("Прапор прийнято!") / error ("Невірний прапор"); disabled while `PendingSolveChallenge`; disabled + note when the event is finished.
- **`ChallengeSolvedBy.tsx`** — Розв'язали tab: `useChallengeSolvedBy(id)` list of `TeamSolution` (`Name` + formatted `SolvedAt`); loading `Spinner`, empty state.
- **Gate components** (token, small — in the same folder): `before-start` (renders `CountdownTimer` to `StartTime`, "Завдання стануть доступні через"), `no-team` (CTA to create/join a team, shown only when `Participation === Team` and `useGetTeam` has no team), plus inline `loading` (`Spinner`), `empty`, and `error` states for the challenges query.

**`src/app/challenges/page.tsx`** — rewritten thin: renders `<ChallengesBoard/>`. No Chakra imports.

**New primitive:** generate shadcn `tabs` via CLI (`npx shadcn@latest add tabs`) — Radix-based, token-styled, reused by later slices (team detail, cabinet). `Dialog`, `Input`, `Button`, `Badge`, `Card`, `Separator` already exist (Slice 1).

**Deleted once unused:** `src/components/challenge/{ChallengesView,ChallengeModal,ChallengeTile,ChallengeForm,ChallengeSolvesTable}.tsx` (importers today: only `challenges/page.tsx` + their mutual imports — all removed by the rewrite).

## Gating / state flow (board)

1. Event info loading → `Spinner`.
2. `now < StartTime` → before-start gate (countdown to start). No board.
3. `Participation === Team` AND `useGetTeam` resolves without a team → no-team CTA (create/join). No board.
4. In-event → enable `useGetChallenges`:
   - loading → `Spinner`; error → error state; empty (no categories/challenges) → empty state; success → category grid.
5. `now > FinishTime` → board stays visible read-only; `FlagSubmit` is disabled with a "Відповіді більше не приймаються" note (solved challenges still show their solved state; Розв'язали tab still loads).

## Error handling

- Query/zod failures surface as the board `error` state (the hooks already `throw ErrorInvalidResponseData` on `safeParse` failure); no raw casts.
- Flag submit errors → toast; never crash the modal. Network/HTTP errors from `solveChallengeFn` are caught by the mutation and toasted.
- Mock mode: unmatched routes fall through to real `/api` via the fixed passthrough (`axios.getAdapter`).

## Testing / acceptance (no unit runner)

Gate: `npx tsc --noEmit` clean + `npm run build` succeeds. Browser visual-match with `NEXT_PUBLIC_USE_MOCKS=1` against `.event-app.html`:
- Board groups by category with counts; solved cards show the green tint.
- Card click opens the modal; tabs switch Завдання ↔ Розв'язали; attached files listed with download affordance.
- Flag submit shows a toast and (correct flag) flips the card/modal to solved without a full reload.
- Before-start shows the countdown gate; no-team (Team participation) shows the CTA; after-finish disables submit with the closed note.
- The challenges page renders inside the AppShell (top-band + sidebar) and imports no `@chakra-ui/*`.

## Out of scope (later slices)

Scoreboard, teams, cabinet, custom pages, landing, notifications content. Migrating the shared `WithEventForm`/`WithTeamForm` to token style. Difficulty/hints/solve-count/term-highlighting/flag-format (dropped per scope decision 1). Deep-link/share of a specific challenge (URL modal state).
