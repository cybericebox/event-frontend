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
import {pluralUk} from "@/components/event/challenges/challengeBoardModel";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventSelect} from "@/components/ui/EventSelect";
import {scoringFloorVisible, withTimeDecayFloor} from "@/components/event/manage/scoringFloor";
import {
    attachmentActionError, attachmentKind, attachmentScopeLabel, attachmentVersionLabel, detachWithConfirm, exercisesAppURL,
    hintCostChanges, hintCostDraftValid, isDetached,
} from "./attachmentModel";
import {InfrastructureIcon} from "./InfrastructureIcon";
import {exercisesOrigin} from "@/utils/origins";

type ChallengeDraft = Pick<EventBoardChallenge, "Points" | "HintsEnabled" | "Published">;
type Board = {attachment: EventExerciseAttachment; challenges: EventBoardChallenge[]};
type Action = {kind: "update" | "fork" | "revert" | "detach"; attachment: EventExerciseAttachment; attempts?: boolean; error?: string};

const scoringModes = [
    {value: "event", label: "Профіль події"},
    {value: "0", label: "Фіксовані бали"},
    {value: "1", label: "За кількістю розв’язань"},
    {value: "2", label: "За порядком розв’язань"},
    {value: "3", label: "За часом розв’язання"},
];

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
        ? lifecycle.JoinPolicy !== 0 ? "Цей режим потребує завершення приєднання до початку події." : ""
        : draft?.Mode === 3 && !lifecycle.FinishAt ? "Для цього режиму спершу заплануйте завершення події." : "";
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
            toast.success("Нарахування балів збережено");
        } catch {toast.error("Не вдалося зберегти нарахування балів.");}
        finally {setSaving(false);}
    }

    return <div className="event-exercise-editor__scoring">
        <div className="event-manage-field"><ManageFieldLabel title="Нарахування балів" help="Профіль події застосовує загальні налаштування. Локальний профіль діє лише для цього завдання, якщо в профілі події не ввімкнено примусове застосування." /><EventSelect ariaLabel={`Нарахування балів для ${challenge.Snapshot.name}`} value={draft === null ? "event" : String(draft.Mode)} options={scoringModes} onValueChange={changeMode} disabled={!canManage || saving} /></div>
        {dynamic && <div className={floor ? "event-manage-fields-three" : "event-manage-fields-two"}>
            <label className="event-manage-field">Мінімум балів<input className="event-manage-input" type="number" min={1} step={1} value={draft.MinPoints} onChange={event => setDraft({...draft, MinPoints: Number(event.target.value)})} disabled={!canManage || saving} /></label>
            <label className="event-manage-field">Максимум балів<input className="event-manage-input" type="number" min={draft.MinPoints + 1} step={1} value={draft.MaxPoints} onChange={event => setDraft({...draft, MaxPoints: Number(event.target.value)})} disabled={!canManage || saving} /></label>
            {floor && <label className="event-manage-field">Поріг, %<input className="event-manage-input" type="number" min={1} max={100} step={1} value={draft.FloorAtPercent} onChange={event => setDraft({...draft, FloorAtPercent: Number(event.target.value)})} disabled={!canManage || saving} /></label>}
        </div>}
        {modeProblem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{modeProblem}</p>}
        {dynamic && !valid && <p className="event-manage-validation" role="alert">{floor ? "Мінімум має бути понад нуль, максимум більший за мінімум, поріг від 1 до 100%." : "Мінімум має бути понад нуль, максимум більший за мінімум."}</p>}
        {changed && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || saving || !valid || !!modeProblem} onClick={() => void save()}>Зберегти нарахування</button>}
    </div>;
}

// Per-event hint costs: empty = the exercise's default cost.
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
            toast.success("Вартість підказок збережено");
        } catch (error) {toast.error(attachmentActionError(error, "Не вдалося зберегти вартість підказок."));}
        finally {setSaving(false);}
    }

    return <div className="event-exercise-hints">
        <span className="event-exercise-hints__title">Підказки</span>
        <ol className="event-exercise-hints__list">{challenge.Hints.map((hint, index) => {
            const value = drafts[hint.ID] ?? (hint.Overridden ? String(hint.Cost) : "");
            return <li className="event-exercise-hints__item" key={hint.ID}>
                <span className="event-exercise-hints__name">Підказка {index + 1}</span>
                <span className="event-exercise-hints__text" title={hint.Text}>{hint.Text || "Без тексту"}</span>
                <label className="event-exercise-hints__cost">
                    <span className="event-manage-visually-hidden">Вартість підказки {index + 1}</span>
                    <input className="event-manage-input" type="number" inputMode="numeric" min={0} max={10000} step={1} value={value} placeholder={String(hint.DefaultCost)}
                        aria-invalid={!hintCostDraftValid(value)} disabled={!canManage || saving}
                        onChange={event => setDrafts(current => ({...current, [hint.ID]: event.target.value}))} />
                    <span className="event-exercise-hints__unit">{hint.Overridden || value !== "" ? "балів" : "за замовч."}</span>
                </label>
            </li>;
        })}</ol>
        {!valid && <p className="event-manage-validation" role="alert">Вартість — ціле число від 0 до 10000. Порожнє поле — вартість за замовчуванням.</p>}
        {changes.length > 0 && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || saving || !valid} onClick={() => void save()}>Зберегти вартість</button>}
    </div>;
}

function actionCopy(action: Action): {title: string; description: string; confirm: string; danger?: boolean} {
    const {attachment} = action;
    if (action.kind === "update") return {title: `Оновити до версії ${attachment.LatestVersionNumber}?`, description: "Налаштування події збережуться: бали, публікація, порядок, групи, нарахування й вартість підказок.", confirm: "Оновити"};
    if (action.kind === "fork") return {title: "Налаштувати під подію?", description: "Подія отримає власну копію набору, яку можна редагувати. Каталог не зміниться, налаштування події збережуться.", confirm: "Створити копію"};
    if (action.kind === "revert") return {title: "Повернути оригінал?", description: `Набір знову використовуватиме версію ${attachment.Fork?.SourceVersionNumber ?? ""} з каталогу. Налаштування події збережуться.`, confirm: "Повернути"};
    if (action.attempts) return {title: "Команди вже мають спроби", description: "Завдання набору зникнуть з дошки, а бали за них перестануть враховуватися. Спроби залишаться в журналі.", confirm: "Від’єднати все одно", danger: true};
    return {title: "Від’єднати набір?", description: "Завдання набору зникнуть з дошки, їхні налаштування буде видалено.", confirm: "Від’єднати", danger: true};
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
            toast.success("Завдання збережено");
        } catch {toast.error("Не вдалося зберегти завдання.");}
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
            toast.success(kind === "update" ? "Набір оновлено" : kind === "fork" ? "Копію для події створено" : kind === "revert" ? "Оригінал повернуто" : "Набір від’єднано");
        } catch (error) {
            const fallback = kind === "update" ? "Не вдалося оновити набір." : kind === "fork" ? "Не вдалося створити копію." : kind === "revert" ? "Не вдалося повернути оригінал." : "Не вдалося від’єднати набір.";
            // 1809 stays in the dialog: the organizer has to read why.
            if (error instanceof ManageApiError && error.code === ApiErrorCode.ExerciseTaskHasAttempts) setAction({...action, error: attachmentActionError(error, fallback)});
            else {setAction(null); toast.error(attachmentActionError(error, fallback));}
        } finally {setBusy(false);}
    }

    if (attachmentsQuery.isPending || boardsQuery.isPending || scoringQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (attachmentsQuery.isError || boardsQuery.isError || scoringQuery.isError || lifecycleQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити завдання</h1><button className="ib-btn" onClick={() => {void Promise.all([attachmentsQuery.refetch(), boardsQuery.refetch(), scoringQuery.refetch(), lifecycleQuery.refetch()]);}}>Повторити</button></div>;

    const copy = action && actionCopy(action);
    return <>
        {scoringQuery.data.ForceEventScoring && <p className="event-manage-notice">Зараз примусово діє профіль балів події. Локальні налаштування завдань зберігаються, але почнуть діяти після вимкнення цього параметра.</p>}
        <section className="event-manage-section" aria-label="Набори події">
            {boards.length === 0 && detached.length === 0 && <p className="event-challenge-manager__empty">Наборів завдань поки немає.</p>}
            {boards.map(({attachment, challenges}) => {
                const kind = attachmentKind(attachment);
                const editURL = exercisesAppURL(exercisesOrigin, "detail", {exerciseID: attachment.ExerciseID, eventID, returnURL});
                return <article className="event-exercise-set" key={attachment.ID} aria-labelledby={`set-${attachment.ID}`}>
                    <header className="event-exercise-set__head">
                        <div className="event-exercise-set__title">
                            <h3 id={`set-${attachment.ID}`}>{attachment.ExerciseName || "Набір"}</h3>
                            <span className="ib-tag ib-tag--sm">{attachmentVersionLabel(attachment)}</span>
                            <span className="ib-tag ib-tag--sm">{attachmentScopeLabel[kind]}</span>
                            {attachment.Infrastructure && <InfrastructureIcon />}
                        </div>
                        {canManage && <div className="event-exercise-set__actions">
                            {kind === "catalog" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "fork", attachment})}>Налаштувати під подію</button>}
                            {kind !== "catalog" && <a className="ib-btn ib-btn--sm" href={editURL}><Pencil aria-hidden="true" />Редагувати</a>}
                            {kind === "fork" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "revert", attachment})}>Повернути оригінал</button>}
                            <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setAction({kind: "detach", attachment, attempts: attachment.HasAttempts})}>Від’єднати</button>
                        </div>}
                        <p className="event-exercise-set__meta">
                            {attachment.ChallengeCount} {pluralUk(attachment.ChallengeCount, "завдання", "завдання", "завдань")} · {attachment.PublishedCount} на дошці
                            {attachment.VariantMode === 1 && attachment.FixedVariantIndex !== null ? ` · варіант ${attachment.FixedVariantIndex + 1} для всіх` : attachment.VariantCount > 1 ? ` · ${attachment.VariantCount} ${pluralUk(attachment.VariantCount, "варіант", "варіанти", "варіантів")}` : ""}
                            {attachment.Fork && ` · копія версії ${attachment.Fork.SourceVersionNumber} з каталогу`}
                        </p>
                    </header>
                    {attachment.UpdateAvailable && <div className="event-exercise-set__notice">
                        <span><strong>Доступна нова версія {attachment.LatestVersionNumber}</strong> Налаштування події збережуться.</span>
                        {canManage && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={busy} onClick={() => setAction({kind: "update", attachment})}>Оновити</button>}
                    </div>}
                    {attachment.Fork?.SourceUpdateAvailable && <div className="event-exercise-set__notice">
                        <span><strong>У каталозі нова версія {attachment.Fork.SourceLatestVersionNumber}</strong> Копія події її не отримує.</span>
                    </div>}
                    {challenges.length === 0 ? <p className="event-challenge-manager__empty">У цьому наборі немає завдань.</p> : <div className="event-exercise-editor__tasks">
                        {challenges.map(challenge => {
                            const draft = drafts[challenge.ID] ?? {Points: challenge.Points, HintsEnabled: challenge.HintsEnabled, Published: challenge.Published};
                            const changed = draft.Points !== challenge.Points || draft.HintsEnabled !== challenge.HintsEnabled || draft.Published !== challenge.Published;
                            return <div className="event-exercise-editor__task" key={challenge.ID}>
                                <div className="event-exercise-editor__task-head"><strong>{challenge.Snapshot.name}</strong><span>{challenge.Published ? "На дошці" : "Приховано"}</span></div>
                                <div className="event-exercise-editor__controls">
                                    <label className="event-manage-field">Бали<input className="event-manage-input" type="number" min={1} step={1} value={draft.Points} onChange={event => updateDraft(challenge, {Points: Number(event.target.value)})} disabled={!canManage || busy} /></label>
                                    <label className="event-exercise-editor__check"><input type="checkbox" checked={draft.HintsEnabled} onChange={event => updateDraft(challenge, {HintsEnabled: event.target.checked})} disabled={!canManage || busy} /> Підказки</label>
                                    <label className="event-exercise-editor__check"><input type="checkbox" checked={draft.Published} onChange={event => updateDraft(challenge, {Published: event.target.checked})} disabled={!canManage || busy} /> Показувати на дошці</label>
                                    {changed && <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!canManage || busy || !Number.isInteger(draft.Points) || draft.Points < 1} onClick={() => void saveChallenge(attachment.ID, challenge)}>Зберегти</button>}
                                </div>
                                {challenge.Hints.length > 0 && <ChallengeHintCosts key={challenge.Hints.map(hint => `${hint.ID}:${hint.Cost}`).join("|")} eventID={eventID} attachmentID={attachment.ID} challenge={challenge} canManage={canManage} onSaved={refreshBoards} />}
                                <ChallengeScoringEditor eventID={eventID} attachmentID={attachment.ID} challenge={challenge} lifecycle={lifecycleQuery.data} canManage={canManage} onSaved={refreshBoards} />
                            </div>;
                        })}
                    </div>}
                </article>;
            })}
            {detached.map(attachment => <article className="event-exercise-set is-detached" key={attachment.ID} aria-label={`${attachment.ExerciseName} · від’єднано`}>
                <header className="event-exercise-set__head">
                    <div className="event-exercise-set__title"><h3>{attachment.ExerciseName || "Набір"}</h3><span className="ib-tag ib-tag--sm">Від’єднано</span></div>
                    <p className="event-exercise-set__meta">{attachment.DetachedAt ? `Від’єднано ${new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium"}).format(new Date(attachment.DetachedAt))}. ` : ""}Бали за ці завдання не враховуються.</p>
                </header>
            </article>)}
        </section>
        <DialogModal open={!!action} onClose={() => { if (!busy) setAction(null); }} title={copy?.title ?? ""} description={copy?.description}
            footer={action?.error ? <button className="ib-btn" type="button" onClick={() => setAction(null)}>Закрити</button> : <>
                <button className="ib-btn" type="button" disabled={busy} onClick={() => setAction(null)}>Скасувати</button>
                <button className={`ib-btn ${copy?.danger ? "ib-btn--danger" : "ib-btn--primary"}`} type="button" disabled={busy} onClick={() => void runAction()}>{busy ? "Зачекайте…" : copy?.confirm}</button>
            </>}>
            {action?.error ? <p className="event-manage-feedback event-manage-feedback--error" role="alert">{action.error}</p> : <p className="event-exercise-set__dialog-name">{action?.attachment.ExerciseName}</p>}
        </DialogModal>
    </>;
}

