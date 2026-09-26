"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Plus, Search} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    attachEventExercise, getEventBoardChallenges, getEventExerciseAttachments, getPublishedExerciseChoices,
    updateEventBoardChallenge, type EventBoardChallenge, type EventExerciseAttachment,
} from "@/api/manageChallenges";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";

type ChallengeDraft = Pick<EventBoardChallenge, "Points" | "HintsEnabled" | "Published">;
type Board = {attachment: EventExerciseAttachment; challenges: EventBoardChallenge[]};

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

    if (attachmentsQuery.isPending || catalogQuery.isPending || boardsQuery.isPending) return <EventLoading event={event} />;
    if (attachmentsQuery.isError || boardsQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити завдання</h1><button className="ib-btn" onClick={() => {void attachmentsQuery.refetch(); void boardsQuery.refetch();}}>Повторити</button></div>;

    return <div className="event-manage-settings event-challenge-manager">
        <header className="event-manage-heading"><div><h1>Завдання</h1><p>Прикріпіть опублікований набір і налаштуйте завдання на дошці події.</p></div></header>
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
