"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {AlertTriangle} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, putManageConfig, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";

function asInput(config: ManageConfig): ManageConfigInput {
    return {Participation: config.Participation, Registration: config.Registration, ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility, PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture, MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams, DynamicLabsPlanned: config.DynamicLabsPlanned};
}

export default function ParticipationSettingsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ManageConfigInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = edit?.eventID === eventID ? edit.value : configQuery.data ? asInput(configQuery.data) : null;
    const update = (patch: Partial<ManageConfigInput>) => {if (config) setEdit({eventID, value: {...config, ...patch}});};
    const dirty = !!config && !!configQuery.data && JSON.stringify(config) !== JSON.stringify(asInput(configQuery.data));
    const locked = !!lifecycleQuery.data?.Configured && lifecycleQuery.data.Status !== "not_published";
    const valid = !!config && config.Participation !== null;
    const disabled = !canManage || saving;

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !valid || disabled || !dirty) return;
        setSaving(true);
        try {
            const updated = await putManageConfig(eventID, config);
            queryClient.setQueryData(["event-management-config", eventID], updated);
            setEdit(null);
            toast.success("Формат участі збережено");
        } catch {toast.error("Не вдалося зберегти формат участі.");}
        finally {setSaving(false);}
    }

    if (configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || lifecycleQuery.isError || !config) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити формат участі</h1><button className="ib-btn" onClick={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Формат участі</h1><p>Визначає, кому зараховуються розв’язання та бали.</p></div></header>
        <section className="event-manage-section">
            <ManageFieldLabel title="Тип участі" help={"Оберіть, хто проходить завдання та отримує бали: окремий учасник або команда.\n\nФормат можна змінити лише до публікації."} required />
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Тип участі">
                <label><input type="radio" name="participation" checked={config.Participation === 0} onChange={() => update({Participation: 0})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>Особиста участь</strong><ul className="event-manage-choice-points"><li>Кожен грає зі свого облікового запису.</li><li>Розв’язання та бали належать учаснику.</li><li>Команди не створюються.</li></ul></div></label>
                <label><input type="radio" name="participation" checked={config.Participation === 1} onChange={() => update({Participation: 1})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>Командна участь</strong><ul className="event-manage-choice-points"><li>Учасники об’єднуються в команди.</li><li>Розв’язання учасника зараховується команді.</li><li>Бали та місце визначаються для команди.</li></ul></div></label>
            </div>
            <div className="event-manage-warning" role="note"><AlertTriangle size={18} aria-hidden="true" /><span>Після публікації змінити формат участі неможливо.</span></div>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
