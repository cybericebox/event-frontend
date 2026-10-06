"use client";

import {useQuery, useQueryClient, type QueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getEventExerciseAttachments, type EventExerciseAttachment} from "@/api/manageChallenges";
import {setExerciseStage, type ManageStage} from "@/api/manageStages";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";

const WHOLE_EVENT = "";

// One save chain per cache and event: changes of different sets never race either.
const queues = new WeakMap<QueryClient, Map<string, Promise<void>>>();
// Puts one set back to what the server has, without touching the others (they may hold choices that are still saving).
async function restore(queryClient: QueryClient, eventID: string, attachmentID: string, key: unknown[]) {
    try {
        const fresh = (await getEventExerciseAttachments(eventID)).find(item => item.ID === attachmentID);
        if (fresh) queryClient.setQueryData<EventExerciseAttachment[]>(key, items => (items ?? []).map(item => item.ID === attachmentID ? fresh : item));
    } catch {
        // the toast below already tells the save failed
    }
}

function enqueue(queryClient: QueryClient, eventID: string, job: () => Promise<void>) {
    const byEvent = queues.get(queryClient) ?? new Map<string, Promise<void>>();
    queues.set(queryClient, byEvent);
    const next = (byEvent.get(eventID) ?? Promise.resolve()).then(job);
    byEvent.set(eventID, next);
}

// The stage of one set: «Весь захід» or a stage. An instant control: the choice shows at once, saves run one after another
// and never disable it, and a refused change rolls back with the reason. Before a stage opens everything is free; once it
// has opened nothing leaves it, and a closed stage accepts nothing new (the server enforces the same).
export function SetStageField({eventID, attachment: shownAttachment, stages, canManage}: {eventID: string; attachment: EventExerciseAttachment; stages: ManageStage[]; canManage: boolean}) {
    const queryClient = useQueryClient();
    const key = ["event-exercise-attachments", eventID];
    // The set on the board is a copy taken when the board loaded; the attachments cache is where a stage change lands, so it wins.
    const live = useQuery({queryKey: key, queryFn: () => getEventExerciseAttachments(eventID), staleTime: Infinity, refetchOnWindowFocus: false, select: items => items.find(item => item.ID === shownAttachment.ID)});
    const attachment = live.data ? {...shownAttachment, StageID: live.data.StageID} : shownAttachment;
    const current = stages.find(stage => stage.ID === attachment.StageID);
    const locked = !!current && current.State !== "upcoming";
    const options = [
        {value: WHOLE_EVENT, label: t("manage.stages.set.whole")},
        ...stages.map(stage => stage.State === "closed" && stage.ID !== attachment.StageID
            ? {value: stage.ID, label: t("manage.stages.set.closedOption", {name: stage.Name}), disabled: true}
            : {value: stage.ID, label: stage.Name}),
    ];

    function choose(value: string) {
        if (!canManage || locked || (attachment.StageID ?? WHOLE_EVENT) === value) return;
        queryClient.setQueryData<EventExerciseAttachment[]>(key, items => (items ?? []).map(item => item.ID === attachment.ID ? {...item, StageID: value || null} : item));
        enqueue(queryClient, eventID, async () => {
            const shownOf = () => queryClient.getQueryData<EventExerciseAttachment[]>(key)?.find(item => item.ID === attachment.ID);
            const wanted = shownOf()?.StageID ?? null;
            try {
                const saved = await setExerciseStage(eventID, attachment.ID, wanted);
                toast.success(t("manage.stages.set.saved"));
                // Take the server's answer for this set only when no newer change of it is waiting; other sets stay as they are.
                const shown = shownOf();
                if (saved && shown && (shown.StageID ?? null) === wanted && JSON.stringify(saved) !== JSON.stringify(shown)) {
                    queryClient.setQueryData<EventExerciseAttachment[]>(key, items => (items ?? []).map(item => item.ID === saved.ID ? saved : item));
                }
            } catch (failure) {
                // Roll back just this set to what the server has; the other sets' optimistic choices are left alone.
                await restore(queryClient, eventID, attachment.ID, key);
                toast.error(failure instanceof ManageApiError ? apiErrorMessage(failure.code, t("manage.stages.set.saveFailed")) : t("manage.stages.set.saveFailed"));
            }
        });
    }

    return <div className="event-exercise-set__stage">
        <label className="event-exercise-set__stage-label" id={`set-stage-${attachment.ID}`}>{t("manage.stages.set.label")}</label>
        <EventSelect ariaLabel={t("manage.stages.set.labelOf", {name: attachment.ExerciseName})} value={attachment.StageID ?? WHOLE_EVENT} options={options} onValueChange={choose} disabled={!canManage || locked} />
        {locked && <p className="ib-cmodal__hint event-exercise-set__stage-note">{t("manage.stages.set.openedLocked")}</p>}
        {current?.State === "open" && <p className="ib-cmodal__hint event-exercise-set__stage-note" role="status">{t("manage.stages.set.openNote")}</p>}
    </div>;
}
