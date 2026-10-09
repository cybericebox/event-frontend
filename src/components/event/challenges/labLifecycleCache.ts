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

type QuestionLabPin = {Lab: LabLifecycle; EventExerciseID: string | null};

// Attachment pins live in the same clearable query session, isolated by identity and team.
export function questionLabPinKey(client: QueryClient, mode: BoardMode, eventID: string, questionID: string) {
    const account = client.getQueryData<{ID: string}>(["event-current-user"])?.ID ?? null;
    const team = client.getQueryData<{ID: string}>(["event-own-team", eventID])?.ID ?? null;
    return ["event-question-lab-pin", mode, eventID, account, team, questionID] as const;
}

export function rememberQuestionLab(client: QueryClient, mode: BoardMode, eventID: string, questionID: string, lab: LabLifecycle,
    eventExerciseID: string | null = lab.EventExerciseID) {
    const key = questionLabPinKey(client, mode, eventID, questionID);
    client.getQueryCache().build<QuestionLabPin>(client, {queryKey: key, gcTime: Infinity});
    client.setQueryData<QuestionLabPin>(key, current => ({Lab: newestLab(current?.Lab, lab), EventExerciseID: eventExerciseID}));
}

export function knownQuestionLab(client: QueryClient, mode: BoardMode, eventID: string, questionID: string | undefined,
    eventExerciseID?: string | null): LabLifecycle | undefined {
    if (!questionID) return undefined;
    const key = questionLabPinKey(client, mode, eventID, questionID);
    let pin = client.getQueryData<QuestionLabPin>(key);
    // Initial identity/team queries may settle after the first board. Bind an unknown scope once,
    // then remove its unbound slot so it can never follow a later account or team change.
    if (!pin && (key[3] !== null || key[4] !== null)) {
        for (const [account, team] of [[null, key[4]], [key[3], null], [null, null]] as const) {
            const initialKey = [key[0], key[1], key[2], account, team, key[5]] as const;
            const initial = client.getQueryData<QuestionLabPin>(initialKey);
            if (!initial) continue;
            client.getQueryCache().build<QuestionLabPin>(client, {queryKey: key, gcTime: Infinity});
            client.setQueryData(key, initial);
            client.removeQueries({queryKey: initialKey, exact: true});
            pin = initial;
            break;
        }
    }
    if (!pin || (eventExerciseID && pin.EventExerciseID && eventExerciseID !== pin.EventExerciseID)) return undefined;
    const shared = client.getQueryData<LabLifecycle>(labLifecycleKey(mode, eventID, pin.Lab.ID));
    return shared ? newestLab(pin.Lab, shared) : pin.Lab;
}

export function rememberRuntimeQuestionLab(client: QueryClient, mode: BoardMode, eventID: string, questionID: string, lab: LabLifecycle) {
    const board = client.getQueryData<OwnBoard | OwnChallenge[]>([mode === "participant" ? "event-own-challenges" : "event-moderators-board", eventID]);
    const rows = Array.isArray(board) ? board : board?.Challenges;
    const question = rows?.find(row => row.EventChallengeID === questionID);
    if (rows && !question) return;
    if (question?.EventExerciseID && question.EventExerciseID !== lab.EventExerciseID) return;
    const attached = question?.Lab ?? knownQuestionLab(client, mode, eventID, questionID, question?.EventExerciseID);
    // A delayed runtime reply cannot replace an explicit attachment to another generation.
    if (attached && attached.ID !== lab.ID) return;
    rememberQuestionLab(client, mode, eventID, questionID, lab);
}

export function reconcileChallenges(client: QueryClient, mode: BoardMode, eventID: string, challenges: OwnChallenge[]): OwnChallenge[] {
    // A present attachment may explicitly replace an old generation. Missing identity cannot erase it.
    for (const item of challenges) {
        if (item.Lab) {
            const latest = rememberLab(client, mode, eventID, item.Lab);
            rememberQuestionLab(client, mode, eventID, item.EventChallengeID, latest, item.EventExerciseID ?? latest.EventExerciseID);
        } else if (item.EventExerciseID && !knownQuestionLab(client, mode, eventID, item.EventChallengeID, item.EventExerciseID)) {
            client.removeQueries({queryKey: questionLabPinKey(client, mode, eventID, item.EventChallengeID), exact: true});
        }
    }
    return challenges.map(item => {
        const lab = item.Lab
            ? client.getQueryData<LabLifecycle>(labLifecycleKey(mode, eventID, item.Lab.ID))!
            : knownQuestionLab(client, mode, eventID, item.EventChallengeID, item.EventExerciseID);
        return lab ? {...item, Lab: lab} : item;
    });
}

export function reconcileBoard(client: QueryClient, mode: BoardMode, eventID: string, board: OwnBoard): OwnBoard {
    return {...board, Challenges: reconcileChallenges(client, mode, eventID, board.Challenges)};
}

export function applySubmission(client: QueryClient, eventID: string, id: string, result: ChallengeSubmission, at: string): void {
    if (result.Lab) {
        const latest = rememberLab(client, "participant", eventID, result.Lab);
        rememberQuestionLab(client, "participant", eventID, id, latest);
    }
    client.setQueryData<OwnBoard>(["event-own-challenges", eventID], old => {
        if (!old) return old;
        const Challenges = !result.Correct ? old.Challenges : result.Practice
            ? old.Challenges.map(item => item.EventChallengeID === id ? {...item, Practice: true, AttemptsLeft: null} : item)
            : markSolved(old.Challenges, id, at);
        return reconcileBoard(client, "participant", eventID, {...old, Challenges});
    });
}

export function applyModeratorSubmission(client: QueryClient, eventID: string, id: string, result: ModeratorSubmission, at: string): void {
    if (result.Lab) {
        const latest = rememberLab(client, "moderators", eventID, result.Lab);
        rememberQuestionLab(client, "moderators", eventID, id, latest);
    }
    client.setQueryData<OwnChallenge[]>(["event-moderators-board", eventID], old => old &&
        reconcileChallenges(client, "moderators", eventID, result.Correct ? markSolved(old, id, at) : old));
}
