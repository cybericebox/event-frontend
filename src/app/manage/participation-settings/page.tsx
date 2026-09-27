"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {AlertTriangle} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, type ManageConfig, type ManageConfigInput} from "@/api/manage";
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
    const valid = !!config && config.Participation !== null && (config.Participation !== 1 || (config.MaxTeamSize >= 1 && (!config.MinTeamSize || config.MinTeamSize <= config.MaxTeamSize))) && (!config.DynamicLabsPlanned || !!lifecycleQuery.data?.Infrastructure.LaboratoriesAvailable || !!configQuery.data?.DynamicLabsPlanned);
    const disabled = !canManage || saving;

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !valid || disabled || !dirty) return;
        setSaving(true);
        try {
            const updated = await putManageConfig(eventID, config);
            queryClient.setQueryData(["event-management-config", eventID], updated);
            queryClient.setQueryData<typeof event>(["event-manager-public-info"], current => current ? {...current, Participation: updated.Participation} : current);
            setEdit(null);
            toast.success("Формат події збережено");
        } catch (failure) {toast.error(failure instanceof ManageApiError && failure.status === 409 ? "Формат події вже зафіксовано після публікації." : "Не вдалося зберегти формат події.");}
        finally {setSaving(false);}
    }

    if (configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || lifecycleQuery.isError || !config) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити формат події</h1><button className="ib-btn" onClick={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Формат події</h1><p>Визначте, хто бере участь і чи будуть завдання з інфраструктурою.</p></div></header>
        <section className="event-manage-section">
            <ManageFieldLabel title="Формат участі" help={"Оберіть, хто проходить завдання та отримує бали: окремий учасник або команда.\n\nФормат можна змінити лише до публікації."} required />
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Тип участі">
                <label><input type="radio" name="participation" checked={config.Participation === 0} onChange={() => update({Participation: 0})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>Особиста участь</strong><ul className="event-manage-choice-points"><li>Кожен грає зі свого облікового запису.</li><li>Розв’язання та бали належать учаснику.</li><li>Команди не створюються.</li></ul></div></label>
                <label><input type="radio" name="participation" checked={config.Participation === 1} onChange={() => update({Participation: 1})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>Командна участь</strong><ul className="event-manage-choice-points"><li>Учасники об’єднуються в команди.</li><li>Розв’язання учасника зараховується команді.</li><li>Бали та місце визначаються для команди.</li></ul></div></label>
            </div>
            {config.Participation === 1 && <div className="event-manage-fields-two">
                <div className="event-manage-field"><ManageFieldLabel htmlFor="max-team-size" title="Максимум у команді" help={"Найбільша кількість учасників в одній команді.\n\nПісля публікації змінити не можна."} required /><input id="max-team-size" className="event-manage-input" type="number" min={1} value={config.MaxTeamSize} onChange={change => update({MaxTeamSize: Number(change.target.value)})} disabled={disabled || locked} /></div>
                <div className="event-manage-field"><ManageFieldLabel htmlFor="min-team-size" title="Мінімум у команді" help={"Найменша дозволена кількість учасників у команді.\n\nЗалиште порожнім, якщо обмеження не потрібне."} /><input id="min-team-size" className="event-manage-input" type="number" min={1} max={config.MaxTeamSize} value={config.MinTeamSize ?? ""} onChange={change => update({MinTeamSize: change.target.value ? Number(change.target.value) : null})} disabled={disabled || locked} /></div>
            </div>}
            <div className="event-manage-warning" role="note"><AlertTriangle size={18} aria-hidden="true" /><span>Після публікації змінити формат участі неможливо.</span></div>
        </section>
        <section className="event-manage-section">
            <ManageFieldLabel title="Наявність завдань з інфраструктурою" help={"Визначає, чи використовуватимуться завдання з окремою лабораторією для учасника або команди.\n\nДля таких завдань потрібна підключена інфраструктура. Цей вибір можна змінити лише до публікації."} required />
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Наявність завдань з інфраструктурою">
                <label><input type="radio" name="dynamic-labs" checked={!config.DynamicLabsPlanned} onChange={() => update({DynamicLabsPlanned: false})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>Без завдань з інфраструктурою</strong><small>Окрема інфраструктура для учасників не створюється.</small></div></label>
                <label className={!lifecycleQuery.data?.Infrastructure.LaboratoriesAvailable ? "is-unavailable" : undefined}><input type="radio" name="dynamic-labs" checked={config.DynamicLabsPlanned} onChange={() => update({DynamicLabsPlanned: true})} disabled={disabled || locked || !lifecycleQuery.data?.Infrastructure.LaboratoriesAvailable} /><div className="event-manage-choice-content"><strong>Із завданнями з інфраструктурою</strong><small>{lifecycleQuery.data?.Infrastructure.LaboratoriesAvailable ? "Для учасника або команди створюється окрема лабораторія." : "Інфраструктура не підключена. Зверніться до адміністратора."}</small></div></label>
            </div>
            <div className="event-manage-warning" role="note"><AlertTriangle size={18} aria-hidden="true" /><span>Після публікації змінити наявність завдань з інфраструктурою неможливо.</span></div>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
