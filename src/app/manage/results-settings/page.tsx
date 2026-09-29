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
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";

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
            toast.success(t("manage.results.settings.saved"));
        } catch {toast.error(t("manage.results.settings.saveFailed"));}
        finally {setSaving(false);}
    }

    if (settingsQuery.isPending) return <EventLoading event={event} />;
    if (settingsQuery.isError || !value) return <div className="event-manage-error" role="alert"><h1>{t("manage.results.settings.loadFailed")}</h1><button className="ib-btn" onClick={() => {void settingsQuery.refetch();}}>{t("common.retry")}</button></div>;

    const freezeAt = freezeStartAt(event.FinishTime, value.FreezeMinutes);
    const teamMode = event.Participation === 1;
    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>{t("manage.results.settings.title")}</h1><p>{t("manage.results.settings.subtitle")}</p></div></header>
        <section className="event-manage-section"><div className="event-manage-field"><ManageFieldLabel title={t("manage.results.settings.visibility")} help={t("manage.results.settings.visibilityHelp")} required /><EventSelect ariaLabel={t("manage.results.settings.visibility")} value={String(value.ScoreboardVisibility)} options={["0", "1", "2"].map(option => ({value: option, label: t(`manage.results.settings.visibility.${option}`)}))} onValueChange={next => change({ScoreboardVisibility: Number(next) as 0 | 1 | 2})} disabled={disabled} /></div></section>
        <section className="event-manage-section" aria-labelledby="results-freeze-title">
            <div className="event-manage-section__head"><h2 id="results-freeze-title">{t("manage.results.settings.freeze")}</h2><p>{t("manage.results.settings.freezeHelp")}</p></div>
            <EventSwitch checked={value.FreezeEnabled} disabled={disabled} onCheckedChange={checked => change({FreezeEnabled: checked})} label={t("manage.results.settings.freezeEnabled")} />
            {value.FreezeEnabled && <label className="event-manage-field">{t("manage.results.settings.freezeMinutes")}<input className="event-manage-input event-results-settings__number" type="number" min={1} max={1440} value={value.FreezeMinutes} disabled={disabled} onChange={event => change({FreezeMinutes: Number(event.target.value)})} />
                <small>{!inRange(value.FreezeMinutes, 1, 1440) ? t("manage.results.settings.freezeMinutesRange") : freezeAt && event.FinishTime ? t("manage.results.settings.freezeAt", {freeze: clockLabel(freezeAt), finish: clockLabel(event.FinishTime)}) : t("manage.results.settings.freezeDependsOnFinish")}</small></label>}
        </section>
        <section className="event-manage-section" aria-labelledby="results-chart-title">
            <div className="event-manage-section__head"><h2 id="results-chart-title">{t("manage.results.settings.chart")}</h2><p>{t("manage.results.settings.chartHelp")}</p></div>
            <EventSwitch checked={value.ChartEnabled} disabled={disabled} onCheckedChange={checked => change({ChartEnabled: checked})} label={t("manage.results.settings.chartEnabled")} />
            {value.ChartEnabled && <label className="event-manage-field">{teamMode ? t("manage.results.settings.chartTeams") : t("manage.results.settings.chartParticipants")}<input className="event-manage-input event-results-settings__number" type="number" min={1} max={10} value={value.ChartTeams} disabled={disabled} onChange={event => change({ChartTeams: Number(event.target.value)})} /><small>{inRange(value.ChartTeams, 1, 10) ? t("manage.results.settings.chartTop") : t("manage.results.settings.chartRange")}</small></label>}
        </section>
        <section className="event-manage-section" aria-labelledby="results-rows-title">
            <div className="event-manage-section__head"><h2 id="results-rows-title">{t("manage.results.settings.rows")}</h2><p>{t("manage.results.settings.rowsHelp")}</p></div>
            <div className="event-manage-choice-group" role="radiogroup" aria-label={t("manage.results.settings.rows")}>
                <label><input type="radio" name="rows" checked={value.RowsLimit === null} disabled={disabled} onChange={() => change({RowsLimit: null})} /><span><strong>{t("manage.results.settings.rowsAll")}</strong><small>{t("manage.results.settings.rowsAllHelp")}</small></span></label>
                <label><input type="radio" name="rows" checked={value.RowsLimit !== null} disabled={disabled} onChange={() => change({RowsLimit: 10})} /><span><strong>{t("manage.results.settings.rowsTop")}</strong><small>{t("manage.results.settings.rowsTopHelp")}</small></span></label>
            </div>
            {value.RowsLimit !== null && <label className="event-manage-field">{t("manage.results.settings.rowsLimit")}<input className="event-manage-input event-results-settings__number" type="number" min={1} max={1000} value={value.RowsLimit} disabled={disabled} onChange={event => change({RowsLimit: Number(event.target.value)})} />{!inRange(value.RowsLimit, 1, 1000) && <small>{t("manage.results.settings.rowsRange")}</small>}</label>}
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || !valid} busy={saving}>{t("common.save")}</EventButton></div>}
    </form>;
}
