"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CircleHelp, Info} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, putManageConfig, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventTooltip} from "@/components/ui/EventTooltip";

function asInput(config: ManageConfig): ManageConfigInput {
    return {Participation: config.Participation, Registration: config.Registration, ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility, PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture, MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams, DynamicLabsPlanned: config.DynamicLabsPlanned};
}

function FieldLabel({htmlFor, title, help, required = false}: {htmlFor: string; title: string; help: string; required?: boolean}) {
    return <div className="event-brand-field__head"><label htmlFor={htmlFor}>{title}{required && <span className="event-field-required" aria-label="Обов’язкове поле">*</span>}</label><EventTooltip content={help}>{id => <button className="event-brand-help" type="button" aria-label={`Про поле «${title}»`} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>;
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
    const valid = !!config && config.Participation !== null && config.MaxTeamSize >= 1 && (!config.MinTeamSize || config.MinTeamSize <= config.MaxTeamSize) && (!config.MaxTeams || config.MaxTeams >= 1);
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
        <header className="event-manage-heading"><div><h1>Формат участі</h1><p>Визначає, чи виконують завдання окремі учасники, чи команди.</p></div></header>
        <section className="event-manage-section">
            <div className="event-brand-field__head"><span>Тип участі<span className="event-field-required" aria-label="Обов’язкове поле">*</span></span><EventTooltip content="Виберіть формат до публікації. Після публікації змінити його не можна.">{id => <button className="event-brand-help" type="button" aria-label="Про тип участі" aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Тип участі">
                <label><input type="radio" name="participation" checked={config.Participation === 0} onChange={() => update({Participation: 0})} disabled={disabled || locked} /><span><strong>Особиста участь</strong><small>Кожен учасник проходить завдання самостійно.</small></span></label>
                <label><input type="radio" name="participation" checked={config.Participation === 1} onChange={() => update({Participation: 1})} disabled={disabled || locked} /><span><strong>Командна участь</strong><small>Учасники об’єднуються в команди.</small></span></label>
            </div>
            {locked && <div className="event-manage-notice" role="status"><Info size={18} />Формат участі та розмір команди зафіксовано після публікації.</div>}
            {config.Participation === 1 && <>
                <div className="event-manage-section__head"><h2>Параметри команд</h2></div>
                <div className="event-manage-fields-three">
                    <div className="event-manage-field"><FieldLabel htmlFor="max-team-size" title="Максимум у команді" help="Найбільша дозволена кількість учасників у команді. Після публікації змінити не можна." required /><input id="max-team-size" className="event-manage-input" type="number" min={1} value={config.MaxTeamSize} onChange={change => update({MaxTeamSize: Number(change.target.value)})} disabled={disabled || locked} /></div>
                    <div className="event-manage-field"><FieldLabel htmlFor="min-team-size" title="Мінімум у команді" help="Мінімальна кількість учасників у команді. Залиште порожнім, якщо обмеження не потрібне." /><input id="min-team-size" className="event-manage-input" type="number" min={1} max={config.MaxTeamSize} value={config.MinTeamSize ?? ""} onChange={change => update({MinTeamSize: change.target.value ? Number(change.target.value) : null})} disabled={disabled || locked} /></div>
                    <div className="event-manage-field"><FieldLabel htmlFor="max-teams" title="Кількість команд" help="Максимальна кількість команд. Залиште порожнім, якщо обмеження не потрібне." /><input id="max-teams" className="event-manage-input" type="number" min={1} value={config.MaxTeams ?? ""} onChange={change => update({MaxTeams: change.target.value ? Number(change.target.value) : null})} disabled={disabled} /></div>
                </div>
            </>}
            <div className="event-manage-section__head"><h2>Лабораторії</h2></div>
            <div className="event-manage-field"><FieldLabel htmlFor="dynamic-labs" title="Динамічні лабораторії" help="Для учасника або команди будуть підготовлені VPN та інтернет-шлюз до появи завдань." /><label className="event-manage-check" htmlFor="dynamic-labs"><input id="dynamic-labs" type="checkbox" checked={config.DynamicLabsPlanned} onChange={change => update({DynamicLabsPlanned: change.target.checked})} disabled={disabled} /><span>Плануються динамічні лабораторії</span></label></div>
        </section>
        {!valid && config.Participation === 1 && <p className="event-manage-validation" role="alert">Перевірте обмеження команди.</p>}
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
