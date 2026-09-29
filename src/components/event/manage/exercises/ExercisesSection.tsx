"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getManageConfig, getManageLifecycle} from "@/api/manage";
import {Plus} from "lucide-react";
import {useManager} from "@/components/event/manage/ManagerShell";
import {AttachExerciseDialog} from "./AttachExerciseDialog";
import {ExerciseAttachments, useReturnURL} from "./ExerciseAttachments";
import {exercisesAppURL} from "./attachmentModel";
import {exercisesOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";
import "./challengesManage.css";

export function ExercisesSection() {
    const {event, canManage} = useManager();
    const queryClient = useQueryClient();
    const returnURL = useReturnURL();
    const [attachOpen, setAttachOpen] = useState(false);
    const config = useQuery({queryKey: ["event-management-config", event.EventID], queryFn: () => getManageConfig(event.EventID), refetchOnWindowFocus: false});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", event.EventID], queryFn: () => getManageLifecycle(event.EventID), refetchOnWindowFocus: false});

    return <div className="event-manage-settings event-challenge-manager">
        <header className="event-manage-heading">
            <div><h1>{t("manage.exercises.title")}</h1><p>{t("manage.exercises.subtitle")}</p></div>
            {canManage && <div className="event-exercise-set__actions">
                <a className="ib-btn" href={exercisesAppURL(exercisesOrigin, "new", {eventID: event.EventID, returnURL})}>{t("manage.exercises.create")}</a>
                <button className="ib-btn ib-btn--primary" type="button" onClick={() => setAttachOpen(true)}><Plus aria-hidden="true" />{t("manage.exercises.attach")}</button>
            </div>}
        </header>
        <ExerciseAttachments />
        {canManage && config.data && <AttachExerciseDialog eventID={event.EventID} infrastructureAllowed={config.data.InfrastructureAllowed} published={!!lifecycle.data && lifecycle.data.Status !== "not_published"} open={attachOpen} onClose={() => setAttachOpen(false)}
            onAttached={() => Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-exercise-attachments", event.EventID]}),
                queryClient.invalidateQueries({queryKey: ["event-exercise-boards", event.EventID]}),
                queryClient.invalidateQueries({queryKey: ["event-exercise-catalog", event.EventID]}),
            ])} />}
    </div>;
}
