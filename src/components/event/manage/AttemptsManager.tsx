"use client";

import {useState, type FormEvent, type KeyboardEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Download} from "lucide-react";
import {annulManageSolve, attemptPageSizes, AttemptsCursorError, attemptsLiveURL, decideManageAttempt, downloadAttemptsCSV, emptyAttemptFilters, getManageAttempts, type AttemptDecision, type AttemptFilters, type ManageAttempt} from "@/api/manageAttempts";
import {getModeratorResults} from "@/api/manageResults";
import {getManageParticipants} from "@/api/manageParticipants";
import {getEventBoardChallenges, getEventExerciseAttachments} from "@/api/manageChallenges";
import {ManageApiError} from "@/api/manage";
import {ApiErrorCode} from "@/api/apiErrors";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {zoneLabel} from "@/components/ui/dateTimePicker";
import {DialogModal} from "@/components/event/DialogModal";
import {useEventStream} from "@/utils/eventStream";
import {useManager} from "./ManagerShell";
import {t, tPlural} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {BusyMark, EventButton} from "@/components/ui/EventButton";
import "./dataTable.css";

const all = "all";

// Times are shown in the viewer's own time zone; the table header names it.
const localTime = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"});
const points = new Intl.NumberFormat("uk-UA");

function attemptStatus(attempt: ManageAttempt) {
    if (attempt.Decision === "accepted") return t("manage.attempts.status.acceptedManually");
    if (attempt.Decision === "rejected") return t("manage.attempts.status.rejectedManually");
    return attempt.Correct ? t("manage.attempts.status.correct") : t("manage.attempts.status.incorrect");
}

function ResultTag({attempt}: {attempt: ManageAttempt}) {
    return <span className={`ib-tag ib-tag--sm ${attempt.Correct ? "ib-tag--ok" : "ib-tag--danger"}`}>{attemptStatus(attempt)}</span>;
}

// Challenge filter options: every active board challenge of the event.
async function listChallengeOptions(eventID: string) {
    const attachments = (await getEventExerciseAttachments(eventID)).filter(item => !item.SupersededAt);
    const boards = await Promise.all(attachments.map(item => getEventBoardChallenges(eventID, item.ID)));
    return boards.flat().sort((a, b) => a.Order - b.Order).map(item => ({value: item.ID, label: item.Snapshot.name || t("manage.attempts.challenge")}));
}

export function AttemptsManager() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const queryClient = useQueryClient();
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(attemptPageSizes[0]);
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [draft, setDraft] = useState<{id: string; decision: AttemptDecision; reason: string} | null>(null);
    const [showExpected, setShowExpected] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filters, setFilters] = useState<AttemptFilters>(emptyAttemptFilters);
    const [annul, setAnnul] = useState<{attempt: ManageAttempt; reason: string} | null>(null);
    const [annulling, setAnnulling] = useState(false);
    const [exporting, setExporting] = useState(false);
    const cursor = cursors[pageIndex] ?? null;
    // Realtime: the stream says "changed", the page refetches; polling when SSE fails.
    const stream = useEventStream({url: () => attemptsLiveURL(eventID), events: ["attempts-changed"], onChange: () => void queryClient.invalidateQueries({queryKey: ["event-manage-attempts", eventID]}), enabled: true});
    const pageQuery = useQuery({queryKey: ["event-manage-attempts", eventID, filters, cursor, pageSize], queryFn: () => getManageAttempts(eventID, filters, cursor, pageSize), refetchOnWindowFocus: false, refetchInterval: stream === "fallback" ? 10_000 : false, placeholderData: previous => previous});
    const teams = useQuery({queryKey: ["event-management-moderator-results", eventID], queryFn: () => getModeratorResults(eventID), refetchOnWindowFocus: false});
    const participants = useQuery({queryKey: ["event-manage-attempt-participants", eventID], queryFn: () => getManageParticipants(eventID, {kind: "participants"}, null, 100), enabled: teamMode, refetchOnWindowFocus: false});
    const challenges = useQuery({queryKey: ["event-manage-attempt-challenges", eventID], queryFn: () => listChallengeOptions(eventID), refetchOnWindowFocus: false});
    // A stale cursor is rejected by the server: go back to the first page.
    if (pageQuery.error instanceof AttemptsCursorError && cursor !== null) {
        setCursors([null]);
        setPageIndex(0);
    }
    const items = pageQuery.data?.Items ?? [];
    const total = pageQuery.data?.Total ?? 0;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const selected = items.find(item => item.ID === selectedID) ?? null;
    const decision = draft && selected && draft.id === selected.ID ? draft.decision : selected?.Decision ?? "automatic";
    const reason = draft && selected && draft.id === selected.ID ? draft.reason : selected?.DecisionReason ?? "";
    const changed = !!selected && (decision !== selected.Decision || reason !== (selected.DecisionReason ?? ""));
    const filtered = filters.teamID !== null || filters.participantID !== null || filters.challengeID !== null || filters.correct !== null || !!filters.from || !!filters.to;
    const {offset} = zoneLabel();
    const busy = pageQuery.isFetching && !!pageQuery.data;

    function open(attempt: ManageAttempt) {
        setSelectedID(attempt.ID);
        setDraft({id: attempt.ID, decision: attempt.Decision, reason: attempt.DecisionReason ?? ""});
        setShowExpected(false);
    }

    function close() {
        if (saving) return;
        setSelectedID(null);
        setDraft(null);
    }

    function rowKey(keyEvent: KeyboardEvent<HTMLTableRowElement>, attempt: ManageAttempt) {
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        keyEvent.preventDefault();
        open(attempt);
    }

    function restart() {
        setCursors([null]);
        setPageIndex(0);
    }

    function changeFilters(patch: Partial<AttemptFilters>) {
        setFilters(current => ({...current, ...patch}));
        restart();
    }

    function nextPage() {
        const next = pageQuery.data?.NextCursor;
        if (!next || busy) return;
        setCursors(current => [...current.slice(0, pageIndex + 1), next]);
        setPageIndex(index => index + 1);
    }

    function previousPage() {
        if (pageIndex === 0 || busy) return;
        setPageIndex(index => index - 1);
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!selected || !changed || !reason.trim() || !canManage || saving) return;
        setSaving(true);
        try {
            await decideManageAttempt(eventID, selected.ID, decision, reason.trim());
            await queryClient.invalidateQueries({queryKey: ["event-manage-attempts", eventID]});
            setDraft(null);
            toast.success(t("manage.attempts.decisionSaved"));
        } catch {toast.error(t("manage.attempts.decisionSaveFailed"));}
        finally {setSaving(false);}
    }

    async function confirmAnnul(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!annul || !annul.reason.trim() || annulling) return;
        setAnnulling(true);
        try {
            const result = await annulManageSolve(eventID, annul.attempt.EventTeamID, annul.attempt.EventChallengeID, annul.reason.trim());
            await Promise.all([queryClient.invalidateQueries({queryKey: ["event-manage-attempts", eventID]}), queryClient.invalidateQueries({queryKey: ["event-management-moderator-results", eventID]})]);
            setAnnul(null);
            setDraft(null);
            toast.success(t("manage.attempts.annul.done", {count: result.Rejected}));
        } catch (error) {
            toast.error(error instanceof ManageApiError && error.code === ApiErrorCode.NothingToAnnul ? t("manage.attempts.annul.nothing") : t("manage.attempts.annul.failed"));
        } finally {setAnnulling(false);}
    }

    async function exportCSV() {
        if (exporting) return;
        setExporting(true);
        try {await downloadAttemptsCSV(eventID, filters);}
        catch {toast.error(t("manage.attempts.exportFailed"));}
        finally {setExporting(false);}
    }

    const teamOptions = [{value: all, label: teamMode ? t("manage.attempts.filter.allTeams") : t("manage.attempts.filter.allParticipants")}, ...(teams.data?.Teams ?? []).map(team => ({value: team.TeamID, label: team.RealName && team.RealName !== team.Name ? t("manage.attempts.teamWithRealName", {name: team.Name, realName: team.RealName}) : team.Name}))];
    const participantOptions = [{value: all, label: t("manage.attempts.filter.allParticipants")}, ...(participants.data?.Items ?? []).map(item => ({value: item.UserID, label: item.Name || item.Email}))];
    const challengeOptions = [{value: all, label: t("manage.attempts.filter.allChallenges")}, ...(challenges.data ?? [])];
    const resultOptions = [{value: all, label: t("manage.attempts.filter.all")}, {value: "true", label: t("manage.attempts.filter.correct")}, {value: "false", label: t("manage.attempts.filter.incorrect")}];
    const who = (attempt: ManageAttempt) => teamMode ? attempt.TeamName || t("manage.attempts.team") : attempt.ParticipantName || t("manage.attempts.participant");

    let body;
    if (pageQuery.isPending && !pageQuery.data) body = <EventLoading event={event} label={t("manage.attempts.loading")} />;
    else if (pageQuery.isError && !pageQuery.data) body = <div className="event-data-table__error" role="alert"><p>{t("manage.attempts.loadFailed")}</p><button className="ib-btn" type="button" onClick={() => void pageQuery.refetch()}>{t("common.retry")}</button></div>;
    else if (items.length === 0) body = <EmptyState message={filtered ? t("manage.attempts.emptyFiltered") : t("manage.attempts.empty")} />;
    else body = <table aria-label={t("manage.attempts.list")}>
        <thead><tr>
            <th scope="col">{t("manage.attempts.col.time", {offset})}</th>
            <th scope="col">{teamMode ? t("manage.attempts.col.team") : t("manage.attempts.col.participant")}</th>
            <th scope="col">{t("manage.attempts.col.challenge")}</th>
            <th scope="col">{t("manage.attempts.col.result")}</th>
            <th scope="col" className="is-num">{t("manage.attempts.col.points")}</th>
            {canManage && <th scope="col">{t("manage.attempts.col.answer")}</th>}
        </tr></thead>
        <tbody>{items.map(attempt => <tr key={attempt.ID} tabIndex={0} aria-label={t("manage.attempts.openAttempt", {challenge: attempt.ChallengeName || t("manage.attempts.challenge"), name: who(attempt)})} onClick={() => open(attempt)} onKeyDown={keyEvent => rowKey(keyEvent, attempt)}>
            <td><time className="event-data-table__time" dateTime={attempt.ReceivedAt}>{localTime.format(new Date(attempt.ReceivedAt))}</time></td>
            <td><span className="event-data-table__who"><span>{who(attempt)}</span>{teamMode && attempt.ParticipantName && <small>{attempt.ParticipantName}</small>}</span></td>
            <td>{attempt.ChallengeName || t("manage.attempts.challenge")}</td>
            <td><ResultTag attempt={attempt} /></td>
            <td className="is-num">{attempt.Points === null ? <span className="event-data-table__dim">{t("manage.attempts.noPoints")}</span> : points.format(attempt.Points)}</td>
            {canManage && <td><code className="event-data-table__answer" title={attempt.Answer ?? undefined}>{attempt.Answer}</code></td>}
        </tr>)}</tbody>
    </table>;

    return <div className="event-manage-settings event-attempts-manager">
        <header className="event-manage-heading"><div><h1>{t("manage.attempts.title")}</h1><p>{teamMode ? t("manage.attempts.subtitleTeams") : t("manage.attempts.subtitle")}</p></div>
            <div className="event-attempts-manager__head-actions"><span className="event-attempts-manager__total">{stream === "fallback" ? t("manage.attempts.stream.fallback") : stream === "live" ? t("manage.attempts.stream.live") : t("manage.attempts.stream.connecting")}</span>{canManage && <EventButton className="ib-btn" type="button" disabled={exporting} onClick={() => void exportCSV()} busy={exporting}><Download size={16} aria-hidden="true" /> {t("manage.attempts.export")}</EventButton>}</div>
        </header>
        <section className="event-manage-section event-attempts-manager__filters" aria-label={t("manage.attempts.filter.label")}>
            <label className="event-manage-field">{teamMode ? t("manage.attempts.team") : t("manage.attempts.participant")}<EventSelect ariaLabel={teamMode ? t("manage.attempts.team") : t("manage.attempts.participant")} value={filters.teamID ?? all} options={teamOptions} onValueChange={value => changeFilters({teamID: value === all ? null : value})} /></label>
            {teamMode && <label className="event-manage-field">{t("manage.attempts.participant")}<EventSelect ariaLabel={t("manage.attempts.participant")} value={filters.participantID ?? all} options={participantOptions} onValueChange={value => changeFilters({participantID: value === all ? null : value})} /></label>}
            <label className="event-manage-field">{t("manage.attempts.challenge")}<EventSelect ariaLabel={t("manage.attempts.challenge")} value={filters.challengeID ?? all} options={challengeOptions} onValueChange={value => changeFilters({challengeID: value === all ? null : value})} /></label>
            <label className="event-manage-field">{t("manage.attempts.filter.result")}<EventSelect ariaLabel={t("manage.attempts.filter.result")} value={filters.correct === null ? all : String(filters.correct)} options={resultOptions} onValueChange={value => changeFilters({correct: value === all ? null : value === "true"})} /></label>
            <div className="event-manage-field"><span>{t("manage.attempts.filter.from")}</span><EventDateTimePicker ariaLabel={t("manage.attempts.filter.from")} value={filters.from} placeholder={t("manage.attempts.filter.anyTime")} allowClear onChange={value => changeFilters({from: value})} /></div>
            <div className="event-manage-field"><span>{t("manage.attempts.filter.to")}</span><EventDateTimePicker ariaLabel={t("manage.attempts.filter.to")} value={filters.to} placeholder={t("manage.attempts.filter.anyTime")} allowClear onChange={value => changeFilters({to: value})} /></div>
            {filtered && <div className="event-attempts-manager__filter-row"><button className="ib-btn ib-btn--sm" type="button" onClick={() => changeFilters(emptyAttemptFilters)}>{t("manage.attempts.filter.reset")}</button></div>}
        </section>
        <section className="event-data-table" aria-label={t("manage.attempts.list")}>
            <div className="event-data-table__scroll" aria-busy={busy}>{body}</div>
            <footer className="event-table-pagination">
                <div className="event-table-pagination__info">
                    <span>{tPlural("manage.attempts.records", total)}</span>
                    <span>{t("manage.attempts.pagination.page", {page: pageIndex + 1, pages})}</span>
                    <span className="event-table-pagination__busy" role="status" aria-label={busy ? t("manage.attempts.pagination.updating") : undefined}>{busy && <BusyMark />}</span>
                </div>
                <div className="event-table-pagination__nav">
                    <button className="ib-btn ib-btn--sm" type="button" disabled={busy || pageIndex === 0} onClick={previousPage}>{t("manage.attempts.pagination.previous")}</button>
                    <button className="ib-btn ib-btn--sm" type="button" disabled={busy || !pageQuery.data?.NextCursor} onClick={nextPage}>{t("manage.attempts.pagination.next")}</button>
                </div>
                <div className="event-table-pagination__size"><span>{t("manage.attempts.pagination.perPage")}</span><EventSelect ariaLabel={t("manage.attempts.pagination.perPage")} value={String(pageSize)} options={attemptPageSizes.map(size => ({value: String(size), label: String(size)}))} onValueChange={value => { setPageSize(Number(value)); restart(); }} /></div>
            </footer>
        </section>
        <DialogModal open={!!selected} onClose={close} size="md" title={selected ? selected.ChallengeName || t("manage.attempts.challenge") : t("manage.attempts.detail")}
            description={selected ? t("manage.attempts.detailMeta", {name: teamMode && selected.ParticipantName ? t("manage.attempts.teamWithRealName", {name: who(selected), realName: selected.ParticipantName}) : who(selected), time: localTime.format(new Date(selected.ReceivedAt)), offset}) : undefined}>
            {selected && <div className="event-attempts-manager__detail">
                <dl className="event-attempts-manager__facts">
                    {selected.Answer !== null && <div><dt>{t("manage.attempts.answer")}</dt><dd><code>{selected.Answer}</code></dd></div>}
                    <div><dt>{t("manage.attempts.automaticCheck")}</dt><dd>{selected.AutomaticCorrect ? t("manage.attempts.right") : t("manage.attempts.wrong")}</dd></div>
                    <div><dt>{t("manage.attempts.currentResult")}</dt><dd><ResultTag attempt={selected} /></dd></div>
                    <div><dt>{t("manage.attempts.col.points")}</dt><dd>{selected.Points === null ? t("manage.attempts.noPoints") : points.format(selected.Points)}</dd></div>
                </dl>
                {selected.ExpectedFlag !== null && <div className="event-attempts-manager__expected"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setShowExpected(value => !value)}>{showExpected ? t("manage.attempts.hideExpected") : t("manage.attempts.showExpected")}</button>{showExpected && <code>{selected.ExpectedFlag}</code>}</div>}
                {selected.DecisionReason && <p className="event-attempts-manager__reason"><strong>{t("manage.attempts.previousReason")}</strong> {selected.DecisionReason}</p>}
                {canManage && <form className="event-attempts-manager__review" onSubmit={save}>
                    <label className="event-manage-field">{t("manage.attempts.decision")}<EventSelect ariaLabel={t("manage.attempts.decisionLabel")} value={decision} options={[{value: "automatic", label: t("manage.attempts.automaticCheck")}, {value: "accepted", label: t("manage.attempts.accept")}, {value: "rejected", label: t("manage.attempts.reject")}]} onValueChange={value => setDraft({id: selected.ID, decision: value as AttemptDecision, reason: value === selected.Decision ? selected.DecisionReason ?? "" : ""})} disabled={saving} /></label>
                    <label className="event-manage-field">{t("manage.attempts.reason")}<textarea className="event-manage-input" value={reason} onChange={changeEvent => setDraft({id: selected.ID, decision, reason: changeEvent.target.value})} placeholder={t("manage.attempts.reasonPlaceholder")} maxLength={1000} disabled={saving} /></label>
                    {changed && <div className="event-manage-section__actions"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={saving || !reason.trim()} busy={saving}>{t("manage.attempts.saveDecision")}</EventButton></div>}
                </form>}
                {canManage && selected.Correct && <div className="event-attempts-manager__annul"><div><strong>{t("manage.attempts.annul.title")}</strong><p>{teamMode ? t("manage.attempts.annul.hintTeam") : t("manage.attempts.annul.hintParticipant")}</p></div><button className="ib-btn ib-btn--danger" type="button" onClick={() => setAnnul({attempt: selected, reason: ""})}>{t("manage.attempts.annul.confirm")}</button></div>}
            </div>}
        </DialogModal>
        <DialogModal open={!!annul} onClose={() => { if (!annulling) setAnnul(null); }} title={t("manage.attempts.annul.dialogTitle")} description={annul ? t("manage.attempts.annul.description", {challenge: annul.attempt.ChallengeName || t("manage.attempts.challenge"), name: teamMode ? annul.attempt.TeamName : annul.attempt.ParticipantName}) : undefined}
            footer={<><button className="ib-btn" type="button" disabled={annulling} onClick={() => setAnnul(null)}>{t("common.cancel")}</button><EventButton className="ib-btn ib-btn--danger" type="submit" form="annul-solve-form" disabled={annulling || !annul?.reason.trim()} busy={annulling}>{t("manage.attempts.annul.confirm")}</EventButton></>}>
            <form id="annul-solve-form" onSubmit={confirmAnnul}><label className="event-manage-field">{t("manage.attempts.reason")}<textarea className="event-manage-input" value={annul?.reason ?? ""} onChange={changeEvent => setAnnul(current => current && {...current, reason: changeEvent.target.value})} placeholder={t("manage.attempts.annul.reasonPlaceholder")} maxLength={1000} disabled={annulling} required /></label></form>
        </DialogModal>
    </div>;
}
