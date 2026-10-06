"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Info} from "lucide-react";
import {getResultsSettings, putResultsSettings, resultsSettingsInput, type ResultsSettingsInput} from "@/api/manageResults";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventSelect} from "@/components/ui/EventSelect";
import {clockLabel, freezeStartAt} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";
import "@/components/event/manage/results.css";

function inRange(value: number, min: number, max: number) {
    return Number.isInteger(value) && value >= min && value <= max;
}

const chartSizes = Array.from({length: 10}, (_, index) => String(index + 1));

// «Налаштування результатів»: who sees the ranking, the freeze before the
// final, the chart and the table of the participant results page.
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
    const disabled = !canManage;

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
            setEdit(current => current?.value === value ? null : current);
            toast.success(t("manage.results.settings.saved"));
        } catch {toast.error(t("manage.results.settings.saveFailed"));}
        finally {setSaving(false);}
    }

    if (settingsQuery.isPending) return <EventLoading event={event} />;
    if (settingsQuery.isError || !value) return <EventLoadError message={t("manage.results.settings.loadFailed")} error={settingsQuery.error} onRetry={() => {void settingsQuery.refetch();}} />;

    const freezeAt = freezeStartAt(event.FinishTime, value.FreezeMinutes);
    const teamMode = event.Participation === 1;
    const freezeHint = !inRange(value.FreezeMinutes, 1, 1440) ? t("manage.results.settings.freezeMinutesRange")
        : freezeAt && event.FinishTime ? t("manage.results.settings.freezeAt", {freeze: clockLabel(freezeAt), finish: clockLabel(event.FinishTime)}) : t("manage.results.settings.freezeDependsOnFinish");
    return <form className="event-manage-settings event-manage-general event-results-settings" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>{t("manage.results.settings.title")}</h1><p>{t("manage.results.settings.subtitle")}</p></div></header>
        {!canManage && <div className="event-manage-notice" role="status"><Info size={18} aria-hidden="true" />{t("manage.results.settings.readOnly")}</div>}

        <section className="event-manage-section" aria-labelledby="results-access-title">
            <div className="event-manage-section__head"><h2 id="results-access-title">{t("manage.results.settings.access")}</h2><p>{t("manage.results.settings.accessHelp")}</p></div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.results.settings.visibility")} help={t("manage.results.settings.visibilityHelp")} required />
                <EventSelect ariaLabel={t("manage.results.settings.visibility")} value={String(value.ScoreboardVisibility)} options={["0", "1", "2"].map(option => ({value: option, label: t(`manage.results.settings.visibility.${option}`)}))} onValueChange={next => change({ScoreboardVisibility: Number(next) as 0 | 1 | 2})} disabled={disabled} />
                <small className="event-results-settings__hint">{t("manage.results.settings.staffAlways")}</small>
            </div>
        </section>

        <section className="event-manage-section" aria-labelledby="results-freeze-title">
            <div className="event-manage-section__head"><h2 id="results-freeze-title">{t("manage.results.settings.freeze")}</h2><p>{t("manage.results.settings.freezeSectionHelp")}</p></div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.results.settings.freezeTitle")} help={t("manage.results.settings.freezeHelp")} />
                <EventSwitch className="event-manage-form__switch" checked={value.FreezeEnabled} disabled={disabled} onCheckedChange={checked => change({FreezeEnabled: checked})} label={t("manage.results.settings.freezeEnabled")} />
            </div>
            {value.FreezeEnabled && <div className="event-manage-field">
                <ManageFieldLabel htmlFor="results-freeze-minutes" title={t("manage.results.settings.freezeMinutes")} help={t("manage.results.settings.freezeMinutesHelp")} required />
                <input id="results-freeze-minutes" className="event-manage-input event-results-settings__number" type="number" inputMode="numeric" min={1} max={1440} required value={value.FreezeMinutes} disabled={disabled} aria-invalid={!inRange(value.FreezeMinutes, 1, 1440)} onChange={event => change({FreezeMinutes: Number(event.target.value)})} />
                <small className={inRange(value.FreezeMinutes, 1, 1440) ? "event-results-settings__hint" : "event-manage-validation"}>{freezeHint}</small>
            </div>}
        </section>

        <section className="event-manage-section" aria-labelledby="results-chart-title">
            <div className="event-manage-section__head"><h2 id="results-chart-title">{t("manage.results.settings.chart")}</h2><p>{t("manage.results.settings.chartSectionHelp")}</p></div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.results.settings.chartTitle")} help={t("manage.results.settings.chartHelp")} />
                <EventSwitch className="event-manage-form__switch" checked={value.ChartEnabled} disabled={disabled} onCheckedChange={checked => change({ChartEnabled: checked})} label={t("manage.results.settings.chartEnabled")} />
            </div>
            {value.ChartEnabled && <div className="event-manage-field">
                <ManageFieldLabel title={teamMode ? t("manage.results.settings.chartTeams") : t("manage.results.settings.chartParticipants")} help={t("manage.results.settings.chartTop")} required />
                <EventSelect className="event-results-settings__select" ariaLabel={teamMode ? t("manage.results.settings.chartTeams") : t("manage.results.settings.chartParticipants")} value={String(value.ChartTeams)} options={chartSizes.map(size => ({value: size, label: size}))} onValueChange={next => change({ChartTeams: Number(next)})} disabled={disabled} />
            </div>}
        </section>

        <section className="event-manage-section" aria-labelledby="results-rows-title">
            <div className="event-manage-section__head"><h2 id="results-rows-title">{t("manage.results.settings.rows")}</h2><p>{t("manage.results.settings.rowsSectionHelp")}</p></div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel title={t("manage.results.settings.rowsMode")} help={t("manage.results.settings.rowsHelp")} required />
                    <EventSelect ariaLabel={t("manage.results.settings.rowsMode")} value={value.RowsLimit === null ? "all" : "top"} options={[{value: "all", label: t("manage.results.settings.rowsAll")}, {value: "top", label: t("manage.results.settings.rowsTop")}]}
                        onValueChange={next => change({RowsLimit: next === "all" ? null : value.RowsLimit ?? 10})} disabled={disabled} />
                </div>
                {value.RowsLimit !== null && <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="results-rows-limit" title={t("manage.results.settings.rowsLimit")} help={t("manage.results.settings.rowsTopHelp")} required />
                    <input id="results-rows-limit" className="event-manage-input event-results-settings__number" type="number" inputMode="numeric" min={1} max={1000} required value={value.RowsLimit} disabled={disabled} aria-invalid={!inRange(value.RowsLimit, 1, 1000)} onChange={event => change({RowsLimit: Number(event.target.value)})} />
                    {!inRange(value.RowsLimit, 1, 1000) && <small className="event-manage-validation">{t("manage.results.settings.rowsRange")}</small>}
                </div>}
            </div>
        </section>

        {(dirty || saving) && <div className="event-manage-savebar"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || !valid} busy={saving}>{t("common.save")}</EventButton></div>}
    </form>;
}
