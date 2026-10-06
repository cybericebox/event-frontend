# Event Frontend — Foundation + Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the redesigned event-frontend skeleton — Indigo-Frost theme, base UI primitives, ice-cube loader, mock data layer, and the App shell (top-band + sidebar + popovers) wired into `layout.tsx` with a navigable routing skeleton of placeholder pages.

**Architecture:** shadcn new-york primitives (Tailwind v3 + CVA + Radix, `cn` from `@/utils/cn`) under `src/components/ui/`; shell blocks under `src/components/event/`; mock-first data via an axios adapter on `baseAPI` gated by `NEXT_PUBLIC_USE_MOCKS=1`, returning zod-validated fixtures shaped as `IResponse<T>`. Later sub-projects fill page bodies into the shell.

**Tech Stack:** Next 15.4 App Router, React 18, Tailwind v3 (shadcn HSL tokens), TypeScript strict, zod 3, @tanstack/react-query 5, axios, Radix, CVA, lucide-react, Geist fonts.

**Spec:** `docs/superpowers/specs/2026-07-13-event-foundation-shell-design.md`. **Master:** `REDESIGN.md`. **Visual reference:** `../ds-bundle/.event-app.html`.

## Global Constraints

- **Branch `redesign/event-frontend`.** The working tree has PRE-EXISTING unrelated modifications (deploy/Dockerfile, src/api/challengeAPI.ts, src/app/challenges/page.tsx, src/app/scoreboard/page.tsx, CopyToClipboardButtonWIthToast.tsx). NEVER `git add -A`/`.`/`-u`. Stage ONLY each task's own paths; `git show --stat HEAD` after each commit to confirm; if a foreign file leaks, `git reset --soft HEAD~1`, re-stage only your paths, recommit.
- **NO unit-test runner** in this repo (no vitest/jest). Do NOT add one. Each task's gate is: `npx tsc --noEmit` clean for touched files + `npm run build` succeeds; shell/theme/loader/routing tasks additionally require a **browser visual check** with `NEXT_PUBLIC_USE_MOCKS=1` against `.event-app.html`.
- **Mock-first (REDESIGN §0/§4):** keep `*Fn` names/signatures stable; hooks use react-query with zod `safeParse` in `select`; the mock adapter is the only thing swapped for real endpoints later.
- **New components:** Tailwind + CVA + Radix (shadcn new-york), `cn` from `@/utils/cn`. Do NOT remove Chakra (`@chakra-ui/*`) in this slice — it stays for not-yet-migrated pages.
- **Theme = Indigo-Frost** (REDESIGN §1) — light `:root` + mirrored `.dark`. Keep the crest logo (`Logo.tsx`); no IceMark.
- **uk copy** via existing JSON-lookup `t()` only (no i18n lib); tone mature-CTF; naming Учасники/Команди.
- **Code comments ENGLISH ONLY.**
- One zod schema per payload in `types/*.ts`; validate every fixture in a dev assert.

---

### Task 1: Indigo-Frost theme + Geist fonts

**Files:**
- Modify: `src/app/globals.css` (replace the `:root`/`.dark` token blocks)
- Modify: `src/app/layout.tsx` (wire Geist fonts to `<html>`/`<body>` — font vars only; shell wiring is Task 6)
- Modify: `tailwind.config.ts` (map `--font-geist-sans`/`--font-geist-mono` to `fontFamily` if not already)
- Modify: `package.json` (add `geist`)

**Interfaces:**
- Produces: CSS custom properties `--background --foreground --card --primary --secondary --muted --accent --destructive --border --input --ring --cyan --radius --success --warning` (HSL triplets) consumed by every primitive and shell component; `--font-geist-sans`/`--font-geist-mono` font vars.

- [ ] **Step 1: Install Geist**

Run: `cd event-frontend && npm install geist`
Expected: `geist` added to dependencies.

- [ ] **Step 2: Replace the token blocks in `src/app/globals.css`**

Set `:root` to exactly the Indigo-Frost tokens (from REDESIGN §1), and mirror them in `.dark` (same values are acceptable for this light-first slice — REDESIGN ships light):

```css
:root {
  --background: 207 77% 95%;
  --foreground: 230 65% 12%;
  --card: 0 0% 100%;
  --card-foreground: 230 65% 12%;
  --popover: 0 0% 100%;
  --popover-foreground: 230 65% 12%;
  --primary: 231 56% 27%;
  --primary-foreground: 0 0% 100%;
  --secondary: 210 82% 91%;
  --secondary-foreground: 225 61% 18%;
  --muted: 208 74% 93%;
  --muted-foreground: 212 30% 38%;
  --accent: 209 85% 90%;
  --accent-foreground: 203 83% 16%;
  --destructive: 347 77% 50%;
  --destructive-foreground: 0 0% 100%;
  --border: 207 59% 82%;
  --input: 206 56% 78%;
  --ring: 203 100% 46%;
  --cyan: 203 100% 46%;
  --radius: 0.75rem;
  --success: 152 60% 40%;
  --warning: 38 92% 55%;
}
.dark { /* mirror the same tokens for now — light-first slice */
  --background: 207 77% 95%; --foreground: 230 65% 12%; --card: 0 0% 100%;
  --card-foreground: 230 65% 12%; --popover: 0 0% 100%; --popover-foreground: 230 65% 12%;
  --primary: 231 56% 27%; --primary-foreground: 0 0% 100%; --secondary: 210 82% 91%;
  --secondary-foreground: 225 61% 18%; --muted: 208 74% 93%; --muted-foreground: 212 30% 38%;
  --accent: 209 85% 90%; --accent-foreground: 203 83% 16%; --destructive: 347 77% 50%;
  --destructive-foreground: 0 0% 100%; --border: 207 59% 82%; --input: 206 56% 78%;
  --ring: 203 100% 46%; --cyan: 203 100% 46%; --radius: 0.75rem; --success: 152 60% 40%;
  --warning: 38 92% 55%;
}
```

Keep the existing `@tailwind base/components/utilities` directives and any `@layer base { * { @apply border-border } body { @apply bg-background text-foreground } }` block; if that base block is missing, add it so the tokens actually paint.

- [ ] **Step 3: Wire Geist fonts in `src/app/layout.tsx`**

In `layout.tsx`, import and apply the font CSS variables on `<html>` (do NOT change the providers/children structure yet — that is Task 6):

```tsx
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
// ...
<html lang="uk" className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

- [ ] **Step 4: Map fonts in `tailwind.config.ts`**

Ensure `theme.extend.fontFamily` maps `sans: ["var(--font-geist-sans)", ...]` and `mono: ["var(--font-geist-mono)", ...]`, and that `theme.extend.colors` references the HSL vars via `hsl(var(--…))` for `background/foreground/primary/secondary/muted/accent/destructive/border/input/ring/card/popover` plus `cyan/success/warning` (standard shadcn Tailwind mapping). If the config already has the shadcn color mapping, only add `cyan/success/warning` and the Geist font families.

- [ ] **Step 5: Verify**

Run: `cd event-frontend && npx tsc --noEmit`  → no new errors.
Run: `cd event-frontend && npm run build`  → succeeds.
Browser: `NEXT_PUBLIC_USE_MOCKS=1 npm run dev` → the page background is the pale Indigo-Frost blue and text uses Geist (visually confirm; full shell comes later).

- [ ] **Step 6: Commit**

```bash
cd event-frontend
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts package.json package-lock.json
git commit -m "feat(theme): Indigo-Frost tokens + Geist fonts"
git show --stat HEAD   # only these files
```

---

### Task 2: Base UI primitives (shadcn new-york)

**Files:**
- Create via shadcn CLI: `src/components/ui/{input,card,badge,table,dialog,dropdown-menu,toggle,avatar,popover,separator}.tsx`
- Modify: `src/components/ui/button.tsx` (already exists — confirm it uses the token palette)
- Modify: `package.json` (Radix deps added by the CLI)

**Interfaces:**
- Produces: the standard shadcn exports used by the shell and later pages — `Button`, `Input`, `Card`/`CardHeader`/`CardContent`/`CardFooter`/`CardTitle`/`CardDescription`, `Badge`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`, `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuSeparator`, `Toggle`, `Avatar`/`AvatarImage`/`AvatarFallback`, `Popover`/`PopoverTrigger`/`PopoverContent`, `Separator`.

- [ ] **Step 1: Generate the primitives via the shadcn CLI**

The repo is already shadcn-configured (`components.json`, style new-york, `@/utils/cn`). Generate the canonical primitives (do NOT hand-write them — the CLI installs the correct Radix deps and token-based styles):

Run:
```bash
cd event-frontend
npx shadcn@latest add input card badge table dialog dropdown-menu toggle avatar popover separator --yes --overwrite
```
Expected: the 10 files created under `src/components/ui/`, and Radix packages (`@radix-ui/react-dialog`, `-dropdown-menu`, `-avatar`, `-popover`, `-separator`, `-toggle`, etc.) added to `package.json`.

If the CLI cannot run (offline/interactive prompt), hand-create each from the shadcn new-york source at https://ui.shadcn.com, using `cn` from `@/utils/cn` and the token classes (`bg-primary text-primary-foreground`, `border-input`, etc.). Do not deviate from the canonical component API.

- [ ] **Step 2: Confirm `button.tsx` uses the token palette**

Open `src/components/ui/button.tsx`; ensure its variants use `bg-primary text-primary-foreground`, `border-input`, `bg-secondary`, `bg-destructive`, `hover:bg-primary/90`, `ring-ring`, `rounded-md` (radius token) — i.e. the same token classes shadcn uses. If it hard-codes non-token colors (e.g. slate), replace them with the token equivalents. No API change.

- [ ] **Step 3: Verify**

Run: `cd event-frontend && npx tsc --noEmit`  → no new errors (all primitives compile, imports resolve).
Run: `cd event-frontend && npm run build`  → succeeds.

- [ ] **Step 4: Commit**

```bash
cd event-frontend
git add src/components/ui/*.tsx package.json package-lock.json
git commit -m "feat(ui): shadcn base primitives (button/input/card/badge/table/dialog/dropdown/toggle/avatar/popover/separator)"
git show --stat HEAD   # only ui primitives + package files
```

---

### Task 3: Ice-cube Spinner adoption

**Files:**
- Create: `src/components/ui/spinner.tsx` (copied verbatim from admin-frontend)
- Create: `src/components/ui/spinner.css` (copied verbatim from admin-frontend)
- Modify: call sites of the old `src/components/Loader.tsx` (replace with `Spinner`/`PageLoader`)
- Delete: `src/components/Loader.tsx` (once no importers remain)

**Interfaces:**
- Consumes: the canonical `spinner.tsx` from admin-frontend.
- Produces: `Spinner({ size?: "sm"|"md"|"lg"; label?: string; className?: string })` and `PageLoader({ label?: string })` — the platform ice-cube loader.

- [ ] **Step 1: Copy both files verbatim from admin-frontend**

Run:
```bash
cd /Volumes/Projects/My/CyberICEBox
cp admin-frontend/src/components/ui/spinner.css event-frontend/src/components/ui/spinner.css
cp admin-frontend/src/components/ui/spinner.tsx event-frontend/src/components/ui/spinner.tsx
diff admin-frontend/src/components/ui/spinner.tsx event-frontend/src/components/ui/spinner.tsx && diff admin-frontend/src/components/ui/spinner.css event-frontend/src/components/ui/spinner.css && echo IDENTICAL
```
Both apps import `cn` from `@/utils/cn`, so the copy is byte-identical. Expected: `IDENTICAL`.

- [ ] **Step 2: Replace `Loader.tsx` usages**

Run: `cd event-frontend && grep -rn "components/Loader" src` to list importers. For each, replace `import Loader from "@/components/Loader"` + `<Loader/>` with `import { PageLoader } from "@/components/ui/spinner"` + `<PageLoader/>` (for full-screen loaders) or `import { Spinner } from "@/components/ui/spinner"` + `<Spinner size="md" className="text-primary" />` (for inline). Match the old size intent (a big centered loader → `PageLoader`; a small inline one → `Spinner size="sm"`).

- [ ] **Step 3: Delete the old Loader once unused**

Run: `cd event-frontend && grep -rn "components/Loader" src` → expect no results, then `git rm src/components/Loader.tsx`.

- [ ] **Step 4: Verify**

Run: `cd event-frontend && npx tsc --noEmit`  → no new errors.
Run: `cd event-frontend && npm run build`  → succeeds.
Browser (`NEXT_PUBLIC_USE_MOCKS=1 npm run dev`): a route that previously showed the loader now shows the ice cube; confirm it animates and its color reads against the Indigo-Frost background. Note in the report that Tailwind v3's `@layer components` still lets utilities override the `.ice-loader` default (`text-primary` on the SetupScreen-style call works).

- [ ] **Step 5: Commit**

```bash
cd event-frontend
git add src/components/ui/spinner.tsx src/components/ui/spinner.css <the call-site files you edited>
git rm src/components/Loader.tsx   # if not already staged by the delete
git commit -m "feat(ui): adopt shared ice-cube Spinner, retire Loader"
git show --stat HEAD
```

---

### Task 4: Mock data layer

**Files:**
- Create: `src/api/mock/adapter.ts` (mock axios adapter + flag)
- Create: `src/api/mock/fixtures/event.ts` (event-info fixture)
- Create: `src/api/mock/fixtures/notifications.ts` (notifications fixture + schema if missing)
- Modify: `src/api/baseAPI.ts` (install the adapter when the flag is on)
- Create (if missing): `src/types/notification.ts` (zod schema for an announcement)

**Interfaces:**
- Consumes: `baseAPI` (axios instance, `baseURL: "/api"`), `IResponse<T>` from `@/types/api`, `IEventInfo` from `@/types/event`.
- Produces: `installMockAdapter(api: AxiosInstance): void` (no-op unless `NEXT_PUBLIC_USE_MOCKS === "1"`); a route→fixture map returning `IResponse<T>`-shaped bodies; `eventInfoFixture: IResponse<IEventInfo>`; `notificationsFixture: IResponse<INotification[]>`; `NotificationSchema`/`INotification`.

- [ ] **Step 1: Notification schema (if none exists)**

`src/types/notification.ts`:
```ts
import { z } from "zod"
export const NotificationSchema = z.object({
  ID: z.string(),
  Title: z.string(),
  Body: z.string(),
  CreatedAt: z.coerce.date(),
  Read: z.boolean().default(false),
})
export interface INotification extends z.infer<typeof NotificationSchema> {}
```
(If a notification/announcement schema already exists in `types/*.ts`, import and reuse it instead — do not duplicate.)

- [ ] **Step 2: Fixtures shaped as `IResponse<T>`, validated by zod in a dev assert**

`src/api/mock/fixtures/event.ts`:
```ts
import { IResponse } from "@/types/api"
import { EventInfoSchema, IEventInfo } from "@/types/event" // use the actual exported schema name from types/event.ts
const data: IEventInfo = EventInfoSchema.parse({
  Name: "Winter Arena",
  Picture: "",
  StartTime: new Date(Date.now() - 3600_000).toISOString(),
  FinishTime: new Date(Date.now() + 6 * 3600_000).toISOString(),
  // ...fill every required field of EventInfoSchema with representative values that mirror .event-app.html
})
export const eventInfoFixture: IResponse<IEventInfo> = { Data: data /*, mirror IResponse's other fields */ }
```
Adjust the parsed object to satisfy the ACTUAL `EventInfoSchema` in `src/types/event.ts` (read it first — it has `Name/Picture/StartTime/FinishTime/TeamName` and more). The `.parse()` call is the dev assert: an invalid fixture throws at import in dev.

`src/api/mock/fixtures/notifications.ts`:
```ts
import { IResponse } from "@/types/api"
import { NotificationSchema, INotification } from "@/types/notification"
const list: INotification[] = z.array(NotificationSchema).parse([
  { ID: "n1", Title: "Змагання розпочато", Body: "Успіхів!", CreatedAt: new Date().toISOString(), Read: false },
]) // import { z } from "zod"
export const notificationsFixture: IResponse<INotification[]> = { Data: list }
```

- [ ] **Step 3: Mock adapter**

`src/api/mock/adapter.ts`:
```ts
import { AxiosInstance, AxiosAdapter } from "axios"
import { eventInfoFixture } from "./fixtures/event"
import { notificationsFixture } from "./fixtures/notifications"

// Route (method + path suffix) → fixture body. Extend as later pages add fixtures.
const ROUTES: { test: (url: string, method?: string) => boolean; body: unknown }[] = [
  { test: (u) => u.includes("events/self/info"), body: eventInfoFixture },
  { test: (u) => u.includes("events/self/notifications"), body: notificationsFixture },
]

// Install a mock adapter that resolves fixtures with a small latency when the flag is on.
export function installMockAdapter(api: AxiosInstance): void {
  if (process.env.NEXT_PUBLIC_USE_MOCKS !== "1") return
  const passthrough = api.defaults.adapter as AxiosAdapter
  api.defaults.adapter = async (config) => {
    const url = (config.baseURL ?? "") + (config.url ?? "")
    const hit = ROUTES.find((r) => r.test(url, config.method))
    if (!hit) return passthrough(config) // unmocked routes fall through to real /api
    await new Promise((r) => setTimeout(r, 250))
    return { data: hit.body, status: 200, statusText: "OK", headers: {}, config, request: {} } as any
  }
}
```
Confirm the actual event-info request path in `src/api/eventAPI.ts` (`getEventInfoFn` → adjust the `test` matcher to that exact path). Add a notifications `*Fn`/path if none exists yet (thin GET to `events/self/notifications`).

- [ ] **Step 4: Install the adapter on `baseAPI`**

In `src/api/baseAPI.ts`, after `export const baseAPI = axios.create({ baseURL: "/api", ... })`, add:
```ts
import { installMockAdapter } from "@/api/mock/adapter"
installMockAdapter(baseAPI)
```

- [ ] **Step 5: Verify**

Run: `cd event-frontend && npx tsc --noEmit`  → no new errors.
Run: `cd event-frontend && npm run build`  → succeeds.
Browser: with `NEXT_PUBLIC_USE_MOCKS=1`, a component calling `getEventInfoFn` receives the fixture (verify once the shell is wired in Task 5/6); with the flag off, requests still hit `/api`. The zod `.parse()` in the fixtures throws loudly if a fixture is malformed.

- [ ] **Step 6: Commit**

```bash
cd event-frontend
git add src/api/mock src/api/baseAPI.ts src/types/notification.ts
git commit -m "feat(mock): axios mock adapter + event/notifications fixtures behind NEXT_PUBLIC_USE_MOCKS"
git show --stat HEAD
```

---

### Task 5: App shell (top-band + sidebar + popovers)

**Files:**
- Create: `src/components/event/AppShell.tsx`
- Create: `src/components/event/TopBand.tsx`
- Create: `src/components/event/Sidebar.tsx`
- Create: `src/components/event/NotificationsPopover.tsx`
- Create: `src/components/event/AvatarMenu.tsx`
- Create: `src/components/event/nav.ts` (nav item config)

**Interfaces:**
- Consumes: primitives from Task 2 (`Button`, `Popover*`, `Avatar*`, `Badge`, `Separator`, `DropdownMenu*`), `Spinner` (Task 3), the event-info + notifications hooks/`*Fn` reading mock fixtures (Task 4), `Logo` (`@/components/Logo`), `t()` (existing i18n lookup), `Countdown` (`@/components/Countdown`, existing).
- Produces: `AppShell({ children }: { children: React.ReactNode })` — renders the top-band and sidebar around `children`; used by `layout.tsx` (Task 6). `NAV_ITEMS` (label + href + icon) exported from `nav.ts`.

**This task is VISUAL-MATCH.** Build the shell to look like `../ds-bundle/.event-app.html` (open it and REDESIGN §2). Use the primitives and the token classes; do not invent a different layout. The code below is the required STRUCTURE and interfaces; fill the exact markup/classes to match the prototype.

- [ ] **Step 1: Nav config**

`src/components/event/nav.ts` — the flat participant nav (REDESIGN §2), labels via `t()` keys, lucide icons:
```ts
import { ListChecks, Trophy, Users, ScrollText } from "lucide-react"
export const NAV_ITEMS = [
  { key: "nav.challenges", href: "/challenges", Icon: ListChecks },
  { key: "nav.scoreboard", href: "/scoreboard", Icon: Trophy },
  { key: "nav.teams", href: "/teams", Icon: Users },
  { key: "nav.rules", href: "/p/rules", Icon: ScrollText },
] as const
```
Add the four `nav.*` keys to the uk JSON message catalog the existing `t()` reads (Завдання/Результати/Команди/Правила). If custom pages exist in the event fixture, map them in too; include the `+ Сторінка` affordance and the bottom block (Конфіг лабораторії/VPN status, Кабінет команди → `/cabinet`).

- [ ] **Step 2: Sidebar**

`src/components/event/Sidebar.tsx` — left nav: maps `NAV_ITEMS` to `<Link>`s (active state from `usePathname()`), flat (no section headers), with the bottom block (VPN status chip using `Badge`, "Кабінет команди" link). Match the prototype's sidebar.

- [ ] **Step 3: NotificationsPopover + AvatarMenu**

`NotificationsPopover.tsx` — a 🔔 `Button` inside `Popover`; `PopoverContent` lists notifications from the mock hook (Task 4), unread count as a `Badge` on the bell; empty state when none. `AvatarMenu.tsx` — `Avatar` inside `Popover` (or `DropdownMenu`); items: Профіль (external id-domain link ↗), Форма фідбеку, Вийти (calls the existing sign-out `*Fn`). Neither is a route.

- [ ] **Step 4: TopBand**

`TopBand.tsx` — full-width band: `Logo`→`/` · event name (from the event-info hook) · standing chip (`Badge`, e.g. `#4 · 1 250` — from event/standing fixture) · `Countdown` to `FinishTime` · `<NotificationsPopover/>` · `<AvatarMenu/>`. While the event-info fixture resolves, show `<Spinner size="sm" className="text-primary"/>` in place of the name/standing.

- [ ] **Step 5: AppShell**

`AppShell.tsx` — composes: `<TopBand/>` across the top, `<Sidebar/>` on the left, and `<main className="…">{children}</main>` filling the rest. Use the token background/border classes; match the prototype's proportions.

- [ ] **Step 6: Verify**

Run: `cd event-frontend && npx tsc --noEmit`  → no new errors.
Run: `cd event-frontend && npm run build`  → succeeds.
Browser (`NEXT_PUBLIC_USE_MOCKS=1`): after Task 6 wires it, the shell matches `.event-app.html` — top-band items present, sidebar navigates, both popovers open, standing chip + countdown show mock data, ice-cube Spinner during load. (Shell is not mounted until Task 6; this task's standalone gate is tsc + build.)

- [ ] **Step 7: Commit**

```bash
cd event-frontend
git add src/components/event/ <the uk message JSON you added nav keys to>
git commit -m "feat(shell): app shell — top-band, sidebar, notifications + avatar popovers"
git show --stat HEAD
```

---

### Task 6: Layout wiring + routing skeleton

**Files:**
- Modify: `src/app/layout.tsx` (render `AppShell` around `{children}`; drop `NavBar`/`Footer`; keep `Providers` + `Toaster`)
- Create/Modify: `src/app/challenges/page.tsx`, `src/app/scoreboard/page.tsx`, `src/app/teams/page.tsx`, `src/app/teams/[id]/page.tsx`, `src/app/cabinet/page.tsx`, `src/app/p/[slug]/page.tsx` (placeholder bodies)
- Modify: `src/app/page.tsx` (`/` → redirect to `/challenges` when in-event)
- Create: `src/components/event/PagePlaceholder.tsx` (shared "coming soon" body)

**Interfaces:**
- Consumes: `AppShell` (Task 5).
- Produces: a navigable shell with placeholder pages; later sub-projects replace each page body only.

- [ ] **Step 1: Shared placeholder**

`src/components/event/PagePlaceholder.tsx`:
```tsx
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm">Скоро тут з’явиться вміст</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the shell in `layout.tsx`**

Replace the `<NavBar/> <main>{children}</main> <Footer/>` block with `<AppShell>{children}</AppShell>`, keeping `<Providers>` and `<Toaster position="top-center"/>`. Keep `generateMetadata`. Remove the now-unused `NavBar`/`Footer` imports (do NOT delete those component files in this slice — other code/history may reference them; just stop importing).

- [ ] **Step 3: Placeholder pages**

Each route renders `<PagePlaceholder title="…"/>` with its uk title (Завдання/Результати/Команди/Деталь команди/Кабінет команди/Сторінка). For dynamic routes (`teams/[id]`, `p/[slug]`) read the param and show it in the title. NOTE: `src/app/challenges/page.tsx` and `src/app/scoreboard/page.tsx` have PRE-EXISTING uncommitted modifications (foreign) — coordinate: if they already render real content you must not clobber, wrap them in the shell via layout only and leave their bodies; otherwise replace their body with the placeholder. Confirm with `git status` before editing and stage only intentionally.

- [ ] **Step 4: `/` redirect**

In `src/app/page.tsx`, when the (mock) event indicates in-event, `redirect("/challenges")` (next/navigation). Keep the existing landing render for the not-in-event branch (Landing proper is a later sub-project).

- [ ] **Step 5: Verify**

Run: `cd event-frontend && npx tsc --noEmit`  → no new errors.
Run: `cd event-frontend && npm run build`  → succeeds; routes `/challenges /scoreboard /teams /teams/[id] /cabinet /p/[slug]` all present.
Browser (`NEXT_PUBLIC_USE_MOCKS=1 npm run dev`): the shell renders on every route, the sidebar navigates between placeholders, top-band shows mock event data + working popovers, `/` redirects to `/challenges`. Compare against `.event-app.html`.

- [ ] **Step 6: Commit**

```bash
cd event-frontend
git add src/app/layout.tsx src/app/page.tsx src/app/challenges/page.tsx src/app/scoreboard/page.tsx src/app/teams src/app/cabinet src/app/p src/components/event/PagePlaceholder.tsx
git commit -m "feat(shell): wire AppShell in layout + routing skeleton with placeholder pages"
git show --stat HEAD   # only your paths — NOT deploy/Dockerfile or other foreign WIP
```

---

## Self-Review (writing-plans)

1. **Spec coverage:** theme+Geist → Task 1; full §5.1 primitives → Task 2; ice-cube Spinner adoption → Task 3; mock layer/adapter/flag → Task 4; App shell (top-band/sidebar/popovers) → Task 5; layout wiring + routing skeleton + `/` redirect → Task 6. Landing/real page content/admin explicitly deferred (spec "out of scope"). No-test-runner gate (tsc+build+browser) stated in Global Constraints and every task. All spec sections covered.
2. **Placeholder scan:** the only "placeholder" is the intentional `PagePlaceholder` page body (a deliverable, not a plan gap). No TBD/TODO in steps; deterministic parts (tokens, adapter, layout, placeholder) carry full code; shadcn primitives use the canonical CLI (correct DRY — don't transcribe canonical code); the visual shell (Task 5) gives structure+interfaces+prototype reference, which is the complete instruction for a visual-match task with a 130KB reference prototype.
3. **Type consistency:** `IResponse<T>`, `IEventInfo`/`EventInfoSchema`, `INotification`/`NotificationSchema`, `installMockAdapter`, `AppShell`, `NAV_ITEMS`, `Spinner`/`PageLoader`, `PagePlaceholder` names are used consistently across tasks; the mock fixtures are validated against the same zod schemas the hooks use (REDESIGN one-schema-source). NOTE for the implementer: read `src/types/event.ts` for the EXACT exported schema name and required fields before writing the event fixture (the plan flags this in Task 4).
