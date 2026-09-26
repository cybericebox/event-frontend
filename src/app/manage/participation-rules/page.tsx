"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Info} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, putManageConfig, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";

function asInput(config: ManageConfig): ManageConfigInput {
    return {Participation: config.Participation, Registration: config.Registration, ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility, PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture, MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams, DynamicLabsPlanned: config.DynamicLabsPlanned};
}

export default function ParticipationRulesPage() {
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
    const valid = !!config && config.MaxTeamSize >= 1 && (!config.MinTeamSize || config.MinTeamSize <= config.MaxTeamSize) && (!config.MaxTeams || config.MaxTeams >= 1);
    const disabled = !canManage || saving;

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !valid || disabled || !dirty) return;
        setSaving(true);
        try {
            const updated = await putManageConfig(eventID, config);
            queryClient.setQueryData(["event-management-config", eventID], updated);
            setEdit(null);
            toast.success("Правила участі збережено");
        } catch {toast.error("Не вдалося зберегти правила участі.");}
        finally {setSaving(false);}
    }

    if (configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || lifecycleQuery.isError || !config) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити правила участі</h1><button className="ib-btn" onClick={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Правила участі</h1><p>Обмеження команд і підготовка лабораторій.</p></div></header>
        {config.Participation === 1 && <section className="event-manage-section">
                <div className="event-manage-section__head"><h2>Команди</h2></div>
                {locked && <div className="event-manage-notice" role="status"><Info size={18} />Розмір команди зафіксовано після публікації.</div>}
                <div className="event-manage-fields-three">
                    <div className="event-manage-field"><ManageFieldLabel htmlFor="max-team-size" title="Максимум у команді" help={"Найбільша кількість учасників, які можуть бути в одній команді.\n\nПісля публікації змінити не можна."} required /><input id="max-team-size" className="event-manage-input" type="number" min={1} value={config.MaxTeamSize} onChange={change => update({MaxTeamSize: Number(change.target.value)})} disabled={disabled || locked} /></div>
                    <div className="event-manage-field"><ManageFieldLabel htmlFor="min-team-size" title="Мінімум у команді" help={"Найменша дозволена кількість учасників у команді.\n\nЗалиште порожнім, якщо обмеження не потрібне."} /><input id="min-team-size" className="event-manage-input" type="number" min={1} max={config.MaxTeamSize} value={config.MinTeamSize ?? ""} onChange={change => update({MinTeamSize: change.target.value ? Number(change.target.value) : null})} disabled={disabled || locked} /></div>
                    <div className="event-manage-field"><ManageFieldLabel htmlFor="max-teams" title="Кількість команд" help={"Максимальна кількість команд у події.\n\nЗалиште порожнім, якщо обмеження не потрібне."} /><input id="max-teams" className="event-manage-input" type="number" min={1} value={config.MaxTeams ?? ""} onChange={change => update({MaxTeams: change.target.value ? Number(change.target.value) : null})} disabled={disabled} /></div>
                </div>
            </section>}
        <section className="event-manage-section">
            <div className="event-manage-section__head"><h2>Лабораторії</h2></div>
            <div className="event-manage-field"><ManageFieldLabel htmlFor="dynamic-labs" title="Динамічні лабораторії" help={"Увімкніть, якщо для учасника або команди потрібні окремі лабораторії.\n\nVPN та інтернет-шлюз буде підготовлено до появи завдань."} /><label className="event-manage-check" htmlFor="dynamic-labs"><input id="dynamic-labs" type="checkbox" checked={config.DynamicLabsPlanned} onChange={change => update({DynamicLabsPlanned: change.target.checked})} disabled={disabled} /><span>Плануються динамічні лабораторії</span></label></div>
        </section>
        {!valid && config.Participation === 1 && <p className="event-manage-validation" role="alert">Перевірте обмеження команди.</p>}
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
