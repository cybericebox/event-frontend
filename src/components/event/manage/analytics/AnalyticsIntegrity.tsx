"use client";

import Link from "next/link";
import {useId, useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Download, RotateCcw} from "lucide-react";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";
import {
    clampThresholds, getAnalyticsIntegrity, integrityExportPath, integrityJournalHref, thresholdLimits, thresholdsEqual,
    type AnalyticsIntegrity as Integrity, type IntegrityKind, type IntegritySignal, type IntegrityThresholds,
} from "@/api/manageAnalyticsIntegrity";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {ManageTable, ManageTableSearch, type ManageTableState} from "@/components/event/manage/ManageTable";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t} from "@/i18n/t";
import {formatCount, formatDateTime, formatDuration} from "./analyticsFormat";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
import {loadThresholds, saveThresholds} from "./integrityThresholds";
import {useAnalyticsAccess} from "./useAnalyticsAccess";
import {useAnalyticsPeriod} from "./useAnalyticsPeriod";
import "./analyticsIntegrity.css";

export const INTEGRITY_POLL_SECONDS = 30;

const kinds: IntegrityKind[] = ["same_answer", "burst", "fast_solve"];
const allKinds = "all";

type NumericKey = keyof typeof thresholdLimits;
const numericFields: {key: NumericKey; unit: "seconds" | "count"}[] = [
    {key: "SameAnswerWindowSeconds", unit: "seconds"}, {key: "SameAnswerMinLength", unit: "count"},
    {key: "BurstAttempts", unit: "count"}, {key: "BurstWindowSeconds", unit: "seconds"}, {key: "FastSolveGapSeconds", unit: "seconds"},
];

export function signalDetails(signal: IntegritySignal): string {
    switch (signal.Kind) {
        case "same_answer": return t(signal.Correct ? "manage.analytics.integrity.detail.sameCorrect" : "manage.analytics.integrity.detail.sameWrong", {answer: signal.Answer, attempts: signal.Attempts});
        case "burst": return t("manage.analytics.integrity.detail.burst", {attempts: signal.Attempts, time: formatDuration(Math.max(1, Math.round((Date.parse(signal.To) - Date.parse(signal.From)) / 1000))), rejected: signal.Rejections});
        case "fast_solve": return t("manage.analytics.integrity.detail.fast", {gap: formatDuration(signal.GapSeconds), first: signal.Teams[0]?.Name ?? "", attempts: signal.Attempts});
    }
}

function ThresholdsPanel({defaults, applied, onApply, onReset}: {defaults: IntegrityThresholds; applied: IntegrityThresholds; onApply: (value: IntegrityThresholds) => void; onReset: () => void}) {
    const id = useId();
    const [draft, setDraft] = useState<IntegrityThresholds>(applied);
    const changed = !thresholdsEqual(clampThresholds(draft), applied);
    const isDefault = thresholdsEqual(applied, defaults);
    return <section className="event-integrity-thresholds" aria-label={t("manage.analytics.integrity.thresholds.title")}>
        <div className="event-analytics__block-head"><h2>{t("manage.analytics.integrity.thresholds.title")}</h2><p>{t("manage.analytics.integrity.thresholds.subtitle")}</p></div>
        <div className="event-integrity-thresholds__grid">
            {numericFields.map(({key, unit}) => <div className="event-manage-field" key={key}>
                <ManageFieldLabel htmlFor={`${id}-${key}`} title={t(`manage.analytics.integrity.thresholds.${key}`)} help={t(`manage.analytics.integrity.thresholds.${key}Help`, {default: defaults[key], min: thresholdLimits[key].min, max: thresholdLimits[key].max})} />
                <div className="event-integrity-thresholds__input">
                    <input id={`${id}-${key}`} className="ib-input" type="number" inputMode="numeric" min={thresholdLimits[key].min} max={thresholdLimits[key].max} value={draft[key]}
                        onChange={event => setDraft(current => ({...current, [key]: event.target.value === "" ? 0 : Number(event.target.value)}))} />
                    <span>{unit === "seconds" ? t("manage.analytics.integrity.thresholds.unitSeconds") : t("manage.analytics.integrity.thresholds.unitCount")}</span>
                </div>
            </div>)}
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.analytics.integrity.thresholds.IncludeCorrect")} help={t("manage.analytics.integrity.thresholds.IncludeCorrectHelp")} />
                <EventSwitch checked={draft.IncludeCorrect} onCheckedChange={checked => setDraft(current => ({...current, IncludeCorrect: checked}))} ariaLabel={t("manage.analytics.integrity.thresholds.IncludeCorrect")} />
            </div>
        </div>
        <div className="event-integrity-thresholds__actions">
            <button className="ib-btn ib-btn--sm" type="button" disabled={isDefault && !changed} onClick={onReset}><RotateCcw size={14} aria-hidden="true" /> {t("manage.analytics.integrity.thresholds.reset")}</button>
            <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!changed} onClick={() => onApply(clampThresholds(draft))}>{t("manage.analytics.integrity.thresholds.apply")}</button>
        </div>
    </section>;
}

function ExportButton({eventID, period, thresholds, disabled}: {eventID: string; period: {from: string | null; to: string | null}; thresholds: IntegrityThresholds | null; disabled: boolean}) {
    const [busy, setBusy] = useState(false);
    async function download() {
        setBusy(true);
        try {await downloadManageCSV(eventID, integrityExportPath(period, thresholds), csvFileName("analytics-integrity"));}
        catch {toast.error(t("manage.analytics.exportFailed"));}
        finally {setBusy(false);}
    }
    return <EventButton className="ib-btn" type="button" disabled={disabled || busy} busy={busy} onClick={() => void download()}><Download size={16} aria-hidden="true" /> {t("manage.analytics.export")}</EventButton>;
}

function SignalRows({signals}: {signals: IntegritySignal[]}) {
    return <tbody>{signals.map(signal => <tr key={`${signal.Kind}-${signal.ChallengeID}-${signal.From}-${signal.Teams.map(team => team.ID).join("+")}`}>
        <td><span className={`ib-tag ib-tag--sm ${signal.Kind === "burst" ? "ib-tag--danger" : "ib-tag--warn"}`}>{t(`manage.analytics.integrity.kind.${signal.Kind}`)}</span></td>
        <td><strong>{signal.ChallengeName}</strong></td>
        <td><div className="event-manage-table__tags">{signal.Teams.map(team => <span className="ib-tag ib-tag--sm" key={team.ID}>{team.Name}</span>)}</div></td>
        <td className="event-manage-table__nowrap">{formatDateTime(signal.From)}</td>
        <td className="event-integrity__details">{signalDetails(signal)}</td>
        <td className="event-manage-table__actions-col"><Link className="ib-btn ib-btn--sm" href={integrityJournalHref(signal)}>{t("manage.analytics.integrity.openJournal")}</Link></td>
    </tr>)}</tbody>;
}

function Summary({data}: {data: Integrity}) {
    return <AnalyticsStatGrid label={t("manage.analytics.integrity.stats.label")}>
        <AnalyticsStat label={t("manage.analytics.integrity.stat.total")} value={formatCount(data.Total)} hint={t("manage.analytics.integrity.stat.totalHint")} />
        <AnalyticsStat label={t("manage.analytics.integrity.stat.same_answer")} value={formatCount(data.SameAnswer)} hint={t("manage.analytics.integrity.stat.same_answerHint")} />
        <AnalyticsStat label={t("manage.analytics.integrity.stat.burst")} value={formatCount(data.Burst)} hint={t("manage.analytics.integrity.stat.burstHint")} />
        <AnalyticsStat label={t("manage.analytics.integrity.stat.fast_solve")} value={formatCount(data.FastSolve)} hint={t("manage.analytics.integrity.stat.fast_solveHint")} />
    </AnalyticsStatGrid>;
}

// «Доброчесність» (§6.6): signals for a person to review, never a verdict.
// Only for viewers with the sensitive level; no IP or device data is used.
export function AnalyticsIntegrity() {
    const {event} = useManager();
    const eventID = event.EventID;
    const access = useAnalyticsAccess(eventID);
    const filter = useAnalyticsPeriod();
    const [search, setSearch] = useState("");
    const [kind, setKind] = useState<string>(allKinds);
    // null: the server defaults. The page mounts in the browser only (the
    // manager shell waits for its access check), so storage is readable here.
    const [thresholds, setThresholds] = useState<IntegrityThresholds | null>(() => loadThresholds(eventID));
    const allowed = access.data?.Sensitive === true;
    const query = useQuery({
        queryKey: ["event-analytics-integrity", eventID, filter.period.from, filter.period.to, thresholds],
        queryFn: () => getAnalyticsIntegrity(eventID, filter.period, thresholds),
        enabled: allowed,
        refetchInterval: INTEGRITY_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });
    const data = query.data;
    const title = t("manage.analytics.section.integrity.title");
    const description = t("manage.analytics.section.integrity.description");
    const actions = <>
        <LiveStatus freshness={{kind: "polling", seconds: INTEGRITY_POLL_SECONDS, failing: query.isError}} updatedAt={query.dataUpdatedAt} />
        <ExportButton eventID={eventID} period={filter.period} thresholds={thresholds} disabled={!data} />
    </>;

    if (access.isPending || (allowed && query.isPending)) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EventLoading event={event} label={t("manage.analytics.integrity.loading")} /></div>
    </AnalyticsPage>;
    if (access.isError) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.integrity.loadFailed")} error={access.error} onRetry={() => void access.refetch()} /></div>
    </AnalyticsPage>;
    if (!allowed) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EmptyState message={t("manage.analytics.integrity.noAccess")} /></div>
    </AnalyticsPage>;
    if (!data) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.integrity.loadFailed")} error={query.error} onRetry={() => void query.refetch()} /></div>
    </AnalyticsPage>;

    const needle = search.trim().toLowerCase();
    const signals = data.Signals.filter(signal => (kind === allKinds || signal.Kind === kind)
        && (!needle || signal.ChallengeName.toLowerCase().includes(needle) || signal.Teams.some(team => team.Name.toLowerCase().includes(needle))));
    const state: ManageTableState = signals.length === 0 ? "empty" : "ready";
    const applied = data.Thresholds;

    return <AnalyticsPage title={title} description={description} actions={actions} filter={<AnalyticsPeriodFilter period={filter} />}>
        <p className="event-integrity__notice">{t("manage.analytics.integrity.notice")}</p>
        <Summary data={data} />
        <ThresholdsPanel key={JSON.stringify(applied)} defaults={data.Defaults} applied={applied}
            onApply={value => {const next = thresholdsEqual(value, data.Defaults) ? null : value; setThresholds(next); saveThresholds(eventID, next);}}
            onReset={() => {setThresholds(null); saveThresholds(eventID, null);}} />
        {data.Total > data.Signals.length && <p className="event-integrity__notice" role="status">{t("manage.analytics.integrity.truncated", {shown: data.Signals.length, total: data.Total})}</p>}
        <ManageTable event={event} state={state} loadingLabel={t("manage.analytics.integrity.loading")} errorMessage={t("manage.analytics.integrity.loadFailed")}
            emptyMessage={t(data.Signals.length === 0 ? "manage.analytics.integrity.empty" : "manage.analytics.integrity.emptyFiltered")} onRetry={() => void query.refetch()} busy={query.isFetching}
            toolbar={<>
                <ManageTableSearch value={search} onChange={setSearch} label={t("manage.analytics.integrity.search")} />
                <EventSelect ariaLabel={t("manage.analytics.integrity.kindFilter")} value={kind} onValueChange={setKind}
                    options={[{value: allKinds, label: t("manage.analytics.integrity.allKinds")}, ...kinds.map(value => ({value, label: t(`manage.analytics.integrity.kind.${value}`)}))]} />
            </>}
            head={<tr>
                <th scope="col">{t("manage.analytics.integrity.col.kind")}</th>
                <th scope="col">{t("manage.analytics.integrity.col.task")}</th>
                <th scope="col">{t("manage.analytics.integrity.col.teams")}</th>
                <th scope="col">{t("manage.analytics.integrity.col.when")}</th>
                <th scope="col">{t("manage.analytics.integrity.col.details")}</th>
                <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.analytics.integrity.col.journal")}</span></th>
            </tr>}>
            <SignalRows signals={signals} />
        </ManageTable>
    </AnalyticsPage>;
}
