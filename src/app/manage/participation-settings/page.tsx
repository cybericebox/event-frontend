"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {AlertTriangle} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, manageConfigInput, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";


export default function ParticipationSettingsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ManageConfigInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = edit?.eventID === eventID ? edit.value : configQuery.data ? manageConfigInput(configQuery.data) : null;
    const update = (patch: Partial<ManageConfigInput>) => {if (config) setEdit({eventID, value: {...config, ...patch}});};
    const dirty = !!config && !!configQuery.data && JSON.stringify(config) !== JSON.stringify(manageConfigInput(configQuery.data));
    const locked = !!lifecycleQuery.data?.Configured && lifecycleQuery.data.Status !== "not_published";
    const valid = !!config && config.Participation !== null && (config.Participation !== 1 || (config.MaxTeamSize >= 1 && (!config.MinTeamSize || config.MinTeamSize <= config.MaxTeamSize)));
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
            toast.success("Формат участі збережено");
        } catch (failure) {toast.error(failure instanceof ManageApiError && failure.status === 409 ? "Формат участі вже зафіксовано після публікації." : "Не вдалося зберегти формат участі.");}
        finally {setSaving(false);}
    }

    if (configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || lifecycleQuery.isError || !config) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити формат участі</h1><button className="ib-btn" onClick={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Формат участі</h1><p>Визначте, хто змагається: окремі учасники чи команди.</p></div></header>
        <section className="event-manage-section">
            <ManageFieldLabel title="Формат участі" help={"Оберіть, хто проходить завдання та отримує бали: окремий учасник або команда.\n\nФормат можна змінити лише до публікації."} required />
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Тип участі">
                <label><input type="radio" name="participation" checked={config.Participation === 0} onChange={() => update({Participation: 0})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>Особиста участь</strong><ul className="event-manage-choice-points"><li>Кожен учасник змагається самостійно.</li><li>Розв’язання, бали й місце — особисті.</li><li>У рейтингу показується ім’я або псевдонім учасника.</li></ul></div></label>
                <label><input type="radio" name="participation" checked={config.Participation === 1} onChange={() => update({Participation: 1})} disabled={disabled || locked} /><div className="event-manage-choice-content"><strong>Командна участь</strong><ul className="event-manage-choice-points"><li>Учасники об’єднуються в команди.</li><li>Розв’язання учасника зараховується команді.</li><li>Бали та місце визначаються для команди.</li></ul></div></label>
            </div>
            {config.Participation === 1 && <div className="event-manage-fields-two">
                <div className="event-manage-field"><ManageFieldLabel htmlFor="max-team-size" title="Максимум у команді" help={"Найбільша кількість учасників в одній команді.\n\nПісля публікації змінити не можна."} required /><input id="max-team-size" className="event-manage-input" type="number" min={1} value={config.MaxTeamSize} onChange={change => update({MaxTeamSize: Number(change.target.value)})} disabled={disabled || locked} /></div>
                <div className="event-manage-field"><ManageFieldLabel htmlFor="min-team-size" title="Мінімум у команді" help={"Команда з меншою кількістю учасників не допускається до завдань, доки її не допустить модератор.\n\nЯкщо поле порожнє, мінімум — 2 учасники (або максимум, якщо він менший)."} /><input id="min-team-size" className="event-manage-input" type="number" min={1} max={config.MaxTeamSize} placeholder={String(Math.min(2, config.MaxTeamSize || 2))} value={config.MinTeamSize ?? ""} onChange={change => update({MinTeamSize: change.target.value ? Number(change.target.value) : null})} disabled={disabled || locked} /></div>
            </div>}
            <div className="event-manage-warning" role="note"><AlertTriangle size={18} aria-hidden="true" /><span>Після публікації змінити формат участі неможливо.</span></div>
        </section>
        <section className="event-manage-section">
            <ManageFieldLabel title="Завдання з інфраструктурою" help={"Дозвіл на завдання з окремою лабораторією для команди задає адміністратор під час створення події.\n\nЗмінити його після створення не можна."} />
            <p className="event-manage-readonly-note">Завдання з інфраструктурою: {configQuery.data?.InfrastructureAllowed ? "дозволено" : "не дозволено"} адміністратором під час створення події.</p>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
