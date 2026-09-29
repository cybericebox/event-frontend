"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {BoardDisplaySettings} from "@/components/event/manage/BoardDisplaySettings";
import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    createEventChallengeGroup, deleteEventChallengeGroup, getEventBoardChallenges, getEventChallengeGroups,
    getEventExerciseAttachments, reorderEventBoardChallenges, reorderEventChallengeGroups, setEventChallengeGroup, updateEventChallengeGroup,
    type EventBoardChallenge, type EventChallengeGroup, type EventExerciseAttachment,
} from "@/api/manageChallenges";
import {ManageApiError} from "@/api/manage";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventSelect} from "@/components/ui/EventSelect";

type Board = {attachment: EventExerciseAttachment; challenges: EventBoardChallenge[]};

function taskCount(count: number) {
    const ending = count % 10 === 1 && count % 100 !== 11 ? "завдання" : [2, 3, 4].includes(count % 10) && (count % 100 < 12 || count % 100 > 14) ? "завдання" : "завдань";
    return `${count} ${ending}`;
}

export default function ExerciseGroupsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const groupKey = ["event-challenge-groups", eventID];
    const attachmentKey = ["event-exercise-attachments", eventID];
    const groupsQuery = useQuery({queryKey: groupKey, queryFn: () => getEventChallengeGroups(eventID), refetchOnWindowFocus: false});
    const attachmentsQuery = useQuery({queryKey: attachmentKey, queryFn: () => getEventExerciseAttachments(eventID), refetchOnWindowFocus: false});
    const boardKey = ["event-exercise-boards", eventID, attachmentsQuery.data?.map(item => item.ID).join("|") ?? ""];
    const boardsQuery = useQuery({
        queryKey: boardKey,
        queryFn: async (): Promise<Board[]> => Promise.all((attachmentsQuery.data ?? []).filter(item => item.Status === 0).map(async attachment => ({
            attachment, challenges: (await getEventBoardChallenges(eventID, attachment.ID)).sort((a, b) => a.Order - b.Order),
        }))),
        enabled: attachmentsQuery.isSuccess,
        refetchOnWindowFocus: false,
    });
    const [name, setName] = useState("");
    const [editing, setEditing] = useState<{id: string; name: string} | null>(null);
    const [busy, setBusy] = useState(false);
    const groups = [...(groupsQuery.data ?? [])].sort((a, b) => a.Order - b.Order || a.Name.localeCompare(b.Name));
    const boards = boardsQuery.data ?? [];
    const assigned = new Map(groups.map(group => [group.ID, boards.reduce((count, board) => count + board.challenges.filter(challenge => challenge.GroupID === group.ID).length, 0)]));

    async function refresh() {
        await Promise.all([queryClient.invalidateQueries({queryKey: groupKey}), queryClient.invalidateQueries({queryKey: boardKey})]);
    }

    async function create(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        const trimmed = name.trim();
        if (!canManage || !trimmed || busy) return;
        setBusy(true);
        try {
            await createEventChallengeGroup(eventID, trimmed, Math.max(-1, ...groups.map(group => group.Order)) + 1);
            setName("");
            await refresh();
            toast.success("Групу створено");
        } catch {toast.error("Не вдалося створити групу.");}
        finally {setBusy(false);}
    }

    async function rename(group: EventChallengeGroup) {
        const trimmed = editing?.name.trim();
        if (!canManage || !trimmed || busy) return;
        if (trimmed === group.Name) {setEditing(null); return;}
        setBusy(true);
        try {
            await updateEventChallengeGroup(eventID, group.ID, trimmed, group.Order);
            setEditing(null);
            await refresh();
            toast.success("Назву групи збережено");
        } catch (failure) {toast.error(failure instanceof ManageApiError && failure.status === 409 ? "Група з такою назвою вже існує." : "Не вдалося перейменувати групу.");}
        finally {setBusy(false);}
    }

    async function moveGroup(group: EventChallengeGroup, direction: -1 | 1) {
        const index = groups.findIndex(item => item.ID === group.ID);
        const other = groups[index + direction];
        if (!canManage || !other || busy) return;
        setBusy(true);
        try {
            const ids = groups.map(item => item.ID);
            [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
            await reorderEventChallengeGroups(eventID, ids);
            await refresh();
        } catch {
            await refresh();
            toast.error("Не вдалося змінити порядок груп.");
        } finally {setBusy(false);}
    }

    async function removeGroup(group: EventChallengeGroup) {
        if (!canManage || busy) return;
        const count = assigned.get(group.ID) ?? 0;
        const prompt = count > 0
            ? `Видалити групу «${group.Name}»? ${count} завдань залишаться без групи.`
            : `Видалити групу «${group.Name}»?`;
        if (!window.confirm(prompt)) return;
        setBusy(true);
        try {
            await deleteEventChallengeGroup(eventID, group.ID);
            await refresh();
            toast.success("Групу видалено");
        } catch {toast.error("Не вдалося видалити групу.");}
        finally {setBusy(false);}
    }

    async function setGroup(board: Board, challenge: EventBoardChallenge, groupID: string) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await setEventChallengeGroup(eventID, board.attachment.ID, challenge, groupID || null);
            await refresh();
            toast.success("Групу завдання оновлено");
        } catch {toast.error("Не вдалося перемістити завдання.");}
        finally {setBusy(false);}
    }

    async function moveChallenge(board: Board, index: number, direction: -1 | 1) {
        const other = index + direction;
        if (!canManage || busy || other < 0 || other >= board.challenges.length) return;
        const ids = board.challenges.map(challenge => challenge.ID);
        [ids[index], ids[other]] = [ids[other], ids[index]];
        setBusy(true);
        try {
            await reorderEventBoardChallenges(eventID, board.attachment.ID, ids);
            await refresh();
        } catch {toast.error("Не вдалося змінити порядок завдань.");}
        finally {setBusy(false);}
    }

    if (groupsQuery.isPending || attachmentsQuery.isPending || boardsQuery.isPending) return <EventLoading event={event} />;
    if (groupsQuery.isError || attachmentsQuery.isError || boardsQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити групи й завдання</h1><button className="ib-btn" onClick={() => {void Promise.all([groupsQuery.refetch(), attachmentsQuery.refetch(), boardsQuery.refetch()]);}}>Повторити</button></div>;

    return <div className="event-manage-settings event-challenge-manager">
        <header className="event-manage-heading"><div><h1>Групи й порядок</h1><p>Створіть розділи дошки та розташуйте завдання всередині кожного набору.</p></div></header>
        <BoardDisplaySettings eventID={event.EventID} canManage={canManage} />
        <section className="event-manage-section" aria-labelledby="challenge-groups-title">
            <div className="event-manage-section__head"><h2 id="challenge-groups-title">Групи</h2><p>Групи визначають розділи, у яких учасники бачать завдання.</p></div>
            {groups.length === 0 ? <p className="event-challenge-manager__empty">Груп поки немає. Завдання відображатимуться без групи.</p> : <ol className="event-challenge-manager__list">
                {groups.map((group, index) => <li className="event-challenge-manager__group" key={group.ID}>
                    {editing?.id === group.ID ? <form className="event-challenge-manager__rename" onSubmit={event => {event.preventDefault(); void rename(group);}}>
                        <input className="event-manage-input" aria-label="Нова назва групи" maxLength={80} value={editing.name} onChange={event => setEditing({...editing, name: event.target.value})} disabled={busy} autoFocus />
                        <button className="ib-btn ib-btn--sm ib-btn--primary" disabled={busy || !editing.name.trim()}>Зберегти</button>
                        <button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(null)}>Скасувати</button>
                    </form> : <div className="event-challenge-manager__group-main"><strong>{group.Name}</strong><span>{taskCount(assigned.get(group.ID) ?? 0)}</span></div>}
                    <div className="event-challenge-manager__actions">
                        <button className="ib-btn ib-btn--sm" type="button" aria-label={`Підняти групу ${group.Name}`} title="Підняти" disabled={!canManage || busy || index === 0} onClick={() => void moveGroup(group, -1)}><ArrowUp /></button>
                        <button className="ib-btn ib-btn--sm" type="button" aria-label={`Опустити групу ${group.Name}`} title="Опустити" disabled={!canManage || busy || index === groups.length - 1} onClick={() => void moveGroup(group, 1)}><ArrowDown /></button>
                        <button className="ib-btn ib-btn--sm" type="button" disabled={!canManage || busy} onClick={() => setEditing({id: group.ID, name: group.Name})}>Змінити назву</button>
                        <button className="ib-btn ib-btn--sm ib-btn--danger" type="button" aria-label={`Видалити групу ${group.Name}`} title="Видалити групу" disabled={!canManage || busy} onClick={() => void removeGroup(group)}><Trash2 /></button>
                    </div>
                </li>)}
            </ol>}
            {canManage && <form className="event-challenge-manager__create" onSubmit={create}>
                <label className="event-manage-field" htmlFor="new-challenge-group">Нова група<input id="new-challenge-group" className="event-manage-input" value={name} maxLength={80} placeholder="Наприклад, Веббезпека" onChange={event => setName(event.target.value)} disabled={busy} /></label>
                <button className="ib-btn ib-btn--primary" disabled={busy || !name.trim()}><Plus />Додати групу</button>
            </form>}
        </section>
        <section className="event-manage-section" aria-labelledby="challenge-order-title">
            <div className="event-manage-section__head"><h2 id="challenge-order-title">Завдання на дошці</h2><p>Змінюйте групу й порядок завдань у межах одного набору.</p></div>
            {boards.length === 0 ? <p className="event-challenge-manager__empty">До події ще не прикріплено наборів завдань.</p> : boards.map((board, boardIndex) => <div className="event-challenge-manager__board" key={board.attachment.ID}>
                <h3>{board.attachment.ExerciseName || `Набір ${boardIndex + 1}`} <span>· {taskCount(board.challenges.length)}</span></h3>
                {board.challenges.length === 0 ? <p className="event-challenge-manager__empty">У цьому наборі немає завдань.</p> : <ol className="event-challenge-manager__list">
                    {board.challenges.map((challenge, index) => <li className="event-challenge-manager__task" key={challenge.ID}>
                        <div className="event-challenge-manager__task-name"><span className="event-challenge-manager__position">{index + 1}</span><strong>{challenge.Snapshot.name}</strong></div>
                        <EventSelect ariaLabel={`Група завдання ${challenge.Snapshot.name}`} value={challenge.GroupID ?? "none"} options={[{value: "none", label: "Без групи"}, ...groups.map(group => ({value: group.ID, label: group.Name}))]} onValueChange={value => void setGroup(board, challenge, value === "none" ? "" : value)} disabled={!canManage || busy} />
                        <div className="event-challenge-manager__actions">
                            <button className="ib-btn ib-btn--sm" type="button" title="Підняти" aria-label={`Підняти завдання ${challenge.Snapshot.name}`} disabled={!canManage || busy || index === 0} onClick={() => void moveChallenge(board, index, -1)}><ArrowUp /></button>
                            <button className="ib-btn ib-btn--sm" type="button" title="Опустити" aria-label={`Опустити завдання ${challenge.Snapshot.name}`} disabled={!canManage || busy || index === board.challenges.length - 1} onClick={() => void moveChallenge(board, index, 1)}><ArrowDown /></button>
                        </div>
                    </li>)}
                </ol>}
            </div>)}
        </section>
    </div>;
}
