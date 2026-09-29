"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getResultsSettings, putResultsSettings, resultsSettingsInput, type ResultsSettingsInput} from "@/api/manageResults";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {clockLabel, freezeStartAt} from "@/utils/resultsFreeze";

function inRange(value: number, min: number, max: number) {
    return Number.isInteger(value) && value >= min && value <= max;
}

export default function ResultsSettingsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const settingsQuery = useQuery({queryKey: ["event-management-results-settings", eventID], queryFn: () => getResultsSettings(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ResultsSettingsInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const settings = settingsQuery.data;
    const saved = settings ? resultsSettingsInput(settings) : null;
    const value = edit?.eventID === eventID ? edit.value : saved;
    const dirty = !!saved && !!value && JSON.stringify(saved) !== JSON.stringify(value);
    const valid = !!value && inRange(value.FreezeMinutes, 1, 1440) && inRange(value.ChartTeams, 1, 10) && (value.RowsLimit === null || inRange(value.RowsLimit, 1, 1000));
    const disabled = !canManage || saving;

    function change(patch: Partial<ResultsSettingsInput>) {
        if (value) setEdit({eventID, value: {...value, ...patch}});
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!value || !canManage || saving || !dirty || !valid) return;
        setSaving(true);
        try {
            const updated = await putResultsSettings(eventID, value);
            queryClient.setQueryData(["event-management-results-settings", eventID], updated);
            void queryClient.invalidateQueries({queryKey: ["event-management-config", eventID]});
            setEdit(null);
            toast.success("Налаштування результатів збережено");
        } catch {toast.error("Не вдалося зберегти налаштування результатів.");}
        finally {setSaving(false);}
    }

    if (settingsQuery.isPending) return <EventLoading event={event} />;
    if (settingsQuery.isError || !value) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити налаштування результатів</h1><button className="ib-btn" onClick={() => {void settingsQuery.refetch();}}>Повторити</button></div>;

    const freezeAt = freezeStartAt(event.FinishTime, value.FreezeMinutes);
    const teamWord = event.Participation === 1 ? "команд" : "учасників";
    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Налаштування результатів</h1><p>Хто бачить рейтинг і як виглядає сторінка результатів.</p></div></header>
        <section className="event-manage-section"><div className="event-manage-field"><ManageFieldLabel title="Перегляд результатів" help={"Визначає, хто може переглядати бали та місця.\n\n• Приховано — ніхто з відвідувачів.\n• Учасникам — лише авторизовані учасники.\n• Усім — усі відвідувачі сайту."} required /><EventSelect ariaLabel="Перегляд результатів" value={String(value.ScoreboardVisibility)} options={[{value: "0", label: "Приховано"}, {value: "1", label: "Учасникам"}, {value: "2", label: "Усім"}]} onValueChange={next => change({ScoreboardVisibility: Number(next) as 0 | 1 | 2})} disabled={disabled} /></div></section>
        <section className="event-manage-section" aria-labelledby="results-freeze-title">
            <div className="event-manage-section__head"><h2 id="results-freeze-title">Заморожування</h2><p>Учасники й гості бачать таблицю на момент заморожування, своя команда — свої бали. Модератори завжди бачать актуальні дані. Знімається після фінішу або кнопкою «Відкрити підсумки».</p></div>
            <label className="event-manage-form__switch"><input type="checkbox" checked={value.FreezeEnabled} disabled={disabled} onChange={event => change({FreezeEnabled: event.target.checked})} />Заморожувати рейтинг перед фіналом</label>
            {value.FreezeEnabled && <label className="event-manage-field">За скільки хвилин до фіналу<input className="event-manage-input event-results-settings__number" type="number" min={1} max={1440} value={value.FreezeMinutes} disabled={disabled} onChange={event => change({FreezeMinutes: Number(event.target.value)})} />
                <small>{!inRange(value.FreezeMinutes, 1, 1440) ? "Від 1 до 1440 хвилин." : freezeAt && event.FinishTime ? `Рейтинг заморозиться о ${clockLabel(freezeAt)}, фініш о ${clockLabel(event.FinishTime)}.` : "Час заморожування залежить від фінішу події."}</small></label>}
        </section>
        <section className="event-manage-section" aria-labelledby="results-chart-title">
            <div className="event-manage-section__head"><h2 id="results-chart-title">Графік</h2><p>Динаміка балів лідерів над таблицею. Своя команда учасника завжди на графіку.</p></div>
            <label className="event-manage-form__switch"><input type="checkbox" checked={value.ChartEnabled} disabled={disabled} onChange={event => change({ChartEnabled: event.target.checked})} />Показувати графік</label>
            {value.ChartEnabled && <label className="event-manage-field">Скільки {teamWord} на графіку<input className="event-manage-input event-results-settings__number" type="number" min={1} max={10} value={value.ChartTeams} disabled={disabled} onChange={event => change({ChartTeams: Number(event.target.value)})} /><small>{inRange(value.ChartTeams, 1, 10) ? "Перші за місцем." : "Від 1 до 10."}</small></label>}
        </section>
        <section className="event-manage-section" aria-labelledby="results-rows-title">
            <div className="event-manage-section__head"><h2 id="results-rows-title">Рядки таблиці</h2><p>Своя команда учасника показується, навіть якщо вона нижче.</p></div>
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Рядки таблиці">
                <label><input type="radio" name="rows" checked={value.RowsLimit === null} disabled={disabled} onChange={() => change({RowsLimit: null})} /><span><strong>Усі</strong><small>Повний рейтинг.</small></span></label>
                <label><input type="radio" name="rows" checked={value.RowsLimit !== null} disabled={disabled} onChange={() => change({RowsLimit: 10})} /><span><strong>Лише перші</strong><small>Топ-N місць.</small></span></label>
            </div>
            {value.RowsLimit !== null && <label className="event-manage-field">Скільки рядків<input className="event-manage-input event-results-settings__number" type="number" min={1} max={1000} value={value.RowsLimit} disabled={disabled} onChange={event => change({RowsLimit: Number(event.target.value)})} />{!inRange(value.RowsLimit, 1, 1000) && <small>Від 1 до 1000.</small>}</label>}
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
