# Event Frontend — Slice 4: Результати (Scoreboard) Design

> Sub-project 4 of REDESIGN §5. Fills the Результати page body into the existing AppShell (Slice 2). Visual-first, mock-first.

**Goal:** Redesign `/scoreboard` as an Indigo-Frost token/shadcn page — an ECharts time-series of the top teams plus a full ranking table of ALL teams — fully replacing the old Chakra implementation.

**Spec source:** `REDESIGN.md` §5.4 · **Visual reference:** `../ds-bundle/.event-app.html` (`pageScoreboard` / `lineChart`).

**Stack:** Next 15 App Router, React 18, Tailwind v3 (shadcn HSL tokens), TypeScript strict, zod 3, @tanstack/react-query 5, `echarts-for-react` (already a dependency). No i18n lib (uk copy hardcoded inline). No unit-test runner.

## Scope decisions (locked)

1. **Chart = top-5, table = ALL teams.** The ECharts line chart plots the top-5 teams' score-over-time (the `useGetScore` hook already builds `ActiveChartSeries` from `TeamScoreTimeline`; the chart slices it to 5). The ranking table below lists EVERY team from `TeamsScores` (full ranking, scrollable) — no top-N cap, no pagination. The viewer's own team row is highlighted.
2. **Freeze note DROPPED (YAGNI).** The participant score/event API exposes no freeze field (freeze is an admin-only setting). Do NOT render a freeze chip; it returns when the API provides the data.
3. **Full replacement.** The old Chakra impl (`ScoreBoard`, `ScoreGraph`, `SolveTable`) is replaced by new token/shadcn components; `scoreboard/page.tsx` is rewritten (its uncommitted foreign WIP — and `SolveTable.tsx`'s WIP — are intentionally discarded, user-authorized). The old three are deleted once no importer remains. The scoreboard page imports no `@chakra-ui/*`.
4. **`WithEventForm`/`WithTeamForm` are NOT retired.** They remain imported by `team/page.tsx`, `page.tsx` (landing), and `navbar/index.tsx`. This slice rebuilds the scoreboard's gates in token style but leaves those shared components untouched.
5. **No team required.** The scoreboard is visible to any in-app participant; `useGetTeam` is used ONLY to highlight the viewer's own row.

## Data layer (exists — reuse unchanged)

Do NOT change the hook/`*Fn`/zod interfaces.

| Concern | `*Fn` (path) | Hook | Schema |
|---|---|---|---|
| Scores | `getScore` (`GET /events/self/score`) | `useEvent().useGetScore({ enabled })` | `EventScoreSchema` |
| Event window + visibility | `getEventInfoFn` | `useEvent().useGetEventInfo()` | `IEventInfo` (`StartTime`/`FinishTime`/`ScoreboardAvailability`) |
| Own-team highlight | `getTeamFn` | `useTeam().useGetTeam()` | `ITeam` (`TeamID`/`Name`) |

`useGetScore`'s `select` already: (a) `safeParse`s via `EventScoreSchema`, (b) builds `ActiveChartSeries` = one `{ name, data: TeamScoreTimeline, type: "line" }` per team for the first 10 teams. The chart consumes this array (sliced to 5). `GetScoreResponse?.Data.TeamsScores` is the full ranking (already ordered by `Rank`).

`TeamScoreSchema` = `{ TeamID, TeamName, Rank, Score, LatestSolution, TeamSolutions: Record<challengeID, {ID,Rank}>, TeamScoreTimeline: [date,int][], InChart? }`. Solved-count per team = `Object.keys(team.TeamSolutions).length`. `ScoreboardVisibilityTypeEnum` = { Hidden=0, Private=1, Public=2 }.

## Mock fixtures (new)

`src/api/mock/fixtures/scoreboard.ts` — a `scoreFixture: IResponse<IEventScore>` shaped as the real `IResponse<T>` (`{ Status, Data }`), validated by `EventScoreSchema.parse(...)` at import (dev assert). Mirror the prototype: 5–6 teams with `Rank`, `Score`, `LatestSolution`, a non-empty `TeamSolutions` record, and a `TeamScoreTimeline` (a handful of `[isoDate, score]` points climbing over the event window). Add a route to the mock adapter: `GET /events/self/score` (match `events/self/score`) → `scoreFixture`. (Note: `EventScoreSchema` requires `Challenges` and `TeamsScores`; `ActiveChartSeries` is optional and produced by the hook, so the fixture need not include it.)

## Components (new — `src/components/event/scoreboard/`)

- **`ScoreboardView.tsx`** (`"use client"`) — orchestrator. Resolves the gates (below), then renders the chart card + the ranking table. Owns the enable flag for `useGetScore`.
- **`ScoreChart.tsx`** (`"use client"`) — wraps `echarts-for-react` `ReactECharts`. Props: `{ series: IActiveChartSeriesItem[]; startTime: Date; finishTime: Date }`. Renders a line chart: `xAxis` type `time` (min `startTime`, max `finishTime`), `yAxis` type `value`, `tooltip` trigger `axis`, `legend`, series = the passed series (already `type:"line"`). Style to Indigo-Frost: a token-derived line-color palette, muted axis/grid, transparent background so the card's `bg-card` shows. The parent slices `ActiveChartSeries` to the first 5 before passing. (Follow the existing `ScoreGraph.tsx` ECharts option shape as a starting point, restyled with tokens; drop the old `{labels,data}` prop shape.)
- **`ScoreTable.tsx`** — shadcn `Table`. Columns: `#` (Rank) · `Команда` (TeamName) · `Розв'язано` (solved-count, right-aligned) · `Бали` (Score, `font-mono`, right-aligned). Rows = ALL `TeamsScores` (ordered by Rank). Wrapped in an `overflow-y-auto` container so a long list scrolls within the page. The row whose `TeamID` equals the viewer's own team (from `useGetTeam`) gets a tint (`bg-primary/[0.06]` or `bg-accent`) — resolved by the parent passing `ownTeamID?: string`.
- **`scoreboard/page.tsx`** — rewritten thin: renders `<ScoreboardView/>`. No Chakra imports.

**Primitives:** `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (Slice 1), `Card`, `Spinner`, `Badge` already exist. `CountdownTimer` (named) from `@/components/Countdown` for the before-start gate.

**Deleted once unused:** `src/components/scoreboard/{ScoreBoard,ScoreGraph,SolveTable}.tsx` (importers today: only `scoreboard/page.tsx` + ScoreBoard's imports of the other two — all removed by the rewrite).

## Gating / state flow (ScoreboardView)

1. Event info loading → `Spinner`.
2. `ScoreboardAvailability === Hidden` → a token gate card: "Рейтинг приховано організатором." No chart/table. (Replaces the old redirect-to-`/` — a gate is less jarring.)
3. `now < StartTime` → before-start gate: `CountdownTimer` to `StartTime` ("Рейтинг з'явиться після старту"), with the same 1s re-render tick used in Slice 3 (`useEffect` + `setInterval` while `!started`, placed before early returns) so it auto-advances at start without a blank screen.
4. In-event and visible → enable `useGetScore({ enabled: canLoad })` where `canLoad = started && ScoreboardAvailability !== Hidden`:
   - loading → `Spinner`; error → error state; empty (`TeamsScores.length === 0`) → empty state ("Ще немає результатів"); success → chart card + table.
5. Live updates ride the hook's existing `refetchInterval: 5 * 60 * 1000` (5 min) + `refetchOnWindowFocus`. The after-finish state needs no special handling (the scoreboard stays visible read-only; there is no submit here).

## Error handling

- Query/zod failures surface as the ScoreboardView `error` state (the hook already `throw`s `ErrorInvalidResponseData` on `safeParse` failure). No raw casts.
- The chart renders only when `ActiveChartSeries` is non-empty; a team with an empty `TeamScoreTimeline` simply contributes no points.
- Mock mode: the `events/self/score` route serves `scoreFixture`; unmatched routes fall through to real `/api` via the fixed passthrough.

## Testing / acceptance (no unit runner)

Gate: `npx tsc --noEmit` clean + `npm run build` succeeds. Browser visual-match with `NEXT_PUBLIC_USE_MOCKS=1` against `.event-app.html`:
- The page renders inside the AppShell (top-band + sidebar), header "Результати".
- The chart card ("Динаміка балів · топ-5") shows a line per top-5 team over the event window; legend + tooltip work; colors read against the Indigo-Frost card.
- The ranking table lists ALL teams with # / Команда / Розв'язано / Бали; a long list scrolls; the viewer's own team row is tinted.
- Before-start shows the countdown gate and auto-advances at start; a Hidden scoreboard shows the "приховано" gate; empty shows the empty state.
- The scoreboard page imports no `@chakra-ui/*`.

## Out of scope (later slices)

Teams roster page (`/teams`, Slice 5), team detail, cabinet, custom pages, landing, notifications content. The freeze note (dropped per decision 2). Public (unauthenticated) scoreboard access. Migrating the shared `WithEventForm`/`WithTeamForm` to token style (still used by other pages).
