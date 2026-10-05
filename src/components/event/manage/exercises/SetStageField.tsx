"use client";

import {useRef} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import {setExerciseStage, type ManageStage} from "@/api/manageStages";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";

const WHOLE_EVENT = "";

// The stage of one set: «Весь захід» or a stage. An instant control: the choice shows at once, saves run one after another
// and never disable it, and a refused change rolls back with the reason. Before a stage opens everything is free; once it
// has opened nothing leaves it, and a closed stage accepts nothing new (the server enforces the same).
export function SetStageField({eventID, attachment, stages, canManage}: {eventID: string; attachment: EventExerciseAttachment; stages: ManageStage[]; canManage: boolean}) {
    const queryClient = useQueryClient();
    const queue = useRef<Promise<void>>(Promise.resolve());
    const key = ["event-exercise-attachments", eventID];
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
        queue.current = queue.current.then(async () => {
            const wanted = queryClient.getQueryData<EventExerciseAttachment[]>(key)?.find(item => item.ID === attachment.ID)?.StageID ?? null;
            try {
                await setExerciseStage(eventID, attachment.ID, wanted);
                toast.success(t("manage.stages.set.saved"));
            } catch (failure) {
                await queryClient.invalidateQueries({queryKey: key});
                toast.error(failure instanceof ManageApiError ? apiErrorMessage(failure.code, t("manage.stages.set.saveFailed")) : t("manage.stages.set.saveFailed"));
            }
        });
    }

    return <div className="event-exercise-set__stage">
        <label className="event-exercise-set__stage-label" id={`set-stage-${attachment.ID}`}>{t("manage.stages.set.label")}</label>
        <EventSelect ariaLabel={`${t("manage.stages.set.label")}: ${attachment.ExerciseName}`} value={attachment.StageID ?? WHOLE_EVENT} options={options} onValueChange={choose} disabled={!canManage || locked} />
        {locked && <p className="ib-cmodal__hint event-exercise-set__stage-note">{t("manage.stages.set.openedLocked")}</p>}
        {current?.State === "open" && <p className="ib-cmodal__hint event-exercise-set__stage-note" role="status">{t("manage.stages.set.openNote")}</p>}
    </div>;
}
