import type {QueryClient} from "@tanstack/react-query";
import type {LabLifecycle} from "@/api/labLifecycle";
import type {LabRuntime} from "@/api/manageLabs";
import type {OwnBoard, OwnChallenge} from "@/api/participantChallenges";
import type {BoardMode} from "./ChallengeModal";
import {labLifecycleKey, newestLab} from "./labLifecycleCache";

export const taskBoardKey = (mode: BoardMode, eventID: string) =>
    [mode === "moderators" ? "event-moderators-board" : "event-own-challenges", eventID] as const;

// The task attachment chooses the Lab identity. Revisions order only observations of that Lab.
export function labAccessScope(client: QueryClient, mode: BoardMode, eventID: string, challengeID: string | undefined,
    fallback: LabLifecycle | null | undefined, runtime: LabRuntime | undefined): {lifecycle: LabLifecycle | undefined; identityMismatch: boolean} {
    const board = client.getQueryData<OwnBoard | OwnChallenge[]>(taskBoardKey(mode, eventID));
    const tasks = Array.isArray(board) ? board : board?.Challenges;
    const task = tasks?.find(item => item.EventChallengeID === challengeID);
    const attached = tasks ? task?.Lab : fallback ?? runtime?.Lab;
    let lifecycle = attached ?? undefined;
    const raw = runtime?.Lab;
    const shared = attached && client.getQueryData<LabLifecycle>(labLifecycleKey(mode, eventID, attached.ID));
    for (const observation of [fallback, shared, raw]) {
        if (lifecycle && observation?.ID === lifecycle.ID) lifecycle = newestLab(lifecycle, observation);
    }
    return {lifecycle, identityMismatch: (!!tasks && !task) || (!!raw && raw.ID !== attached?.ID)};
}
