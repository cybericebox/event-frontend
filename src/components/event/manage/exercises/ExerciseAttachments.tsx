"use client";

import {useState, useSyncExternalStore} from "react";
import {useQuery} from "@tanstack/react-query";
import {ChevronRight, Pencil} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    detachEventExercise, forkEventExercise, removeEventChallenge, revertEventExercise, updateEventExercise,
    type EventBoardChallenge, type EventExerciseAttachment,
} from "@/api/manageChallenges";
import {ApiErrorCode} from "@/api/apiErrors";
import {getManageConfig, getManageLifecycle, getManageScoring, ManageApiError} from "@/api/manage";
import {getManageLabs} from "@/api/manageLabs";
import {EventLoading} from "@/components/event/EventLoading";
import {DialogModal} from "@/components/event/DialogModal";
import {useManager} from "@/components/event/manage/ManagerShell";
import {
    attachmentActionError, attachmentKind, attachmentScopeLabel, attachmentScopeTip, attachmentVersionLabel, detachWithConfirm, exercisesAppURL,
    infrastructureMismatch, isDetached,
} from "./attachmentModel";
import {InfrastructureIcon, TipTag} from "./InfrastructureIcon";
import {HintMark, TaskRow} from "./TaskRow";
import {setOpenByDefault, setSummary, standReadiness} from "./taskRowModel";
import {useSetOpenState} from "./useSetOpenState";
import {useBoardSets} from "./useBoardSets";
import {exercisesOrigin} from "@/utils/origins";
import {t, tPlural} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";

type Action =
    | {kind: "update" | "fork" | "revert" | "detach"; attachment: EventExerciseAttachment; attempts?: boolean; error?: string}
    | {kind: "remove"; attachment: EventExerciseAttachment; challenge: EventBoardChallenge; error?: string};

const noSubscribe = () => () => {};

// The manage URL the exercises app returns to after editing.
export function useReturnURL(): string {
    return useSyncExternalStore(noSubscribe, () => window.location.href, () => "");
}

function actionCopy(action: Action): {title: string; description: string; confirm: string; danger?: boolean} {
    const {attachment} = action;
    if (action.kind === "remove") return {title: t("manage.challenges.task.removeTitle"), description: t("manage.challenges.task.removeDescription"), confirm: t("manage.challenges.task.remove"), danger: true};
    if (action.kind === "update") return {title: t("manage.exercises.action.update.title", {number: attachment.LatestVersionNumber}), description: t("manage.exercises.action.update.description"), confirm: t("manage.exercises.action.update.confirm")};
    if (action.kind === "fork") return {title: t("manage.exercises.action.fork.title"), description: t("manage.exercises.action.fork.description"), confirm: t("manage.exercises.action.fork.confirm")};
    if (action.kind === "revert") return {title: t("manage.exercises.action.revert.title"), description: t("manage.exercises.action.revert.description", {number: attachment.Fork?.SourceVersionNumber ?? ""}), confirm: t("manage.exercises.action.revert.confirm")};
    if (action.attempts) return {title: t("manage.exercises.action.detachAttempts.title"), description: t("manage.exercises.action.detachAttempts.description"), confirm: t("manage.exercises.action.detachAttempts.confirm"), danger: true};
    return {title: t("manage.exercises.action.detach.title"), description: t("manage.exercises.action.detach.description"), confirm: t("manage.exercises.action.detach.confirm"), danger: true};
}

// «Завдання»: the event's sets, each collapsible, with its tasks as thin rows.
export function ExerciseAttachments() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const returnURL = useReturnURL();
    const board = useBoardSets(eventID);
    const [busy, setBusy] = useState(false);
    const [action, setAction] = useState<Action | null>(null);
    const openState = useSetOpenState(eventID);
    const scoringQuery = useQuery({queryKey: ["event-management-scoring", eventID], queryFn: () => getManageScoring(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const sets = board.sets.data ?? [];
    const infrastructure = sets.some(set => set.attachment.Infrastructure);
    // Stand readiness is optional: a failure only hides the stand badges.
    const labsQuery = useQuery({queryKey: ["event-management-labs", eventID], queryFn: () => getManageLabs(eventID), enabled: infrastructure, refetchInterval: 30_000, refetchOnWindowFocus: false, retry: false});
    const detached = (board.attachments.data ?? []).filter(isDetached);

    async function runAction() {
        if (!action || busy) return;
        setBusy(true);
        try {
            if (action.kind === "remove") await removeEventChallenge(eventID, action.attachment.ID, action.challenge.ID);
            if (action.kind === "update") await updateEventExercise(eventID, action.attachment.ID);
            if (action.kind === "fork") await forkEventExercise(eventID, action.attachment.ID);
            if (action.kind === "revert") await revertEventExercise(eventID, action.attachment.ID);
            if (action.kind === "detach") {
                const result = await detachWithConfirm(confirm => detachEventExercise(eventID, action.attachment.ID, confirm), !!action.attempts);
                if (result === "needs-confirm") {setAction({...action, attempts: true}); return;}
            }
            await board.refreshAll();
            setAction(null);
            toast.success(action.kind === "remove" ? t("manage.challenges.task.removed") : t(`manage.exercises.action.${action.kind}.done`));
        } catch (error) {
            const fallback = action.kind === "remove" ? t("manage.challenges.task.removeFailed") : t(`manage.exercises.action.${action.kind}.failed`);
            // Attempts conflicts stay in the dialog: the organizer has to read why.
            if (error instanceof ManageApiError && (error.code === ApiErrorCode.ExerciseTaskHasAttempts || error.code === ApiErrorCode.ChallengeRemoveHasAttempts)) setAction({...action, error: attachmentActionError(error, fallback)});
            else {setAction(null); toast.error(attachmentActionError(error, fallback));}
        } finally {setBusy(false);}
    }

    if (board.pending || scoringQuery.isPending || lifecycleQuery.isPending || configQuery.isPending) return <EventLoading event={event} />;
    if (board.failed || scoringQuery.isError || lifecycleQuery.isError || configQuery.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.exercises.loadFailed")}</h1><button className="ib-btn" type="button" onClick={() => {board.retry(); void scoringQuery.refetch(); void lifecycleQuery.refetch(); void configQuery.refetch();}}>{t("common.retry")}</button></div>;

    const copy = action && actionCopy(action);
    return <>
        {scoringQuery.data.ForceEventScoring && <p className="event-manage-notice">{t("manage.challenges.task.scoringForcedNotice")}</p>}
        <section className="event-manage-section event-sets" aria-label={t("manage.exercises.sets")}>
            {sets.length === 0 && detached.length === 0 && <EmptyState message={t("manage.exercises.empty")} />}
            {sets.map(({attachment, challenges}) => {
                const kind = attachmentKind(attachment);
                const editURL = kind === "catalog" ? null : exercisesAppURL(exercisesOrigin, "detail", {exerciseID: attachment.ExerciseID, eventID, returnURL});
                const fallback = setOpenByDefault(sets.length);
                const open = openState.isOpen(attachment.ID, fallback);
                const toggle = () => openState.toggle(attachment.ID, fallback);
                const name = attachment.ExerciseName || t("manage.exercises.set");
                const stands = challenges.map(challenge => attachment.Infrastructure ? standReadiness(challenge.ID, labsQuery.data) : null);
                const summary = setSummary(challenges, configQuery.data.HintsDisabled, stands);
                const mismatch = infrastructureMismatch(attachment, configQuery.data.InfrastructureAllowed);
                return <article className={`event-exercise-set${open ? " is-open" : ""}`} key={attachment.ID} aria-labelledby={`set-${attachment.ID}`}>
                    {/* The header row toggles the set; its buttons and links keep their own action. */}
                    <header className="event-exercise-set__head" onClick={clickEvent => { if (!(clickEvent.target as HTMLElement).closest("button, a, [role=alert]")) toggle(); }}>
                        <div className="event-exercise-set__title">
                            <h3 id={`set-${attachment.ID}`}>{name}</h3>
                            <TipTag label={attachmentVersionLabel(attachment)} tip={t("manage.challenges.set.versionTip", {number: attachment.VersionNumber})} />
                            <TipTag label={attachmentScopeLabel(kind)} tip={attachmentScopeTip(kind)} />
                            {attachment.Infrastructure && <InfrastructureIcon />}
                        </div>
                        <div className="event-exercise-set__side">
                            <span className="event-task__badges">
                                {mismatch && <span className="ib-tag ib-tag--sm ib-tag--danger">{t("manage.challenges.set.infraMissingBadge")}</span>}
                                {summary.hints && <HintMark hints={summary.hints} />}
                                {summary.ownScoring && <span className="ib-tag ib-tag--sm">{t("manage.challenges.task.ownScoring")}</span>}
                                {summary.stand && <span className={`ib-tag ib-tag--sm ib-tag--${summary.stand === "ready" ? "ok" : "warn"}`}>{t(summary.stand === "ready" ? "manage.challenges.task.standReady" : "manage.challenges.task.standNotReady")}</span>}
                            </span>
                            {canManage && <div className="event-exercise-set__actions">
                                {kind === "catalog" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "fork", attachment})}>{t("manage.exercises.fork")}</button>}
                                {editURL && <a className="ib-btn ib-btn--sm" href={editURL}><Pencil aria-hidden="true" />{t("common.edit")}</a>}
                                {kind === "fork" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "revert", attachment})}>{t("manage.exercises.revert")}</button>}
                                <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "detach", attachment, attempts: attachment.HasAttempts})}>{t("manage.exercises.action.detach.confirm")}</button>
                            </div>}
                            <button type="button" className="ib-icon-btn ib-icon-btn--sm event-exercise-set__toggle" aria-expanded={open} aria-controls={`set-tasks-${attachment.ID}`}
                                aria-label={t(open ? "manage.challenges.set.collapse" : "manage.challenges.set.expand", {name})} onClick={toggle}>
                                <ChevronRight className="event-exercise-set__chevron" size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <p className="event-exercise-set__meta">
                            {[
                                tPlural("manage.exercises.meta.challenges", attachment.ChallengeCount),
                                t("manage.exercises.meta.published", {count: attachment.PublishedCount}),
                                attachment.VariantMode === 1 && attachment.FixedVariantIndex !== null ? t("manage.exercises.meta.fixedVariant", {number: attachment.FixedVariantIndex + 1})
                                    : attachment.VariantCount > 1 ? tPlural("manage.exercises.meta.variants", attachment.VariantCount) : "",
                                attachment.Fork ? t("manage.exercises.meta.forkOf", {number: attachment.Fork.SourceVersionNumber}) : "",
                            ].filter(Boolean).join(" · ")}
                        </p>
                        {mismatch && <div className="event-exercise-set__warning" role="alert">
                            <span><strong>{t("manage.challenges.set.infraMissing")}</strong> {t("manage.challenges.set.infraMissingHow")}</span>
                            {canManage && <button className="ib-btn ib-btn--sm ib-btn--danger" type="button" disabled={busy} onClick={() => setAction({kind: "detach", attachment, attempts: attachment.HasAttempts})}>{t("manage.challenges.task.remove")}</button>}
                        </div>}
                    </header>
                    {open && <div className="event-exercise-set__body" id={`set-tasks-${attachment.ID}`}>
                        {attachment.UpdateAvailable && <div className="event-exercise-set__notice">
                            <span><strong>{t("manage.exercises.updateAvailable", {number: attachment.LatestVersionNumber})}</strong> {t("manage.exercises.settingsKept")}</span>
                            {canManage && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={busy} onClick={() => setAction({kind: "update", attachment})}>{t("manage.exercises.action.update.confirm")}</button>}
                        </div>}
                        {attachment.Fork?.SourceUpdateAvailable && <div className="event-exercise-set__notice">
                            <span><strong>{t("manage.exercises.sourceUpdateAvailable", {number: attachment.Fork.SourceLatestVersionNumber})}</strong> {t("manage.exercises.copyNotUpdated")}</span>
                        </div>}
                        {challenges.length === 0 ? <EmptyState compact message={t("manage.exercises.setEmpty")} /> : <ul className="event-task-list">
                            {challenges.map(challenge => <TaskRow key={challenge.ID} eventID={eventID} attachment={attachment} challenge={challenge}
                                scoring={scoringQuery.data} lifecycle={lifecycleQuery.data} hintsDisabled={configQuery.data.HintsDisabled} infrastructureMissing={mismatch} stand={attachment.Infrastructure ? standReadiness(challenge.ID, labsQuery.data) : null}
                                canManage={canManage} editURL={editURL} onSaved={board.refreshSets} onRemove={() => setAction({kind: "remove", attachment, challenge})} />)}
                        </ul>}
                    </div>}
                </article>;
            })}
            {detached.map(attachment => <article className="event-exercise-set is-detached" key={attachment.ID} aria-label={t("manage.exercises.detachedLabel", {name: attachment.ExerciseName})}>
                <header className="event-exercise-set__head">
                    <div className="event-exercise-set__title"><h3>{attachment.ExerciseName || t("manage.exercises.set")}</h3><span className="ib-tag ib-tag--sm">{t("manage.exercises.detached")}</span></div>
                    <p className="event-exercise-set__meta">{attachment.DetachedAt ? t("manage.exercises.detachedAt", {date: new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium"}).format(new Date(attachment.DetachedAt))}) + " " : ""}{t("manage.exercises.detachedNote")}</p>
                </header>
            </article>)}
        </section>
        <DialogModal open={!!action} onClose={() => { if (!busy) setAction(null); }} title={copy?.title ?? ""} description={copy?.description}
            footer={action?.error ? <button className="ib-btn" type="button" onClick={() => setAction(null)}>{t("common.close")}</button> : <>
                <button className="ib-btn" type="button" disabled={busy} onClick={() => setAction(null)}>{t("common.cancel")}</button>
                <EventButton className={`ib-btn ${copy?.danger ? "ib-btn--danger" : "ib-btn--primary"}`} type="button" disabled={busy} onClick={() => void runAction()} busy={busy}>{copy?.confirm}</EventButton>
            </>}>
            {action?.error ? <p className="event-manage-feedback event-manage-feedback--error" role="alert">{action.error}</p>
                : <p className="event-exercise-set__dialog-name">{action?.kind === "remove" ? action.challenge.Snapshot.name : action?.attachment.ExerciseName}</p>}
        </DialogModal>
    </>;
}
