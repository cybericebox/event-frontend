"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CircleHelp} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, putManageConfig, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";

function asInput(config: ManageConfig): ManageConfigInput {
    return {Participation: config.Participation, Registration: config.Registration, ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility, PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture, MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams, DynamicLabsPlanned: config.DynamicLabsPlanned};
}

function FieldLabel({title, help}: {title: string; help: string}) {
    return <div className="event-brand-field__head"><span>{title}<span className="event-field-required" aria-label="Обов’язкове поле">*</span></span><EventTooltip content={help}>{id => <button className="event-brand-help" type="button" aria-label={`Про поле «${title}»`} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>;
}

const visibilityOptions = [{value: "0", label: "Приховано"}, {value: "1", label: "Учасникам"}, {value: "2", label: "Усім"}];

export default function VisibilityPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ManageConfigInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = edit?.eventID === eventID ? edit.value : configQuery.data ? asInput(configQuery.data) : null;
    const update = (patch: Partial<ManageConfigInput>) => {if (config) setEdit({eventID, value: {...config, ...patch}});};
    const dirty = !!config && !!configQuery.data && JSON.stringify(config) !== JSON.stringify(asInput(configQuery.data));

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !canManage || saving || !dirty) return;
        setSaving(true);
        try {
            const updated = await putManageConfig(eventID, config);
            queryClient.setQueryData(["event-management-config", eventID], updated);
            setEdit(null);
            toast.success("Налаштування видимості збережено");
        } catch {toast.error("Не вдалося зберегти налаштування видимості.");}
        finally {setSaving(false);}
    }

    if (configQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || !config) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити налаштування видимості</h1><button className="ib-btn" onClick={() => {void configQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Видимість</h1><p>Визначте, хто бачить учасників і результати та як можна зареєструватися.</p></div></header>
        <section className="event-manage-section">
            <div className="event-manage-fields-two">
                <div className="event-manage-field"><FieldLabel title="Реєстрація" help="Закрита — нові заявки недоступні. За схваленням — заявку перевіряє модератор. Відкрита — учасники приєднуються самостійно. До публікації реєстрація недоступна незалежно від цього налаштування." /><EventSelect ariaLabel="Реєстрація" value={String(config.Registration)} options={[{value: "0", label: "Закрита"}, {value: "1", label: "За схваленням"}, {value: "2", label: "Відкрита"}]} onValueChange={value => update({Registration: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving} /></div>
                <div className="event-manage-field"><FieldLabel title="Таблиця результатів" help="Визначає, хто може переглядати бали та місця учасників або команд." /><EventSelect ariaLabel="Таблиця результатів" value={String(config.ScoreboardVisibility)} options={visibilityOptions} onValueChange={value => update({ScoreboardVisibility: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving} /></div>
                <div className="event-manage-field"><FieldLabel title="Список учасників" help="Визначає, хто може переглядати перелік учасників. У командному форматі також застосовується до команд." /><EventSelect ariaLabel="Список учасників" value={String(config.ParticipantsVisibility)} options={visibilityOptions} onValueChange={value => update({ParticipantsVisibility: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving} /></div>
            </div>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
