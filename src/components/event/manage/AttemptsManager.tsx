"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {decideManageAttempt, getManageAttempts, type AttemptDecision, type ManageAttempt} from "@/api/manageAttempts";
import {getEventBoardChallenges, getEventExerciseAttachments} from "@/api/manageChallenges";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {useManager} from "./ManagerShell";

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

export function AttemptsManager({solvedOnly}: {solvedOnly: boolean}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [draft, setDraft] = useState<{id: string; decision: AttemptDecision; reason: string} | null>(null);
    const [showExpected, setShowExpected] = useState(false);
    const [saving, setSaving] = useState(false);
    const correct = solvedOnly ? true : null;
    const cursor = cursors[pageIndex] ?? null;
    const pageQuery = useQuery({queryKey: ["event-manage-attempts", eventID, correct, cursor], queryFn: () => getManageAttempts(eventID, correct, cursor), enabled: canManage, refetchOnWindowFocus: false});
    const namesQuery = useQuery({
        queryKey: ["event-manage-attempt-names", eventID],
        queryFn: async () => {
            const attachments = await getEventExerciseAttachments(eventID);
            const boards = await Promise.all(attachments.map(attachment => getEventBoardChallenges(eventID, attachment.ID)));
            return Object.fromEntries(boards.flat().map(challenge => [challenge.ID, challenge.Snapshot.name]));
        }, enabled: canManage, refetchOnWindowFocus: false,
    });
    const items = pageQuery.data?.Items ?? [];
    const selected = items.find(item => item.ID === selectedID) ?? null;
    const decision = draft && selected && draft.id === selected.ID ? draft.decision : selected?.Decision ?? "automatic";
    const reason = draft && selected && draft.id === selected.ID ? draft.reason : selected?.DecisionReason ?? "";
    const changed = !!selected && (decision !== selected.Decision || reason !== (selected.DecisionReason ?? ""));

    function select(attempt: ManageAttempt) {
        setSelectedID(attempt.ID);
        setDraft({id: attempt.ID, decision: attempt.Decision, reason: attempt.DecisionReason ?? ""});
        setShowExpected(false);
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

    if (!canManage) return <div className="event-manage-error" role="status"><h1>Журнал відповідей доступний лише менеджерам</h1><p>Для перегляду відповідей і ручних рішень потрібні права керування подією.</p></div>;
    if (pageQuery.isPending) return <EventLoading event={event} />;
    if (pageQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити відповіді</h1><button className="ib-btn" onClick={() => void pageQuery.refetch()}>Повторити</button></div>;

    return <div className="event-manage-settings event-attempts-manager">
        <header className="event-manage-heading"><div><h1>{solvedOnly ? "Розв’язання" : "Надсилання"}</h1><p>{solvedOnly ? "Зараховані відповіді учасників і команд." : "Історія всіх надісланих відповідей та рішень модератора."}</p></div><span className="event-attempts-manager__total">{recordCount(pageQuery.data?.Total ?? 0)}</span></header>
        {items.length === 0 ? <section className="event-manage-section"><p className="event-challenge-manager__empty">{solvedOnly ? "Зарахованих розв’язань поки немає." : "Відповідей поки немає."}</p></section> : <div className="event-attempts-manager__layout">
            <section className="event-manage-section event-attempts-manager__list" aria-label={solvedOnly ? "Зараховані розв’язання" : "Надіслані відповіді"}>
                {items.map(attempt => <button className={`event-attempts-manager__row${selectedID === attempt.ID ? " is-selected" : ""}`} type="button" key={attempt.ID} aria-pressed={selectedID === attempt.ID} onClick={() => select(attempt)}>
                    <span className="event-attempts-manager__row-title"><strong>{namesQuery.data?.[attempt.EventChallengeID] ?? "Завдання"}</strong><span className={attempt.Correct ? "is-correct" : "is-incorrect"}>{attemptStatus(attempt)}</span></span>
                    <span className="event-attempts-manager__row-meta">{attempt.ParticipantName || "Учасник"}{attempt.TeamName ? ` · ${attempt.TeamName}` : ""}</span>
                    <time dateTime={attempt.ReceivedAt}>{timestamp(attempt.ReceivedAt)} UTC</time>
                </button>)}
                <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={previousPage}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!pageQuery.data?.NextCursor} onClick={nextPage}>Далі</button></div>
            </section>
            <section className="event-manage-section event-attempts-manager__detail" aria-label="Деталі відповіді">
                {!selected ? <p className="event-challenge-manager__empty">Оберіть відповідь у списку, щоб переглянути деталі.</p> : <>
                    <div className="event-manage-section__head"><h2>{namesQuery.data?.[selected.EventChallengeID] ?? "Завдання"}</h2><p>{selected.ParticipantName || "Учасник"}{selected.TeamName ? ` · ${selected.TeamName}` : ""} · {timestamp(selected.ReceivedAt)} UTC</p></div>
                    <dl className="event-attempts-manager__facts"><div><dt>Надіслана відповідь</dt><dd><code>{selected.Answer}</code></dd></div><div><dt>Автоматична перевірка</dt><dd>{selected.AutomaticCorrect ? "Правильно" : "Неправильно"}</dd></div><div><dt>Поточний результат</dt><dd>{attemptStatus(selected)}</dd></div></dl>
                    {canManage && <div className="event-attempts-manager__expected"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setShowExpected(value => !value)}>{showExpected ? "Сховати еталон" : "Показати еталон"}</button>{showExpected && <code>{selected.ExpectedFlag}</code>}</div>}
                    {selected.DecisionReason && <p className="event-attempts-manager__reason"><strong>Причина попереднього рішення:</strong> {selected.DecisionReason}</p>}
                    {canManage && <form className="event-attempts-manager__review" onSubmit={save}>
                        <label className="event-manage-field">Рішення<EventSelect ariaLabel="Рішення щодо відповіді" value={decision} options={[{value: "automatic", label: "Автоматична перевірка"}, {value: "accepted", label: "Зарахувати вручну"}, {value: "rejected", label: "Відхилити вручну"}]} onValueChange={value => setDraft({id: selected.ID, decision: value as AttemptDecision, reason: value === selected.Decision ? selected.DecisionReason ?? "" : ""})} disabled={saving} /></label>
                        <label className="event-manage-field">Причина<textarea className="event-manage-input" value={reason} onChange={event => setDraft({id: selected.ID, decision, reason: event.target.value})} placeholder="Поясніть рішення для історії модерації" maxLength={1000} disabled={saving} /></label>
                        {changed && <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={saving || !reason.trim()}>{saving ? "Зберігаємо…" : "Зберегти рішення"}</button></div>}
                    </form>}
                </>}
            </section>
        </div>}
    </div>;
}
