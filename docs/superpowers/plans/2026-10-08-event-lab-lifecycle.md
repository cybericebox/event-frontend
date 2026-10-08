# Event Lab Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a team's shared environment immediately after its last dependent objective is solved, then support the approved progressive manual and retained-stage lifecycle in the existing event UI.

**Architecture:** The backend owns shared completion, admission, desired lifecycle and resource accounting. The browser renders its authoritative Lab object, retains the largest observed decimal revision, and uses that same identity/revision for board, runtime and link access. First-delivery tasks implement automatic completion; subsequent-delivery tasks add explicit manual control and stage/policy consumers only after the producer contracts are implemented and tested.

**Tech Stack:** Next.js 16.3.6, React 19.3.0, TanStack Query 5.103.2, Zod 4.6.5, TypeScript, Vitest and Testing Library. No new dependency.

**Spec:** `/Volumes/Projects/My/CyberICEBox/laboratory/docs/superpowers/specs/2026-10-08-lab-lifecycle-design.md` at owner-approved commit `f5c8bfb`.

## Global Constraints

- "Keep one LabGroup per participation unit/team. Group sharing is not implemented."
- "A solved laboratory is terminal for participant runtime"; "Progressive manual restart applies to manually stopped unresolved environments, not solved ones."
- "Internal snapshot/stop progress is available to the backend and operator, not a participant-facing shutting-down state."
- "Actual capacity is credited only after identity-matching release confirmation."
- "Existing stage `Closed` and returnable `Practice` retain their meanings."
- "Closing a stage is a stop, not immediate deletion." Solved laboratories remain stopped during subsequent preparation.
- Keep `TaskRevealMode` names `all_ready` and `as_ready`; publication mode is independent of rolling-roster participation policy.
- Configurable policy values must come from the backend; three/five are not product constants. No academy portal or moderator forced per-team stop power.
- Every UI string is a key in both `messages/uk.json` and `messages/en.json`; use `t`. Event-logo loaders, existing centered `EmptyState`/`EventLoadError`, shared `ConfirmDialog` and danger tone for stop. Instant settings are optimistic, queued, never disable neighboring controls, and never remount the form.
- Work on `feat/event-lab-lifecycle` in this directory. This plan-only turn authorizes no product edit or commit. Implementation requires the primary plan gate; local commits follow primary authorization, with no push, PR or release.

## Review Focus

1. A single visible question cannot establish shared completeness: test the first dependent solve, last dependent solve, another shared Lab and another team's identity.
2. Delayed polls and link responses cannot restore withdrawn access: test smaller/equal revisions, task changes during a request and a closed Lab with cached proxy/IP placeholders.
3. Practice and manual stop cannot become rated completion: test `Practice` versus `SolvedAt`, preserved answers/progress and a terminal solved Lab with a contradictory restart capability.
4. Stage pause/prewarm cannot resurrect solved copies: test closed-returnable history, fixed eligibility `all_ready`, readiness lag and preparation with solved Labs still closed.
5. Unavailable resource observations cannot become zero/free and pending settings cannot blink: test retained last data, explicit unknown resources and two queued policy changes with one failure.

## Producer contract and delivery gate

The backend agent agreed this participant contract on 2026-10-08. Producer schema tests are a prerequisite to consumer implementation; the first integrated delivery is incomplete until the backend durable worker and Laboratory actual-release/native checks also pass.

```ts
export type LabLifecycle = {
    ID: string;                    // UUID of the shared Lab generation
    EventExerciseID: string;       // UUID of the pinned exercise attachment
    Revision: string;              // canonical decimal, never a JSON int64 number
    LogicalClosed: boolean;
    CloseReason: null | "solved" | "manual" | "stage" | "event";
    ClosedAt: string | null;       // RFC3339 UTC
    RuntimeState: "preparing" | "ready" | "closed" | "unavailable";
    CanStop: boolean;
    CanRestart: boolean;
};
```

`LogicalClosed` forces participant `RuntimeState="closed"`; it never exposes physical Snapshotting/Stopping/StopFailed. Every question has required `EventExerciseID`; static questions have `Lab:null`. Submission `Data` is `{Correct:boolean,FirstSolve:boolean,Practice:boolean,Lab:LabLifecycle|null}`. Existing runtime `Data` adds `Lab:LabLifecycle` to its existing `Phase`, `Ready`, `Queue`, CIDRs and `Access`. Existing challenge-based link routes stay, and link `Data` is `{URL:string,ExpiresAt:string,LabID:string,Revision:string}`. Moderator submissions use the same authoritative Lab result after correct acceptance.

Participant mutation routes for the subsequent delivery are `POST /api/events/:eventID/teams/labs/:labID/stop` and `/restart`; the team comes from the authenticated session. Payload is `{Revision:string,IdempotencyKey:string}` and response is `{Data:{Lab:LabLifecycle}}`. HTTP 409 means refresh the affected Lab and show a translated state-change message; HTTP 403 means the server disallows the action. Neither error solves a task or opens access.

## Frozen operator/resource and policy contracts

The event frontend defines these schemas locally in `src/api/labObservations.ts`; it does not import code from the independent admin frontend. The backend publishes one canonical row per shared Lab, with `Questions:[{EventChallengeID,Name}]`, representative `ChallengeID/ChallengeName`, existing Status/Reason/Live/LiveUnavailable and `Lab:ManagedLabView`. `StandDetail.Group` is `ManagedGroupView`. `ManageResources.Observation` is `ResourceObservation`; its Held already includes PendingStarts and GroupServices.

```ts
export type Decimal = string;
export type ComputeView = {CPUMillicores: Decimal; MemoryBytes: Decimal};
export type AllocationView = {
    ConfiguredRequests: ComputeView; ConfiguredLimits: ComputeView;
    AllocatedRequests: ComputeView; Used: ComputeView; ReleasedRequests: ComputeView;
    RuntimeState: "Allocated" | "Releasing" | "Released" | "Unknown";
    ObservedAt: string | null; ReleasedAt: string | null; UsageAvailable: boolean;
    SnapshotQuotaBytes: Decimal;
    StorageState: "None" | "Retained" | "DeleteRequested" | "CleanupPending" | "Deleted" | "Unknown";
    PhysicalStorageBytesAvailable: boolean; PhysicalStorageBytes: Decimal;
};
export type ManagedActualState = "Running" | "Snapshotting" | "Stopping" | "Stopped" | "StopFailed" | "Starting" | "Unknown" | "Deleting" | "Deleted";
export type ManagedLabView = {
    ID: string; EventExerciseID: string; TeamID: string; ExerciseName: string;
    Revision: Decimal; ObservedRevision: Decimal; Generation: number; AgentUID: string;
    DesiredState: "Running" | "Stopped" | "Deleted"; ActualState: ManagedActualState;
    CloseReason: null | "solved" | "manual" | "stage" | "event";
    ClosedAt: string | null; ActualStoppedAt: string | null;
    RetentionUntil: string | null; ObservedAt: string | null;
    SnapshotState: "NotRequired" | "Pending" | "Succeeded" | "Failed" | "Unknown";
    FailureCode: string; FailureMessage: string; Resources: AllocationView;
};
export type ManagedGroupView = {
    Name: string; Revision: Decimal; ObservedRevision: Decimal; AgentUID: string;
    DesiredState: "Running" | "Stopped" | "Deleted"; ActualState: ManagedActualState;
    Ready: boolean; ObservedAt: string | null;
    FailureCode: string; FailureMessage: string; Resources: AllocationView;
};
export type ResourceObservation = {
    ObservedAt: string | null; Complete: boolean;
    Held: ComputeView & {SnapshotQuotaBytes: Decimal};
    PendingStarts: ComputeView; GroupServices: ComputeView;
    PhysicalStorageBytesAvailable: boolean; PhysicalStorageBytes: Decimal;
};
```

`Config.LabPolicy={SnapshotMode:"skip"|"required",MaxActiveLabsPerTeam:number|null,RetentionMinutes:number}`. Active limits are 1..1000 or null; retention is 0..10080 minutes; the backend supplies effective defaults skip/null/60. Stage `LabRetentionMinutes:null|number` overrides retention or inherits when null. Subsequent participant Lab metadata adds `SnapshotPolicy:"none"|"required"` and `RetentionUntil:null|RFC3339`. This signals required policy, never that capture already succeeded. Existing teardown delay remains final event cleanup timing, not a divergent stage-retention setting. Existing reservation/usage/InUse/Free numeric fields are retained; new quantities use decimal strings.

## Additive legacy response handling

The producer sends required identity fields on new responses. During staged consumer integration the parser accepts absent legacy `Lab` as null and absent `EventExerciseID` as null, without deriving a shared identity from a question. `Lab`, link `LabID/Revision`, policy and new observations use nullish-to-null additive parsing; numeric revisions or malformed present objects still fail. If lifecycle is absent throughout a legacy request, preserve existing ready/access behavior and expose no lifecycle/manual action. Once a present Lab is observed, every stale response or legacy link lacking its identity is fenced and cannot reopen it. Lifecycle guarantees are accepted only in the combined producer/consumer gate with all new fields present. Static questions remain `Lab:null`.

Local Next guidance already read for this plan: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` and `01-app/02-guides/client-side-data-fetching/tanstack-query.md` (mutation section). Retain browser-only query ownership, existing providers and route boundaries. No Server Action, new route or Next server cache is needed.

## File map

- Create `src/api/labLifecycle.ts`: participant lifecycle schema/types and decimal revision comparison.
- Create `src/test/labLifecycle.ts`: test-only canonical UUID/revision fixture.
- Create `src/components/event/challenges/labLifecycleCache.ts`: same-Lab revision reconciliation and targeted board/runtime cache changes.
- Create `src/components/event/challenges/LabAccessBlock.tsx`: existing host rows moved out of the modal, with settled closed/loading/error states.
- Create `src/components/event/challenges/LabControls.tsx` in the subsequent delivery: progressive stop confirmation and explicit restart.
- Modify `src/api/participantChallenges.ts`, `src/api/manageLabs.ts`, `src/api/moderatorsBoard.ts`: exact response parsing and mutations.
- Modify `ChallengesBoard.tsx`, `ChallengeModal.tsx`, `descriptionValues.ts`, `useLabLink.ts`: consume authoritative shared state and fence access.
- Modify `components/event/manage/StandDetailDialog.tsx`, `standStatus.ts`, `resources/ResourcesPage.tsx`: producer-owned lifecycle/resource display; no stop power.
- Modify `api/manage.ts`, `components/event/manage/exercises/ChallengeSettings.tsx` and `manage/StagesManager.tsx` only in the subsequent policy/stage delivery.
- Modify only relevant existing component CSS; no public versioned stylesheet, design-system sync or unrelated redesign.

### Task F1: Parse authoritative shared Lab identity

**Files:** Create `src/api/labLifecycle.ts`, `src/api/labLifecycle.test.ts`, `src/test/labLifecycle.ts`; modify `src/api/participantChallenges.ts:47,95,104,174,184`, `src/api/manageLabs.ts:97`, `src/api/moderatorsBoard.ts` submission parser, `src/components/event/challenges/fixtures/challengeFixture.ts` with `EventExerciseID` and `Lab`; test `src/api/participantChallenges.test.ts`, `src/api/manageLabs.test.ts`.

**Interfaces:** Consumes the producer contract above. Produces `LabLifecycleSchema`, `type LabLifecycle`, `compareRevision(a:string,b:string):number`, required `OwnChallenge.EventExerciseID`, nullable additive `OwnChallenge.Lab`, `ChallengeSubmission.Lab`, `LabRuntime.Lab` and `openLabLink` result `{url,expiresAt,labID:string|null,revision:string|null}`. Parsed `EventExerciseID` is `string|null` only for legacy absence; new wire responses always have it.

- [ ] Add the fixture and failing parse tests:

```ts
// src/test/labLifecycle.ts
import type {LabLifecycle} from "@/api/labLifecycle";
export const labID = "00000000-0000-4000-8000-000000000100";
export const exerciseID = "00000000-0000-4000-8000-000000000200";
export const runningLab: LabLifecycle = {
    ID: labID, EventExerciseID: exerciseID, Revision: "9007199254740993",
    LogicalClosed: false, CloseReason: null, ClosedAt: null,
    RuntimeState: "ready", CanStop: false, CanRestart: false,
};
export const completedLab: LabLifecycle = {
    ...runningLab, Revision: "9007199254740994", LogicalClosed: true,
    CloseReason: "solved", ClosedAt: "2026-10-08T12:00:00Z", RuntimeState: "closed",
};
// src/api/labLifecycle.test.ts
import {describe, expect, it} from "vitest";
import {LabLifecycleSchema, compareRevision} from "./labLifecycle";
import {completedLab, runningLab} from "@/test/labLifecycle";
it("preserves a decimal revision beyond safe JSON integers", () => {
    expect(LabLifecycleSchema.parse(completedLab)).toEqual(completedLab);
    expect(compareRevision(completedLab.Revision, runningLab.Revision)).toBeGreaterThan(0);
    expect(LabLifecycleSchema.safeParse({...runningLab, Revision: 9007199254740992}).success).toBe(false);
    expect(LabLifecycleSchema.safeParse({...runningLab, RuntimeState: "stopping"}).success).toBe(false);
});
```

Add transport tests that parse static `Lab:null`, every question's attachment ID, a correct/practice submission `Lab`, runtime `Lab`, and link `LabID/Revision`. Legacy missing `EventExerciseID`/`Lab` parse to null and do not enable lifecycle controls; numeric revisions fail parsing; do not silently invent identity from a question or catch an unknown runtime state.

- [ ] Run `npm test -- src/api/labLifecycle.test.ts src/api/participantChallenges.test.ts src/api/manageLabs.test.ts`; expect missing exports/new fields to fail before implementation.
- [ ] Implement the schema and parser additions:

```ts
import {z} from "zod";
export const revisionSchema = z.string().regex(/^(0|[1-9]\d*)$/);
export const LabLifecycleSchema = z.object({
    ID: z.string().uuid(), EventExerciseID: z.string().uuid(), Revision: revisionSchema,
    LogicalClosed: z.boolean(), CloseReason: z.enum(["solved", "manual", "stage", "event"]).nullable(),
    ClosedAt: z.string().nullable(), RuntimeState: z.enum(["preparing", "ready", "closed", "unavailable"]),
    CanStop: z.boolean(), CanRestart: z.boolean(),
});
export type LabLifecycle = z.infer<typeof LabLifecycleSchema>;
export function compareRevision(a: string, b: string): number {
    return a.length === b.length ? (a === b ? 0 : a < b ? -1 : 1) : a.length - b.length;
}
```

Use `Lab:LabLifecycleSchema.nullish().transform(value => value ?? null)` in board/submission/runtime and `EventExerciseID:z.string().uuid().nullish().transform(value => value ?? null)` for additive consumer parsing. Parse link `LabID/Revision` with their UUID/decimal schemas plus nullish-to-null handling; require present matching fields whenever the request has a known Lab; keep the existing current question/moderator paths and short-lived URL handling. Update test fixtures as explicit static or shared environments.

- [ ] Rerun the targeted tests and `npm run typecheck`; verify no first-delivery participant schema permits `stopping` or physical failure states.
- [ ] After primary implementation/commit authorization, checkpoint locally: `git add src/api src/test src/components/event/challenges/fixtures && git commit -m "feat: add shared event lab lifecycle contract"`.

### Task F2: Reconcile shared state without stale reopening

**Files:** Create `src/components/event/challenges/labLifecycleCache.ts`, `src/components/event/challenges/labLifecycleCache.test.ts`; modify `src/components/event/challenges/ChallengesBoard.tsx:163,216`, `src/components/event/challenges/ChallengeModal.tsx:226,286`, `src/components/event/challenges/challengeBoardModel.ts:113`; test `src/components/event/challenges/SolvedState.test.tsx`.

**Interfaces:** Consumes F1's `LabLifecycle`, `compareRevision`, `OwnBoard`, `ChallengeSubmission`, `LabRuntime`. Produces `labLifecycleKey(mode:BoardMode,eventID:string,labID:string)`, `newestLab(current:LabLifecycle|undefined,next:LabLifecycle):LabLifecycle`, `rememberLab(client:QueryClient,mode:BoardMode,eventID:string,next:LabLifecycle):LabLifecycle`, `reconcileBoard(client:QueryClient,mode:BoardMode,eventID:string,board:OwnBoard):OwnBoard`, `applySubmission(client:QueryClient,eventID:string,id:string,result:ChallengeSubmission,at:string):void`. Moderator arrays use the same `rememberLab` and per-question update without replacing the existing board endpoint.

- [ ] Add the meaningful stale-revision tests:

```ts
import {QueryClient} from "@tanstack/react-query";
import {expect, it} from "vitest";
import {rememberLab, newestLab} from "./labLifecycleCache";
import {runningLab, completedLab} from "@/test/labLifecycle";
it("keeps closure across delayed smaller and conflicting equal revisions", () => {
    expect(newestLab(completedLab, runningLab)).toEqual(completedLab);
    expect(newestLab(completedLab, {...runningLab, Revision: "9007199254740995", CanRestart: true})).toEqual(completedLab);
    expect(newestLab(completedLab, {...runningLab, Revision: completedLab.Revision})).toEqual(completedLab);
    const client = new QueryClient();
    rememberLab(client, "participant", "event-a", completedLab);
    expect(rememberLab(client, "participant", "event-a", runningLab)).toEqual(completedLab);
    expect(rememberLab(client, "participant", "event-b", runningLab)).toEqual(runningLab);
});
```

In `SolvedState.test.tsx`, use a board of three questions: two share `runningLab`, one has another Lab UUID. First submission returns `runningLab`; second returns `completedLab`. Assert only the corresponding question becomes solved on each result, final closure applies to both same-Lab questions immediately, and the third Lab stays open. A practice result sets `Practice:true` without `SolvedAt` or a rated score. Test a delayed old board response after final closure. Include another event/team context so an unrelated participant's Lab never changes.

- [ ] Run `npm test -- src/components/event/challenges/labLifecycleCache.test.ts src/components/event/challenges/SolvedState.test.tsx`; expect missing cache helpers/immediate shared closure to fail.
- [ ] Implement monotonic cache ownership:

```ts
import {QueryClient} from "@tanstack/react-query";
import {compareRevision, type LabLifecycle} from "@/api/labLifecycle";
import type {OwnBoard, ChallengeSubmission} from "@/api/participantChallenges";
import type {BoardMode} from "./ChallengeModal";
import {markSolved} from "./challengeBoardModel";
export const labLifecycleKey = (mode: BoardMode, eventID: string, labID: string) =>
    ["event-lab-lifecycle", mode, eventID, labID] as const;
export function newestLab(current: LabLifecycle | undefined, next: LabLifecycle): LabLifecycle {
    if (!current || current.ID !== next.ID) return next;
    if (current.LogicalClosed && current.CloseReason === "solved" && (!next.LogicalClosed || next.CloseReason !== "solved")) return current;
    const order = compareRevision(next.Revision, current.Revision);
    return order < 0 || (order === 0 && current.LogicalClosed && !next.LogicalClosed) ? current : next;
}
export function rememberLab(client: QueryClient, mode: BoardMode, eventID: string, next: LabLifecycle): LabLifecycle {
    const key = labLifecycleKey(mode, eventID, next.ID);
    client.setQueryData<LabLifecycle>(key, current => newestLab(current, next));
    return client.getQueryData<LabLifecycle>(key)!;
}
export function reconcileBoard(client: QueryClient, mode: BoardMode, eventID: string, board: OwnBoard): OwnBoard {
    return {...board, Challenges: board.Challenges.map(item => item.Lab
        ? {...item, Lab: rememberLab(client, mode, eventID, item.Lab)} : item)};
}
export function applySubmission(client: QueryClient, eventID: string, id: string, result: ChallengeSubmission, at: string): void {
    if (result.Lab) rememberLab(client, "participant", eventID, result.Lab);
    if (!result.Correct) return;
    client.setQueryData<OwnBoard>(["event-own-challenges", eventID], old => {
        if (!old) return old;
        const Challenges = result.Practice
            ? old.Challenges.map(item => item.EventChallengeID === id ? {...item, Practice: true, AttemptsLeft: null} : item)
            : markSolved(old.Challenges, id, at);
        return reconcileBoard(client, "participant", eventID, {...old, Challenges});
    });
}
```

The board query function returns `reconcileBoard(...)` after the network result; a disabled `useQuery<LabLifecycle>` on `labLifecycleKey` in the modal subscribes to that authoritative entry. Runtime query results call `rememberLab` and use the returned lifecycle, so delayed runtime data cannot replace it. Keep query keys scoped by mode and event. Extend `onAccepted` to `(id:string,result:ChallengeSubmission)=>void`; both rated and practice correct results take this path. Remember any returned Lab before displaying a result, including a response received after another teammate closes the environment. Refetch reconciles score details without emptying/remounting the modal. Never infer completeness from counting visible question solves.

- [ ] Rerun both test files and typecheck; inspect that no code subtracts resource usage or starts Labs when a board/query mounts.
- [ ] After primary authorization, checkpoint only the listed cache/board/modal/test files with `git commit -m "feat: apply authoritative shared lab closure immediately"`.

### Task F3: Settle closed access and fence late links

**Files:** Create `src/components/event/challenges/LabAccessBlock.tsx`, `src/components/event/challenges/LabAccessBlock.test.tsx`; modify `src/components/event/challenges/ChallengeModal.tsx:54-88,226,336,374,395`, `src/components/event/challenges/descriptionValues.ts:48`, `src/components/event/challenges/useLabLink.ts:28`, `src/styles/event-participant.css`, `messages/uk.json`, `messages/en.json`; test `src/components/event/challenges/descriptionValues.test.ts`, `src/components/event/challenges/ChallengePlaceholders.test.tsx`, `src/components/event/challenges/useLabLink.test.tsx`, `src/components/event/challenges/SolvedState.test.tsx`.

**Interfaces:** Consumes F1/F2. Produces `LabAccessBlock({lab:LabRuntime|undefined,lifecycle:LabLifecycle|null,pending:boolean,error?:unknown,link:LabLinkState,busyKey:string|null,onOpen,onRetry,onReload})`, closed-safe `descriptionValues(placeholders,lab,lifecycle?:LabLifecycle)`, and `useLabLink(eventID,challengeID,moderators,lifecycle:LabLifecycle|undefined)` with existing return members. `LogicalClosed` is the first rendering/access check.

- [ ] Add tests before implementation:

```ts
it("removes dynamic proxy and IP links with closed lifecycle even with stale ready access", () => {
    const stale = {...runtimeFixture, Lab: runningLab, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://web.example.test"}]};
    const value = descriptionValues([
        {key: "web", kind: "external.link", device_name: "web"},
        {key: "ip", kind: "ip", ip_reference: "vpn", last_octet: 5, as_link: true, scheme: "http"},
    ], stale, completedLab);
    expect(value.links).toEqual({});
    expect(value.variables).toEqual({web: "—", ip: "—"});
});
```

Export `runtimeFixture:LabRuntime = {Lab:runningLab,Phase:"Ready",Ready:true,Queue:null,VPNCIDR:"10.128.1.0/24",InternetCIDR:"",Access:[]}` from `src/test/labLifecycle.ts`, importing `LabRuntime` from `@/api/manageLabs`. Add a hook test using the existing fake blank tab: start `open`, rerender with `completedLab`, resolve the old response `{url,expiresAt,labID:runningLab.ID,revision:runningLab.Revision}`, assert `tab.close()` and `about:blank`, and assert retry performs no request. Repeat with challenge switch and a newer revision. Modal test asserts settled translated closure, retained solved panel, no host-open/copy action and no preparing/shutting-down text before any poll settles. An individually solved question with `runningLab` retains access.

- [ ] Run `npm test -- src/components/event/challenges/descriptionValues.test.ts src/components/event/challenges/useLabLink.test.tsx src/components/event/challenges/ChallengePlaceholders.test.tsx src/components/event/challenges/SolvedState.test.tsx`; expect late navigation/old host access to fail.
- [ ] Move the current host/copy rows into `LabAccessBlock` without redesigning them. Render the new closed branch before any pending/error state:

```tsx
if (lifecycle?.LogicalClosed) return <section className="ib-cmodal__blk">
    <h3>{t("challenges.lab.environment")}</h3>
    <EmptyState compact message={t(`challenges.lab.closed.${lifecycle.CloseReason ?? "event"}`)} />
</section>;
const access = !lifecycle && !lab?.Lab ? lab?.Access ?? []
    : lifecycle?.RuntimeState === "ready" && lab?.Lab?.Revision === lifecycle.Revision ? lab.Access : [];
```

Use existing `EventLoading`/`EventLoadError` centered inside the same minimum-height state block for the nonclosed pending/error branches. Known RuntimeState unavailable renders `EventLoadError` with a retry, and preparing renders the event-logo loader; neither is labeled as shutting down. Keep cached data visible on background refresh. Closed Labs do not show VPN badges for that task and do not poll access indefinitely; the board still reconciles through existing polling/stage boundaries. Description values return a dash and no links for every runtime placeholder whenever the effective lifecycle is closed or the runtime revision is older. Ordinary organizer-authored nonruntime links remain content; backend ACL enforcement refuses any old direct lab URL.

Update the hook using a ref of current task/lifecycle. At click capture `requested={challengeID,revision:lifecycle?.Revision??null}`. The success branch must implement this exact fence before navigation:

```ts
const latest = current.current;
const unsafe = latest.challengeID !== requested.challengeID || (requested.revision === null
    ? !!latest.lifecycle
    : !latest.lifecycle || latest.lifecycle.LogicalClosed || latest.lifecycle.ID !== link.labID
      || latest.lifecycle.Revision !== requested.revision || link.revision !== requested.revision);
if (unsafe) {
    tab.close();
    setState({status: "idle"});
    return;
}
tab.location.href = link.url;
```

Known closed/unavailable/not-ready Labs never call `window.open`. For a request begun without legacy lifecycle, navigate only if lifecycle is still absent; if a Lab appears during the request, close the blank tab because the old request has no trusted generation. Known lifecycle requests require every fence field above. Close an outstanding blank tab when a task or revision changes and on unmount. A 403/409 link failure closes the blank tab and refetches the affected board/runtime; a newly known closure replaces the retry error with the settled state.

Add exact i18n values:

| Key | Ukrainian | English |
|---|---|---|
| `challenges.lab.environment` | Середовище | Environment |
| `challenges.lab.closed.solved` | Усі завдання цього середовища виконано. Середовище закрито. | All tasks in this environment are complete. The environment is closed. |
| `challenges.lab.closed.manual` | Середовище зупинено. Прогрес завдань збережено. | The environment is stopped. Task progress is saved. |
| `challenges.lab.closed.stage` | Етап завершено. Середовище закрито. | The stage has ended. The environment is closed. |
| `challenges.lab.closed.event` | Захід завершено. Середовище закрито. | The event has ended. The environment is closed. |

- [ ] Rerun targeted tests, `npm run typecheck` and lint the touched TypeScript files. Inspect desktop/mobile modal once; confirm event-logo/standard empty/error states, keyboard focus and settled closure with unchanged results.
- [ ] After primary authorization, checkpoint the scoped files with `git commit -m "feat: settle closed event environments and fence lab links"`.

### Task F4: First integrated delivery and manager/resource consumers

**Files:** Create `src/api/labObservations.ts`, `src/api/labObservations.test.ts`, `src/components/event/manage/resources/ResourceObservationFacts.tsx`, `src/components/event/manage/resources/ResourceObservationFacts.test.tsx`, `src/components/event/manage/resources/resourceObservationModel.ts`, `src/components/event/manage/resources/resourceObservationModel.test.ts`; modify `src/api/manageLabs.ts`, `src/components/event/manage/StandDetailDialog.tsx`, `src/components/event/manage/standStatus.ts`, `src/api/manageResources.ts`, `src/components/event/manage/resources/ResourcesPage.tsx`, both message catalogs; extend `src/components/event/manage/StandDetailDialog.test.tsx`, `src/components/event/manage/resources/ResourcesPage.test.tsx`.

**Interfaces:** Consumes the frozen `ManagedLabView`, `ManagedGroupView`, `AllocationView`, `ResourceObservation` block above. Produces matching local schemas, `ManagedLabFacts({lab:ManagedLabView})`, `ResourceObservationFacts({observation:ResourceObservation|null})` and read-only canonical detail. No operation endpoint is introduced. Existing plan rows remain keyed by `EventExerciseID` and retain server totals.

- [ ] Add detail tests: one canonical Lab with two Questions renders both names and exactly one Live block; `ClosedAt` with `ActualState:"StopFailed"` retains AllocatedRequests and shows snapshot failure; missing legacy Lab/Group remains readable without lifecycle claims. A new matching stop observation alone changes the displayed release facts. Add aggregate tests with Held=500m, PendingStarts=250m and GroupServices=50m: total remains 500m, not 800m. Complete=false retains conservative data and an unknown-contributor state; physically unavailable storage is unknown rather than zero.
- [ ] Run `npm test -- src/api/labObservations.test.ts src/components/event/manage/StandDetailDialog.test.tsx src/components/event/manage/resources/ResourceObservationFacts.test.tsx src/components/event/manage/resources/ResourcesPage.test.tsx`; new observation/assertions fail before implementation.
- [ ] Define local schemas using the complete frozen block. Decimal fields use `z.string().regex(/^(0|[1-9]\d*)$/)`; every new enum is explicit. Managed row Lab/Questions/Group and Observation use nullable additive parsing, never a default stopped/zero value. Preserve existing Live schema and numeric API fields. Render lifecycle facts directly:

```tsx
export function ManagedLabFacts({lab}: {lab: ManagedLabView}) {
    const current = lab.Revision === lab.ObservedRevision && lab.AgentUID !== "" && lab.ObservedAt !== null;
    return <section data-lab-id={lab.ID}>
        {lab.ClosedAt && <p role="status">{t(`manage.labs.lifecycle.closed.${lab.CloseReason ?? "event"}`)}</p>}
        <dl>
            <div><dt>{t("manage.labs.lifecycle.actual")}</dt><dd>{t(`manage.labs.lifecycle.actual.${lab.ActualState}`)}</dd></div>
            <div><dt>{t("manage.labs.lifecycle.snapshot")}</dt><dd>{t(`manage.labs.lifecycle.snapshot.${lab.SnapshotState}`)}</dd></div>
            <div><dt>{t("manage.labs.lifecycle.observation")}</dt><dd>{t(current ? "manage.labs.lifecycle.current" : "manage.labs.lifecycle.unknown")}</dd></div>
        </dl>
        {lab.FailureMessage && <p role="status">{lab.FailureMessage}</p>}
    </section>;
}
```

Implement the independent event decimal helpers and explicit allocation/observation rows, using local existing resource formatting imports:

```ts
// resources/resourceObservationModel.ts
import {t} from "@/i18n/t";
import {formatCpu, formatMemory} from "./resourcesModel";
function safeDecimal(value: string): number | null {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function decimalCpu(value: string): string {
    const number = safeDecimal(value);
    return number === null ? t("manage.resources.observation.exactMcpu", {value: BigInt(value).toLocaleString("uk-UA")}) : formatCpu(number);
}
export function decimalMemory(value: string): string {
    const number = safeDecimal(value);
    return number === null ? t("manage.resources.observation.exactBytes", {value: BigInt(value).toLocaleString("uk-UA")}) : formatMemory(number);
}
```

```tsx
// ResourceObservationFacts.tsx: import frozen local types, t, EmptyState and both decimal formatters.
const computeText = (value: ComputeView) => t("manage.resources.observation.computeValue", {cpu: decimalCpu(value.CPUMillicores), memory: decimalMemory(value.MemoryBytes)});
export function AllocationFacts({resources}: {resources: AllocationView}) {
    return <dl>
        <div><dt>{t("manage.resources.observation.configuredRequests")}</dt><dd>{computeText(resources.ConfiguredRequests)}</dd></div>
        <div><dt>{t("manage.resources.observation.configuredLimits")}</dt><dd>{computeText(resources.ConfiguredLimits)}</dd></div>
        <div><dt>{t("manage.resources.observation.held")}</dt><dd>{computeText(resources.AllocatedRequests)}</dd></div>
        <div><dt>{t("manage.resources.observation.used")}</dt><dd>{resources.UsageAvailable ? computeText(resources.Used) : t("manage.resources.observation.unknown")}</dd></div>
        <div><dt>{t("manage.resources.observation.released")}</dt><dd>{computeText(resources.ReleasedRequests)}</dd></div>
        <div><dt>{t("manage.resources.observation.snapshotQuota")}</dt><dd>{decimalMemory(resources.SnapshotQuotaBytes)}</dd></div>
        <div><dt>{t("manage.resources.observation.physicalStorage")}</dt><dd>{resources.PhysicalStorageBytesAvailable ? decimalMemory(resources.PhysicalStorageBytes) : t("manage.resources.observation.unknown")}</dd></div>
        <div><dt>{t("manage.resources.observation.runtime")}</dt><dd>{t(`manage.resources.observation.runtime.${resources.RuntimeState}`)}</dd></div>
        <div><dt>{t("manage.resources.observation.storage")}</dt><dd>{t(`manage.resources.observation.storage.${resources.StorageState}`)}</dd></div>
    </dl>;
}
export function ResourceObservationFacts({observation}: {observation: ResourceObservation | null}) {
    if (!observation) return <EmptyState compact message={t("manage.resources.observation.unknown")} />;
    const unknownHeld = !observation.Complete && observation.Held.CPUMillicores === "0" && observation.Held.MemoryBytes === "0";
    return <section aria-label={t("manage.resources.observation.title")}>
        <p role="status">{t(observation.Complete ? "manage.resources.observation.complete" : "manage.resources.observation.incomplete")}</p>
        <dl>
            <div><dt>{t("manage.resources.observation.held")}</dt><dd data-testid="observation-held">{unknownHeld ? t("manage.resources.observation.unknown") : computeText(observation.Held)}</dd></div>
            <div><dt>{t("manage.resources.observation.pendingStarts")}</dt><dd>{computeText(observation.PendingStarts)}</dd></div>
            <div><dt>{t("manage.resources.observation.groupServices")}</dt><dd>{computeText(observation.GroupServices)}</dd></div>
            <div><dt>{t("manage.resources.observation.snapshotQuota")}</dt><dd>{decimalMemory(observation.Held.SnapshotQuotaBytes)}</dd></div>
            <div><dt>{t("manage.resources.observation.physicalStorage")}</dt><dd>{observation.PhysicalStorageBytesAvailable ? decimalMemory(observation.PhysicalStorageBytes) : t("manage.resources.observation.unknown")}</dd></div>
        </dl>
    </section>;
}
```

`ManagedLabFacts` includes `<AllocationFacts resources={lab.Resources}/>` after its logical/physical fields. Test decimal values above Number.MAX_SAFE_INTEGER. All rows read producer fields directly: no resource arithmetic or summing canonical question rows.

`StandDetailDialog` renders Questions list plus one physical block per Lab ID; device controls use `canManage && lab.Lab?.ClosedAt == null` for new rows, preserving legacy behavior. `ResourcesPage` uses `query.isError && !query.data` for first-load failure, retains prior data on background errors, and shows Observation below existing allocated/InUse/Free facts. `Observation.Held` includes pending/group compute; do not add breakdowns. Create translated keys for every physical/snapshot/resource state. No forced-team-stop control and no display of unvalidated resource candidates as supported defaults.

- [ ] Rerun the targeted tests, F1–F3 tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:ds`. Repeated broad runs require a new change/failure; report unrelated failures separately.
- [ ] Run one local browser scenario against the backend fixture from its Task 6: artifact fields include EventID/EventTag, Teams, three dependent EventChallengeIDs on a shared Lab, unrelated Lab, LabID/Revision, URLs and opaque session handles. No secret values enter plans/repository. First shared answer keeps access; final closes immediately; stale link stays closed; unrelated Lab stays available; resource amounts stay held until confirmed release. Capture desktop/mobile after closure together.
- [ ] Primary first-delivery gate requires durable backend retry/restart evidence, current snapshot barrier proof, actual Linux stop/accounting and browser observations. Mocked UI alone cannot prove physical release. Only after that gate and primary commit authorization checkpoint `feat: expose confirmed event lab closure observations`.

### Task S1: Progressive explicit manual stop/restart

**Files:** Modify `src/api/participantChallenges.ts`, `src/api/labLifecycle.ts` and its fixtures; create `src/components/event/challenges/LabControls.tsx`, `src/components/event/challenges/LabControls.test.tsx`; modify `src/components/event/challenges/LabAccessBlock.tsx`, `src/components/event/challenges/ChallengeModal.tsx`, `src/components/event/challenges/labLifecycleCache.test.ts`, `messages/uk.json` and `messages/en.json`.

**Interfaces:** Consumes authenticated own-Lab route contract above, `LabLifecycle.Revision/CanStop/CanRestart/CloseReason` and `Lab.SnapshotPolicy:"none"|"required"` and `Lab.RetentionUntil:string|null`, added by the producer in this delivery. Extend the local lifecycle schema with nullable legacy metadata and fixtures; controls requiring preservation copy stay hidden until SnapshotPolicy is present. Produces `stopOwnLab(eventID:string,labID:string,revision:string,idempotencyKey:string):Promise<LabLifecycle>`, `restartOwnLab` with the same signature and a `LabControls` component that never mutates a question's solve state.

- [ ] Add transport tests for exact route/session credentials and `{Revision,IdempotencyKey}`. Add component tests: strict capabilities false show neither action; progressive stop opens common danger confirmation; stop response closes only that Lab without changing `SolvedAt`, `Practice`, scores or progress; restart is explicit, closes nothing else and resource refusal preserves stopped state; solved closure shows no restart even if a malformed response says `CanRestart:true`.
- [ ] Run `npm test -- src/api/participantChallenges.test.ts src/components/event/challenges/LabControls.test.tsx`; expect missing methods/controls to fail.
- [ ] Implement the request using the existing participant failure parser:

```ts
async function changeOwnLab(eventID: string, labID: string, action: "stop" | "restart", revision: string, idempotencyKey: string): Promise<LabLifecycle> {
    const response = await fetch(`${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/teams/labs/${encodeURIComponent(labID)}/${action}`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Revision: revision, IdempotencyKey: idempotencyKey}),
    });
    if (!response.ok) throw await failure(response);
    return z.object({Data: z.object({Lab: LabLifecycleSchema})}).parse(await response.json()).Data.Lab;
}
export const stopOwnLab = (eventID: string, labID: string, revision: string, key: string) => changeOwnLab(eventID, labID, "stop", revision, key);
export const restartOwnLab = (eventID: string, labID: string, revision: string, key: string) => changeOwnLab(eventID, labID, "restart", revision, key);
```

`canStop = Lab.CanStop && !Lab.LogicalClosed`; `canRestart = Lab.CanRestart && Lab.LogicalClosed && Lab.CloseReason === "manual"`. Only an accepted authoritative reply calls `rememberLab`; never optimistically withdraw access before the server does. Stop uses `ConfirmDialog tone="danger"` with question title, cancellation focus, inline error and event-logo busy confirm button. Restart uses an explicit `EventButton` and renders preparing only after the accepted revision. On 403/409 refetch that Lab, preserve input/progress and show translated refusal. Reuse one UUID for a retry of an uncertain operation.

Copy keys: `challenges.lab.stop.title` = "Зупинити середовище?" / "Stop the environment?"; `stop.confirm` = "Зупинити" / "Stop"; `restart` = "Запустити знову" / "Start again"; `stateChanged` = "Стан середовища змінився. Оновіть його та спробуйте ще раз." / "The environment state changed. Refresh it and try again.". Add `challenges.lab.stop.requiredBody`: "Прогрес завдань залишиться. Перед фізичною зупинкою потрібен успішний знімок файлового стану." / "Task progress remains. Physical stop requires a successful filesystem snapshot." Add `challenges.lab.stop.noneBody`: "Прогрес завдань залишиться. Зміни у середовищі можуть бути втрачені." / "Task progress remains. Changes in the environment may be lost." Choose the body from effective SnapshotPolicy; required policy does not say capture has already succeeded. No promise of process memory or unrecorded network state preservation.

- [ ] Rerun transport/control/cache tests, typecheck and targeted lint. Browser-check explicit stop/restart with a capacity rejection and keyboard confirmation. No automatic call to `restartOwnLab` appears in mount/refetch/stage/group-resume effects.
- [ ] After primary subsequent-delivery gate and commit authorization, checkpoint `feat: add progressive participant lab stop and restart`.

### Task S2: Configurable lifecycle policy and stage-retention override

**Files:** Modify `src/api/manage.ts`, `src/api/manageStages.ts`, `src/components/event/manage/exercises/ChallengeSettings.tsx`, `src/components/event/manage/StagesManager.tsx`, both message catalogs; create `src/components/event/manage/labPolicyModel.ts`, `src/components/event/manage/labPolicyModel.test.ts`; extend `src/components/event/manage/exercises/ChallengeSettings.test.tsx`, `src/components/event/manage/StagesManager.test.tsx`, `src/api/manageStages.test.ts` and create `src/api/manageConfig.lifecycle.test.ts`.

**Interfaces:** Produces `LabPolicySchema`, `type LabPolicy={SnapshotMode:"skip"|"required",MaxActiveLabsPerTeam:number|null,RetentionMinutes:number}`, additive `ManageConfig.LabPolicy:LabPolicy|null`, optional `ManageConfigInput.LabPolicy:LabPolicy`, additive `ManageStage.LabRetentionMinutes:number|null`, corresponding optional `StageUpdateInput` field, and `parsePolicyNumber(raw:string,min:number,max:number,nullable:boolean):number|null|undefined`. Consumes existing `getManageConfig/putManageConfig/manageConfigInput` and `updateManageStage` endpoints. Existing teardown delay is untouched final-event timing.

- [ ] Add concrete policy tests:

```ts
it("validates nullable active limits and zero retention without product constants", () => {
    expect(parsePolicyNumber("", 1, 1000, true)).toBeNull();
    expect(parsePolicyNumber("0", 0, 10080, false)).toBe(0);
    expect(parsePolicyNumber("1001", 1, 1000, true)).toBeUndefined();
    expect(parsePolicyNumber("60.5", 0, 10080, false)).toBeUndefined();
});
```

Transport assertions preserve full config with `LabPolicy:{SnapshotMode:"required",MaxActiveLabsPerTeam:7,RetentionMinutes:90}` and every unrelated value; stage PUT carries `{LabRetentionMinutes:null}` for inherit. Component test changes snapshot then limit while first save is pending: both values appear immediately, both controls remain enabled, calls are serial, stale reply cannot overwrite newer change, failure refetches only that config query and shows a toast. Legacy missing policy hides only this settings section. Stage override save keeps existing Returnable edit and first/open/closed anchors intact.

- [ ] Run policy-model/config/settings/stage API tests; new fields and controls fail before implementation.
- [ ] Implement exact validation and full-payload preservation:

```ts
export const LabPolicySchema = z.object({
    SnapshotMode: z.enum(["skip", "required"]),
    MaxActiveLabsPerTeam: z.number().int().min(1).max(1000).nullable(),
    RetentionMinutes: z.number().int().min(0).max(10080),
});
export type LabPolicy = z.infer<typeof LabPolicySchema>;
// ManageConfigSchema adds LabPolicy: LabPolicySchema.nullish().transform(value => value ?? null).
// ManageConfigInput omits nullable consumer LabPolicy then adds LabPolicy?: LabPolicy.
// manageConfigInput includes only present policy, preserving backend defaults for legacy payloads:
const policyInput = config.LabPolicy ? {LabPolicy: config.LabPolicy} : {};
export function parsePolicyNumber(raw: string, min: number, max: number, nullable: boolean): number | null | undefined {
    if (raw.trim() === "") return nullable ? null : undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}
```

Spread `policyInput` into the existing full config object. Extend existing `saveConfig` patch type with LabPolicy and use the existing optimistic queue for all policy controls. The new section uses current server values, SnapshotMode select options skip/required, nullable active-limit number input and retention number input. On blur/Enter validate with `parsePolicyNumber`; invalid values display `t("manage.labs.policy.range",{min,max})` and make no request. Never use browser 3/5/default60 policy values. No remount key or section-wide saving flag.

Generalize the existing stage Returnable queue into a same-stage patch queue without losing newer fields:

```ts
function saveStagePatch(stageID: string, patch: Partial<Pick<ManageStage, "Returnable" | "LabRetentionMinutes">>) {
    const key = stagesKey(eventID);
    queryClient.setQueryData<ManageStage[]>(key, rows => rows?.map(row => row.ID === stageID ? {...row, ...patch} : row));
    queue.current = queue.current.then(async () => {
        const wanted = queryClient.getQueryData<ManageStage[]>(key)?.find(row => row.ID === stageID);
        if (!wanted) return;
        try {
            const saved = await updateManageStage(eventID, stageID, {Returnable: wanted.Returnable, LabRetentionMinutes: wanted.LabRetentionMinutes});
            const shown = queryClient.getQueryData<ManageStage[]>(key)?.find(row => row.ID === stageID);
            if (shown === wanted) queryClient.setQueryData<ManageStage[]>(key, rows => rows?.map(row => row.ID === stageID ? saved : row));
        } catch {
            await queryClient.invalidateQueries({queryKey: key, exact: true});
            toast.error(t("manage.stages.saveFailed"));
        }
    });
}
```

`StageSchema` uses `z.number().int().min(0).max(10080).nullish().transform(v=>v??null)`; wire `StageUpdateInput` sends nullable override. Stage retention input can stay editable under the producer's policy constraints and uses `canManage`; no change to stage Returnable/time locks or backend closing authorization. Use the verified existing `manage.stages.saveFailed` key and `failureText` error helper from `StagesManager.tsx`.

Copy: `manage.labs.policy.snapshot` "Знімок перед зупинкою" / "Snapshot before stop"; `.skip` "Не вимагати знімок" / "Do not require a snapshot"; `.required` "Вимагати успішний знімок" / "Require a successful snapshot"; `.activeLimit` "Максимум активних середовищ команди" / "Maximum active environments per team"; `.unlimited` "Без обмеження" / "Unlimited"; `.retention` "Зберігати зупинене середовище (хвилини)" / "Stopped environment retention (minutes)"; `.inherit` "Політика заходу" / "Event policy"; `.range` "Введіть ціле число від {min} до {max}." / "Enter a whole number from {min} to {max}." Explain retention expiry starts separately confirmed deletion; capture policy does not promise successful state preservation before acknowledgement.

- [ ] Rerun policy/config/stage tests, typecheck and targeted lint. Check S1 stop consequence text against effective participant SnapshotPolicy. Backend retention stop/expiry confirmation tests must pass before UI acceptance.
- [ ] After primary authorization, checkpoint `feat: expose configurable event lab lifecycle policy`.

### Task S3: Stage closure, retained history and readiness/prewarm consumers

**Files:** Modify `src/api/manageStages.ts`, `src/components/event/manage/StagesManager.tsx`, `src/components/event/challenges/ChallengeModal.tsx`, `src/components/event/challenges/challengeBoardModel.ts`, `src/components/event/manage/StagesManager.test.tsx`, `src/components/event/challenges/ChallengeStages.test.tsx`, `src/components/event/challenges/ChallengeBoardStages.test.tsx`, both message files. Shared group lifecycle observation display belongs to the manager/admin observation contract; no participant group action is added.

**Interfaces:** Consumes `StandDetail.Group:ManagedGroupView|null`, stage `LabRetentionMinutes`, existing `StageSchema.State/Returnable/DeployLeadMinutes`, board `CurrentStage/NextChangeAt`, producer `LabLifecycle` and fixed-eligibility readiness behavior for `all_ready`. Produces retained read/history with withdrawn runtime access; stage/group start is never initiated by this frontend.

- [ ] Add integration-component tests: closing a returnable stage leaves description, practice meaning and score/history accessible but hides all runtime links; `open` filter excludes the ended stage; `all`/closed history remains readable. Next preparation keeps solved Labs closed, unresolved stage Labs preparing, and no stop/restart route fires from rendering. `all_ready` shows the next set only when the fixed eligible set is ready; `as_ready` preserves per-team admission. Test command accepted with group preparing: tasks do not become available from acceptance or Pod Running alone.
- [ ] Run `npm test -- src/components/event/manage/StagesManager.test.tsx src/components/event/challenges/ChallengeStages.test.tsx src/components/event/challenges/ChallengeBoardStages.test.tsx`; establish failing assertions for runtime closure/preparation before consumer changes.
- [ ] Keep `boardStatus` and `isSolvableNow` stage/score meanings. Give `Lab.LogicalClosed` priority for runtime rendering independently of `challenge.Closed`/`Practice`; describe archived environments as closed, and render restart solely for manual unresolved S1 capability. Add the manager-only group presenter with explicit readiness (not command acceptance):

```tsx
function ManagedGroupFacts({group}: {group: ManagedGroupView}) {
    const current = group.Revision === group.ObservedRevision && group.AgentUID !== "" && group.ObservedAt !== null;
    return <section data-group-name={group.Name}>
        <p>{t(`manage.labs.lifecycle.actual.${group.ActualState}`)}</p>
        <p role="status">{t(group.Ready && current ? "manage.labs.group.ready" : "manage.labs.group.notReady")}</p>
        <p>{t("manage.labs.group.prepareHelp")}</p>
        {group.FailureMessage && <p>{group.FailureMessage}</p>}
    </section>;
}
```

Render `<AllocationFacts resources={group.Resources}/>` with the F4 interface; never divide group overhead by solved children. Stage edit/close success uses exact query cache answers; retain existing previous data and boundary-triggered board refetch. Update manager help text to explain deployment lead includes group services, snapshot restore and lab network readiness. Do not simulate readiness by a browser timer or start solved copies when a stage changes.
- [ ] Rerun stage, S1, F1–F4 tests and appropriate typecheck/lint/build checks. Primary local integrated stage scenario must show all current children confirmed stopped before group services pause, group prewarming in existing lead window, only unresolved required next-stage Labs starting, solved Labs still stopped, and expiry deletion separately confirmed. Browser mock success alone is insufficient.
- [ ] After primary full-model gate and commit authorization, checkpoint `feat: render retained stage lab lifecycle and readiness`.


## Operational translation values

Use these values for each plan's lifecycle namespaces. The event plan uses `manage.labs.lifecycle.actual.*`/`.snapshot.*`; admin uses `admin.labs.lifecycle.actual.*`/`.snapshot.*`. These are manager/admin-only physical states.

| State | Ukrainian | English |
|---|---|---|
| Running | Працює | Running |
| Snapshotting | Створюється знімок | Creating snapshot |
| Stopping | Зупиняється | Stopping |
| Stopped | Зупинено | Stopped |
| StopFailed | Зупинка не завершилась | Stop failed |
| Starting | Запускається | Starting |
| Unknown | Невідомо | Unknown |
| Deleting | Видаляється | Deleting |
| Deleted | Видалено | Deleted |
| NotRequired | Знімок не потрібен | Snapshot not required |
| Pending | Знімок очікується | Snapshot pending |
| Succeeded | Знімок створено | Snapshot created |
| Failed | Знімок не створено | Snapshot failed |

Resource labels use `manage.resources.observation.*` in event and the explicit `admin.labs.resources.*` / `admin.resources.observation.*` keys in admin: configuredRequests "Запити за конфігурацією" / "Configured requests"; configuredLimits "Ліміти за конфігурацією" / "Configured limits"; held "Утримані ресурси" / "Held resources"; used "Виміряне використання" / "Measured usage"; released "Підтверджено звільнено" / "Confirmed released"; snapshotQuota "Утримана квота знімків" / "Held snapshot quota"; physicalStorage "Фізичне сховище" / "Physical storage"; unknown "Невідомо" / "Unknown"; pendingStarts "Запуски в очікуванні" / "Pending starts"; groupServices "Сервіси групи (входять до загального обсягу)" / "Group services (included in held total)"; complete "Спостереження актуальні" / "Observations are current"; incomplete "Неповні спостереження; відомі ресурси залишаються утриманими" / "Incomplete observations; known resources remain held"; computeValue "{cpu} · {memory}" in both; exactMcpu "{value} mCPU" in both; exactBytes "{value} Б" / "{value} B". `title` is "Підтверджені ресурси" / "Confirmed resources".

Runtime-state resource keys: Allocated "Утримуються" / "Held"; Releasing "Звільнення не підтверджено" / "Release unconfirmed"; Released "Звільнення підтверджено" / "Release confirmed"; Unknown as above. Storage-state keys: None "Не утримується" / "None held"; Retained "Збережено" / "Retained"; DeleteRequested "Видалення запитано" / "Deletion requested"; CleanupPending "Очищення не підтверджено" / "Cleanup unconfirmed"; Deleted "Видалення підтверджено" / "Deletion confirmed"; Unknown as above. Physical storage availability false always uses unknown text, not zero.

## Self-review and handoff

Each spec section is owned either by these UI tasks or the producer plans: aggregate lock/durable worker/native snapshot/barrier/physical stop/sizing belong to backend/Laboratory; F1–F4 render the first authoritative auto-stop; S1–S3 consume the full policy/manual/stage model. All five review-focus conditions have tests assigned above. S2/F4 and the companion backend/admin plan now share the exact frozen policy, allocation, observation and group fields above; implementation still waits for producer schema/behavior tests and primary review. All producer fields are frozen; no consumer shape is inferred during execution. No full-model completion claim follows from F1–F4 alone.

Plan review is the next primary-session step. Product changes and local commits remain gated until that review. No remote action is authorized.
