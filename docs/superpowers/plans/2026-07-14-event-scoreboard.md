# Event Scoreboard (Slice 4 — Результати) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/scoreboard` as an Indigo-Frost token/shadcn page — an ECharts top-5 score-over-time chart plus a scrollable ranking table of ALL teams — fully replacing the old Chakra implementation.

**Architecture:** New components under `src/components/event/scoreboard/` consuming the EXISTING `useGetScore`/`useGetEventInfo`/`useGetTeam` hooks (react-query + zod `safeParse` in `select`) unchanged. A mock fixture behind `NEXT_PUBLIC_USE_MOCKS=1` feeds the page via the Slice-1 axios mock adapter. `scoreboard/page.tsx` becomes a thin wrapper around `<ScoreboardView/>`; the old Chakra scoreboard components are deleted once unused.

**Tech Stack:** Next 15.4 App Router, React 18, Tailwind v3 (shadcn HSL tokens), TypeScript strict, zod 3, @tanstack/react-query 5, `echarts-for-react` (already a dependency), lucide-react. `cn` from `@/utils/cn`.

**Spec:** `docs/superpowers/specs/2026-07-14-event-scoreboard-design.md`. **Visual reference:** `../ds-bundle/.event-app.html` (`pageScoreboard` / `lineChart`). **Master:** `REDESIGN.md` §5.4.

## Global Constraints

- **Branch `redesign/event-frontend`.** The working tree has PRE-EXISTING foreign WIP in files NOT owned by this plan (deploy/Dockerfile, src/components/Countdown.tsx, src/components/Footer.tsx, src/components/team/CreateTeam.tsx, src/components/team/JoinTeam.tsx, src/hooks/useTeam.ts, src/types/user.ts). NEVER `git add -A`/`.`/`-u`. Stage ONLY each task's own paths; run `git show --stat HEAD` after each commit; if a foreign file leaks, `git reset --soft HEAD~1`, re-stage only your paths, recommit.
- **In-scope files that DO carry discardable WIP** (user-authorized to overwrite/delete this slice): `src/app/scoreboard/page.tsx` (rewritten in Task 4) and `src/components/scoreboard/SolveTable.tsx` (deleted in Task 4). Their uncommitted edits are intentionally discarded.
- **NO unit-test runner** in this repo (no vitest/jest). Do NOT add one. Each task's gate is: `npx tsc --noEmit` clean (no NEW errors — a pre-existing `src/components/Logo.tsx` TS2307 `@/app/favicon.ico` error may appear at baseline; ignore it) + `npm run build` succeeds. Task 4 additionally requires a **browser visual-match** with `NEXT_PUBLIC_USE_MOCKS=1` against `.event-app.html`.
- **Mock-first (REDESIGN §0/§4):** do NOT change the existing hook/`*Fn`/zod interfaces. The mock adapter is the only thing swapped for real endpoints. One zod schema per payload (all already exist in `src/types/event.ts`); validate every fixture in a dev assert (`EventScoreSchema.parse(...)` at import).
- **New components:** Tailwind + CVA + Radix (shadcn), `cn` from `@/utils/cn`, token classes only (`bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`, `bg-accent`, `text-foreground`, etc.) — no hard-coded hex/slate. Do NOT introduce `@chakra-ui/*`; the scoreboard page must import no Chakra after Task 4.
- **YAGNI — real fields only.** Render ONLY what the schema provides. NO freeze note/chip (the API has no freeze field). Chart = top-5; table = ALL teams.
- **Do NOT retire `WithEventForm`/`WithTeamForm`/`WithEvent.tsx`** — still imported by `team/page.tsx`, `page.tsx` (landing), `navbar/index.tsx`. This slice only stops the scoreboard from using them.
- **uk copy** hardcoded inline (no `t()`). **Code comments ENGLISH ONLY.**

---

### Task 1: Scoreboard mock fixture + adapter route

**Files:**
- Create: `src/api/mock/fixtures/scoreboard.ts`
- Modify: `src/api/mock/adapter.ts` (add the score route)

**Interfaces:**
- Consumes: `IResponse<T>` from `@/types/api`; `EventScoreSchema`, `IEventScore`, `TeamChallengeSolutionSchema` from `@/types/event`.
- Produces: `scoreFixture: IResponse<IEventScore>`.

- [ ] **Step 1: Read the real schema shapes**

Run: `sed -n '/TeamScoreSchema = /,/EventScoreSchema/p' src/types/event.ts` — confirm `TeamScoreSchema` fields (`TeamID, TeamName, Rank, Score, LatestSolution, TeamSolutions: Record<uuid,{ID,Rank}>, TeamScoreTimeline: [date,int][]`) and `EventScoreSchema` (`Challenges: {ID,Name}[]`, `TeamsScores: TeamScore[]`, `ActiveChartSeries?` optional). The fixture need NOT include `ActiveChartSeries` — the hook builds it.

- [ ] **Step 2: Write the fixture**

`src/api/mock/fixtures/scoreboard.ts`:
```ts
import { IResponse } from "@/types/api"
import { EventScoreSchema, IEventScore } from "@/types/event"

// Stable UUID helper for fixtures (valid v4 shape; deterministic strings).
const uid = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`
// Challenge IDs reused as TeamSolutions keys.
const CH = [uid("c1"), uid("c2"), uid("c3")]
// Event window mirrors the event fixture (started ~1h ago).
const t0 = Date.now() - 3600_000
const at = (mins: number) => new Date(t0 + mins * 60_000).toISOString()

// One climbing timeline per team.
const timeline = (pts: number[]): [string, number][] =>
  pts.map((v, i) => [at(i * 12), v])

const teams = [
  { name: "frostbyte",   rank: 1, score: 6850, solved: 3, tl: [400, 1100, 2000, 3100, 4200, 5200, 6850] },
  { name: "IceBreakers", rank: 2, score: 6400, solved: 3, tl: [300, 900, 1700, 2600, 3600, 4600, 6400] },
  { name: "SubZero",     rank: 3, score: 5200, solved: 2, tl: [200, 700, 1400, 2200, 3100, 4100, 5200] },
  { name: "Glacier",     rank: 4, score: 3900, solved: 2, tl: [150, 500, 1000, 1700, 2500, 3200, 3900] },
  { name: "Permafrost",  rank: 5, score: 2600, solved: 1, tl: [100, 300, 700, 1200, 1700, 2200, 2600] },
  { name: "Blizzard",    rank: 6, score: 1200, solved: 1, tl: [50, 150, 350, 600, 800, 1000, 1200] },
]

const data: IEventScore = EventScoreSchema.parse({
  Challenges: [
    { ID: CH[0], Name: "IceWall" },
    { ID: CH[1], Name: "SQL Frostbite" },
    { ID: CH[2], Name: "Glacier Cipher" },
  ],
  TeamsScores: teams.map((t, ti) => ({
    TeamID: uid(`70${ti}`),
    TeamName: t.name,
    Rank: t.rank,
    Score: t.score,
    LatestSolution: at(60 + ti),
    // First `t.solved` challenges count as solved by this team.
    TeamSolutions: Object.fromEntries(
      CH.slice(0, t.solved).map((chID, ri) => [chID, { ID: chID, Rank: ri + 1 }])
    ),
    TeamScoreTimeline: timeline(t.tl),
  })),
})

export const scoreFixture: IResponse<IEventScore> = {
  Status: { Code: 200, Message: "OK" },
  Data: data,
}
```
Adjust field names if Step 1 shows any difference (e.g. the exact `TeamChallengeSolutionSchema` keys — it is `{ ID, Rank }`). The `EventScoreSchema.parse(...)` is the dev assert.

- [ ] **Step 3: Add the adapter route**

In `src/api/mock/adapter.ts`, add ONE route to the `ROUTES` array (import `scoreFixture` from `./fixtures/scoreboard`), leaving every existing route and the gating/passthrough logic unchanged:
```ts
{ test: (u) => u.includes("events/self/score"), body: scoreFixture },
```
Confirm `events/self/score` does not collide with any existing matcher (it does not — no other route contains that substring).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`  → no NEW errors (the fixture `.parse()` type-checks).
Run: `npm run build`  → succeeds; the fixture's `.parse()` runs at import without throwing.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/api/mock/fixtures/scoreboard.ts src/api/mock/adapter.ts
git commit -m "feat(mock): scoreboard fixture + adapter route"
git show --stat HEAD   # only these two files
```

---

### Task 2: `ScoreChart` (ECharts line chart)

**Files:**
- Create: `src/components/event/scoreboard/ScoreChart.tsx`

**Interfaces:**
- Consumes: `IActiveChartSeriesItem` from `@/types/event` (`{ name: string; data: [Date, number][]; type: string }`); `echarts-for-react` (`ReactECharts`, default import).
- Produces: `ScoreChart({ series, startTime, finishTime }: { series: IActiveChartSeriesItem[]; startTime: Date; finishTime: Date })`.

**This is a VISUAL-MATCH component.** Match the prototype `lineChart` inside `pageScoreboard` (`.event-app.html`) — a multi-line score-over-time chart. Use `echarts-for-react`. The existing `src/components/scoreboard/ScoreGraph.tsx` shows the working ECharts option shape (time xAxis with min/max from event start/finish, value yAxis, axis tooltip, dataZoom) — use it as a starting point but restyle with Indigo-Frost tokens and consume the NEW `series` prop shape.

- [ ] **Step 1: `ScoreChart.tsx`**

`"use client"`. Structure:
```tsx
"use client"
import ReactECharts from "echarts-for-react"
import { IActiveChartSeriesItem } from "@/types/event"

export function ScoreChart({ series, startTime, finishTime }:
  { series: IActiveChartSeriesItem[]; startTime: Date; finishTime: Date }) {
  const option = {
    // Indigo-Frost palette for the top lines (token-derived hex is acceptable
    // here because ECharts can't read CSS vars; keep it a small named palette).
    color: ["#1E2A6B", "#0091EA", "#3B82F6", "#22C55E", "#F59E0B"],
    grid: { left: 44, right: 16, top: 28, bottom: 28 },
    legend: { orient: "horizontal", top: 0, textStyle: { color: "#64748b" } },
    xAxis: {
      type: "time",
      min: startTime.getTime(),
      max: finishTime.getTime(),
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { color: "#64748b" },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b" },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    tooltip: { trigger: "axis" },
    series: series.map((s) => ({ name: s.name, type: "line", data: s.data, smooth: true, showSymbol: false })),
  }
  return <ReactECharts style={{ height: 300, width: "100%" }} option={option} notMerge />
}
```
(The parent passes at most 5 series. Confirm `IActiveChartSeriesItem.data` is `[Date, number][]` — ECharts' `time` axis accepts `Date`/ms/ISO; if the coerced dates arrive as `Date` objects that's fine. Keep the palette to ~5 colors matching the prototype's blues/green/amber.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`  → no NEW errors.
Run: `npm run build`  → succeeds.
(Not mounted until Task 4 — standalone gate is tsc + build; visual verified then.)

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/components/event/scoreboard/ScoreChart.tsx
git commit -m "feat(scoreboard): ECharts top-5 score-over-time chart"
git show --stat HEAD
```

---

### Task 3: `ScoreTable` (ranking table, all teams)

**Files:**
- Create: `src/components/event/scoreboard/ScoreTable.tsx`

**Interfaces:**
- Consumes: `ITeamScore` from `@/types/event` (`{ TeamID, TeamName, Rank, Score, TeamSolutions, ... }`); `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` from `@/components/ui/table`; `cn` from `@/utils/cn`.
- Produces: `ScoreTable({ teams, ownTeamID }: { teams: ITeamScore[]; ownTeamID?: string })`.

- [ ] **Step 1: `ScoreTable.tsx`**

Structure (match the prototype `pageScoreboard` table: columns `#` / `Команда` / `Розв'язано` (right) / `Бали` (right)):
```tsx
import { ITeamScore } from "@/types/event"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { cn } from "@/utils/cn"

export function ScoreTable({ teams, ownTeamID }: { teams: ITeamScore[]; ownTeamID?: string }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Команда</TableHead>
            <TableHead className="text-right">Розв'язано</TableHead>
            <TableHead className="text-right">Бали</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((t) => (
            <TableRow
              key={t.TeamID}
              className={cn(ownTeamID && t.TeamID === ownTeamID && "bg-primary/[0.06]")}
            >
              <TableCell className="font-mono text-muted-foreground">{t.Rank}</TableCell>
              <TableCell className="font-medium text-foreground">{t.TeamName}</TableCell>
              <TableCell className="text-right font-mono">{Object.keys(t.TeamSolutions).length}</TableCell>
              <TableCell className="text-right font-mono">{t.Score}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```
Escape the apostrophe in "Розв'язано" as needed for this repo's `react/no-unescaped-entities` lint (use `Розв&apos;язано` or the `’`/`'` that passes build — verify `npm run build` is clean). Do NOT render `LatestSolution` or a per-challenge matrix (YAGNI — match the prototype's 4 columns).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`  → no NEW errors.
Run: `npm run build`  → succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/components/event/scoreboard/ScoreTable.tsx
git commit -m "feat(scoreboard): ranking table (all teams, own-team highlight)"
git show --stat HEAD
```

---

### Task 4: `ScoreboardView` orchestrator + wire page + delete old Chakra (browser visual-match)

**Files:**
- Create: `src/components/event/scoreboard/ScoreboardView.tsx`
- Modify (rewrite): `src/app/scoreboard/page.tsx`
- Delete: `src/components/scoreboard/ScoreBoard.tsx`, `src/components/scoreboard/ScoreGraph.tsx`, `src/components/scoreboard/SolveTable.tsx`

**Interfaces:**
- Consumes: `useEvent` from `@/hooks/useEvent` (`useGetEventInfo()` → `{ GetEventInfoResponse, GetEventInfoRequest }`, `GetEventInfoResponse?.Data.{StartTime,FinishTime,ScoreboardAvailability}`; `useGetScore({ enabled })` → `{ GetScoreResponse, GetScoreRequest }`, `GetScoreResponse?.Data.{TeamsScores, ActiveChartSeries}`); `useTeam` from `@/hooks/useTeam` (`useGetTeam()` → `{ GetTeamResponse }`, the viewer's own team id); `ScoreboardVisibilityTypeEnum` from `@/types/event`; `CountdownTimer` from `@/components/Countdown`; `Spinner` from `@/components/ui/spinner`; `ScoreChart` (Task 2), `ScoreTable` (Task 3).
- Produces: `ScoreboardView()` (named export), consumed by `scoreboard/page.tsx`.

- [ ] **Step 1: Confirm the own-team id field**

Run: `grep -n "ID\|TeamID\|Name" src/types/user.ts | head` and check `src/hooks/useTeam.ts` — confirm the field on the team payload (`ITeam`) that corresponds to `TeamScore.TeamID`. It is expected to be `GetTeamResponse?.Data?.ID` (a uuid). Use whatever the real field is as `ownTeamID`. If the team payload exposes no id that matches `TeamScore.TeamID`, pass `ownTeamID={undefined}` (own-team highlight simply won't render) and note it in the report — do NOT invent a field or change the hook.

- [ ] **Step 2: `ScoreboardView.tsx`**

`"use client"`. Gating per spec §"Gating / state flow":
```tsx
"use client"
import { useEffect, useState } from "react"
import { useEvent } from "@/hooks/useEvent"
import { useTeam } from "@/hooks/useTeam"
import { ScoreboardVisibilityTypeEnum } from "@/types/event"
import { CountdownTimer } from "@/components/Countdown"
import { Spinner } from "@/components/ui/spinner"
import { ScoreChart } from "./ScoreChart"
import { ScoreTable } from "./ScoreTable"

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>
}
function GateCard({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-lg font-medium text-foreground">{title}</p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function ScoreboardView() {
  const { GetEventInfoResponse, GetEventInfoRequest } = useEvent().useGetEventInfo()
  const event = GetEventInfoResponse?.Data
  const now = Date.now()
  const started = !!event && new Date(event.StartTime).getTime() <= now
  const hidden = event?.ScoreboardAvailability === ScoreboardVisibilityTypeEnum.Hidden

  // Re-render each second until the event starts so the gate auto-advances at StartTime.
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (started) return
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [started])

  const canLoad = started && !hidden
  const { GetScoreResponse, GetScoreRequest } = useEvent().useGetScore({ enabled: canLoad })
  const teams = GetScoreResponse?.Data.TeamsScores ?? []
  const series = (GetScoreResponse?.Data.ActiveChartSeries ?? []).slice(0, 5)

  const { GetTeamResponse } = useTeam().useGetTeam()
  const ownTeamID = GetTeamResponse?.Data?.ID // confirmed in Step 1

  // 1. Event loading.
  if (GetEventInfoRequest.isLoading || !event)
    return <Centered><Spinner size="md" className="text-primary" /></Centered>
  // 2. Hidden.
  if (hidden)
    return <Centered><GateCard title="Рейтинг приховано організатором" /></Centered>
  // 3. Before start.
  if (!started)
    return (
      <Centered>
        <CountdownTimer text="Рейтинг з'явиться після старту" until={new Date(event.StartTime)} />
      </Centered>
    )
  // 4. Score states.
  if (GetScoreRequest.isLoading)
    return <Centered><Spinner size="md" className="text-primary" /></Centered>
  if (GetScoreRequest.isError)
    return <Centered><p className="text-sm text-destructive">Не вдалося завантажити рейтинг.</p></Centered>
  if (!teams.length)
    return <Centered><GateCard title="Ще немає результатів" /></Centered>

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold text-foreground">Динаміка балів · топ-5</p>
        <ScoreChart series={series} startTime={new Date(event.StartTime)} finishTime={new Date(event.FinishTime)} />
      </div>
      <ScoreTable teams={teams} ownTeamID={ownTeamID} />
    </div>
  )
}
```
Verify the exact hook return-property names against `src/hooks/useEvent.ts` / `useTeam.ts` before finalizing (`GetScoreResponse`/`GetScoreRequest`, `GetEventInfoResponse`/`GetEventInfoRequest`, `GetTeamResponse`). Do NOT change the hooks. The `useEffect` must sit before the early returns (Rules of Hooks). Escape the apostrophe in "з'явиться" if the build lint requires it.

- [ ] **Step 3: Rewrite `src/app/scoreboard/page.tsx`**

```tsx
import { ScoreboardView } from "@/components/event/scoreboard/ScoreboardView"

export default function ScoreboardPage() {
  return <ScoreboardView />
}
```
(Overwrites the file's uncommitted foreign WIP — intentional. The AppShell wraps every route via `layout.tsx`.)

- [ ] **Step 4: Delete the old Chakra components (after confirming no importers)**

Run: `grep -rn "components/scoreboard/ScoreBoard\|components/scoreboard/ScoreGraph\|components/scoreboard/SolveTable" src`
Expected: NO results after Step 3 (the three files only imported each other + the old page). If any OTHER file still imports one, STOP and report. Then:
```bash
git rm src/components/scoreboard/ScoreBoard.tsx src/components/scoreboard/ScoreGraph.tsx src/components/scoreboard/SolveTable.tsx
```
(Deleting `SolveTable.tsx` discards its uncommitted foreign WIP too — intentional.)

- [ ] **Step 5: Confirm no Chakra on the scoreboard page**

Run: `grep -rn "@chakra-ui" src/app/scoreboard src/components/event/scoreboard` → expect NO results.

- [ ] **Step 6: Verify (tsc + build)**

Run: `npx tsc --noEmit`  → no NEW errors (deleting the old components must not leave a dangling import; if Step 4 grep was clean this passes).
Run: `npm run build`  → succeeds; `/scoreboard` route present.

- [ ] **Step 7: Browser visual-match**

Run: `NEXT_PUBLIC_USE_MOCKS=1 npm run dev`, open `/scoreboard`, verify against `../ds-bundle/.event-app.html`:
- The page renders inside the AppShell (top-band + sidebar), header/section "Динаміка балів · топ-5".
- The chart shows up to 5 lines climbing over the event window; legend + hover tooltip work; colors read against the card.
- The ranking table lists ALL teams (# / Команда / Розв'язано / Бали); a long list scrolls; if the mock team matches, that row is tinted.
- No freeze chip is shown. The page imports no `@chakra-ui/*`.
If you cannot drive a browser, say so and state exactly what you verified instead (e.g. curl the dev route, confirm 200 + chart/table markup). Do NOT claim a visual pass you did not perform.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/components/event/scoreboard/ScoreboardView.tsx src/app/scoreboard/page.tsx
git commit -m "feat(scoreboard): wire redesigned scoreboard into /scoreboard, retire old Chakra components"
git show --stat HEAD   # only ScoreboardView.tsx + scoreboard/page.tsx + the 3 deletions — NOT other foreign WIP
```

---

## Self-Review (writing-plans)

1. **Spec coverage:** mock fixture+route → Task 1; ECharts top-5 chart → Task 2; ranking table (all teams, own-team tint, solved-count) → Task 3; orchestrator gates (event-loading/hidden/before-start+tick/loading/empty/error) + page wiring + old-component deletion + Chakra-free + browser visual-match → Task 4. Data-layer reuse (no interface changes), mock-first, uk-inline/English-comments, token-only, foreign-WIP discipline, no-freeze, WithEventForm-not-retired all in Global Constraints. All spec sections covered.
2. **Placeholder scan:** no TBD/TODO. The ECharts token palette uses named hex (ECharts cannot read CSS vars — an explicit, justified exception noted in Task 2). Deterministic parts (fixture, route, table, orchestrator gating, page wiring, deletions) carry full code; the chart gives full option code + prototype reference. The own-team-id field is flagged in Task 4 Step 1 for the implementer to confirm against the real `ITeam` (with a defined fallback: `undefined` → no highlight).
3. **Type consistency:** `IEventScore`/`ITeamScore`/`IActiveChartSeriesItem`, `scoreFixture`, `ScoreChart`/`ScoreTable`/`ScoreboardView`, and the hook return props (`GetScoreResponse`/`GetScoreRequest`, `GetEventInfoResponse`/`GetEventInfoRequest`, `GetTeamResponse`) are used consistently across tasks. `ScoreChart({series,startTime,finishTime})` and `ScoreTable({teams,ownTeamID})` props match between producer (Tasks 2/3) and consumer (Task 4). The before-start tick mirrors the verified Slice-3 pattern (hooks before early returns).
