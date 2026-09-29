"use client";

import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Plus} from "lucide-react";
import {useManager} from "@/components/event/manage/ManagerShell";
import {AttachExerciseDialog} from "./AttachExerciseDialog";
import {ExerciseAttachments, useReturnURL} from "./ExerciseAttachments";
import {exercisesAppURL} from "./attachmentModel";
import {exercisesTabFromParam, exercisesTabHref, exercisesTabs, type ExercisesTab} from "./exercisesTabs";
import {HintUnlocksList} from "./HintUnlocksList";
import {exercisesOrigin} from "@/utils/origins";

export function ExercisesSection({initialTab}: {initialTab: string | undefined}) {
    const {event, canManage} = useManager();
    const queryClient = useQueryClient();
    const returnURL = useReturnURL();
    const [tab, setTab] = useState<ExercisesTab>(exercisesTabFromParam(initialTab));
    const [attachOpen, setAttachOpen] = useState(false);

    function change(value: ExercisesTab) {
        setTab(value);
        window.history.replaceState(null, "", exercisesTabHref(value));
    }

    return <div className="event-manage-settings event-challenge-manager">
        <header className="event-manage-heading">
            <div><h1>Завдання</h1><p>Набори з каталогу й власні завдання події.</p></div>
            {canManage && <div className="event-exercise-set__actions">
                <a className="ib-btn" href={exercisesAppURL(exercisesOrigin, "new", {eventID: event.EventID, returnURL})}>Створити завдання</a>
                <button className="ib-btn ib-btn--primary" type="button" onClick={() => setAttachOpen(true)}><Plus aria-hidden="true" />Додати набір</button>
            </div>}
        </header>
        <div className="event-manage-participants__filters" role="tablist" aria-label="Розділи завдань">{exercisesTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => change(option.value)}>{option.label}</button>)}</div>
        <div role="tabpanel" className="event-challenge-manager__panel">{tab === "sets" ? <ExerciseAttachments /> : <HintUnlocksList />}</div>
        {canManage && <AttachExerciseDialog eventID={event.EventID} open={attachOpen} onClose={() => setAttachOpen(false)}
            onAttached={() => Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-exercise-attachments", event.EventID]}),
                queryClient.invalidateQueries({queryKey: ["event-exercise-boards", event.EventID]}),
                queryClient.invalidateQueries({queryKey: ["event-exercise-catalog", event.EventID]}),
            ])} />}
    </div>;
}
