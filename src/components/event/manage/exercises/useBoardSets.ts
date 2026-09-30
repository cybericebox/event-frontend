"use client";

import {keepPreviousData, useQuery, useQueryClient} from "@tanstack/react-query";
import {getEventBoardChallenges, getEventChallengeGroups, getEventExerciseAttachments} from "@/api/manageChallenges";
import type {BoardSet} from "./challengeOrder";

// The event's sets (active attachments with their board challenges) and groups,
// shared by «Групи й порядок» and «Завдання».
export function useBoardSets(eventID: string) {
    const queryClient = useQueryClient();
    const attachments = useQuery({queryKey: ["event-exercise-attachments", eventID], queryFn: () => getEventExerciseAttachments(eventID), refetchOnWindowFocus: false});
    const groups = useQuery({queryKey: ["event-challenge-groups", eventID], queryFn: () => getEventChallengeGroups(eventID), refetchOnWindowFocus: false});
    const active = (attachments.data ?? []).filter(item => item.Status === 0);
    const sets = useQuery({
        queryKey: ["event-exercise-boards", eventID, active.map(item => `${item.ID}:${item.Revision}`).join("|")],
        queryFn: async (): Promise<BoardSet[]> => Promise.all(active.map(async attachment => ({
            attachment, challenges: (await getEventBoardChallenges(eventID, attachment.ID)).sort((a, b) => a.Order - b.Order),
        }))),
        enabled: attachments.isSuccess, refetchOnWindowFocus: false,
        // The key follows the sets' revisions: keep the shown board while the new key loads.
        placeholderData: keepPreviousData,
    });
    const refreshSets = () => queryClient.invalidateQueries({queryKey: ["event-exercise-boards", eventID]});
    const refreshGroups = () => queryClient.invalidateQueries({queryKey: ["event-challenge-groups", eventID]});
    const refreshAll = () => Promise.all([
        queryClient.invalidateQueries({queryKey: ["event-exercise-attachments", eventID]}),
        refreshSets(), refreshGroups(),
        queryClient.invalidateQueries({queryKey: ["event-exercise-catalog", eventID]}),
    ]);
    return {
        attachments, groups, sets,
        pending: attachments.isPending || groups.isPending || sets.isPending,
        failed: attachments.isError || groups.isError || sets.isError,
        error: attachments.error ?? groups.error ?? sets.error,
        retry: () => void Promise.all([attachments.refetch(), groups.refetch(), sets.refetch()]),
        refreshSets, refreshGroups, refreshAll,
    };
}
