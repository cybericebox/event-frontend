"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CircleHelp} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, putManageConfig, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";

function asInput(config: ManageConfig): ManageConfigInput {
    return {Participation: config.Participation, Registration: config.Registration, ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility, PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture, MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams, DynamicLabsPlanned: config.DynamicLabsPlanned};
}

function FieldLabel({htmlFor, title, help, required = false}: {htmlFor?: string; title: string; help: string; required?: boolean}) {
    return <div className="event-brand-field__head"><label htmlFor={htmlFor}>{title}{required && <span className="event-field-required" aria-label="Обов’язкове поле">*</span>}</label><EventTooltip content={help}>{id => <button className="event-brand-help" type="button" aria-label={`Про поле «${title}»`} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>;
}

const visibilityOptions = [{value: "0", label: "Приховано"}, {value: "1", label: "Учасникам"}, {value: "2", label: "Усім"}];

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
    const valid = !!config && config.MaxTeamSize >= 1 && (!config.MinTeamSize || config.MinTeamSize <= config.MaxTeamSize) && (!config.MaxTeams || config.MaxTeams >= 1);
    const disabled = !canManage || saving;
    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !valid) return;
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
        <header className="event-manage-heading"><div><h1>Правила участі</h1><p>Формат, реєстрація, видимість і доступ до лабораторій.</p></div></header>
        <section className="event-manage-section">
            <div className="event-manage-fields-two">
                <div className="event-manage-field"><FieldLabel title="Формат участі" help="Особистий або командний формат. Після публікації змінити не можна." required /><EventSelect ariaLabel="Формат участі" value={String(config.Participation ?? "")} options={[{value: "", label: "Оберіть формат"}, {value: "0", label: "Особистий"}, {value: "1", label: "Командний"}]} onValueChange={value => update({Participation: value === "" ? null : Number(value) as 0 | 1})} disabled={disabled || locked} /></div>
                <div className="event-manage-field"><FieldLabel title="Реєстрація" help="Визначає, як люди подають заявку на участь." required /><EventSelect ariaLabel="Реєстрація" value={String(config.Registration)} options={[{value: "0", label: "Закрита"}, {value: "1", label: "За схваленням"}, {value: "2", label: "Відкрита"}]} onValueChange={value => update({Registration: Number(value) as 0 | 1 | 2})} disabled={disabled} /></div>
                <div className="event-manage-field"><FieldLabel title="Результати" help="Хто може бачити таблицю результатів." required /><EventSelect ariaLabel="Результати" value={String(config.ScoreboardVisibility)} options={visibilityOptions} onValueChange={value => update({ScoreboardVisibility: Number(value) as 0 | 1 | 2})} disabled={disabled} /></div>
                <div className="event-manage-field"><FieldLabel title="Список учасників" help="Хто може бачити список учасників." required /><EventSelect ariaLabel="Список учасників" value={String(config.ParticipantsVisibility)} options={visibilityOptions} onValueChange={value => update({ParticipantsVisibility: Number(value) as 0 | 1 | 2})} disabled={disabled} /></div>
            </div>
            {config.Participation === 1 && <div className="event-manage-fields-three">
                <div className="event-manage-field"><FieldLabel htmlFor="max-team-size" title="Максимум у команді" help="Найбільша дозволена кількість людей у команді." required /><input id="max-team-size" className="event-manage-input" type="number" min={1} value={config.MaxTeamSize} onChange={change => update({MaxTeamSize: Number(change.target.value)})} disabled={disabled || locked} /></div>
                <div className="event-manage-field"><FieldLabel htmlFor="min-team-size" title="Мінімум у команді" help="Порожнє поле означає відсутність обмеження." /><input id="min-team-size" className="event-manage-input" type="number" min={1} max={config.MaxTeamSize} value={config.MinTeamSize ?? ""} onChange={change => update({MinTeamSize: change.target.value ? Number(change.target.value) : null})} disabled={disabled || locked} /></div>
                <div className="event-manage-field"><FieldLabel htmlFor="max-teams" title="Кількість команд" help="Порожнє поле означає відсутність обмеження." /><input id="max-teams" className="event-manage-input" type="number" min={1} value={config.MaxTeams ?? ""} onChange={change => update({MaxTeams: change.target.value ? Number(change.target.value) : null})} disabled={disabled} /></div>
            </div>}
            <div className="event-manage-field"><FieldLabel htmlFor="dynamic-labs" title="Динамічні лабораторії" help="Для команди будуть підготовлені VPN та інтернет-шлюз ще до появи завдань." /><label className="event-manage-check" htmlFor="dynamic-labs"><input id="dynamic-labs" type="checkbox" checked={config.DynamicLabsPlanned} onChange={change => update({DynamicLabsPlanned: change.target.checked})} disabled={disabled} /><span>Плануються динамічні лабораторії</span></label></div>
        </section>
        {!valid && <p className="event-manage-validation" role="alert">Перевірте обмеження команди.</p>}
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
