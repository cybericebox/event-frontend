"use client";

import {useState} from "react";
import {FolderInput, Pencil, Plus, Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    createEventChallengeGroup, deleteEventChallengeGroup, reorderEventChallengeGroups, reorderGroupChallenges,
    setEventChallengeGroup, updateEventChallengeGroup, type EventChallengeGroup,
} from "@/api/manageChallenges";
import {ManageApiError} from "@/api/manage";
import {DialogModal} from "@/components/event/DialogModal";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {t, tPlural} from "@/i18n/t";
import {groupBuckets, orderedGroups, type GroupTask} from "./challengeOrder";
import {ActionMenu} from "./ActionMenu";
import {GroupNameDialog} from "./GroupNameDialog";
import {SortableList} from "./SortableList";
import {useBoardSets} from "./useBoardSets";
import "./challengesManage.css";

const noGroup = "none";

// «Групи й порядок»: groups on the left (ordered), the selected group's tasks
// on the right (ordered inside the group). The participant board uses the same order.
export function ChallengeGroupsManager() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const board = useBoardSets(eventID);
    const [selectedID, setSelectedID] = useState<string | null>(null);
    // «Додати групу» / «Перейменувати групу» dialog.
    const [naming, setNaming] = useState<{group: EventChallengeGroup | null; key: number} | null>(null);
    const [removing, setRemoving] = useState<EventChallengeGroup | null>(null);
    const [removeError, setRemoveError] = useState("");
    const [moving, setMoving] = useState<{task: GroupTask; target: string} | null>(null);
    const [busy, setBusy] = useState(false);
    // Optimistic orders while the server saves them.
    const [groupOrder, setGroupOrder] = useState<string[] | null>(null);
    const [taskOrder, setTaskOrder] = useState<{groupID: string | null; ids: string[]} | null>(null);

    if (board.pending) return <EventLoading event={event} />;
    if (board.failed) return <div className="event-manage-error" role="alert"><h1>{t("manage.exercises.groups.loadFailed")}</h1><button className="ib-btn" type="button" onClick={board.retry}>{t("common.retry")}</button></div>;

    const sorted = orderedGroups(board.groups.data ?? []);
    const groups = groupOrder ? groupOrder.map(id => sorted.find(group => group.ID === id)).filter((group): group is EventChallengeGroup => !!group) : sorted;
    const buckets = groupBuckets(groups, board.sets.data ?? []);
    const bucketOf = (groupID: string | null) => buckets.find(bucket => bucket.groupID === groupID)!;
    const selected = selectedID && groups.some(group => group.ID === selectedID) ? selectedID : selectedID === noGroup ? null : groups[0]?.ID ?? null;
    const selectedGroup = groups.find(group => group.ID === selected) ?? null;
    const selectedName = selectedGroup?.Name ?? t("manage.exercises.groups.none");
    const bucket = bucketOf(selected);
    const tasks = taskOrder && taskOrder.groupID === selected
        ? taskOrder.ids.map(id => bucket.tasks.find(task => task.challenge.ID === id)).filter((task): task is GroupTask => !!task)
        : bucket.tasks;
    const hasSets = (board.sets.data ?? []).length > 0;

    async function run(action: () => Promise<unknown>, success: string | null, failure: string | ((error: unknown) => string)) {
        setBusy(true);
        try {
            await action();
            if (success) toast.success(success);
            return true;
        } catch (error) {
            toast.error(typeof failure === "string" ? failure : failure(error));
            return false;
        } finally {setBusy(false);}
    }

    async function create(name: string) {
        if (!canManage || busy) return;
        const ok = await run(async () => {
            const created = await createEventChallengeGroup(eventID, name, Math.max(-1, ...sorted.map(group => group.Order)) + 1);
            setSelectedID(created.ID);
            await board.refreshGroups();
        }, t("manage.exercises.groups.created"), error => error instanceof ManageApiError && error.status === 409 ? t("manage.exercises.groups.exists") : t("manage.exercises.groups.createFailed"));
        if (ok) setNaming(null);
    }

    async function rename(group: EventChallengeGroup, name: string) {
        if (!canManage || busy) return;
        if (name === group.Name) {setNaming(null); return;}
        const ok = await run(async () => {
            await updateEventChallengeGroup(eventID, group.ID, name, group.Order);
            await board.refreshGroups();
        }, t("manage.exercises.groups.renamed"), error => error instanceof ManageApiError && error.status === 409 ? t("manage.exercises.groups.exists") : t("manage.exercises.groups.renameFailed"));
        if (ok) setNaming(null);
    }

    async function remove() {
        if (!removing || !canManage || busy) return;
        const group = removing;
        setBusy(true);
        setRemoveError("");
        try {
            await deleteEventChallengeGroup(eventID, group.ID);
            await Promise.all([board.refreshGroups(), board.refreshSets()]);
            setRemoving(null);
            toast.success(t("manage.exercises.groups.deleted"));
        } catch {setRemoveError(t("manage.exercises.groups.deleteFailed"));}
        finally {setBusy(false);}
    }

    async function reorderGroups(ids: string[]) {
        if (!canManage || busy) return;
        setGroupOrder(ids);
        await run(async () => {
            try {await reorderEventChallengeGroups(eventID, ids);}
            finally {await board.refreshGroups(); setGroupOrder(null);}
        }, null, t("manage.exercises.groups.reorderFailed"));
    }

    async function reorderTasks(ids: string[]) {
        if (!canManage || busy) return;
        setTaskOrder({groupID: selected, ids});
        await run(async () => {
            try {await reorderGroupChallenges(eventID, selected, ids);}
            finally {await board.refreshSets(); setTaskOrder(null);}
        }, null, t("manage.exercises.groups.challengeReorderFailed"));
    }

    async function move() {
        if (!moving || !canManage || busy) return;
        const {task, target} = moving;
        const ok = await run(async () => {
            await setEventChallengeGroup(eventID, task.attachment.ID, task.challenge, target === noGroup ? null : target);
            await board.refreshSets();
        }, t("manage.exercises.groups.challengeMoved"), t("manage.exercises.groups.challengeMoveFailed"));
        if (ok) setMoving(null);
    }

    const count = (groupID: string | null) => tPlural("manage.exercises.meta.challenges", bucketOf(groupID).tasks.length);
    const moveTargets = [...groups.map(group => ({value: group.ID, label: group.Name})), {value: noGroup, label: t("manage.exercises.groups.none")}]
        .filter(option => option.value !== (moving?.task.challenge.GroupID && groups.some(group => group.ID === moving.task.challenge.GroupID) ? moving.task.challenge.GroupID : noGroup));

    return <div className="event-manage-settings event-challenge-manager">
        <header className="event-manage-heading"><div><h1>{t("manage.exercises.groups.title")}</h1><p>{t("manage.challenges.groups.subtitle")}</p></div></header>
        <div className="event-group-order">
            <section className="event-manage-section event-group-order__groups" aria-labelledby="challenge-groups-title">
                <div className="event-manage-section__head event-group-order__head"><h2 id="challenge-groups-title">{t("manage.exercises.groups.groups")}</h2>
                    {canManage && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={busy} onClick={() => setNaming({group: null, key: Date.now()})}><Plus aria-hidden="true" />{t("manage.exercises.groups.add")}</button>}
                </div>
                {groups.length === 0 ? <EmptyState compact message={t("manage.exercises.groups.empty")} /> : <SortableList listID="groups" ariaLabel={t("manage.exercises.groups.groups")} items={groups}
                    itemID={group => group.ID} itemName={group => group.Name} disabled={!canManage || busy} onReorder={ids => void reorderGroups(ids)}
                    renderItem={group => ({
                        selected: selected === group.ID,
                        onSelect: () => setSelectedID(group.ID),
                        content: <span className="event-group-order__label"><strong>{group.Name}</strong><small>{count(group.ID)}</small></span>,
                        actions: canManage && <ActionMenu label={t("manage.challenges.groups.groupMenu", {name: group.Name})} disabled={busy} items={[
                            {key: "rename", label: t("manage.exercises.groups.rename"), icon: Pencil, onSelect: () => setNaming({group, key: Date.now()})},
                            {key: "delete", label: t("manage.exercises.groups.deleteGroup"), icon: Trash2, danger: true, onSelect: () => {setRemoveError(""); setRemoving(group);}},
                        ]} />,
                    })} />}
                <button type="button" className={`event-group-order__none${selected === null ? " is-selected" : ""}`} aria-pressed={selected === null} onClick={() => setSelectedID(noGroup)}>
                    <span className="event-group-order__label"><strong>{t("manage.exercises.groups.none")}</strong><small>{count(null)}</small></span>
                </button>
            </section>
            <section className="event-manage-section event-group-order__tasks" aria-labelledby="group-tasks-title">
                <div className="event-manage-section__head"><h2 id="group-tasks-title">{selectedName}</h2><p>{t("manage.challenges.groups.tasksHelp")}</p></div>
                {!hasSets ? <EmptyState message={t("manage.exercises.groups.noSets")} />
                    : tasks.length === 0 ? <EmptyState message={t("manage.challenges.groups.groupEmpty")} />
                    : <SortableList listID={`tasks-${selected ?? noGroup}`} ariaLabel={t("manage.challenges.groups.tasksLabel", {name: selectedName})} items={tasks}
                        itemID={task => task.challenge.ID} itemName={task => task.challenge.Snapshot.name} disabled={!canManage || busy} onReorder={ids => void reorderTasks(ids)}
                        renderItem={(task, index) => ({
                            content: <span className="event-group-order__task"><span className="event-group-order__position">{index + 1}</span><strong>{task.challenge.Snapshot.name}</strong><small>{task.attachment.ExerciseName}</small></span>,
                            actions: canManage && <ActionMenu label={t("manage.challenges.groups.taskMenu", {name: task.challenge.Snapshot.name})} disabled={busy} items={[
                                {key: "move", label: t("manage.challenges.groups.moveTo"), icon: FolderInput, onSelect: () => setMoving({task, target: ""})},
                            ]} />,
                        })} />}
            </section>
        </div>
        {naming && <GroupNameDialog key={naming.key} open mode={naming.group ? "rename" : "create"} initialName={naming.group?.Name ?? ""} busy={busy}
            otherNames={sorted.filter(group => group.ID !== naming.group?.ID).map(group => group.Name)}
            onClose={() => setNaming(null)} onSubmit={name => void (naming.group ? rename(naming.group, name) : create(name))} />}
        <ConfirmDialog open={!!removing} onCancel={() => setRemoving(null)} tone="danger" busy={busy} error={removeError} title={t("manage.challenges.groups.deleteTitle")}
            description={removing ? bucketOf(removing.ID).tasks.length > 0 ? tPlural("manage.exercises.groups.deleteConfirmWithTasks", bucketOf(removing.ID).tasks.length, {name: removing.Name}) : t("manage.exercises.groups.deleteConfirm", {name: removing.Name}) : undefined}
            subject={removing?.Name} confirmLabel={t("manage.exercises.groups.deleteGroup")} onConfirm={() => void remove()} />
        <DialogModal open={!!moving} onClose={() => { if (!busy) setMoving(null); }} title={t("manage.challenges.groups.moveTitle")}
            description={moving ? t("manage.challenges.groups.moveDescription", {name: moving.task.challenge.Snapshot.name}) : undefined}
            footer={<><button className="ib-btn" type="button" disabled={busy} onClick={() => setMoving(null)}>{t("common.cancel")}</button>
                <EventButton className="ib-btn ib-btn--primary" type="button" disabled={busy || !moving?.target} busy={busy} onClick={() => void move()}>{t("manage.challenges.groups.moveConfirm")}</EventButton></>}>
            {moving && <div className="event-manage-field">{t("manage.challenges.groups.moveTarget")}
                <EventSelect ariaLabel={t("manage.challenges.groups.moveTarget")} value={moving.target} options={moveTargets} onValueChange={target => setMoving({...moving, target})} disabled={busy} />
            </div>}
        </DialogModal>
    </div>;
}
