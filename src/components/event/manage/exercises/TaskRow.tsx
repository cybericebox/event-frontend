"use client";

import {useState} from "react";
import {ChevronRight, Pencil} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    updateEventBoardChallenge, updateEventChallengeHintCosts, updateEventChallengeScoring,
    type EventBoardChallenge, type EventExerciseAttachment,
} from "@/api/manageChallenges";
import type {ManageLifecycle, ManageScoring} from "@/api/manage";
import {hintLevelLabel, hintPlainText} from "@/components/event/challenges/hintModel";
import {withTimeDecayFloor} from "@/components/event/manage/scoringFloor";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t} from "@/i18n/t";
import {attachmentActionError, hintCostChanges, hintCostDraftValid} from "./attachmentModel";
import {descriptionFirstLine} from "./challengeOrder";
import {decayOptions, decayProblem, dynamicValid, scoringSummary, staticPointsValid, type DynamicProfile, type ScoringMode} from "./scoringModel";
import {taskBadges, type StandReadiness} from "./taskRowModel";

type ScoringKind = "event" | "static" | "dynamic";
type ScoringDraft = {kind: ScoringKind; points: string; profile: DynamicProfile};

function scoringDraftOf(challenge: EventBoardChallenge): ScoringDraft {
    const override = challenge.ScoringOverride;
    const kind: ScoringKind = !override ? "event" : override.Mode === 0 ? "static" : "dynamic";
    const profile: DynamicProfile = override && override.Mode !== 0 ? override : {Mode: 1, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50};
    return {kind, points: String(challenge.Points), profile};
}

// Board fields the per-challenge PUT always sends in full.
const boardFields = (challenge: EventBoardChallenge) => ({Points: challenge.Points, HintsEnabled: challenge.HintsEnabled, Published: challenge.Published});

// «Оцінювання» of one task: as the event, or its own static / dynamic value.
function TaskScoring({eventID, attachmentID, challenge, scoring, lifecycle, disabled, onSaved}: {
    eventID: string; attachmentID: string; challenge: EventBoardChallenge; scoring: ManageScoring; lifecycle: ManageLifecycle;
    disabled: boolean; onSaved: () => Promise<unknown>;
}) {
    const [draft, setDraft] = useState<ScoringDraft>(() => scoringDraftOf(challenge));
    const [saving, setSaving] = useState(false);
    const forced = scoring.ForceEventScoring;
    const original = scoringDraftOf(challenge);
    const changed = draft.kind !== original.kind
        || (draft.kind === "static" && draft.points.trim() !== original.points)
        || (draft.kind === "dynamic" && JSON.stringify(withTimeDecayFloor(draft.profile)) !== JSON.stringify(withTimeDecayFloor(original.profile)));
    const problem = draft.kind === "dynamic" ? decayProblem(draft.profile.Mode, lifecycle) : "";
    const valid = draft.kind === "static" ? staticPointsValid(draft.points, true) : draft.kind === "dynamic" ? dynamicValid(draft.profile) : true;
    const locked = disabled || saving || forced;
    const eventPoints = scoring.StaticPoints ?? challenge.Points;
    const updateProfile = (patch: Partial<DynamicProfile>) => setDraft({...draft, profile: {...draft.profile, ...patch}});

    async function save() {
        if (locked || !changed || !valid || problem) return;
        setSaving(true);
        try {
            if (draft.kind === "event") await updateEventChallengeScoring(eventID, attachmentID, challenge.ID, null);
            if (draft.kind === "static") {
                const points = Number(draft.points);
                if (points !== challenge.Points) await updateEventBoardChallenge(eventID, attachmentID, challenge.ID, {...boardFields(challenge), Points: points});
                await updateEventChallengeScoring(eventID, attachmentID, challenge.ID, {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0});
            }
            if (draft.kind === "dynamic") await updateEventChallengeScoring(eventID, attachmentID, challenge.ID, withTimeDecayFloor(draft.profile));
            await onSaved();
            toast.success(t("manage.challenges.scoring.saved"));
        } catch {toast.error(t("manage.challenges.scoring.saveFailed"));}
        finally {setSaving(false);}
    }

    const kinds = [
        {value: "event", label: t("manage.challenges.task.scoringEvent")},
        {value: "static", label: t("manage.challenges.scoring.static")},
        {value: "dynamic", label: t("manage.challenges.scoring.dynamic")},
    ];
    return <section className="event-task__section" aria-labelledby={`task-scoring-${challenge.ID}`}>
        <h4 id={`task-scoring-${challenge.ID}`}>{t("manage.challenges.scoring.title")}</h4>
        {forced && <p className="event-task__note">{t("manage.challenges.task.scoringForced")}</p>}
        <div className="event-task__fields">
            <div className="event-manage-field event-task__kind">{t("manage.challenges.task.scoringKind")}
                <EventSelect ariaLabel={t("manage.challenges.task.scoringKindFor", {name: challenge.Snapshot.name})} value={draft.kind} options={kinds} onValueChange={kind => setDraft({...draft, kind: kind as ScoringKind})} disabled={locked} /></div>
            {draft.kind === "event" && <p className="event-task__summary">{scoringSummary(scoring, eventPoints)}</p>}
            {draft.kind === "static" && <label className="event-manage-field event-task__number">{t("manage.challenges.scoring.staticPoints")}
                <input className="event-manage-input" type="number" inputMode="numeric" min={1} step={1} value={draft.points} aria-invalid={!valid} onChange={changeEvent => setDraft({...draft, points: changeEvent.target.value})} disabled={locked} /></label>}
            {draft.kind === "dynamic" && <>
                <div className="event-manage-field event-task__kind">{t("manage.challenges.scoring.decay")}
                    <EventSelect ariaLabel={t("manage.challenges.scoring.decay")} value={String(draft.profile.Mode)} options={decayOptions()} onValueChange={mode => updateProfile({Mode: Number(mode) as ScoringMode})} disabled={locked} /></div>
                <label className="event-manage-field event-task__number">{t("manage.challenges.task.from")}<input className="event-manage-input" type="number" min={draft.profile.MinPoints + 1} step={1} value={draft.profile.MaxPoints} onChange={changeEvent => updateProfile({MaxPoints: Number(changeEvent.target.value)})} disabled={locked} /></label>
                <label className="event-manage-field event-task__number">{t("manage.challenges.task.to")}<input className="event-manage-input" type="number" min={1} step={1} value={draft.profile.MinPoints} onChange={changeEvent => updateProfile({MinPoints: Number(changeEvent.target.value)})} disabled={locked} /></label>
                {draft.profile.Mode !== 3 && <label className="event-manage-field event-task__number">{t("manage.scoring.floor")}<input className="event-manage-input" type="number" min={1} max={100} step={1} value={draft.profile.FloorAtPercent} onChange={changeEvent => updateProfile({FloorAtPercent: Number(changeEvent.target.value)})} disabled={locked} /></label>}
            </>}
        </div>
        {problem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{problem}</p>}
        {!valid && !problem && <p className="event-manage-validation" role="alert">{draft.kind === "static" ? t("manage.challenges.scoring.staticInvalid") : t(draft.profile.Mode === 3 ? "manage.scoring.invalidTime" : "manage.scoring.invalid")}</p>}
        {changed && !forced && <button className="ib-btn ib-btn--sm ib-btn--primary event-task__save" type="button" disabled={locked || !valid || !!problem} onClick={() => void save()}>{t("common.save")}</button>}
    </section>;
}

// «Підказки»: on/off plus the event's price per hint (the catalog sets only the level).
function TaskHints({eventID, attachmentID, challenge, disabled, onSaved}: {
    eventID: string; attachmentID: string; challenge: EventBoardChallenge; disabled: boolean; onSaved: () => Promise<unknown>;
}) {
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const changes = hintCostChanges(challenge.Hints, drafts);
    const valid = Object.values(drafts).every(hintCostDraftValid);
    const locked = disabled || saving;

    async function toggle(enabled: boolean) {
        if (locked) return;
        setSaving(true);
        try {
            await updateEventBoardChallenge(eventID, attachmentID, challenge.ID, {...boardFields(challenge), HintsEnabled: enabled});
            await onSaved();
        } catch {toast.error(t("manage.exercises.challenge.saveFailed"));}
        finally {setSaving(false);}
    }

    async function saveCosts() {
        if (locked || !valid || changes.length === 0) return;
        setSaving(true);
        try {
            await updateEventChallengeHintCosts(eventID, attachmentID, challenge.ID, changes);
            await onSaved();
            setDrafts({});
            toast.success(t("manage.exercises.hints.saved"));
        } catch (error) {toast.error(attachmentActionError(error, t("manage.exercises.hints.saveFailed")));}
        finally {setSaving(false);}
    }

    return <section className="event-task__section" aria-labelledby={`task-hints-${challenge.ID}`}>
        <h4 id={`task-hints-${challenge.ID}`}>{t("manage.exercises.hints.title")}</h4>
        {challenge.Hints.length === 0 ? <p className="event-task__note">{t("manage.challenges.task.noHints")}</p> : <>
            <EventSwitch className="event-manage-form__switch" checked={challenge.HintsEnabled} onCheckedChange={checked => void toggle(checked)} disabled={locked} label={t("manage.challenges.task.hintsEnabled")} />
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
                            aria-invalid={!hintCostDraftValid(value)} disabled={locked}
                            onChange={changeEvent => setDrafts(current => ({...current, [hint.ID]: changeEvent.target.value}))} />
                        <span className="event-exercise-hints__unit">{t("manage.exercises.hints.points")}</span>
                    </label>
                </li>;
            })}</ol>
            {!valid && <p className="event-manage-validation" role="alert">{t("manage.exercises.hints.invalid")}</p>}
            {changes.length > 0 && <button className="ib-btn ib-btn--sm ib-btn--primary event-task__save" type="button" disabled={locked || !valid} onClick={() => void saveCosts()}>{t("manage.exercises.hints.save")}</button>}
        </>}
    </section>;
}

// «Дошка»: whether participants see the task.
function TaskBoard({eventID, attachmentID, challenge, disabled, onSaved}: {
    eventID: string; attachmentID: string; challenge: EventBoardChallenge; disabled: boolean; onSaved: () => Promise<unknown>;
}) {
    const [saving, setSaving] = useState(false);
    async function toggle(published: boolean) {
        if (disabled || saving) return;
        setSaving(true);
        try {
            await updateEventBoardChallenge(eventID, attachmentID, challenge.ID, {...boardFields(challenge), Published: published});
            await onSaved();
        } catch {toast.error(t("manage.exercises.challenge.saveFailed"));}
        finally {setSaving(false);}
    }
    return <section className="event-task__section" aria-labelledby={`task-board-${challenge.ID}`}>
        <h4 id={`task-board-${challenge.ID}`}>{t("manage.challenges.board.title")}</h4>
        <EventSwitch className="event-manage-form__switch" checked={challenge.Published} onCheckedChange={checked => void toggle(checked)} disabled={disabled || saving} label={t("manage.exercises.challenge.showOnBoard")} />
    </section>;
}

// One task of a set: a thin row (name, first description line, badges) that
// expands into «Оцінювання», «Підказки» and «Дошка».
export function TaskRow({eventID, attachment, challenge, scoring, lifecycle, stand, canManage, editURL, onSaved, onRemove}: {
    eventID: string; attachment: EventExerciseAttachment; challenge: EventBoardChallenge; scoring: ManageScoring; lifecycle: ManageLifecycle;
    stand: StandReadiness | null; canManage: boolean; editURL: string | null; onSaved: () => Promise<unknown>; onRemove: () => void;
}) {
    const [open, setOpen] = useState(false);
    const line = descriptionFirstLine(challenge.Snapshot.description);
    const panelID = `task-panel-${challenge.ID}`;
    return <li className={`event-task${open ? " is-open" : ""}`}>
        <button type="button" className="event-task__row" aria-expanded={open} aria-controls={panelID} onClick={() => setOpen(current => !current)}>
            <ChevronRight className="event-task__chevron" size={16} aria-hidden="true" />
            <span className="event-task__text"><strong>{challenge.Snapshot.name}</strong>{line && <span>{line}</span>}</span>
            <span className="event-task__badges">{taskBadges(challenge, stand).map(badge => <span key={badge.key} className={`ib-tag ib-tag--sm${badge.tone ? ` ib-tag--${badge.tone}` : ""}`}>{badge.label}</span>)}</span>
        </button>
        {open && <div className="event-task__panel" id={panelID}>
            <TaskScoring key={`${challenge.Points}:${JSON.stringify(challenge.ScoringOverride)}`} eventID={eventID} attachmentID={attachment.ID} challenge={challenge} scoring={scoring} lifecycle={lifecycle} disabled={!canManage} onSaved={onSaved} />
            <TaskHints key={challenge.Hints.map(hint => `${hint.ID}:${hint.Cost}`).join("|")} eventID={eventID} attachmentID={attachment.ID} challenge={challenge} disabled={!canManage} onSaved={onSaved} />
            <TaskBoard eventID={eventID} attachmentID={attachment.ID} challenge={challenge} disabled={!canManage} onSaved={onSaved} />
            {canManage && <div className="event-task__actions">
                {editURL
                    ? <a className="ib-btn ib-btn--sm" href={editURL}><Pencil aria-hidden="true" />{t("common.edit")}</a>
                    : <button className="ib-btn ib-btn--sm" type="button" disabled title={t("manage.challenges.task.editNeedsFork")}><Pencil aria-hidden="true" />{t("common.edit")}</button>}
                <button className="ib-btn ib-btn--sm ib-btn--danger" type="button" onClick={onRemove}>{t("manage.challenges.task.remove")}</button>
            </div>}
        </div>}
    </li>;
}
