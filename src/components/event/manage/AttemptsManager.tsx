"use client";

import {useState, type FormEvent, type KeyboardEvent} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Download} from "lucide-react";
import {annulManageSolve, AttemptsCursorError, attemptsLiveURL, decideManageAttempt, downloadAttemptsCSV, emptyAttemptFilters, getManageAttempts, type AttemptDecision, type AttemptFilters, type ManageAttempt} from "@/api/manageAttempts";
import {ManageApiError} from "@/api/manage";
import {ApiErrorCode} from "@/api/apiErrors";
import {EventSelect} from "@/components/ui/EventSelect";
import {zoneLabel} from "@/components/ui/dateTimePicker";
import {DialogModal} from "@/components/event/DialogModal";
import {useEventStream} from "@/utils/eventStream";
import {useManager} from "./ManagerShell";
import {ManageTable, ManageTablePagination, useCursorPages} from "./ManageTable";
import {HintUnlocksLog} from "./HintUnlocksLog";
import {journalViews, type JournalView} from "./journalViews";
import {journalTime, PeriodFilters, useJournalOptions} from "./journalShared";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import "./journal.css";

const all = "all";

const points = new Intl.NumberFormat("uk-UA");

function attemptStatus(attempt: ManageAttempt) {
    if (attempt.Decision === "accepted") return t("manage.attempts.status.acceptedManually");
    if (attempt.Decision === "rejected") return t("manage.attempts.status.rejectedManually");
    return attempt.Correct ? t("manage.attempts.status.correct") : t("manage.attempts.status.incorrect");
}

function ResultTag({attempt}: {attempt: ManageAttempt}) {
    return <span className={`ib-tag ib-tag--sm ${attempt.Correct ? "ib-tag--ok" : "ib-tag--danger"}`}>{attemptStatus(attempt)}</span>;
}

// «Журнал спроб»: solution attempts and opened hints, one view at a time.
export function AttemptsManager({initialView = "attempts"}: {initialView?: JournalView}) {
    const router = useRouter();
    const [view, setView] = useState<JournalView>(initialView);
    const {event} = useManager();
    const teamMode = event.Participation === 1;

    function switchView(next: JournalView) {
        setView(next);
        router.replace(`/manage/submissions?tab=${next}`, {scroll: false});
    }

    return <div className="event-manage-settings event-journal">
        <header className="event-manage-heading"><div><h1>{t("manage.journal.title")}</h1><p>{view === "hints" ? t("manage.journal.subtitleHints") : teamMode ? t("manage.attempts.subtitleTeams") : t("manage.attempts.subtitle")}</p></div></header>
        <div className="ib-seg event-journal__views" role="group" aria-label={t("manage.journal.views")}>
            {journalViews.map(item => <button key={item} type="button" aria-pressed={view === item} onClick={() => switchView(item)}>{t(`manage.journal.view.${item}`)}</button>)}
        </div>
        {view === "attempts" ? <AttemptsLog /> : <HintUnlocksLog />}
    </div>;
}

function AttemptsLog() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const queryClient = useQueryClient();
    const pages = useCursorPages();
    const options = useJournalOptions();
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [draft, setDraft] = useState<{id: string; decision: AttemptDecision; reason: string} | null>(null);
    const [showExpected, setShowExpected] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filters, setFilters] = useState<AttemptFilters>(emptyAttemptFilters);
    const [annul, setAnnul] = useState<{attempt: ManageAttempt; reason: string} | null>(null);
    const [annulling, setAnnulling] = useState(false);
    const [exporting, setExporting] = useState(false);
    // Realtime: the stream says "changed", the page refetches; polling when SSE fails.
    const stream = useEventStream({url: () => attemptsLiveURL(eventID), events: ["attempts-changed"], onChange: () => void queryClient.invalidateQueries({queryKey: ["event-manage-attempts", eventID]}), enabled: true});
    const pageQuery = useQuery({queryKey: ["event-manage-attempts", eventID, filters, pages.cursor, pages.pageSize], queryFn: () => getManageAttempts(eventID, filters, pages.cursor, pages.pageSize), refetchOnWindowFocus: false, refetchInterval: stream === "fallback" ? 10_000 : false, placeholderData: previous => previous});
    // A stale cursor is rejected by the server: go back to the first page.
    if (pageQuery.error instanceof AttemptsCursorError && pages.cursor !== null) pages.reset();
    const items = pageQuery.data?.Items ?? [];
    const selected = items.find(item => item.ID === selectedID) ?? null;
    const decision = draft && selected && draft.id === selected.ID ? draft.decision : selected?.Decision ?? "automatic";
    const reason = draft && selected && draft.id === selected.ID ? draft.reason : selected?.DecisionReason ?? "";
    const changed = !!selected && (decision !== selected.Decision || reason !== (selected.DecisionReason ?? ""));
    const filtered = filters.teamID !== null || filters.participantID !== null || filters.challengeID !== null || filters.correct !== null || !!filters.from || !!filters.to;
    const {offset} = zoneLabel();
    const busy = pageQuery.isFetching && !!pageQuery.data;
    const state = pageQuery.isPending && !pageQuery.data ? "loading" : pageQuery.isError && !pageQuery.data ? "error" : items.length === 0 ? "empty" : "ready";
    const who = (attempt: ManageAttempt) => teamMode ? attempt.TeamName || t("manage.attempts.team") : attempt.ParticipantName || t("manage.attempts.participant");

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

    function changeFilters(patch: Partial<AttemptFilters>) {
        setFilters(current => ({...current, ...patch}));
        pages.reset();
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

    const resultOptions: Array<{value: boolean | null; label: string}> = [{value: null, label: t("manage.attempts.filter.all")}, {value: true, label: t("manage.attempts.filter.correct")}, {value: false, label: t("manage.attempts.filter.incorrect")}];

    const toolbar = <>
        <EventSelect ariaLabel={teamMode ? t("manage.attempts.team") : t("manage.attempts.participant")} value={filters.teamID ?? all} options={options.teams} onValueChange={value => changeFilters({teamID: value === all ? null : value})} />
        {teamMode && <EventSelect ariaLabel={t("manage.attempts.participant")} value={filters.participantID ?? all} options={options.participants} onValueChange={value => changeFilters({participantID: value === all ? null : value})} />}
        <EventSelect ariaLabel={t("manage.attempts.challenge")} value={filters.challengeID ?? all} options={options.challenges} onValueChange={value => changeFilters({challengeID: value === all ? null : value})} />
        <div className="ib-seg" role="group" aria-label={t("manage.attempts.filter.result")}>
            {resultOptions.map(option => <button key={option.label} type="button" aria-pressed={filters.correct === option.value} onClick={() => changeFilters({correct: option.value})}>{option.label}</button>)}
        </div>
        <PeriodFilters from={filters.from} to={filters.to} onChange={changeFilters} />
        {filtered && <button className="ib-btn ib-btn--sm" type="button" onClick={() => changeFilters(emptyAttemptFilters)}>{t("manage.attempts.filter.reset")}</button>}
        <div className="event-journal__actions">
            <span className="event-manage-table__dim">{stream === "fallback" ? t("manage.attempts.stream.fallback") : stream === "live" ? t("manage.attempts.stream.live") : t("manage.attempts.stream.connecting")}</span>
            {canManage && <EventButton className="ib-btn ib-btn--sm" type="button" disabled={exporting} onClick={() => void exportCSV()} busy={exporting}><Download size={16} aria-hidden="true" /> {t("manage.attempts.export")}</EventButton>}
        </div>
    </>;

    return <>
        <ManageTable event={event} state={state} busy={busy} loadingLabel={t("manage.attempts.loading")} emptyMessage={filtered ? t("manage.attempts.emptyFiltered") : t("manage.attempts.empty")} errorMessage={t("manage.attempts.loadFailed")} onRetry={() => void pageQuery.refetch()}
            toolbar={toolbar}
            head={<tr>
                <th scope="col">{t("manage.attempts.col.time", {offset})}</th>
                <th scope="col">{teamMode ? t("manage.attempts.col.team") : t("manage.attempts.col.participant")}</th>
                <th scope="col">{t("manage.attempts.col.challenge")}</th>
                <th scope="col">{t("manage.attempts.col.result")}</th>
                <th scope="col" className="ib-num">{t("manage.attempts.col.points")}</th>
                {canManage && <th scope="col">{t("manage.attempts.col.answer")}</th>}
            </tr>}
            footer={<ManageTablePagination event={event} page={pages.page} pageSize={pages.pageSize} total={pageQuery.data?.Total ?? 0} hasNext={!!pageQuery.data?.NextCursor} busy={busy} onPrevious={pages.previous} onNext={() => pages.next(pageQuery.data?.NextCursor)} onPageSize={pages.setPageSize} />}>
            <tbody>{items.map(attempt => <tr key={attempt.ID} className="is-clickable" tabIndex={0} aria-label={t("manage.attempts.openAttempt", {challenge: attempt.ChallengeName || t("manage.attempts.challenge"), name: who(attempt)})} onClick={() => open(attempt)} onKeyDown={keyEvent => rowKey(keyEvent, attempt)}>
                <td className="event-manage-table__nowrap"><time dateTime={attempt.ReceivedAt}>{journalTime.format(new Date(attempt.ReceivedAt))}</time></td>
                <td><span className="event-manage-table__person"><strong>{who(attempt)}</strong>{teamMode && attempt.ParticipantName && <small>{attempt.ParticipantName}</small>}</span></td>
                <td>{attempt.ChallengeName || t("manage.attempts.challenge")}</td>
                <td><ResultTag attempt={attempt} /></td>
                <td className="ib-num">{attempt.Points === null ? <span className="event-manage-table__dim">{t("manage.attempts.noPoints")}</span> : points.format(attempt.Points)}</td>
                {canManage && <td><code className="event-manage-table__answer event-journal__answer" title={attempt.Answer ?? undefined}>{attempt.Answer}</code></td>}
            </tr>)}</tbody>
        </ManageTable>
        <DialogModal open={!!selected} onClose={close} size="md" title={selected ? selected.ChallengeName || t("manage.attempts.challenge") : t("manage.attempts.detail")}
            description={selected ? t("manage.attempts.detailMeta", {name: teamMode && selected.ParticipantName ? t("manage.attempts.teamWithRealName", {name: who(selected), realName: selected.ParticipantName}) : who(selected), time: journalTime.format(new Date(selected.ReceivedAt)), offset}) : undefined}>
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
    </>;
}
