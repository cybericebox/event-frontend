"use client";

import {useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {setEventExerciseVisibility, updateEventBoardChallenge, type EventBoardChallenge} from "@/api/manageChallenges";
import {t} from "@/i18n/t";
import {attachmentActionError} from "./attachmentModel";
import type {BoardSet} from "./challengeOrder";

// Saves of one event run one after another, whichever component started them.
const queues = new Map<string, Promise<void>>();
const waiting = new Map<string, number>();

const boardsKey = (eventID: string) => ["event-exercise-boards", eventID];

// Instant board controls (a set's visibility, a task's hints switch): the board
// cache changes before the server answers, nothing is disabled or reloaded, the
// server answer is applied only when it differs and no newer save waits, and a
// failure refetches the board and shows a toast.
export function useBoardMutations(eventID: string) {
    const queryClient = useQueryClient();

    function patchSets(change: (set: BoardSet) => BoardSet) {
        queryClient.setQueriesData<BoardSet[]>({queryKey: boardsKey(eventID)}, current => current?.map(change));
    }

    function enqueue(work: () => Promise<void>, fallback: string) {
        waiting.set(eventID, (waiting.get(eventID) ?? 0) + 1);
        const run = (queues.get(eventID) ?? Promise.resolve()).then(async () => {
            try {
                await work();
                waiting.set(eventID, (waiting.get(eventID) ?? 1) - 1);
            } catch (error) {
                waiting.set(eventID, (waiting.get(eventID) ?? 1) - 1);
                if (!waiting.get(eventID)) await queryClient.invalidateQueries({queryKey: boardsKey(eventID)});
                toast.error(attachmentActionError(error, fallback));
            }
        });
        queues.set(eventID, run);
    }

    function setPublished(attachmentID: string, published: boolean) {
        patchSets(set => set.attachment.ID === attachmentID ? {...set, challenges: set.challenges.map(challenge => ({...challenge, Published: published}))} : set);
        enqueue(async () => {await setEventExerciseVisibility(eventID, attachmentID, published);}, t("manage.challenges.set.visibilityFailed"));
    }

    function setHintsEnabled(attachmentID: string, challengeID: string, enabled: boolean) {
        const find = () => queryClient.getQueriesData<BoardSet[]>({queryKey: boardsKey(eventID)})
            .flatMap(([, sets]) => sets ?? []).find(set => set.attachment.ID === attachmentID)?.challenges.find(challenge => challenge.ID === challengeID);
        patchSets(set => set.attachment.ID === attachmentID ? {...set, challenges: set.challenges.map(challenge => challenge.ID === challengeID ? {...challenge, HintsEnabled: enabled} : challenge)} : set);
        enqueue(async () => {
            const current = find();
            if (!current) return;
            const saved = await updateEventBoardChallenge(eventID, attachmentID, challengeID, {Points: current.Points, HintsEnabled: current.HintsEnabled});
            const shown = find();
            // Apply the answer only when no newer save waits and it differs from what is shown.
            if ((waiting.get(eventID) ?? 0) <= 1 && shown && JSON.stringify(saved) !== JSON.stringify(shown as EventBoardChallenge)) {
                patchSets(set => set.attachment.ID === attachmentID ? {...set, challenges: set.challenges.map(challenge => challenge.ID === challengeID ? saved : challenge)} : set);
            }
        }, t("manage.exercises.challenge.saveFailed"));
    }

    return {setPublished, setHintsEnabled};
}
