"use client";

import {FirstSolveBadge} from "@/components/event/challenges/FirstSolveBadge";
import {Fragment, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {toastFailure} from "@/components/ui/toastApiError";
import {apiErrorText} from "@/api/apiErrors";
import {ChevronRight, Download, ExternalLink, Radio, Snowflake} from "lucide-react";
import {downloadResultsCSV, getModeratorResults, resultsLiveURL, setResultsOpened, type ModeratorResults, type ModeratorResultsTeam} from "@/api/manageResults";
import {useManager} from "@/components/event/manage/ManagerShell";
import {useCanExport} from "@/components/event/manage/managerContext";
import {ManageTable, ManageTablePagination, ManageTableSearch} from "@/components/event/manage/ManageTable";
import {HiddenMark} from "@/components/event/manage/HiddenMark";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {SortHeader, TableFilterChips, TableFiltersButton} from "@/components/event/manage/TableFilters";
import type {FilterSpec} from "@/components/event/manage/tableFilterModel";
import {useTableState} from "@/components/event/manage/useTableState";
import {journalTime} from "@/components/event/manage/journalShared";
import {pageOf, selectResults, teamLabel} from "@/components/event/manage/resultsTable";
import {zoneLabel} from "@/components/ui/dateTimePicker";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {useEventStream} from "@/utils/eventStream";
import {clockLabel, freezeLeadMinutes} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";
import "@/components/event/manage/results.css";

const RESULTS_POLL_SECONDS = 30;
const number = new Intl.NumberFormat("uk-UA");

const dayLabel = new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long"});
const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
// «о 21:05» today, «20 жовтня о 21:05» on another day.
const atLabel = (value: string, now: number) => sameDay(new Date(value), new Date(now))
    ? t("manage.results.freeze.at", {time: clockLabel(value)})
    : t("manage.results.freeze.atDate", {date: dayLabel.format(new Date(value)), time: clockLabel(value)});
const momentLabel = (value: string, now: number) => sameDay(new Date(value), new Date(now))
    ? clockLabel(value)
    : t("manage.results.freeze.moment", {date: dayLabel.format(new Date(value)), time: clockLabel(value)});

// `now` is the snapshot time, so the text follows the data, not the render.
function freezeStatus(freeze: ModeratorResults["Freeze"], now: number): string {
    const lead = freezeLeadMinutes(freeze);
    if (!freeze.Enabled) return t("manage.results.freeze.disabled");
    if (freeze.OpenedAt) return t("manage.results.freeze.opened", {when: atLabel(freeze.OpenedAt, now)});
    if (freeze.Active && freeze.FrozenAt) return t("manage.results.freeze.active", {time: momentLabel(freeze.FrozenAt, now)});
    if (freeze.FrozenAt && freeze.FinishAt && Date.parse(freeze.FinishAt) <= now) return t("manage.results.freeze.finished");
    if (freeze.FrozenAt) return lead === null ? t("manage.results.freeze.scheduled", {when: atLabel(freeze.FrozenAt, now)}) : t("manage.results.freeze.scheduledLead", {when: atLabel(freeze.FrozenAt, now), minutes: lead});
    return t("manage.results.freeze.noFinish");
}

function TeamName({team}: {team: ModeratorResultsTeam}) {
    return <span className="event-manage-table__person">
        <span className="event-results-table__title"><strong>{teamLabel(team)}</strong>{team.Moderators ? <HiddenMark moderators /> : team.Hidden && <span className="ib-tag ib-tag--sm">{t("manage.results.hidden")}</span>}{!team.Admitted && <span className="ib-tag ib-tag--sm ib-tag--warn">{t("manage.results.notAdmitted")}</span>}</span>
        {team.Individual && (team.RealName !== team.Name || team.Pseudonym) && <small>{team.RealName}{team.Pseudonym ? ` · ${t("manage.results.pseudonym", {pseudonym: team.Pseudonym})}` : ""}</small>}
    </span>;
}

function SolveDetails({team}: {team: ModeratorResultsTeam}) {
    if (team.Solves.length === 0) return <EmptyState compact message={t("manage.results.detail.empty")} />;
    return <table className="event-results-table__solves">
        <thead><tr>
            <th scope="col">{t("manage.results.detail.challenge")}</th>
            <th scope="col">{t("manage.results.detail.time")}</th>
            <th scope="col" className="ib-num">{t("manage.results.column.points")}</th>
            <th scope="col"><span className="sr-only">{t("manage.results.detail.firstBlood")}</span></th>
        </tr></thead>
        <tbody>{team.Solves.map(solve => <tr key={solve.ChallengeID}>
            <td>{solve.ChallengeName || t("manage.attempts.challenge")}</td>
            <td className="event-manage-table__nowrap"><time dateTime={solve.SolvedAt}>{journalTime.format(new Date(solve.SolvedAt))}</time></td>
            <td className="ib-num">{number.format(solve.Points)}</td>
            <td>{solve.FirstBlood && <FirstSolveBadge />}</td>
        </tr>)}</tbody>
    </table>;
}

export default function ManageResultsPage() {
    const {event, canManage} = useManager();
    const canExport = useCanExport();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<"open" | "export" | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmError, setConfirmError] = useState("");
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const queryKey = ["event-management-moderator-results", eventID];
    const revision = queryClient.getQueryData<ModeratorResults>(queryKey)?.Revision;
    // Moderators are never frozen: the public stream only signals changes.
    const [aliveAt, setAliveAt] = useState(0);
    const stream = useEventStream({url: () => revision === undefined ? null : resultsLiveURL(eventID, revision), events: ["result-change"], resetEvents: ["snapshot-required"], onChange: () => void queryClient.invalidateQueries({queryKey}), onAlive: () => setAliveAt(Date.now()), enabled: revision !== undefined});
    const query = useQuery({queryKey, queryFn: () => getModeratorResults(eventID), refetchInterval: stream === "fallback" ? RESULTS_POLL_SECONDS * 1000 : false, refetchOnWindowFocus: false});
    const teams = query.data?.Teams ?? [];
    const withHints = teams.some(team => team.Hints > 0);
    const who = teamMode ? t("manage.attempts.team") : t("manage.attempts.participant");
    const {offset} = zoneLabel();
    const specs: FilterSpec[] = [
        {key: "@name", label: who, kind: "contains"},
        {key: "@status", label: t("manage.results.column.status"), kind: "any", options: [
            {value: "ranked", label: t("manage.results.status.ranked")},
            {value: "hidden", label: t("manage.results.hidden")},
            {value: "notAdmitted", label: t("manage.results.notAdmitted")},
        ]},
        {key: "@points", label: t("manage.results.column.points"), kind: "number"},
        {key: "@solved", label: t("manage.results.column.solved"), kind: "number"},
        {key: "@last", label: t("manage.results.column.lastSolve"), kind: "date"},
        ...(withHints ? [{key: "@hints", label: t("manage.results.column.hints"), kind: "number" as const}] : []),
        {key: "@firstBlood", label: t("manage.results.detail.firstBlood"), kind: "bool"},
    ];
    const table = useTableState(specs, {key: "@rank", desc: false});
    const rows = selectResults(teams, table.debounced, table.appliedFilters, table.sort);
    const visible = pageOf(rows, table.page, table.pageSize);
    const columns = withHints ? 7 : 6;
    const state = query.isPending ? "loading" : query.isError && !query.data ? "error" : rows.length === 0 ? "empty" : "ready";

    function toggle(teamID: string) {
        setExpanded(current => {
            const next = new Set(current);
            if (!next.delete(teamID)) next.add(teamID);
            return next;
        });
    }

    async function toggleOpened(opened: boolean) {
        setBusy("open");
        setConfirmError("");
        try {
            await setResultsOpened(eventID, opened);
            await queryClient.invalidateQueries({queryKey});
            setConfirmOpen(false);
            toast.success(opened ? t("manage.results.freeze.openedToast") : t("manage.results.freeze.restoredToast"));
        } catch (failure) {
            // «Відкрити підсумки» fails inside its confirmation; «Повернути» has no dialog.
            if (opened) setConfirmError(apiErrorText(failure, t("manage.results.freeze.toggleFailed")));
            else toastFailure(failure, t("manage.results.freeze.toggleFailed"));
        }
        finally {setBusy(null);}
    }

    async function exportCSV() {
        setBusy("export");
        try {await downloadResultsCSV(eventID);}
        catch (failure) {toastFailure(failure, t("manage.results.exportFailed"));}
        finally {setBusy(null);}
    }

    const freeze = query.data?.Freeze;
    const generatedAt = query.data ? Date.parse(query.data.GeneratedAt) : 0;
    const finished = !!freeze?.FinishAt && Date.parse(freeze.FinishAt) <= generatedAt;
    const frozenForParticipants = !!freeze && freeze.Active && !freeze.OpenedAt;
    // The participants' view banner only while they read the board (running or finished, results not hidden).
    const participantsSee = !!query.data?.ParticipantsSee;
    return <div className="event-manage-settings event-manage-results">
        <header className="event-manage-heading">
            <div><h1>{t("manage.results.title")}</h1><p>{teamMode ? t("manage.results.subtitleTeams") : t("manage.results.subtitle")}</p></div>
            <div className="event-manage-heading__actions">
                <LiveStatus freshness={{kind: "stream", mode: stream, pollSeconds: RESULTS_POLL_SECONDS, failing: query.isError}} updatedAt={Math.max(query.dataUpdatedAt, aliveAt)} />
                <a className="ib-btn" href="/live" target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> {t("manage.results.openLive")}</a>
            </div>
        </header>
        {freeze && participantsSee && <div className={`event-manage-notice event-results-freeze${frozenForParticipants ? " is-frozen" : ""}`} role="status" aria-label={t("manage.results.freeze.label")}>
            {frozenForParticipants ? <Snowflake size={18} aria-hidden="true" /> : <Radio size={18} aria-hidden="true" />}
            <span className="event-results-freeze__text"><strong>{frozenForParticipants ? t("manage.results.view.frozen") : t("manage.results.view.live")}</strong> {freezeStatus(freeze, generatedAt)}</span>
            {canManage && freeze.Enabled && !finished && freeze.FrozenAt && freeze.OpenedAt
                && <EventButton className="ib-btn ib-btn--sm" type="button" disabled={busy === "open"} busy={busy === "open"} busyLabel={t("common.busy.returning")} onClick={() => void toggleOpened(false)}>{t("manage.results.freeze.restore")}</EventButton>}
            {canManage && frozenForParticipants
                && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" onClick={() => {setConfirmError(""); setConfirmOpen(true);}}>{t("manage.results.freeze.open")}</button>}
        </div>}
        <ConfirmDialog open={confirmOpen} onCancel={() => setConfirmOpen(false)} busy={busy === "open"} busyLabel={t("common.busy.opening")} error={confirmError}
            title={t("manage.results.freeze.confirmTitle")} description={t("manage.results.freeze.confirmBody")}
            confirmLabel={t("manage.results.freeze.confirm")} onConfirm={() => void toggleOpened(true)} />
        <ManageTable event={event} state={state} loadingLabel={t("manage.results.loading")} errorMessage={t("manage.results.loadFailed")} onRetry={() => void query.refetch()} error={query.error}
            emptyMessage={table.filtered ? t("manage.results.emptyFiltered") : t("manage.results.empty")}
            toolbar={<>
                <ManageTableSearch value={table.search} onChange={table.setSearch} label={teamMode ? t("manage.results.searchTeams") : t("manage.results.searchParticipants")} />
                <TableFiltersButton specs={specs} drafts={table.drafts} onChange={table.setDrafts} active={table.active} />
                {canExport && <div className="event-results-table__tools">
                    <EventButton className="ib-btn" type="button" disabled={busy === "export"} busy={busy === "export"} busyLabel={t("common.busy.downloading")} onClick={() => void exportCSV()}><Download size={16} aria-hidden="true" /> {t("manage.attempts.export")}</EventButton>
                </div>}
                <TableFilterChips specs={specs} drafts={table.drafts} onChange={table.setDrafts} onReset={table.reset}
                    extra={table.search.trim() ? [{key: "@search", text: t("manage.table.filters.searchChip", {text: table.search.trim()}), onRemove: () => table.setSearch("")}] : []} />
            </>}
            footer={<ManageTablePagination event={event} page={table.page} pageSize={table.pageSize} total={rows.length} hasNext={table.page * table.pageSize < rows.length}
                onPrevious={() => table.setPage(table.page - 1)} onNext={() => table.setPage(table.page + 1)} onPageSize={table.setPageSize} />}
            head={<tr>
                <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.results.detail.toggleColumn")}</span></th>
                <SortHeader columnKey="@rank" label={t("manage.results.column.rank")} sort={table.sort} onSort={table.setSort} />
                <SortHeader columnKey="@name" label={who} sort={table.sort} onSort={table.setSort} />
                <SortHeader columnKey="@points" label={t("manage.results.column.points")} sort={table.sort} onSort={table.setSort} />
                <SortHeader columnKey="@solved" label={t("manage.results.column.solved")} sort={table.sort} onSort={table.setSort} />
                <SortHeader columnKey="@last" label={t("manage.results.column.lastSolveAt", {offset})} sort={table.sort} onSort={table.setSort} />
                {withHints && <SortHeader columnKey="@hints" label={t("manage.results.column.hints")} sort={table.sort} onSort={table.setSort} />}
            </tr>}>
            <tbody>{visible.map(team => {
                const open = expanded.has(team.TeamID);
                const detailID = `results-detail-${team.TeamID}`;
                return <Fragment key={team.TeamID}>
                    <tr className={`is-clickable${open ? " is-open" : ""}`} onClick={() => toggle(team.TeamID)}>
                        <td><button className="ib-icon-btn ib-icon-btn--sm event-results-table__toggle" type="button" aria-expanded={open} aria-controls={detailID}
                            aria-label={t(open ? "manage.results.detail.hide" : "manage.results.detail.show", {name: teamLabel(team)})} onClick={clickEvent => {clickEvent.stopPropagation(); toggle(team.TeamID);}}>
                            <ChevronRight size={16} aria-hidden="true" />
                        </button></td>
                        <td className="event-results-table__rank">{team.Rank ?? "—"}</td>
                        <td><TeamName team={team} /></td>
                        <td className="ib-num event-results-table__points">{number.format(team.Points)}</td>
                        <td className="ib-num">{number.format(team.Solved)}</td>
                        <td className="event-manage-table__nowrap event-manage-table__dim">{team.LastSolveAt ? <time dateTime={team.LastSolveAt}>{journalTime.format(new Date(team.LastSolveAt))}</time> : "—"}</td>
                        {withHints && <td className="ib-num">{team.Hints > 0 ? t("manage.results.hintsValue", {count: team.Hints, points: number.format(team.HintPoints)}) : "—"}</td>}
                    </tr>
                    {open && <tr id={detailID} className="event-results-table__detail"><td colSpan={columns}><SolveDetails team={team} /></td></tr>}
                </Fragment>;
            })}</tbody>
        </ManageTable>
    </div>;
}
