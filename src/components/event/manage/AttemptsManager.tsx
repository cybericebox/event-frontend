"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Download} from "lucide-react";
import {annulManageSolve, AttemptsCursorError, attemptsLiveURL, decideManageAttempt, downloadAttemptsCSV, emptyAttemptFilters, getManageAttempts, type AttemptDecision, type AttemptFilters, type ManageAttempt} from "@/api/manageAttempts";
import {getModeratorResults} from "@/api/manageResults";
import {getManageParticipants} from "@/api/manageParticipants";
import {getEventBoardChallenges, getEventExerciseAttachments} from "@/api/manageChallenges";
import {ManageApiError} from "@/api/manage";
import {ApiErrorCode} from "@/api/apiErrors";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {DialogModal} from "@/components/event/DialogModal";
import {useEventStream} from "@/utils/eventStream";
import {useManager} from "./ManagerShell";

const all = "all";

function timestamp(value: string) {
    return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}).format(new Date(value));
}

function attemptStatus(attempt: ManageAttempt) {
    if (attempt.Decision === "accepted") return "Зараховано вручну";
    if (attempt.Decision === "rejected") return "Відхилено вручну";
    return attempt.Correct ? "Зараховано" : "Не зараховано";
}

function recordCount(count: number) {
    const ending = count % 10 === 1 && count % 100 !== 11 ? "запис" : [2, 3, 4].includes(count % 10) && (count % 100 < 12 || count % 100 > 14) ? "записи" : "записів";
    return `${count} ${ending}`;
}

// Challenge filter options: every active board challenge of the event.
async function listChallengeOptions(eventID: string) {
    const attachments = (await getEventExerciseAttachments(eventID)).filter(item => !item.SupersededAt);
    const boards = await Promise.all(attachments.map(item => getEventBoardChallenges(eventID, item.ID)));
    return boards.flat().sort((a, b) => a.Order - b.Order).map(item => ({value: item.ID, label: item.Snapshot.name || "Завдання"}));
}

export function AttemptsManager() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const queryClient = useQueryClient();
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
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
    const stream = useEventStream({url: () => attemptsLiveURL(eventID), events: ["attempts-changed"], onChange: () => void queryClient.invalidateQueries({queryKey: ["event-manage-attempts", eventID]}), enabled: canManage});
    const pageQuery = useQuery({queryKey: ["event-manage-attempts", eventID, filters, cursor], queryFn: () => getManageAttempts(eventID, filters, cursor), enabled: canManage, refetchOnWindowFocus: false, refetchInterval: stream === "fallback" ? 10_000 : false, placeholderData: previous => previous});
    const teams = useQuery({queryKey: ["event-management-moderator-results", eventID], queryFn: () => getModeratorResults(eventID), enabled: canManage, refetchOnWindowFocus: false});
    const participants = useQuery({queryKey: ["event-manage-attempt-participants", eventID], queryFn: () => getManageParticipants(eventID, {kind: "participants"}, null, 100), enabled: canManage && teamMode, refetchOnWindowFocus: false});
    const challenges = useQuery({queryKey: ["event-manage-attempt-challenges", eventID], queryFn: () => listChallengeOptions(eventID), enabled: canManage, refetchOnWindowFocus: false});
    // A stale cursor is rejected by the server: go back to the first page.
    if (pageQuery.error instanceof AttemptsCursorError && cursor !== null) {
        setCursors([null]);
        setPageIndex(0);
        setSelectedID(null);
        setDraft(null);
    }
    const items = pageQuery.data?.Items ?? [];
    const selected = items.find(item => item.ID === selectedID) ?? null;
    const decision = draft && selected && draft.id === selected.ID ? draft.decision : selected?.Decision ?? "automatic";
    const reason = draft && selected && draft.id === selected.ID ? draft.reason : selected?.DecisionReason ?? "";
    const changed = !!selected && (decision !== selected.Decision || reason !== (selected.DecisionReason ?? ""));
    const filtered = filters.teamID !== null || filters.participantID !== null || filters.challengeID !== null || filters.correct !== null || !!filters.from || !!filters.to;

    function select(attempt: ManageAttempt) {
        setSelectedID(attempt.ID);
        setDraft({id: attempt.ID, decision: attempt.Decision, reason: attempt.DecisionReason ?? ""});
        setShowExpected(false);
    }

    function changeFilters(patch: Partial<AttemptFilters>) {
        setFilters(current => ({...current, ...patch}));
        setCursors([null]);
        setPageIndex(0);
        setSelectedID(null);
        setDraft(null);
    }

    function nextPage() {
        const next = pageQuery.data?.NextCursor;
        if (!next) return;
        setCursors(current => [...current.slice(0, pageIndex + 1), next]);
        setPageIndex(index => index + 1);
        setSelectedID(null);
        setDraft(null);
    }

    function previousPage() {
        if (pageIndex === 0) return;
        setPageIndex(index => index - 1);
        setSelectedID(null);
        setDraft(null);
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!selected || !changed || !reason.trim() || !canManage || saving) return;
        setSaving(true);
        try {
            await decideManageAttempt(eventID, selected.ID, decision, reason.trim());
            await queryClient.invalidateQueries({queryKey: ["event-manage-attempts", eventID]});
            setDraft(null);
            toast.success("Рішення щодо відповіді збережено");
        } catch {toast.error("Не вдалося зберегти рішення.");}
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
            toast.success(`Розвʼязок анульовано: відхилено спроб — ${result.Rejected}`);
        } catch (error) {
            toast.error(error instanceof ManageApiError && error.code === ApiErrorCode.NothingToAnnul ? "Зарахованих спроб для цієї пари вже немає." : "Не вдалося анулювати розвʼязок.");
        } finally {setAnnulling(false);}
    }

    async function exportCSV() {
        if (exporting) return;
        setExporting(true);
        try {await downloadAttemptsCSV(eventID, filters);}
        catch {toast.error("Не вдалося експортувати спроби.");}
        finally {setExporting(false);}
    }

    if (!canManage) return <div className="event-manage-error" role="status"><h1>Журнал відповідей доступний лише менеджерам</h1><p>Для перегляду відповідей і ручних рішень потрібні права керування подією.</p></div>;
    if (pageQuery.isPending && !pageQuery.data) return <EventLoading event={event} />;
    if (pageQuery.isError && !pageQuery.data) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити відповіді</h1><button className="ib-btn" onClick={() => void pageQuery.refetch()}>Повторити</button></div>;

    const teamOptions = [{value: all, label: teamMode ? "Усі команди" : "Усі учасники"}, ...(teams.data?.Teams ?? []).map(team => ({value: team.TeamID, label: team.RealName && team.RealName !== team.Name ? `${team.Name} · ${team.RealName}` : team.Name}))];
    const participantOptions = [{value: all, label: "Усі учасники"}, ...(participants.data?.Items ?? []).map(item => ({value: item.UserID, label: item.Name || item.Email}))];
    const challengeOptions = [{value: all, label: "Усі завдання"}, ...(challenges.data ?? [])];

    return <div className="event-manage-settings event-attempts-manager">
        <header className="event-manage-heading"><div><h1>Спроби</h1><p>{teamMode ? "Усі відповіді учасників і команд та рішення модератора в одному журналі." : "Усі відповіді учасників і рішення модератора в одному журналі."}</p></div>
            <div className="event-attempts-manager__head-actions"><span className="event-attempts-manager__total">{recordCount(pageQuery.data?.Total ?? 0)} · {stream === "fallback" ? "оновлення кожні 10 с" : stream === "live" ? "наживо" : "підключаємо…"}</span><button className="ib-btn" type="button" disabled={exporting} onClick={() => void exportCSV()}><Download size={16} aria-hidden="true" /> {exporting ? "Експортуємо…" : "Експорт CSV"}</button></div>
        </header>
        <section className="event-manage-section event-attempts-manager__filters" aria-label="Фільтри спроб">
            <label className="event-manage-field">{teamMode ? "Команда" : "Учасник"}<EventSelect ariaLabel={teamMode ? "Команда" : "Учасник"} value={filters.teamID ?? all} options={teamOptions} onValueChange={value => changeFilters({teamID: value === all ? null : value})} /></label>
            {teamMode && <label className="event-manage-field">Учасник<EventSelect ariaLabel="Учасник" value={filters.participantID ?? all} options={participantOptions} onValueChange={value => changeFilters({participantID: value === all ? null : value})} /></label>}
            <label className="event-manage-field">Завдання<EventSelect ariaLabel="Завдання" value={filters.challengeID ?? all} options={challengeOptions} onValueChange={value => changeFilters({challengeID: value === all ? null : value})} /></label>
            <label className="event-manage-field">Від (UTC)<input className="event-manage-input" type="datetime-local" value={filters.from} onChange={event => changeFilters({from: event.target.value})} /></label>
            <label className="event-manage-field">До (UTC)<input className="event-manage-input" type="datetime-local" value={filters.to} onChange={event => changeFilters({to: event.target.value})} /></label>
            <div className="event-attempts-manager__filter-row">
                <div className="event-manage-participants__filters" role="group" aria-label="Результат">
                    {[{value: null, label: "Усі"}, {value: true, label: "Зараховані"}, {value: false, label: "Не зараховані"}].map(option => <button className="event-manage-participants__filter" key={option.label} type="button" aria-pressed={filters.correct === option.value} onClick={() => changeFilters({correct: option.value})}>{option.label}</button>)}
                </div>
                {filtered && <button className="ib-btn ib-btn--sm" type="button" onClick={() => changeFilters(emptyAttemptFilters)}>Скинути фільтри</button>}
            </div>
        </section>
        {items.length === 0 ? <section className="event-manage-section"><p className="event-challenge-manager__empty">Спроб за цим фільтром поки немає.</p></section> : <div className="event-attempts-manager__layout">
            <section className="event-manage-section event-attempts-manager__list" aria-label="Спроби розв’язання">
                {items.map(attempt => <button className={`event-attempts-manager__row${selectedID === attempt.ID ? " is-selected" : ""}`} type="button" key={attempt.ID} aria-pressed={selectedID === attempt.ID} onClick={() => select(attempt)}>
                    <span className="event-attempts-manager__row-title"><strong>{attempt.ChallengeName || "Завдання"}</strong><span className={attempt.Correct ? "is-correct" : "is-incorrect"}>{attemptStatus(attempt)}</span></span>
                    <span className="event-attempts-manager__row-meta">{attempt.ParticipantName || "Учасник"}{teamMode && attempt.TeamName ? ` · ${attempt.TeamName}` : ""}</span>
                    <time dateTime={attempt.ReceivedAt}>{timestamp(attempt.ReceivedAt)} UTC</time>
                </button>)}
                <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={previousPage}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!pageQuery.data?.NextCursor} onClick={nextPage}>Далі</button></div>
            </section>
            <section className="event-manage-section event-attempts-manager__detail" aria-label="Деталі відповіді">
                {!selected ? <p className="event-challenge-manager__empty">Оберіть відповідь у списку, щоб переглянути деталі.</p> : <>
                    <div className="event-manage-section__head"><h2>{selected.ChallengeName || "Завдання"}</h2><p>{selected.ParticipantName || "Учасник"}{teamMode && selected.TeamName ? ` · ${selected.TeamName}` : ""} · {timestamp(selected.ReceivedAt)} UTC</p></div>
                    <dl className="event-attempts-manager__facts"><div><dt>Надіслана відповідь</dt><dd><code>{selected.Answer}</code></dd></div><div><dt>Автоматична перевірка</dt><dd>{selected.AutomaticCorrect ? "Правильно" : "Неправильно"}</dd></div><div><dt>Поточний результат</dt><dd>{attemptStatus(selected)}</dd></div></dl>
                    <div className="event-attempts-manager__expected"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setShowExpected(value => !value)}>{showExpected ? "Сховати еталон" : "Показати еталон"}</button>{showExpected && <code>{selected.ExpectedFlag}</code>}</div>
                    {selected.DecisionReason && <p className="event-attempts-manager__reason"><strong>Причина попереднього рішення:</strong> {selected.DecisionReason}</p>}
                    <form className="event-attempts-manager__review" onSubmit={save}>
                        <label className="event-manage-field">Рішення<EventSelect ariaLabel="Рішення щодо відповіді" value={decision} options={[{value: "automatic", label: "Автоматична перевірка"}, {value: "accepted", label: "Зарахувати вручну"}, {value: "rejected", label: "Відхилити вручну"}]} onValueChange={value => setDraft({id: selected.ID, decision: value as AttemptDecision, reason: value === selected.Decision ? selected.DecisionReason ?? "" : ""})} disabled={saving} /></label>
                        <label className="event-manage-field">Причина<textarea className="event-manage-input" value={reason} onChange={event => setDraft({id: selected.ID, decision, reason: event.target.value})} placeholder="Поясніть рішення для історії модерації" maxLength={1000} disabled={saving} /></label>
                        {changed && <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={saving || !reason.trim()}>{saving ? "Зберігаємо…" : "Зберегти рішення"}</button></div>}
                    </form>
                    {selected.Correct && <div className="event-attempts-manager__annul"><div><strong>Анулювати розвʼязок</strong><p>Відхилити всі зараховані спроби {teamMode ? "команди" : "учасника"} за це завдання й перерахувати бали.</p></div><button className="ib-btn ib-btn--danger" type="button" onClick={() => setAnnul({attempt: selected, reason: ""})}>Анулювати</button></div>}
                </>}
            </section>
        </div>}
        <DialogModal open={!!annul} onClose={() => { if (!annulling) setAnnul(null); }} title="Анулювати розвʼязок?" description={annul ? `${annul.attempt.ChallengeName || "Завдання"} · ${teamMode ? annul.attempt.TeamName : annul.attempt.ParticipantName}. Усі зараховані спроби буде відхилено, бали перераховано.` : undefined}
            footer={<><button className="ib-btn" type="button" disabled={annulling} onClick={() => setAnnul(null)}>Скасувати</button><button className="ib-btn ib-btn--danger" type="submit" form="annul-solve-form" disabled={annulling || !annul?.reason.trim()}>{annulling ? "Анулюємо…" : "Анулювати"}</button></>}>
            <form id="annul-solve-form" onSubmit={confirmAnnul}><label className="event-manage-field">Причина<textarea className="event-manage-input" value={annul?.reason ?? ""} onChange={event => setAnnul(current => current && {...current, reason: event.target.value})} placeholder="Буде записано в історію модерації" maxLength={1000} disabled={annulling} required /></label></form>
        </DialogModal>
    </div>;
}
