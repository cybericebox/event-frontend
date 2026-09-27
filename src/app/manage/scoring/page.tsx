"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageLifecycle, getManageScoring, putManageScoring, type ManageScoringInput} from "@/api/manage";
import {EventLoading} from "@/components/event/EventLoading";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventSelect} from "@/components/ui/EventSelect";

const scoringModes = [
    {value: "0", label: "Фіксовані бали"},
    {value: "1", label: "За кількістю розв’язань"},
    {value: "2", label: "За порядком розв’язань"},
    {value: "3", label: "За часом розв’язання"},
];

export default function ScoringPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const scoringQuery = useQuery({queryKey: ["event-management-scoring", eventID], queryFn: () => getManageScoring(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ManageScoringInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const original = scoringQuery.data;
    const value = edit?.eventID === eventID ? edit.value : original ? {Mode: original.Mode, MinPoints: original.MinPoints, MaxPoints: original.MaxPoints, FloorAtPercent: original.FloorAtPercent, ForceEventScoring: original.ForceEventScoring} : null;
    const dirty = !!value && !!original && (value.Mode !== original.Mode || value.MinPoints !== original.MinPoints || value.MaxPoints !== original.MaxPoints || value.FloorAtPercent !== original.FloorAtPercent || value.ForceEventScoring !== original.ForceEventScoring);
    const dynamic = value?.Mode !== 0;
    const lifecycle = lifecycleQuery.data;
    const modeProblem = value?.Mode === 1 || value?.Mode === 2
        ? lifecycle?.JoinPolicy !== 0 ? "Цей режим потребує завершення приєднання до початку події." : ""
        : value?.Mode === 3 && !lifecycle?.FinishAt ? "Для цього режиму спершу заплануйте завершення події." : "";
    const valid = !!value && (!dynamic || (Number.isInteger(value.MinPoints) && value.MinPoints > 0 && Number.isInteger(value.MaxPoints) && value.MaxPoints > value.MinPoints && Number.isInteger(value.FloorAtPercent) && value.FloorAtPercent >= 1 && value.FloorAtPercent <= 100)) && !modeProblem;

    function update(patch: Partial<ManageScoringInput>) {
        if (value) setEdit({eventID, value: {...value, ...patch}});
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!value || !valid || !dirty || !canManage || saving) return;
        setSaving(true);
        try {
            const updated = await putManageScoring(eventID, value);
            queryClient.setQueryData(["event-management-scoring", eventID], updated);
            setEdit(null);
            toast.success("Профіль балів збережено");
        } catch {toast.error("Не вдалося зберегти профіль балів.");}
        finally {setSaving(false);}
    }

    if (scoringQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (scoringQuery.isError || lifecycleQuery.isError || !value) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити профіль балів</h1><button className="ib-btn" onClick={() => {void scoringQuery.refetch(); void lifecycleQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Профіль балів</h1><p>Визначте, як завдання приносять бали під час події.</p></div></header>
        <section className="event-manage-section">
            <div className="event-manage-field"><ManageFieldLabel title="Спосіб нарахування" help={"Фіксовані бали — значення, задане для кожного завдання.\n\nЗа кількістю розв’язань — бали зменшуються зі зростанням кількості розв’язань.\nЗа порядком розв’язань — перші розв’язання дають більше балів.\nЗа часом — бали зменшуються протягом події."} required /><EventSelect ariaLabel="Спосіб нарахування" value={String(value.Mode)} options={scoringModes} onValueChange={mode => update({Mode: Number(mode) as ManageScoringInput["Mode"], MinPoints: value.MinPoints || 100, MaxPoints: value.MaxPoints || 500, FloorAtPercent: value.FloorAtPercent || 50})} disabled={!canManage || saving} /></div>
            {modeProblem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{modeProblem}</p>}
            {dynamic && <div className={value.Mode === 3 ? "event-manage-fields-two" : "event-manage-fields-three"}>
                <div className="event-manage-field"><ManageFieldLabel htmlFor="score-min" title="Мінімум балів" help="Найменша кількість балів після зменшення." required /><input id="score-min" className="event-manage-input" type="number" min={1} step={1} value={value.MinPoints} onChange={event => update({MinPoints: Number(event.target.value)})} disabled={!canManage || saving} /></div>
                <div className="event-manage-field"><ManageFieldLabel htmlFor="score-max" title="Максимум балів" help="Скільки балів завдання дає спочатку. Має бути більше мінімуму." required /><input id="score-max" className="event-manage-input" type="number" min={value.MinPoints + 1} step={1} value={value.MaxPoints} onChange={event => update({MaxPoints: Number(event.target.value)})} disabled={!canManage || saving} /></div>
                {value.Mode !== 3 && <div className="event-manage-field"><ManageFieldLabel htmlFor="score-floor" title="Поріг, %" help="Частка учасників або команд, після якої бали досягають мінімуму." required /><input id="score-floor" className="event-manage-input" type="number" min={1} max={100} step={1} value={value.FloorAtPercent} onChange={event => update({FloorAtPercent: Number(event.target.value)})} disabled={!canManage || saving} /></div>}
            </div>}
            {dynamic && !valid && !modeProblem && <p className="event-manage-validation" role="alert">Укажіть цілі значення: мінімум понад нуль, максимум більший за мінімум, поріг від 1 до 100%.</p>}
        </section>
        <section className="event-manage-section"><ManageFieldLabel title="Пріоритет профілю події" help="Локальні налаштування балів завдань зберігаються. Коли цей перемикач увімкнено, замість них для всіх завдань використовується профіль події." /><label className="event-exercise-editor__check"><input type="checkbox" checked={value.ForceEventScoring} onChange={event => update({ForceEventScoring: event.target.checked})} disabled={!canManage || saving} /> Застосовувати до всіх завдань</label></section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
