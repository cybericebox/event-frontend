import type {QueryClient} from "@tanstack/react-query";
import {compareRevision, type LabLifecycle} from "@/api/labLifecycle";
import type {OwnBoard, OwnChallenge, ChallengeSubmission} from "@/api/participantChallenges";
import type {ModeratorSubmission} from "@/api/moderatorsBoard";
import type {BoardMode} from "./ChallengeModal";
import {markSolved} from "./challengeBoardModel";

export const labLifecycleKey = (mode: BoardMode, eventID: string, labID: string) =>
    ["event-lab-lifecycle", mode, eventID, labID] as const;

export function newestLab(current: LabLifecycle | undefined, next: LabLifecycle): LabLifecycle {
    if (!current || current.ID !== next.ID) return next;
    // Solved closure is terminal even if a conflicting later reply permits restart.
    if (current.LogicalClosed && current.CloseReason === "solved" && (!next.LogicalClosed || next.CloseReason !== "solved")) return current;
    const order = compareRevision(next.Revision, current.Revision);
    return order < 0 || (order === 0 && current.LogicalClosed && !next.LogicalClosed) ? current : next;
}

export function rememberLab(client: QueryClient, mode: BoardMode, eventID: string, next: LabLifecycle): LabLifecycle {
    const key = labLifecycleKey(mode, eventID, next.ID);
    // Keep the largest observed revision for this session, including when no modal observes it.
    client.getQueryCache().build<LabLifecycle>(client, {queryKey: key, gcTime: Infinity});
    client.setQueryData<LabLifecycle>(key, current => newestLab(current, next));
    return client.getQueryData<LabLifecycle>(key)!;
}

export function reconcileChallenges(client: QueryClient, mode: BoardMode, eventID: string, challenges: OwnChallenge[]): OwnChallenge[] {
    // A later question can carry a newer revision of the same shared Lab.
    for (const item of challenges) if (item.Lab) rememberLab(client, mode, eventID, item.Lab);
    return challenges.map(item => item.Lab ? {...item, Lab: client.getQueryData<LabLifecycle>(labLifecycleKey(mode, eventID, item.Lab.ID))!} : item);
}

export function reconcileBoard(client: QueryClient, mode: BoardMode, eventID: string, board: OwnBoard): OwnBoard {
    return {...board, Challenges: reconcileChallenges(client, mode, eventID, board.Challenges)};
}

export function applySubmission(client: QueryClient, eventID: string, id: string, result: ChallengeSubmission, at: string): void {
    if (result.Lab) rememberLab(client, "participant", eventID, result.Lab);
    client.setQueryData<OwnBoard>(["event-own-challenges", eventID], old => {
        if (!old) return old;
        const Challenges = !result.Correct ? old.Challenges : result.Practice
            ? old.Challenges.map(item => item.EventChallengeID === id ? {...item, Practice: true, AttemptsLeft: null} : item)
            : markSolved(old.Challenges, id, at);
        return reconcileBoard(client, "participant", eventID, {...old, Challenges});
    });
}

export function applyModeratorSubmission(client: QueryClient, eventID: string, id: string, result: ModeratorSubmission, at: string): void {
    if (result.Lab) rememberLab(client, "moderators", eventID, result.Lab);
    client.setQueryData<OwnChallenge[]>(["event-moderators-board", eventID], old => old &&
        reconcileChallenges(client, "moderators", eventID, result.Correct ? markSolved(old, id, at) : old));
}
