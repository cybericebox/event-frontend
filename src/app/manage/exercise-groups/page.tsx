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
import {t, tPlural} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";

type Board = {attachment: EventExerciseAttachment; challenges: EventBoardChallenge[]};

function taskCount(count: number) {
    return tPlural("manage.exercises.meta.challenges", count);
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
            toast.success(t("manage.exercises.groups.created"));
        } catch {toast.error(t("manage.exercises.groups.createFailed"));}
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
            toast.success(t("manage.exercises.groups.renamed"));
        } catch (failure) {toast.error(failure instanceof ManageApiError && failure.status === 409 ? t("manage.exercises.groups.exists") : t("manage.exercises.groups.renameFailed"));}
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
            toast.error(t("manage.exercises.groups.reorderFailed"));
        } finally {setBusy(false);}
    }

    async function removeGroup(group: EventChallengeGroup) {
        if (!canManage || busy) return;
        const count = assigned.get(group.ID) ?? 0;
        const prompt = count > 0
            ? tPlural("manage.exercises.groups.deleteConfirmWithTasks", count, {name: group.Name})
            : t("manage.exercises.groups.deleteConfirm", {name: group.Name});
        if (!window.confirm(prompt)) return;
        setBusy(true);
        try {
            await deleteEventChallengeGroup(eventID, group.ID);
            await refresh();
            toast.success(t("manage.exercises.groups.deleted"));
        } catch {toast.error(t("manage.exercises.groups.deleteFailed"));}
        finally {setBusy(false);}
    }

    async function setGroup(board: Board, challenge: EventBoardChallenge, groupID: string) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await setEventChallengeGroup(eventID, board.attachment.ID, challenge, groupID || null);
            await refresh();
            toast.success(t("manage.exercises.groups.challengeMoved"));
        } catch {toast.error(t("manage.exercises.groups.challengeMoveFailed"));}
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
        } catch {toast.error(t("manage.exercises.groups.challengeReorderFailed"));}
        finally {setBusy(false);}
    }

    if (groupsQuery.isPending || attachmentsQuery.isPending || boardsQuery.isPending) return <EventLoading event={event} />;
    if (groupsQuery.isError || attachmentsQuery.isError || boardsQuery.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.exercises.groups.loadFailed")}</h1><button className="ib-btn" onClick={() => {void Promise.all([groupsQuery.refetch(), attachmentsQuery.refetch(), boardsQuery.refetch()]);}}>{t("common.retry")}</button></div>;

    return <div className="event-manage-settings event-challenge-manager">
        <header className="event-manage-heading"><div><h1>{t("manage.exercises.groups.title")}</h1><p>{t("manage.exercises.groups.subtitle")}</p></div></header>
        <BoardDisplaySettings eventID={event.EventID} canManage={canManage} />
        <section className="event-manage-section" aria-labelledby="challenge-groups-title">
            <div className="event-manage-section__head"><h2 id="challenge-groups-title">{t("manage.exercises.groups.groups")}</h2><p>{t("manage.exercises.groups.groupsHelp")}</p></div>
            {groups.length === 0 ? <EmptyState message={t("manage.exercises.groups.empty")} /> : <ol className="event-challenge-manager__list">
                {groups.map((group, index) => <li className="event-challenge-manager__group" key={group.ID}>
                    {editing?.id === group.ID ? <form className="event-challenge-manager__rename" onSubmit={event => {event.preventDefault(); void rename(group);}}>
                        <input className="event-manage-input" aria-label={t("manage.exercises.groups.newName")} maxLength={80} value={editing.name} onChange={event => setEditing({...editing, name: event.target.value})} disabled={busy} autoFocus />
                        <button className="ib-btn ib-btn--sm ib-btn--primary" disabled={busy || !editing.name.trim()}>{t("common.save")}</button>
                        <button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
                    </form> : <div className="event-challenge-manager__group-main"><strong>{group.Name}</strong><span>{taskCount(assigned.get(group.ID) ?? 0)}</span></div>}
                    <div className="event-challenge-manager__actions">
                        <button className="ib-btn ib-btn--sm" type="button" aria-label={t("manage.exercises.groups.moveGroupUp", {name: group.Name})} title={t("manage.exercises.groups.moveUp")} disabled={!canManage || busy || index === 0} onClick={() => void moveGroup(group, -1)}><ArrowUp /></button>
                        <button className="ib-btn ib-btn--sm" type="button" aria-label={t("manage.exercises.groups.moveGroupDown", {name: group.Name})} title={t("manage.exercises.groups.moveDown")} disabled={!canManage || busy || index === groups.length - 1} onClick={() => void moveGroup(group, 1)}><ArrowDown /></button>
                        <button className="ib-btn ib-btn--sm" type="button" disabled={!canManage || busy} onClick={() => setEditing({id: group.ID, name: group.Name})}>{t("manage.exercises.groups.rename")}</button>
                        <button className="ib-btn ib-btn--sm ib-btn--danger" type="button" aria-label={t("manage.exercises.groups.deleteGroupNamed", {name: group.Name})} title={t("manage.exercises.groups.deleteGroup")} disabled={!canManage || busy} onClick={() => void removeGroup(group)}><Trash2 /></button>
                    </div>
                </li>)}
            </ol>}
            {canManage && <form className="event-challenge-manager__create" onSubmit={create}>
                <label className="event-manage-field" htmlFor="new-challenge-group">{t("manage.exercises.groups.newGroup")}<input id="new-challenge-group" className="event-manage-input" value={name} maxLength={80} placeholder={t("manage.exercises.groups.newGroupPlaceholder")} onChange={event => setName(event.target.value)} disabled={busy} /></label>
                <button className="ib-btn ib-btn--primary" disabled={busy || !name.trim()}><Plus />{t("manage.exercises.groups.add")}</button>
            </form>}
        </section>
        <section className="event-manage-section" aria-labelledby="challenge-order-title">
            <div className="event-manage-section__head"><h2 id="challenge-order-title">{t("manage.exercises.groups.board")}</h2><p>{t("manage.exercises.groups.boardHelp")}</p></div>
            {boards.length === 0 ? <EmptyState message={t("manage.exercises.groups.noSets")} /> : boards.map((board, boardIndex) => <div className="event-challenge-manager__board" key={board.attachment.ID}>
                <h3>{board.attachment.ExerciseName || t("manage.exercises.groups.setNumber", {number: boardIndex + 1})} <span>· {taskCount(board.challenges.length)}</span></h3>
                {board.challenges.length === 0 ? <EmptyState compact message={t("manage.exercises.setEmpty")} /> : <ol className="event-challenge-manager__list">
                    {board.challenges.map((challenge, index) => <li className="event-challenge-manager__task" key={challenge.ID}>
                        <div className="event-challenge-manager__task-name"><span className="event-challenge-manager__position">{index + 1}</span><strong>{challenge.Snapshot.name}</strong></div>
                        <EventSelect ariaLabel={t("manage.exercises.groups.challengeGroup", {name: challenge.Snapshot.name})} value={challenge.GroupID ?? "none"} options={[{value: "none", label: t("manage.exercises.groups.none")}, ...groups.map(group => ({value: group.ID, label: group.Name}))]} onValueChange={value => void setGroup(board, challenge, value === "none" ? "" : value)} disabled={!canManage || busy} />
                        <div className="event-challenge-manager__actions">
                            <button className="ib-btn ib-btn--sm" type="button" title={t("manage.exercises.groups.moveUp")} aria-label={t("manage.exercises.groups.moveChallengeUp", {name: challenge.Snapshot.name})} disabled={!canManage || busy || index === 0} onClick={() => void moveChallenge(board, index, -1)}><ArrowUp /></button>
                            <button className="ib-btn ib-btn--sm" type="button" title={t("manage.exercises.groups.moveDown")} aria-label={t("manage.exercises.groups.moveChallengeDown", {name: challenge.Snapshot.name})} disabled={!canManage || busy || index === board.challenges.length - 1} onClick={() => void moveChallenge(board, index, 1)}><ArrowDown /></button>
                        </div>
                    </li>)}
                </ol>}
            </div>)}
        </section>
    </div>;
}
