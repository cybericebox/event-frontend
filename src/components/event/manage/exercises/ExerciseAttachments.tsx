"use client";

import {useState, useSyncExternalStore} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Pencil} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    detachEventExercise, forkEventExercise, getEventBoardChallenges, getEventExerciseAttachments, revertEventExercise, updateEventBoardChallenge,
    updateEventChallengeHintCosts, updateEventChallengeScoring, updateEventExercise,
    type ChallengeScoringOverride, type EventBoardChallenge, type EventExerciseAttachment,
} from "@/api/manageChallenges";
import {ApiErrorCode} from "@/api/apiErrors";
import {getManageLifecycle, getManageScoring, ManageApiError, type ManageLifecycle} from "@/api/manage";
import {EventLoading} from "@/components/event/EventLoading";
import {DialogModal} from "@/components/event/DialogModal";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventSelect} from "@/components/ui/EventSelect";
import {scoringFloorVisible, withTimeDecayFloor} from "@/components/event/manage/scoringFloor";
import {
    attachmentActionError, attachmentKind, attachmentScopeLabel, attachmentVersionLabel, detachWithConfirm, exercisesAppURL,
    hintCostChanges, hintCostDraftValid, isDetached,
} from "./attachmentModel";
import {InfrastructureIcon} from "./InfrastructureIcon";
import {hintLevelLabel, hintPlainText} from "@/components/event/challenges/hintModel";
import {exercisesOrigin} from "@/utils/origins";
import {t, tPlural} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";

type ChallengeDraft = Pick<EventBoardChallenge, "Points" | "HintsEnabled" | "Published">;
type Board = {attachment: EventExerciseAttachment; challenges: EventBoardChallenge[]};
type Action = {kind: "update" | "fork" | "revert" | "detach"; attachment: EventExerciseAttachment; attempts?: boolean; error?: string};

const scoringModes = () => ["event", "0", "1", "2", "3"].map(value => ({value, label: t(`manage.exercises.scoring.mode.${value}`)}));

const noSubscribe = () => () => {};

// The manage URL the exercises app returns to after editing.
export function useReturnURL(): string {
    return useSyncExternalStore(noSubscribe, () => window.location.href, () => "");
}


function ChallengeScoringEditor({eventID, attachmentID, challenge, lifecycle, canManage, onSaved}: {
    eventID: string; attachmentID: string; challenge: EventBoardChallenge; lifecycle: ManageLifecycle;
    canManage: boolean; onSaved: () => Promise<unknown>;
}) {
    const [draft, setDraft] = useState<ChallengeScoringOverride | null>(challenge.ScoringOverride);
    const [saving, setSaving] = useState(false);
    const changed = JSON.stringify(draft) !== JSON.stringify(challenge.ScoringOverride);
    const dynamic = draft !== null && draft.Mode !== 0;
    const floor = draft !== null && scoringFloorVisible(draft.Mode);
    const modeProblem = draft?.Mode === 1 || draft?.Mode === 2
        ? lifecycle.JoinPolicy !== 0 ? t("manage.exercises.scoring.needsJoinClosed") : ""
        : draft?.Mode === 3 && !lifecycle.FinishAt ? t("manage.exercises.scoring.needsFinish") : "";
    const valid = !dynamic || (Number.isInteger(draft.MinPoints) && draft.MinPoints > 0 && Number.isInteger(draft.MaxPoints) && draft.MaxPoints > draft.MinPoints && (!floor || (Number.isInteger(draft.FloorAtPercent) && draft.FloorAtPercent >= 1 && draft.FloorAtPercent <= 100)));

    function changeMode(value: string) {
        if (value === "event") {setDraft(null); return;}
        const mode = Number(value) as ChallengeScoringOverride["Mode"];
        setDraft({Mode: mode, MinPoints: mode === 0 ? 0 : draft?.MinPoints || 100, MaxPoints: mode === 0 ? 0 : draft?.MaxPoints || 500, FloorAtPercent: mode === 0 ? 0 : mode === 3 ? 100 : draft?.FloorAtPercent || 50});
    }

    async function save() {
        if (!canManage || saving || !changed || !valid || modeProblem) return;
        setSaving(true);
        try {
            await updateEventChallengeScoring(eventID, attachmentID, challenge.ID, draft && withTimeDecayFloor(draft));
            await onSaved();
            toast.success(t("manage.exercises.scoring.saved"));
        } catch {toast.error(t("manage.exercises.scoring.saveFailed"));}
        finally {setSaving(false);}
    }

    return <div className="event-exercise-editor__scoring">
        <div className="event-manage-field"><ManageFieldLabel title={t("manage.exercises.scoring.title")} help={t("manage.exercises.scoring.help")} /><EventSelect ariaLabel={t("manage.exercises.scoring.ariaLabel", {name: challenge.Snapshot.name})} value={draft === null ? "event" : String(draft.Mode)} options={scoringModes()} onValueChange={changeMode} disabled={!canManage || saving} /></div>
        {dynamic && <div className={floor ? "event-manage-fields-three" : "event-manage-fields-two"}>
            <label className="event-manage-field">{t("manage.exercises.scoring.min")}<input className="event-manage-input" type="number" min={1} step={1} value={draft.MinPoints} onChange={event => setDraft({...draft, MinPoints: Number(event.target.value)})} disabled={!canManage || saving} /></label>
            <label className="event-manage-field">{t("manage.exercises.scoring.max")}<input className="event-manage-input" type="number" min={draft.MinPoints + 1} step={1} value={draft.MaxPoints} onChange={event => setDraft({...draft, MaxPoints: Number(event.target.value)})} disabled={!canManage || saving} /></label>
            {floor && <label className="event-manage-field">{t("manage.exercises.scoring.floor")}<input className="event-manage-input" type="number" min={1} max={100} step={1} value={draft.FloorAtPercent} onChange={event => setDraft({...draft, FloorAtPercent: Number(event.target.value)})} disabled={!canManage || saving} /></label>}
        </div>}
        {modeProblem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{modeProblem}</p>}
        {dynamic && !valid && <p className="event-manage-validation" role="alert">{floor ? t("manage.exercises.scoring.invalidWithFloor") : t("manage.exercises.scoring.invalid")}</p>}
        {changed && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || saving || !valid || !!modeProblem} onClick={() => void save()}>{t("manage.exercises.scoring.save")}</button>}
    </div>;
}

// Per-event hint prices: the catalog gives only the level; unset = free (0).
function ChallengeHintCosts({eventID, attachmentID, challenge, canManage, onSaved}: {
    eventID: string; attachmentID: string; challenge: EventBoardChallenge; canManage: boolean; onSaved: () => Promise<unknown>;
}) {
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const changes = hintCostChanges(challenge.Hints, drafts);
    const valid = Object.values(drafts).every(hintCostDraftValid);

    async function save() {
        if (!canManage || saving || !valid || changes.length === 0) return;
        setSaving(true);
        try {
            await updateEventChallengeHintCosts(eventID, attachmentID, challenge.ID, changes);
            await onSaved();
            setDrafts({});
            toast.success(t("manage.exercises.hints.saved"));
        } catch (error) {toast.error(attachmentActionError(error, t("manage.exercises.hints.saveFailed")));}
        finally {setSaving(false);}
    }

    return <div className="event-exercise-hints">
        <span className="event-exercise-hints__title">{t("manage.exercises.hints.title")}</span>
        <ol className="event-exercise-hints__list">{challenge.Hints.map((hint, index) => {
            const value = drafts[hint.ID] ?? String(hint.Cost);
            const text = hintPlainText(hint.Text);
            return <li className="event-exercise-hints__item" key={hint.ID}>
                <span className="event-exercise-hints__name">{t("manage.exercises.unlocks.hintNumber", {number: index + 1})}</span>
                <span className="event-exercise-hints__level">{hintLevelLabel(hint.Level)}</span>
                <span className="event-exercise-hints__text" title={text || undefined}>{text || t("manage.exercises.hints.noText")}</span>
                <label className="event-exercise-hints__cost">
                    <span className="event-manage-visually-hidden">{t("manage.exercises.hints.costLabel", {number: index + 1})}</span>
                    <input className="event-manage-input" type="number" inputMode="numeric" min={0} max={10000} step={1} value={value} placeholder="0"
                        aria-invalid={!hintCostDraftValid(value)} disabled={!canManage || saving}
                        onChange={event => setDrafts(current => ({...current, [hint.ID]: event.target.value}))} />
                    <span className="event-exercise-hints__unit">{t("manage.exercises.hints.points")}</span>
                </label>
            </li>;
        })}</ol>
        {!valid && <p className="event-manage-validation" role="alert">{t("manage.exercises.hints.invalid")}</p>}
        {changes.length > 0 && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || saving || !valid} onClick={() => void save()}>{t("manage.exercises.hints.save")}</button>}
    </div>;
}

function actionCopy(action: Action): {title: string; description: string; confirm: string; danger?: boolean} {
    const {attachment} = action;
    if (action.kind === "update") return {title: t("manage.exercises.action.update.title", {number: attachment.LatestVersionNumber}), description: t("manage.exercises.action.update.description"), confirm: t("manage.exercises.action.update.confirm")};
    if (action.kind === "fork") return {title: t("manage.exercises.action.fork.title"), description: t("manage.exercises.action.fork.description"), confirm: t("manage.exercises.action.fork.confirm")};
    if (action.kind === "revert") return {title: t("manage.exercises.action.revert.title"), description: t("manage.exercises.action.revert.description", {number: attachment.Fork?.SourceVersionNumber ?? ""}), confirm: t("manage.exercises.action.revert.confirm")};
    if (action.attempts) return {title: t("manage.exercises.action.detachAttempts.title"), description: t("manage.exercises.action.detachAttempts.description"), confirm: t("manage.exercises.action.detachAttempts.confirm"), danger: true};
    return {title: t("manage.exercises.action.detach.title"), description: t("manage.exercises.action.detach.description"), confirm: t("manage.exercises.action.detach.confirm"), danger: true};
}

export function ExerciseAttachments() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const returnURL = useReturnURL();
    const [drafts, setDrafts] = useState<Record<string, ChallengeDraft>>({});
    const [busy, setBusy] = useState(false);
    const [action, setAction] = useState<Action | null>(null);
    const attachmentsQuery = useQuery({queryKey: ["event-exercise-attachments", eventID], queryFn: () => getEventExerciseAttachments(eventID), refetchOnWindowFocus: false});
    const scoringQuery = useQuery({queryKey: ["event-management-scoring", eventID], queryFn: () => getManageScoring(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const active = (attachmentsQuery.data ?? []).filter(item => item.Status === 0);
    const detached = (attachmentsQuery.data ?? []).filter(isDetached);
    const boardsQuery = useQuery({
        queryKey: ["event-exercise-boards", eventID, active.map(item => `${item.ID}:${item.Revision}`).join("|")],
        queryFn: async (): Promise<Board[]> => Promise.all(active.map(async attachment => ({
            attachment, challenges: (await getEventBoardChallenges(eventID, attachment.ID)).sort((a, b) => a.Order - b.Order),
        }))),
        enabled: attachmentsQuery.isSuccess, refetchOnWindowFocus: false,
    });
    const boards = boardsQuery.data ?? [];
    const refreshBoards = () => queryClient.invalidateQueries({queryKey: ["event-exercise-boards", eventID]});
    const refreshAll = () => Promise.all([
        queryClient.invalidateQueries({queryKey: ["event-exercise-attachments", eventID]}),
        refreshBoards(),
        queryClient.invalidateQueries({queryKey: ["event-exercise-catalog", eventID]}),
    ]);

    async function saveChallenge(attachmentID: string, challenge: EventBoardChallenge) {
        const draft = drafts[challenge.ID];
        if (!draft || !canManage || busy || !Number.isInteger(draft.Points) || draft.Points < 1) return;
        setBusy(true);
        try {
            await updateEventBoardChallenge(eventID, attachmentID, challenge.ID, draft);
            setDrafts(current => {const next = {...current}; delete next[challenge.ID]; return next;});
            await refreshBoards();
            toast.success(t("manage.exercises.challenge.saved"));
        } catch {toast.error(t("manage.exercises.challenge.saveFailed"));}
        finally {setBusy(false);}
    }

    function updateDraft(challenge: EventBoardChallenge, patch: Partial<ChallengeDraft>) {
        setDrafts(current => ({...current, [challenge.ID]: {...(current[challenge.ID] ?? {Points: challenge.Points, HintsEnabled: challenge.HintsEnabled, Published: challenge.Published}), ...patch}}));
    }

    async function runAction() {
        if (!action || busy) return;
        const {kind, attachment} = action;
        setBusy(true);
        try {
            if (kind === "update") await updateEventExercise(eventID, attachment.ID);
            if (kind === "fork") await forkEventExercise(eventID, attachment.ID);
            if (kind === "revert") await revertEventExercise(eventID, attachment.ID);
            if (kind === "detach") {
                const result = await detachWithConfirm(confirm => detachEventExercise(eventID, attachment.ID, confirm), !!action.attempts);
                if (result === "needs-confirm") {setAction({...action, attempts: true}); return;}
            }
            await refreshAll();
            setAction(null);
            toast.success(t(`manage.exercises.action.${kind}.done`));
        } catch (error) {
            const fallback = t(`manage.exercises.action.${kind}.failed`);
            // 1809 stays in the dialog: the organizer has to read why.
            if (error instanceof ManageApiError && error.code === ApiErrorCode.ExerciseTaskHasAttempts) setAction({...action, error: attachmentActionError(error, fallback)});
            else {setAction(null); toast.error(attachmentActionError(error, fallback));}
        } finally {setBusy(false);}
    }

    if (attachmentsQuery.isPending || boardsQuery.isPending || scoringQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (attachmentsQuery.isError || boardsQuery.isError || scoringQuery.isError || lifecycleQuery.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.exercises.loadFailed")}</h1><button className="ib-btn" onClick={() => {void Promise.all([attachmentsQuery.refetch(), boardsQuery.refetch(), scoringQuery.refetch(), lifecycleQuery.refetch()]);}}>{t("common.retry")}</button></div>;

    const copy = action && actionCopy(action);
    return <>
        {scoringQuery.data.ForceEventScoring && <p className="event-manage-notice">{t("manage.exercises.forcedScoring")}</p>}
        <section className="event-manage-section" aria-label={t("manage.exercises.sets")}>
            {boards.length === 0 && detached.length === 0 && <EmptyState message={t("manage.exercises.empty")} />}
            {boards.map(({attachment, challenges}) => {
                const kind = attachmentKind(attachment);
                const editURL = exercisesAppURL(exercisesOrigin, "detail", {exerciseID: attachment.ExerciseID, eventID, returnURL});
                return <article className="event-exercise-set" key={attachment.ID} aria-labelledby={`set-${attachment.ID}`}>
                    <header className="event-exercise-set__head">
                        <div className="event-exercise-set__title">
                            <h3 id={`set-${attachment.ID}`}>{attachment.ExerciseName || t("manage.exercises.set")}</h3>
                            <span className="ib-tag ib-tag--sm">{attachmentVersionLabel(attachment)}</span>
                            <span className="ib-tag ib-tag--sm">{attachmentScopeLabel(kind)}</span>
                            {attachment.Infrastructure && <InfrastructureIcon />}
                        </div>
                        {canManage && <div className="event-exercise-set__actions">
                            {kind === "catalog" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "fork", attachment})}>{t("manage.exercises.fork")}</button>}
                            {kind !== "catalog" && <a className="ib-btn ib-btn--sm" href={editURL}><Pencil aria-hidden="true" />{t("common.edit")}</a>}
                            {kind === "fork" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "revert", attachment})}>{t("manage.exercises.revert")}</button>}
                            <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "detach", attachment, attempts: attachment.HasAttempts})}>{t("manage.exercises.action.detach.confirm")}</button>
                        </div>}
                        <p className="event-exercise-set__meta">
                            {[
                                tPlural("manage.exercises.meta.challenges", attachment.ChallengeCount),
                                t("manage.exercises.meta.published", {count: attachment.PublishedCount}),
                                attachment.VariantMode === 1 && attachment.FixedVariantIndex !== null ? t("manage.exercises.meta.fixedVariant", {number: attachment.FixedVariantIndex + 1})
                                    : attachment.VariantCount > 1 ? tPlural("manage.exercises.meta.variants", attachment.VariantCount) : "",
                                attachment.Fork ? t("manage.exercises.meta.forkOf", {number: attachment.Fork.SourceVersionNumber}) : "",
                            ].filter(Boolean).join(" · ")}
                        </p>
                    </header>
                    {attachment.UpdateAvailable && <div className="event-exercise-set__notice">
                        <span><strong>{t("manage.exercises.updateAvailable", {number: attachment.LatestVersionNumber})}</strong> {t("manage.exercises.settingsKept")}</span>
                        {canManage && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={busy} onClick={() => setAction({kind: "update", attachment})}>{t("manage.exercises.action.update.confirm")}</button>}
                    </div>}
                    {attachment.Fork?.SourceUpdateAvailable && <div className="event-exercise-set__notice">
                        <span><strong>{t("manage.exercises.sourceUpdateAvailable", {number: attachment.Fork.SourceLatestVersionNumber})}</strong> {t("manage.exercises.copyNotUpdated")}</span>
                    </div>}
                    {challenges.length === 0 ? <EmptyState compact message={t("manage.exercises.setEmpty")} /> : <div className="event-exercise-editor__tasks">
                        {challenges.map(challenge => {
                            const draft = drafts[challenge.ID] ?? {Points: challenge.Points, HintsEnabled: challenge.HintsEnabled, Published: challenge.Published};
                            const changed = draft.Points !== challenge.Points || draft.HintsEnabled !== challenge.HintsEnabled || draft.Published !== challenge.Published;
                            return <div className="event-exercise-editor__task" key={challenge.ID}>
                                <div className="event-exercise-editor__task-head"><strong>{challenge.Snapshot.name}</strong><span>{challenge.Published ? t("manage.exercises.challenge.onBoard") : t("manage.exercises.challenge.hidden")}</span></div>
                                <div className="event-exercise-editor__controls">
                                    <label className="event-manage-field">{t("manage.exercises.challenge.points")}<input className="event-manage-input" type="number" min={1} step={1} value={draft.Points} onChange={event => updateDraft(challenge, {Points: Number(event.target.value)})} disabled={!canManage || busy} /></label>
                                    <EventSwitch className="event-manage-form__switch" checked={draft.HintsEnabled} onCheckedChange={checked => updateDraft(challenge, {HintsEnabled: checked})} disabled={!canManage || busy} label={t("manage.exercises.hints.title")} />
                                    <EventSwitch className="event-manage-form__switch" checked={draft.Published} onCheckedChange={checked => updateDraft(challenge, {Published: checked})} disabled={!canManage || busy} label={t("manage.exercises.challenge.showOnBoard")} />
                                    {changed && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || busy || !Number.isInteger(draft.Points) || draft.Points < 1} onClick={() => void saveChallenge(attachment.ID, challenge)}>{t("common.save")}</button>}
                                </div>
                                {challenge.Hints.length > 0 && <ChallengeHintCosts key={challenge.Hints.map(hint => `${hint.ID}:${hint.Cost}`).join("|")} eventID={eventID} attachmentID={attachment.ID} challenge={challenge} canManage={canManage} onSaved={refreshBoards} />}
                                <ChallengeScoringEditor eventID={eventID} attachmentID={attachment.ID} challenge={challenge} lifecycle={lifecycleQuery.data} canManage={canManage} onSaved={refreshBoards} />
                            </div>;
                        })}
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
            {action?.error ? <p className="event-manage-feedback event-manage-feedback--error" role="alert">{action.error}</p> : <p className="event-exercise-set__dialog-name">{action?.attachment.ExerciseName}</p>}
        </DialogModal>
    </>;
}

