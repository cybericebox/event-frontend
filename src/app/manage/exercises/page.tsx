"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Plus, Search} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    attachEventExercise, getEventBoardChallenges, getEventExerciseAttachments, getPublishedExerciseChoices,
    updateEventBoardChallenge, updateEventChallengeScoring, type ChallengeScoringOverride, type EventBoardChallenge, type EventExerciseAttachment,
} from "@/api/manageChallenges";
import {getManageLifecycle, getManageScoring, type ManageLifecycle} from "@/api/manage";
import {EventLoading} from "@/components/event/EventLoading";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventSelect} from "@/components/ui/EventSelect";

type ChallengeDraft = Pick<EventBoardChallenge, "Points" | "HintsEnabled" | "Published">;
type Board = {attachment: EventExerciseAttachment; challenges: EventBoardChallenge[]};

const scoringModes = [
    {value: "event", label: "Профіль події"},
    {value: "0", label: "Фіксовані бали"},
    {value: "1", label: "За кількістю розв’язань"},
    {value: "2", label: "За порядком розв’язань"},
    {value: "3", label: "За часом розв’язання"},
];

function ChallengeScoringEditor({eventID, attachmentID, challenge, lifecycle, canManage, onSaved}: {
    eventID: string; attachmentID: string; challenge: EventBoardChallenge; lifecycle: ManageLifecycle;
    canManage: boolean; onSaved: () => Promise<unknown>;
}) {
    const [draft, setDraft] = useState<ChallengeScoringOverride | null>(challenge.ScoringOverride);
    const [saving, setSaving] = useState(false);
    const changed = JSON.stringify(draft) !== JSON.stringify(challenge.ScoringOverride);
    const dynamic = draft !== null && draft.Mode !== 0;
    const modeProblem = draft?.Mode === 1 || draft?.Mode === 2
        ? lifecycle.JoinPolicy !== 0 ? "Цей режим потребує завершення приєднання до початку події." : ""
        : draft?.Mode === 3 && !lifecycle.FinishAt ? "Для цього режиму спершу заплануйте завершення події." : "";
    const valid = !dynamic || (Number.isInteger(draft.MinPoints) && draft.MinPoints > 0 && Number.isInteger(draft.MaxPoints) && draft.MaxPoints > draft.MinPoints && Number.isInteger(draft.FloorAtPercent) && draft.FloorAtPercent >= 1 && draft.FloorAtPercent <= 100);

    function changeMode(value: string) {
        if (value === "event") {setDraft(null); return;}
        const mode = Number(value) as ChallengeScoringOverride["Mode"];
        setDraft({Mode: mode, MinPoints: mode === 0 ? 0 : draft?.MinPoints || 100, MaxPoints: mode === 0 ? 0 : draft?.MaxPoints || 500, FloorAtPercent: mode === 0 ? 0 : draft?.FloorAtPercent || 50});
    }

    async function save() {
        if (!canManage || saving || !changed || !valid || modeProblem) return;
        setSaving(true);
        try {
            await updateEventChallengeScoring(eventID, attachmentID, challenge.ID, draft);
            await onSaved();
            toast.success("Нарахування балів збережено");
        } catch {toast.error("Не вдалося зберегти нарахування балів.");}
        finally {setSaving(false);}
    }

    return <div className="event-exercise-editor__scoring">
        <div className="event-manage-field"><ManageFieldLabel title="Нарахування балів" help="Профіль події застосовує загальні налаштування. Локальний профіль діє лише для цього завдання, якщо в профілі події не ввімкнено примусове застосування." /><EventSelect ariaLabel={`Нарахування балів для ${challenge.Snapshot.name}`} value={draft === null ? "event" : String(draft.Mode)} options={scoringModes} onValueChange={changeMode} disabled={!canManage || saving} /></div>
        {dynamic && <div className="event-manage-fields-three">
            <label className="event-manage-field">Мінімум балів<input className="event-manage-input" type="number" min={1} step={1} value={draft.MinPoints} onChange={event => setDraft({...draft, MinPoints: Number(event.target.value)})} disabled={!canManage || saving} /></label>
            <label className="event-manage-field">Максимум балів<input className="event-manage-input" type="number" min={draft.MinPoints + 1} step={1} value={draft.MaxPoints} onChange={event => setDraft({...draft, MaxPoints: Number(event.target.value)})} disabled={!canManage || saving} /></label>
            <label className="event-manage-field">Поріг, %<input className="event-manage-input" type="number" min={1} max={100} step={1} value={draft.FloorAtPercent} onChange={event => setDraft({...draft, FloorAtPercent: Number(event.target.value)})} disabled={!canManage || saving} /></label>
        </div>}
        {modeProblem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{modeProblem}</p>}
        {dynamic && !valid && <p className="event-manage-validation" role="alert">Мінімум має бути понад нуль, максимум більший за мінімум, поріг від 1 до 100%.</p>}
        {changed && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || saving || !valid || !!modeProblem} onClick={() => void save()}>Зберегти нарахування</button>}
    </div>;
}

export default function EventExercisesPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [drafts, setDrafts] = useState<Record<string, ChallengeDraft>>({});
    const [busy, setBusy] = useState(false);
    const attachmentsQuery = useQuery({queryKey: ["event-exercise-attachments", eventID], queryFn: () => getEventExerciseAttachments(eventID), refetchOnWindowFocus: false});
    const catalogQuery = useQuery({queryKey: ["event-exercise-catalog", eventID, search], queryFn: () => getPublishedExerciseChoices(eventID, search), refetchOnWindowFocus: false});
    const scoringQuery = useQuery({queryKey: ["event-management-scoring", eventID], queryFn: () => getManageScoring(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const boardKey = ["event-exercise-boards", eventID, attachmentsQuery.data?.map(item => item.ID).join("|") ?? ""];
    const boardsQuery = useQuery({
        queryKey: boardKey,
        queryFn: async (): Promise<Board[]> => Promise.all((attachmentsQuery.data ?? []).filter(item => item.Status === 0).map(async attachment => ({
            attachment, challenges: (await getEventBoardChallenges(eventID, attachment.ID)).sort((a, b) => a.Order - b.Order),
        }))),
        enabled: attachmentsQuery.isSuccess, refetchOnWindowFocus: false,
    });
    const boards = boardsQuery.data ?? [];
    const attachedVersions = new Set(boards.map(board => board.attachment.ExerciseVersionID));

    async function attach(versionID: string) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await attachEventExercise(eventID, versionID, 0, null);
            await queryClient.invalidateQueries({queryKey: ["event-exercise-attachments", eventID]});
            await queryClient.invalidateQueries({queryKey: ["event-exercise-boards", eventID]});
            toast.success("Набір завдань прикріплено");
        } catch {toast.error("Не вдалося прикріпити набір. Перевірте, чи його вже не додано.");}
        finally {setBusy(false);}
    }

    async function saveChallenge(attachmentID: string, challenge: EventBoardChallenge) {
        const draft = drafts[challenge.ID];
        if (!draft || !canManage || busy || !Number.isInteger(draft.Points) || draft.Points < 1) return;
        setBusy(true);
        try {
            await updateEventBoardChallenge(eventID, attachmentID, challenge.ID, draft);
            setDrafts(current => {const next = {...current}; delete next[challenge.ID]; return next;});
            await queryClient.invalidateQueries({queryKey: ["event-exercise-boards", eventID]});
            toast.success("Завдання збережено");
        } catch {toast.error("Не вдалося зберегти завдання.");}
        finally {setBusy(false);}
    }

    function updateDraft(challenge: EventBoardChallenge, patch: Partial<ChallengeDraft>) {
        setDrafts(current => ({...current, [challenge.ID]: {...(current[challenge.ID] ?? {Points: challenge.Points, HintsEnabled: challenge.HintsEnabled, Published: challenge.Published}), ...patch}}));
    }

    if (attachmentsQuery.isPending || catalogQuery.isPending || boardsQuery.isPending || scoringQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (attachmentsQuery.isError || boardsQuery.isError || scoringQuery.isError || lifecycleQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити завдання</h1><button className="ib-btn" onClick={() => {void Promise.all([attachmentsQuery.refetch(), boardsQuery.refetch(), scoringQuery.refetch(), lifecycleQuery.refetch()]);}}>Повторити</button></div>;

    return <div className="event-manage-settings event-challenge-manager">
        <header className="event-manage-heading"><div><h1>Завдання</h1><p>Прикріпіть опублікований набір і налаштуйте завдання на дошці події.</p></div></header>
        {scoringQuery.data.ForceEventScoring && <p className="event-manage-notice">Зараз примусово діє профіль балів події. Локальні налаштування завдань зберігаються, але почнуть діяти після вимкнення цього параметра.</p>}
        <section className="event-manage-section" aria-labelledby="attached-exercises-title">
            <div className="event-manage-section__head"><h2 id="attached-exercises-title">Прикріплені набори</h2><p>Зміни в каталозі не замінюють уже прикріплену версію.</p></div>
            {boards.length === 0 ? <p className="event-challenge-manager__empty">Наборів завдань поки немає.</p> : boards.map((board, boardIndex) => <div className="event-challenge-manager__board" key={board.attachment.ID}>
                <h3>{board.attachment.ExerciseName || `Набір ${boardIndex + 1}`} <span>· версія {board.attachment.Revision}</span></h3>
                {board.challenges.length === 0 ? <p className="event-challenge-manager__empty">У цьому наборі немає завдань.</p> : <div className="event-exercise-editor__tasks">
                    {board.challenges.map(challenge => {
                        const draft = drafts[challenge.ID] ?? {Points: challenge.Points, HintsEnabled: challenge.HintsEnabled, Published: challenge.Published};
                        const changed = draft.Points !== challenge.Points || draft.HintsEnabled !== challenge.HintsEnabled || draft.Published !== challenge.Published;
                        return <div className="event-exercise-editor__task" key={challenge.ID}>
                            <div className="event-exercise-editor__task-head"><strong>{challenge.Snapshot.name}</strong><span>{challenge.Published ? "На дошці" : "Приховано"}</span></div>
                            <div className="event-exercise-editor__controls">
                                <label className="event-manage-field">Бали<input className="event-manage-input" type="number" min={1} step={1} value={draft.Points} onChange={event => updateDraft(challenge, {Points: Number(event.target.value)})} disabled={!canManage || busy} /></label>
                                <label className="event-exercise-editor__check"><input type="checkbox" checked={draft.HintsEnabled} onChange={event => updateDraft(challenge, {HintsEnabled: event.target.checked})} disabled={!canManage || busy} /> Підказки</label>
                                <label className="event-exercise-editor__check"><input type="checkbox" checked={draft.Published} onChange={event => updateDraft(challenge, {Published: event.target.checked})} disabled={!canManage || busy} /> Показувати на дошці</label>
                                {changed && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || busy || !Number.isInteger(draft.Points) || draft.Points < 1} onClick={() => void saveChallenge(board.attachment.ID, challenge)}>Зберегти</button>}
                            </div>
                            <ChallengeScoringEditor eventID={eventID} attachmentID={board.attachment.ID} challenge={challenge} lifecycle={lifecycleQuery.data} canManage={canManage} onSaved={() => queryClient.invalidateQueries({queryKey: ["event-exercise-boards", eventID]})} />
                        </div>;
                    })}
                </div>}
            </div>)}
        </section>
        {canManage && <section className="event-manage-section" aria-labelledby="catalog-title">
            <div className="event-manage-section__head"><h2 id="catalog-title">Додати набір</h2><p>Доступні лише опубліковані версії завдань. Після додавання ви зможете змінити їхню групу й порядок.</p></div>
            <form className="event-exercise-editor__search" onSubmit={(submitEvent: FormEvent<HTMLFormElement>) => {submitEvent.preventDefault(); setSearch(searchInput.trim());}}>
                <label className="event-manage-field" htmlFor="exercise-search">Пошук у каталозі<input id="exercise-search" className="event-manage-input" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Назва або опис" maxLength={100} /></label>
                <button className="ib-btn" type="submit"><Search />Знайти</button>
            </form>
            {catalogQuery.isError ? <div className="event-manage-feedback event-manage-feedback--error" role="alert">Не вдалося завантажити каталог. <button className="ib-btn ib-btn--sm" type="button" onClick={() => void catalogQuery.refetch()}>Повторити</button></div>
                : (catalogQuery.data?.length ?? 0) === 0 ? <p className="event-challenge-manager__empty">Опублікованих наборів за цим запитом немає.</p>
                    : <ul className="event-challenge-manager__list">{catalogQuery.data?.map(choice => <li className="event-exercise-editor__choice" key={choice.ID}>
                        <div><strong>{choice.Name}</strong>{choice.Description && <p>{choice.Description}</p>}</div>
                        <button className="ib-btn ib-btn--sm" type="button" disabled={busy || attachedVersions.has(choice.PublishedVersionID)} onClick={() => void attach(choice.PublishedVersionID)}>{attachedVersions.has(choice.PublishedVersionID) ? "Додано" : <><Plus />Додати</>}</button>
                    </li>)}</ul>}
        </section>}
    </div>;
}
