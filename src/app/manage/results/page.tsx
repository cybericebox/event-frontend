"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Download, RefreshCw} from "lucide-react";
import {downloadResultsCSV, getModeratorResults, resultsLiveURL, setResultsOpened, type ModeratorResults} from "@/api/manageResults";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";
import {useEventStream} from "@/utils/eventStream";
import {clockLabel, freezeLeadMinutes} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";

const number = new Intl.NumberFormat("uk-UA");
const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});

// `now` is the snapshot time, so the text follows the data, not the render.
function freezeStatus(freeze: ModeratorResults["Freeze"], now: number): string {
    const lead = freezeLeadMinutes(freeze);
    if (freeze.OpenedAt) return t("manage.results.freeze.opened", {time: clockLabel(freeze.OpenedAt)});
    if (freeze.Active && freeze.FrozenAt) return t("manage.results.freeze.active", {time: clockLabel(freeze.FrozenAt)});
    if (freeze.FrozenAt && freeze.FinishAt && Date.parse(freeze.FinishAt) <= now) return t("manage.results.freeze.finished");
    if (freeze.FrozenAt) return lead === null ? t("manage.results.freeze.scheduled", {time: clockLabel(freeze.FrozenAt)}) : t("manage.results.freeze.scheduledLead", {time: clockLabel(freeze.FrozenAt), minutes: lead});
    return t("manage.results.freeze.noFinish");
}

export default function ManageResultsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<"open" | "export" | null>(null);
    const queryKey = ["event-management-moderator-results", eventID];
    const revision = queryClient.getQueryData<ModeratorResults>(queryKey)?.Revision;
    // Moderators are never frozen: the public stream only signals changes.
    const stream = useEventStream({url: () => revision === undefined ? null : resultsLiveURL(eventID, revision), events: ["result-change"], resetEvents: ["snapshot-required"], onChange: () => void queryClient.invalidateQueries({queryKey}), enabled: revision !== undefined});
    const query = useQuery({queryKey, queryFn: () => getModeratorResults(eventID), refetchInterval: stream === "fallback" ? 30_000 : false, refetchOnWindowFocus: false});

    async function toggleOpened(opened: boolean) {
        setBusy("open");
        try {
            await setResultsOpened(eventID, opened);
            await queryClient.invalidateQueries({queryKey});
            toast.success(opened ? t("manage.results.freeze.openedToast") : t("manage.results.freeze.restoredToast"));
        } catch {toast.error(t("manage.results.freeze.toggleFailed"));}
        finally {setBusy(null);}
    }

    async function exportCSV() {
        setBusy("export");
        try {await downloadResultsCSV(eventID);}
        catch {toast.error(t("manage.results.exportFailed"));}
        finally {setBusy(null);}
    }

    if (query.isPending) return <EventLoading event={event} label={t("manage.results.loading")} />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.results.loadFailed")}</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>{t("common.retry")}</button></div>;

    const results = query.data;
    const teamMode = event.Participation === 1;
    const maxPoints = Math.max(1, ...results.Teams.map(entry => entry.Points));
    const freeze = results.Freeze;
    const generatedAt = Date.parse(results.GeneratedAt);
    const finished = !!freeze.FinishAt && Date.parse(freeze.FinishAt) <= generatedAt;
    return <div className="event-manage-settings event-manage-results">
        <header className="event-manage-heading"><div><h1>{t("manage.results.title")}</h1><p>{teamMode ? t("manage.results.subtitleTeams") : t("manage.results.subtitle")} {stream === "live" ? t("manage.results.stream.live") : stream === "fallback" ? t("manage.results.stream.fallback") : ""}</p></div>
            <div className="event-manage-results__actions"><button className="ib-btn" type="button" disabled={busy === "export"} onClick={() => void exportCSV()}><Download size={16} aria-hidden="true" /> {busy === "export" ? t("manage.attempts.exporting") : t("manage.attempts.export")}</button><button className="ib-btn" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} aria-hidden="true" /> {query.isFetching ? t("manage.results.refreshing") : t("manage.results.refresh")}</button></div>
        </header>
        <div className="event-manage-results__summary"><div><span>{t("manage.results.ranked")}</span><strong>{number.format(results.Counts.Ranked)}</strong></div><div><span>{t("manage.results.hiddenNotAdmitted")}</span><strong>{number.format(results.Counts.Hidden)} · {number.format(results.Counts.NotAdmitted)}</strong></div><div><span>{t("manage.results.updated")}</span><strong>{t("manage.attempts.timeUtc", {time: date.format(new Date(results.GeneratedAt))})}</strong></div></div>
        {freeze.Enabled && <section className="event-manage-section event-manage-results__freeze" aria-label={t("manage.results.freeze.label")}><p>{freezeStatus(freeze, generatedAt)}</p>{canManage && !finished && (freeze.OpenedAt
            ? <button className="ib-btn" type="button" disabled={busy === "open"} onClick={() => void toggleOpened(false)}>{t("manage.results.freeze.restore")}</button>
            : <button className="ib-btn ib-btn--primary" type="button" disabled={busy === "open"} onClick={() => void toggleOpened(true)}>{t("manage.results.freeze.open")}</button>)}</section>}
        <section className="event-manage-section"><div className="event-manage-section__head"><h2>{t("manage.results.ranking")}</h2><p>{teamMode ? t("manage.results.unrankedTeams") : t("manage.results.unrankedParticipants")}</p></div>
            {results.Teams.length === 0 ? <p className="event-challenge-manager__empty">{t("manage.results.empty")}</p> : <div className="event-manage-results__table" role="table" aria-label={t("manage.results.tableLabel")}>
                <div className="event-manage-results__table-head" role="row"><span role="columnheader">{t("manage.results.column.rank")}</span><span role="columnheader">{teamMode ? t("manage.attempts.team") : t("manage.attempts.participant")}</span><span role="columnheader">{t("manage.results.column.points")}</span><span role="columnheader">{t("manage.results.column.solved")}</span><span role="columnheader">{t("manage.results.column.lastSolve")}</span></div>
                {results.Teams.map(entry => <div className="event-manage-results__row" role="row" key={entry.TeamID}>
                    <span role="cell" className="event-manage-results__rank">{entry.Rank ?? "—"}</span>
                    <span role="cell" className="event-manage-results__name">
                        <span className="event-manage-results__title"><strong>{entry.Name}</strong>{entry.Hidden && <span className="ib-tag ib-tag--sm">{t("manage.results.hidden")}</span>}{!entry.Admitted && <span className="ib-tag ib-tag--sm ib-tag--warn">{t("manage.results.notAdmitted")}</span>}</span>
                        {entry.Individual && (entry.RealName !== entry.Name || entry.Pseudonym) && <small>{entry.RealName}{entry.Pseudonym ? ` · ${t("manage.results.pseudonym", {pseudonym: entry.Pseudonym})}` : ""}</small>}
                        <span className="event-manage-results__bar" aria-hidden="true"><i style={{width: `${Math.max(0, Math.min(100, entry.Points / maxPoints * 100))}%`}} /></span>
                    </span>
                    <span role="cell" className="event-manage-results__points">{number.format(entry.Points)}</span>
                    <span role="cell" className="event-manage-results__points">{number.format(entry.Solved)}</span>
                    <span role="cell" className="event-manage-results__time">{entry.LastSolveAt ? t("manage.attempts.timeUtc", {time: date.format(new Date(entry.LastSolveAt))}) : "—"}</span>
                </div>)}
            </div>}
        </section>
    </div>;
}
