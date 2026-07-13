# Event Challenges Board (Slice 3 — Завдання) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/challenges` as an Indigo-Frost token/shadcn board — challenges grouped by category (solved = green tint) with a challenge modal (tabs Завдання / Розв'язали, attached files, flag input) — fully replacing the old Chakra implementation.

**Architecture:** New presentational + orchestrator components under `src/components/event/challenges/`, consuming the EXISTING `useChallenge`/`useTeam`/`useEvent` hooks (react-query + zod `safeParse` in `select`) unchanged. Mock fixtures behind `NEXT_PUBLIC_USE_MOCKS=1` feed the board via the Slice-1 axios mock adapter. `challenges/page.tsx` becomes a thin wrapper around `<ChallengesBoard/>`; the old Chakra challenge components are deleted once unused.

**Tech Stack:** Next 15.4 App Router, React 18, Tailwind v3 (shadcn HSL tokens), TypeScript strict, zod 3, @tanstack/react-query 5, react-hot-toast, Radix/CVA (shadcn new-york), lucide-react. `cn` from `@/utils/cn`.

**Spec:** `docs/superpowers/specs/2026-07-13-event-challenges-board-design.md`. **Visual reference:** `../ds-bundle/.event-app.html` (`pageChallenges` / `challengeCard` / `challengeBody`). **Master:** `REDESIGN.md` §5.3.

## Global Constraints

- **Branch `redesign/event-frontend`.** The working tree has PRE-EXISTING foreign WIP in files NOT in this plan (deploy/Dockerfile, src/app/scoreboard/page.tsx, src/components/Countdown.tsx, src/components/Footer.tsx, src/components/scoreboard/SolveTable.tsx, src/components/team/CreateTeam.tsx, src/components/team/JoinTeam.tsx, src/hooks/useTeam.ts, src/types/user.ts). NEVER `git add -A`/`.`/`-u`. Stage ONLY each task's own paths; run `git show --stat HEAD` after each commit; if a foreign file leaks, `git reset --soft HEAD~1`, re-stage only your paths, recommit.
- **In-scope files that DO carry discardable WIP** (user-authorized to overwrite/delete this slice): `src/app/challenges/page.tsx` (rewritten in Task 6) and `src/components/challenge/ChallengeForm.tsx` (deleted in Task 6). Their uncommitted edits are intentionally discarded.
- **NO unit-test runner** in this repo (no vitest/jest). Do NOT add one. Each task's gate is: `npx tsc --noEmit` clean (no NEW errors — a pre-existing `src/components/Logo.tsx` TS2307 `@/app/favicon.ico` error may appear at baseline; ignore it) + `npm run build` succeeds. Task 6 additionally requires a **browser visual-match** with `NEXT_PUBLIC_USE_MOCKS=1` against `.event-app.html`.
- **Mock-first (REDESIGN §0/§4):** do NOT change the existing hook/`*Fn`/zod interfaces. The mock adapter is the only thing swapped for real endpoints. One zod schema per payload (all already exist in `src/types/challenge.ts`); validate every fixture in a dev assert (`Schema.parse(...)` at import).
- **New components:** Tailwind + CVA + Radix (shadcn new-york), `cn` from `@/utils/cn`, token classes only (`bg-card`, `border-border`, `text-muted-foreground`, `text-success`, `bg-primary`, etc.) — no hard-coded hex/slate. Do NOT introduce `@chakra-ui/*` into any new component; the challenges page must import no Chakra after Task 6.
- **YAGNI — real fields only.** Render ONLY `ChallengeInfoSchema` fields (`ID, Name, Points, Description, AttachedFiles, Solved`) and `TeamSolutionSchema` (`ID, Name, SolvedAt`). Do NOT add difficulty, hints, per-card solve count, tech-term highlighting, or a flag-format field.
- **uk copy** hardcoded inline (there is NO `t()` in this repo). **Code comments ENGLISH ONLY.**

---

### Task 1: Mock fixtures + adapter routes + `tabs` primitive

**Files:**
- Create: `src/api/mock/fixtures/challenges.ts`
- Modify: `src/api/mock/adapter.ts` (add routes + support function bodies)
- Create via shadcn CLI: `src/components/ui/tabs.tsx`
- Modify: `package.json` / `package-lock.json` (Radix tabs dep added by the CLI)

**Interfaces:**
- Consumes: `IResponse<T>` from `@/types/api`; `ChallengeCategoryInfoSchema`, `TeamSolutionSchema`, `SolveChallengeResultSchema`, `IChallengeInfoCategoryInfo`, `ITeamSolution` from `@/types/challenge`; `ITeam`/team schema from `@/types/team`.
- Produces: `challengesFixture: IResponse<IChallengeInfoCategoryInfo[]>`, `solvedByFixture: IResponse<ITeamSolution[]>`, `CORRECT_FLAGS: Record<string,string>` (challengeID → correct flag) and a `solveResult(config)` body; a `teamFixture: IResponse<ITeam>`; the shadcn `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` exports.

- [ ] **Step 1: Generate the `tabs` primitive via the shadcn CLI**

Run:
```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
npx shadcn@latest add tabs --yes --overwrite
```
Expected: `src/components/ui/tabs.tsx` created (exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`), `@radix-ui/react-tabs` added to `package.json`.
If the CLI can't run (offline/interactive), hand-create `src/components/ui/tabs.tsx` from the canonical shadcn new-york `tabs` source, importing `cn` from `@/utils/cn`, using token classes.
CLI side-effect guard: after it runs, `git status` — if the CLI rewrote `globals.css`/`tailwind.config.ts`/`components.json`, `git checkout -- <that file>` (theme files are owned by Slice 1). Your commit must not alter them.

- [ ] **Step 2: Read `src/types/team.ts` for the exact `ITeam` shape**

Run: `sed -n '1,60p' src/types/team.ts` — note the exported team schema name (e.g. `TeamSchema`/`ITeam`) and its required fields (it has at least `Name`). You need this to build a valid `teamFixture` whose `.parse()` passes.

- [ ] **Step 3: Write the fixtures**

`src/api/mock/fixtures/challenges.ts`:
```ts
import { z } from "zod"
import { IResponse } from "@/types/api"
import {
  ChallengeCategoryInfoSchema,
  TeamSolutionSchema,
  IChallengeInfoCategoryInfo,
  ITeamSolution,
} from "@/types/challenge"
// Import the actual team schema/type names you found in Step 2:
import { TeamSchema, ITeam } from "@/types/team"

// A stable UUID helper for fixtures (valid v4 shape; deterministic strings).
const uid = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`

// Correct flags per challenge ID — the mock /solve route checks against these.
export const CORRECT_FLAGS: Record<string, string> = {
  [uid("101")]: "CTF{ice_wall_breached}",
  [uid("102")]: "CTF{frostbite_injection}",
  [uid("201")]: "CTF{glacier_cipher_cracked}",
}

const categories: IChallengeInfoCategoryInfo[] = z
  .array(ChallengeCategoryInfoSchema)
  .parse([
    {
      ID: uid("1"),
      Name: "Web",
      Challenges: [
        { ID: uid("101"), Name: "IceWall", Points: 100, Solved: false,
          Description: "Пробий фаєрвол крижаної фортеці та дістань прапор із адмін-панелі.",
          AttachedFiles: [{ ID: uid("1011"), Name: "icewall.zip" }] },
        { ID: uid("102"), Name: "SQL Frostbite", Points: 250, Solved: true,
          Description: "База даних замерзла, але не захищена. Дістань облікові дані адміністратора.",
          AttachedFiles: [] },
      ],
    },
    {
      ID: uid("2"),
      Name: "Crypto",
      Challenges: [
        { ID: uid("201"), Name: "Glacier Cipher", Points: 400, Solved: false,
          Description: "Стародавній шифр, вкарбований у лід. Розшифруй повідомлення.",
          AttachedFiles: [{ ID: uid("2011"), Name: "cipher.txt" }] },
      ],
    },
  ])

export const challengesFixture: IResponse<IChallengeInfoCategoryInfo[]> = {
  Status: { Code: 200, Message: "OK" },
  Data: categories,
}

const solutions: ITeamSolution[] = z.array(TeamSolutionSchema).parse([
  { ID: uid("9001"), Name: "fr0sty", SolvedAt: new Date(Date.now() - 3600_000).toISOString() },
  { ID: uid("9002"), Name: "ice_wizard", SolvedAt: new Date(Date.now() - 1800_000).toISOString() },
])

export const solvedByFixture: IResponse<ITeamSolution[]> = {
  Status: { Code: 200, Message: "OK" },
  Data: solutions,
}

// Fill EVERY required field of the real team schema from Step 2.
export const teamFixture: IResponse<ITeam> = {
  Status: { Code: 200, Message: "OK" },
  Data: TeamSchema.parse({
    Name: "Frostbyte",
    // ...add the other required ITeam fields with representative values
  }),
}
```
Adjust `teamFixture`'s parsed object to satisfy the ACTUAL team schema you read in Step 2 (add every required field). The `.parse()` calls are the dev asserts.

- [ ] **Step 4: Extend the mock adapter to add routes and support function bodies**

In `src/api/mock/adapter.ts`, the `ROUTES` entries currently have a static `body: unknown`. Change the type to allow a function, and evaluate it per request; then add the four challenge routes. Replace the ROUTES array and the response construction:
```ts
import { AxiosInstance, AxiosAdapter, InternalAxiosRequestConfig } from "axios"
import axios from "axios"
import { eventInfoFixture } from "./fixtures/event"
import { notificationsFixture } from "./fixtures/notifications"
import { challengesFixture, solvedByFixture, teamFixture, CORRECT_FLAGS } from "./fixtures/challenges"
import { SolveChallengeSchema } from "@/types/challenge"

type Body = unknown | ((config: InternalAxiosRequestConfig) => unknown)
const ROUTES: { test: (url: string, method?: string) => boolean; body: Body }[] = [
  { test: (u) => u.includes("events/self/info"), body: eventInfoFixture },
  { test: (u) => u.includes("events/self/notifications"), body: notificationsFixture },
  { test: (u) => u.includes("events/self/challenges/info"), body: challengesFixture },
  { test: (u) => u.includes("/solvedBy"), body: solvedByFixture },
  // Match the team route but NOT its /vpn-config sub-path.
  { test: (u) => u.includes("events/self/teams/self") && !u.includes("vpn-config"), body: teamFixture },
  // POST /solve — compute Solved from the submitted flag vs the challenge's correct flag.
  { test: (u, m) => u.includes("/solve") && (m ?? "").toLowerCase() === "post",
    body: (config) => {
      const id = (config.url ?? "").split("/challenges/")[1]?.split("/solve")[0] ?? ""
      const parsed = SolveChallengeSchema.safeParse(
        typeof config.data === "string" ? JSON.parse(config.data) : config.data
      )
      const solution = parsed.success ? parsed.data.Solution : ""
      return { Status: { Code: 200, Message: "OK" }, Data: { Solved: CORRECT_FLAGS[id] === solution } }
    } },
]

export function installMockAdapter(api: AxiosInstance): void {
  if (process.env.NEXT_PUBLIC_USE_MOCKS !== "1") return
  const passthrough = axios.getAdapter(api.defaults.adapter)
  api.defaults.adapter = async (config) => {
    const url = (config.baseURL ?? "") + (config.url ?? "")
    const hit = ROUTES.find((r) => r.test(url, config.method))
    if (!hit) return passthrough(config)
    await new Promise((r) => setTimeout(r, 250))
    const body = typeof hit.body === "function" ? (hit.body as (c: typeof config) => unknown)(config) : hit.body
    return { data: body, status: 200, statusText: "OK", headers: {}, config, request: {} } as any
  }
}
```
Keep the existing two routes (info, notifications) exactly as they were; only ADD the four challenge routes and the function-body support. (The `axios.getAdapter` passthrough is already how the adapter reads after the Slice-1 final fix — preserve it.)

- [ ] **Step 5: Verify**

Run: `cd /Volumes/Projects/My/CyberICEBox/event-frontend && npx tsc --noEmit`  → no NEW errors (fixtures' `.parse()` type-check; adapter compiles).
Run: `npm run build`  → succeeds; the fixtures' `.parse()` runs at import without throwing.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/api/mock/fixtures/challenges.ts src/api/mock/adapter.ts src/components/ui/tabs.tsx package.json package-lock.json
git commit -m "feat(mock): challenges/solvedBy/solve/team fixtures + adapter routes + tabs primitive"
git show --stat HEAD   # only these files
```

---

### Task 2: `ChallengeCard` + category section (presentational leaves)

**Files:**
- Create: `src/components/event/challenges/ChallengeCard.tsx`
- Create: `src/components/event/challenges/ChallengeCategorySection.tsx`

**Interfaces:**
- Consumes: `IChallengeInfo`, `IChallengeInfoCategoryInfo` from `@/types/challenge`; `cn` from `@/utils/cn`.
- Produces: `ChallengeCard({ challenge, onOpen }: { challenge: IChallengeInfo; onOpen: (c: IChallengeInfo) => void })`; `ChallengeCategorySection({ category, onOpen }: { category: IChallengeInfoCategoryInfo; onOpen: (c: IChallengeInfo) => void })`.

**This task is VISUAL-MATCH.** Match `challengeCard` and the per-category section markup in `../ds-bundle/.event-app.html` (`pageChallenges`), using token classes. The interfaces and required structure below are the complete spec; fill the exact markup/classes to match the prototype.

- [ ] **Step 1: `ChallengeCard.tsx`**

`"use client"` not required (pure presentational, receives `onOpen`). Structure:
- A clickable card (`role="button"`, keyboard-accessible: `tabIndex={0}`, `onKeyDown` Enter/Space → `onOpen`) calling `onOpen(challenge)` on click.
- Rounded card with token classes. When `challenge.Solved`: green-tinted border + background (`border-success/40` + `bg-success/[0.07]` or equivalent token tint) and a "Вирішено" marker; otherwise `border-border bg-card`.
- Show `challenge.Name` (Geist sans, medium) and `challenge.Points` (e.g. a `Badge` or points label; use `font-mono` for the number — Geist Mono for numbers per REDESIGN §1).
- Do NOT render difficulty, hints, or a solve count (YAGNI — not in the schema).
Match the prototype's card proportions (`repeat(auto-fill,minmax(290px,1fr))` grid is applied by the section, gap ~14px).

- [ ] **Step 2: `ChallengeCategorySection.tsx`**

Structure (match the prototype `pageChallenges` section):
- A `<section>` with: a small colored bar (`bg-primary`, ~4px×18px, rounded), the category `category.Name` as an `<h2>` (fontSize ~15, bold), and a muted count "N завдання/завдань" (`text-muted-foreground`). Use a correct uk plural for the count word (inline helper; do NOT add an i18n lib).
- A responsive grid `grid` with `gridTemplateColumns: repeat(auto-fill, minmax(290px, 1fr))` (Tailwind arbitrary value or inline style), gap ~14px, mapping `category.Challenges` to `<ChallengeCard challenge={c} onOpen={onOpen} key={c.ID}/>`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`  → no NEW errors.
Run: `npm run build`  → succeeds.
(The board isn't mounted yet; standalone gate is tsc + build. Visual verified in Task 6.)

- [ ] **Step 4: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/components/event/challenges/ChallengeCard.tsx src/components/event/challenges/ChallengeCategorySection.tsx
git commit -m "feat(challenges): challenge card + category section (presentational)"
git show --stat HEAD
```

---

### Task 3: `FlagSubmit` + `ChallengeSolvedBy` (modal tab contents)

**Files:**
- Create: `src/components/event/challenges/FlagSubmit.tsx`
- Create: `src/components/event/challenges/ChallengeSolvedBy.tsx`

**Interfaces:**
- Consumes: `useChallenge` from `@/hooks/useChallenge` (`useSolveChallenge(id)` → `{ SolveChallenge, PendingSolveChallenge }`; `useChallengeSolvedBy(id)` → `{ ChallengeSolvedByResponse, ChallengeSolvedByRequest }`); `ISolveChallenge`, `ITeamSolution` from `@/types/challenge`; `Input`/`Button` from `@/components/ui/*`; `Spinner` from `@/components/ui/spinner`; `toast` from `react-hot-toast`.
- Produces: `FlagSubmit({ challengeID, solved, eventFinished }: { challengeID: string; solved: boolean; eventFinished: boolean })`; `ChallengeSolvedBy({ challengeID }: { challengeID: string })`.

- [ ] **Step 1: `FlagSubmit.tsx`**

```tsx
"use client"
import { useState } from "react"
import toast from "react-hot-toast"
import { useChallenge } from "@/hooks/useChallenge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function FlagSubmit({ challengeID, solved, eventFinished }:
  { challengeID: string; solved: boolean; eventFinished: boolean }) {
  const [flag, setFlag] = useState("")
  const { SolveChallenge, PendingSolveChallenge } = useChallenge().useSolveChallenge(challengeID)

  // Already solved — show the accepted state instead of an input.
  if (solved) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/[0.09] px-4 py-3 text-success">
        {/* check icon (lucide) */}
        <span className="text-sm font-semibold">Прапор уже прийнято — завдання вирішено вашою командою.</span>
      </div>
    )
  }

  // Event finished — submissions closed.
  if (eventFinished) {
    return (
      <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Відповіді більше не приймаються.
      </div>
    )
  }

  const submit = () => {
    const value = flag.trim()
    if (!value) return
    SolveChallenge(
      { Solution: value },
      {
        onSuccess: (res) => {
          const ok = res.data?.Data?.Solved
          if (ok) { toast.success("Прапор прийнято!"); setFlag("") }
          else toast.error("Невірний прапор")
        },
        onError: () => toast.error("Помилка надсилання прапора"),
      }
    )
  }

  return (
    <div className="flex gap-2">
      <Input
        value={flag}
        onChange={(e) => setFlag(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit() }}
        placeholder="CTF{...}"
        className="font-mono"
        disabled={PendingSolveChallenge}
      />
      <Button onClick={submit} disabled={PendingSolveChallenge || !flag.trim()}>
        Здати
      </Button>
    </div>
  )
}
```
(Confirm the `useSolveChallenge` mutate signature: `SolveChallenge(data, { onSuccess, onError })` where `onSuccess` receives the axios response and `res.data.Data.Solved` is the result. If the hook's response shape differs, read `src/hooks/useChallenge.ts` and adapt the `res.data?.Data?.Solved` access accordingly — do NOT change the hook.)

- [ ] **Step 2: `ChallengeSolvedBy.tsx`**

```tsx
"use client"
import { useChallenge } from "@/hooks/useChallenge"
import { Spinner } from "@/components/ui/spinner"

export function ChallengeSolvedBy({ challengeID }: { challengeID: string }) {
  const { ChallengeSolvedByResponse, ChallengeSolvedByRequest } =
    useChallenge().useChallengeSolvedBy(challengeID)
  const solutions = ChallengeSolvedByResponse?.Data ?? []

  if (ChallengeSolvedByRequest.isLoading)
    return <div className="flex justify-center py-6"><Spinner size="sm" className="text-primary" /></div>
  if (!solutions.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">Ще ніхто не розв'язав це завдання.</p>

  return (
    <ul className="flex flex-col divide-y divide-border">
      {solutions.map((s) => (
        <li key={s.ID} className="flex items-center justify-between py-2.5">
          <span className="text-sm font-medium text-foreground">{s.Name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {new Date(s.SolvedAt).toLocaleString("uk-UA")}
          </span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`  → no NEW errors.
Run: `npm run build`  → succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/components/event/challenges/FlagSubmit.tsx src/components/event/challenges/ChallengeSolvedBy.tsx
git commit -m "feat(challenges): flag submit + solved-by tab content"
git show --stat HEAD
```

---

### Task 4: `ChallengeModal` (Dialog + tabs)

**Files:**
- Create: `src/components/event/challenges/ChallengeModal.tsx`

**Interfaces:**
- Consumes: `IChallengeInfo` from `@/types/challenge`; `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` from `@/components/ui/dialog`; `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `@/components/ui/tabs`; `Badge` from `@/components/ui/badge`; `FlagSubmit` (Task 3), `ChallengeSolvedBy` (Task 3).
- Produces: `ChallengeModal({ challenge, categoryName, eventFinished, open, onOpenChange }: { challenge: IChallengeInfo | null; categoryName?: string; eventFinished: boolean; open: boolean; onOpenChange: (o: boolean) => void })`.

**This task is VISUAL-MATCH.** Match `challengeBody` in `.event-app.html`, minus the dropped features (no highlightDesc, no hints, no format hint). Structure:

- [ ] **Step 1: `ChallengeModal.tsx`**

`"use client"`. Structure:
- `<Dialog open={open} onOpenChange={onOpenChange}>` with `<DialogContent>` (max width ~640px). Render nothing meaningful when `challenge` is null (guard: `if (!challenge) return null` INSIDE the Dialog is wrong — instead render the Dialog but gate the body; simplest: `if (!challenge) return null` at the top and let the parent control `open`). Prefer: early-return `null` when `!challenge`.
- `<DialogHeader>`: `<DialogTitle>` = `challenge.Name`; a row with `categoryName` (muted) · `challenge.Points` (`Badge`, `font-mono`) · a solved `Badge` (green, "Вирішено") when `challenge.Solved`.
- `<Tabs defaultValue="task">`:
  - `<TabsList>`: `<TabsTrigger value="task">Завдання</TabsTrigger>` `<TabsTrigger value="solved">Розв'язали</TabsTrigger>`.
  - `<TabsContent value="task">`:
    - `challenge.Description` as a plain paragraph (`text-sm leading-relaxed` — NO term highlighting).
    - If `challenge.AttachedFiles.length`: a "Прикріплені файли" label + a list of files, each a row (lucide `File` icon + `file.Name` + a download affordance / `Download` icon). These are placeholder anchors (`href="#"` or a real download URL if one becomes available later) — do not fabricate a download endpoint.
    - "Здати прапор" label + `<FlagSubmit challengeID={challenge.ID} solved={challenge.Solved} eventFinished={eventFinished} />`.
  - `<TabsContent value="solved">`: `<ChallengeSolvedBy challengeID={challenge.ID} />`.
Use token classes throughout; match the prototype's spacing/labels (`mLabel`-style section labels → a small uppercase muted label component or inline `text-xs font-semibold uppercase text-muted-foreground`).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`  → no NEW errors.
Run: `npm run build`  → succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/components/event/challenges/ChallengeModal.tsx
git commit -m "feat(challenges): challenge modal (dialog + tabs Завдання/Розв'язали)"
git show --stat HEAD
```

---

### Task 5: Gates + `ChallengesBoard` orchestrator

**Files:**
- Create: `src/components/event/challenges/ChallengesBoard.tsx`

**Interfaces:**
- Consumes: `useEvent` from `@/hooks/useEvent` (`useGetEventInfo()` → `{ GetEventInfoResponse, GetEventInfoRequest }`, `GetEventInfoResponse?.Data.{StartTime,FinishTime,Participation}`); `useTeam` from `@/hooks/useTeam` (`useGetTeam()` → `{ GetTeamResponse, GetTeamRequest }`, `GetTeamResponse?.Data.Name`); `useChallenge` (`useGetChallenges(enabled)` → `{ GetChallengesResponse, GetChallengesRequest }`, `GetChallengesResponse?.Data` = `IChallengeInfoCategoryInfo[]`); `ParticipationTypeEnum` from `@/types/event`; `CountdownTimer` from `@/components/Countdown`; `Spinner` from `@/components/ui/spinner`; `Button` from `@/components/ui/button`; `Link` from `next/link`; `ChallengeCategorySection` (Task 2), `ChallengeModal` (Task 4); `IChallengeInfo`, `IChallengeInfoCategoryInfo` from `@/types/challenge`.
- Produces: `ChallengesBoard()` (default or named export) — the full gated board; consumed by `challenges/page.tsx` (Task 6).

- [ ] **Step 1: `ChallengesBoard.tsx`**

`"use client"`. Logic (match spec §"Gating / state flow"):
```tsx
"use client"
import { useState } from "react"
import Link from "next/link"
import { useEvent } from "@/hooks/useEvent"
import { useTeam } from "@/hooks/useTeam"
import { useChallenge } from "@/hooks/useChallenge"
import { ParticipationTypeEnum } from "@/types/event"
import { CountdownTimer } from "@/components/Countdown"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ChallengeCategorySection } from "./ChallengeCategorySection"
import { ChallengeModal } from "./ChallengeModal"
import { IChallengeInfo, IChallengeInfoCategoryInfo } from "@/types/challenge"

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>
}

export function ChallengesBoard() {
  const [selected, setSelected] = useState<IChallengeInfo | null>(null)
  const { GetEventInfoResponse, GetEventInfoRequest } = useEvent().useGetEventInfo()
  const event = GetEventInfoResponse?.Data
  const now = Date.now()
  const started = !!event && new Date(event.StartTime).getTime() <= now
  const finished = !!event && new Date(event.FinishTime).getTime() < now
  const needsTeam = event?.Participation === ParticipationTypeEnum.Team

  const { GetTeamResponse, GetTeamRequest } = useTeam().useGetTeam()
  const hasTeam = GetTeamRequest.isSuccess && !!GetTeamResponse?.Data?.Name

  // Enable the challenges query only once the gates would let the board render.
  const canLoad = started && (!needsTeam || hasTeam)
  const { GetChallengesResponse, GetChallengesRequest } = useChallenge().useGetChallenges(canLoad)
  const categories: IChallengeInfoCategoryInfo[] = GetChallengesResponse?.Data ?? []

  // 1. Event loading.
  if (GetEventInfoRequest.isLoading || !event)
    return <Centered><Spinner size="md" className="text-primary" /></Centered>

  // 2. Before start.
  if (!started)
    return (
      <Centered>
        <CountdownTimer text="Завдання стануть доступні через" until={new Date(event.StartTime)} />
      </Centered>
    )

  // 3. Team required but no team (only for Team participation).
  if (needsTeam && !hasTeam) {
    if (GetTeamRequest.isLoading)
      return <Centered><Spinner size="md" className="text-primary" /></Centered>
    return (
      <Centered>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium text-foreground">Приєднайтесь до команди</p>
          <p className="mt-1 text-sm text-muted-foreground">Завдання доступні лише учасникам команди.</p>
          <Button asChild className="mt-4"><Link href="/cabinet">Кабінет команди</Link></Button>
        </div>
      </Centered>
    )
  }

  // 4. Board states.
  if (GetChallengesRequest.isLoading)
    return <Centered><Spinner size="md" className="text-primary" /></Centered>
  if (GetChallengesRequest.isError)
    return <Centered><p className="text-sm text-destructive">Не вдалося завантажити завдання.</p></Centered>
  if (!categories.length)
    return <Centered><p className="text-sm text-muted-foreground">Завдань поки немає.</p></Centered>

  return (
    <>
      <div className="mx-auto w-full max-w-screen-2xl">
        {categories.map((cat) => (
          <ChallengeCategorySection key={cat.ID} category={cat} onOpen={setSelected} />
        ))}
      </div>
      <ChallengeModal
        challenge={selected}
        categoryName={categories.find((c) => c.Challenges.some((ch) => ch.ID === selected?.ID))?.Name}
        eventFinished={finished}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null) }}
      />
    </>
  )
}
```
Verify the exact hook return-property names against `src/hooks/useChallenge.ts`, `src/hooks/useTeam.ts`, `src/hooks/useEvent.ts` before finalizing (they are: `GetChallengesResponse`/`GetChallengesRequest`, `GetTeamResponse`/`GetTeamRequest`, `GetEventInfoResponse`/`GetEventInfoRequest`). Do NOT change the hooks.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`  → no NEW errors.
Run: `npm run build`  → succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/components/event/challenges/ChallengesBoard.tsx
git commit -m "feat(challenges): board orchestrator + event/team gates + states"
git show --stat HEAD
```

---

### Task 6: Wire the page + delete old Chakra components (browser visual-match)

**Files:**
- Modify (rewrite): `src/app/challenges/page.tsx`
- Delete: `src/components/challenge/ChallengesView.tsx`, `src/components/challenge/ChallengeModal.tsx`, `src/components/challenge/ChallengeTile.tsx`, `src/components/challenge/ChallengeForm.tsx`, `src/components/challenge/ChallengeSolvesTable.tsx`

**Interfaces:**
- Consumes: `ChallengesBoard` (Task 5).
- Produces: the live `/challenges` route rendering the new board inside the AppShell.

- [ ] **Step 1: Rewrite `src/app/challenges/page.tsx`**

```tsx
import { ChallengesBoard } from "@/components/event/challenges/ChallengesBoard"

export default function ChallengesPage() {
  return <ChallengesBoard />
}
```
(The AppShell wraps every route via `layout.tsx` from Slice 2, so the board renders inside the shell automatically. This overwrites the file's uncommitted foreign WIP — intentional per Global Constraints.)

- [ ] **Step 2: Confirm the old components have no remaining importers, then delete them**

Run: `cd /Volumes/Projects/My/CyberICEBox/event-frontend && grep -rn "components/challenge/ChallengesView\|components/challenge/ChallengeModal\|components/challenge/ChallengeTile\|components/challenge/ChallengeForm\|components/challenge/ChallengeSolvesTable" src`
Expected: NO results (the rewrite in Step 1 removed the only external importer; the five files only imported each other). If any OTHER file still imports one, stop and report — do not delete a still-referenced component.
Then delete:
```bash
git rm src/components/challenge/ChallengesView.tsx src/components/challenge/ChallengeModal.tsx src/components/challenge/ChallengeTile.tsx src/components/challenge/ChallengeForm.tsx src/components/challenge/ChallengeSolvesTable.tsx
```
(Deleting `ChallengeForm.tsx` discards its uncommitted foreign WIP too — intentional per Global Constraints.)

- [ ] **Step 3: Confirm no Chakra on the challenges page**

Run: `grep -rn "@chakra-ui" src/app/challenges src/components/event/challenges` → expect NO results. If a new component pulled Chakra, replace that usage with a token/shadcn equivalent.

- [ ] **Step 4: Verify (tsc + build)**

Run: `npx tsc --noEmit`  → no NEW errors (deleting the old components must not leave a dangling import; if `grep` in Step 2 was clean, this passes).
Run: `npm run build`  → succeeds; `/challenges` route present.

- [ ] **Step 5: Browser visual-match**

Run: `NEXT_PUBLIC_USE_MOCKS=1 npm run dev`, open `/challenges`, and verify against `../ds-bundle/.event-app.html`:
- Board groups challenges by category (Web / Crypto …) with a colored bar + count; solved cards (SQL Frostbite) show the green tint.
- Clicking a card opens the modal; tabs switch Завдання ↔ Розв'язали; the Розв'язали tab lists team solutions; attached files are listed with a download affordance.
- Submitting the correct flag for a challenge (e.g. `CTF{ice_wall_breached}` for IceWall) shows a success toast and flips it to solved (react-query invalidation); a wrong flag shows an error toast.
- The board renders inside the AppShell (top-band + sidebar).
If you cannot drive a browser, say so and state exactly what you verified instead (e.g. curl the dev route, confirm 200 + board markup). Do NOT claim a visual pass you did not perform.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/Projects/My/CyberICEBox/event-frontend
git add src/app/challenges/page.tsx
git commit -m "feat(challenges): wire redesigned board into /challenges, retire old Chakra components"
git show --stat HEAD   # only challenges/page.tsx + the 5 deletions — NOT scoreboard/page.tsx or other foreign WIP
```

---

## Self-Review (writing-plans)

1. **Spec coverage:** fixtures+adapter routes+tabs → Task 1; card+category (solved tint, YAGNI fields) → Task 2; flag submit + solved-by → Task 3; modal (Dialog + tabs, no highlight/hints/format) → Task 4; gates + board orchestrator (before-start/no-team/loading/empty/error/after-finish, local modal state) → Task 5; page wiring + old-component deletion + Chakra-free + browser visual-match → Task 6. Data-layer reuse (no interface changes), mock-first, uk-inline/English-comments, token-only, foreign-WIP discipline all in Global Constraints. All spec sections covered.
2. **Placeholder scan:** the only "placeholder" is the intentional file-download `href="#"` (no download endpoint exists yet — a deliberate deferral, flagged) and the no-team CTA linking to `/cabinet` (the real create/join flow is the cabinet slice). Deterministic parts (fixtures, adapter, FlagSubmit, ChallengeSolvedBy, board gating, page wiring, deletions) carry full code; the two pure-visual components (card, modal body) give structure + interfaces + prototype reference, which is the complete instruction for a visual-match task (same convention as the Slice-2 shell plan). No TBD/TODO.
3. **Type consistency:** `IChallengeInfo`/`IChallengeInfoCategoryInfo`/`ITeamSolution`/`ISolveChallenge`, `challengesFixture`/`solvedByFixture`/`teamFixture`/`CORRECT_FLAGS`, `ChallengeCard`/`ChallengeCategorySection`/`FlagSubmit`/`ChallengeSolvedBy`/`ChallengeModal`/`ChallengesBoard`, and the hook return props (`GetChallengesResponse`/`GetChallengesRequest`, `GetTeamResponse`/`GetTeamRequest`, `GetEventInfoResponse`/`GetEventInfoRequest`) are used consistently across tasks. `onOpen: (c: IChallengeInfo) => void` and the `ChallengeModal` props match between producer (Task 2/4) and consumer (Task 5). NOTE for the implementer: verify the exact `useSolveChallenge` mutate/response shape and team schema name in `src/types/team.ts` before finalizing Tasks 1/3 (both flagged in-task).
