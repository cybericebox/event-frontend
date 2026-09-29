"use client";

import {useState} from "react";
import {ChevronRight, Lightbulb, LightbulbOff, Pencil} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    updateEventBoardChallenge, updateEventChallengeHintCosts, updateEventChallengeScoring,
    type EventBoardChallenge, type EventExerciseAttachment,
} from "@/api/manageChallenges";
import type {ManageLifecycle, ManageScoring} from "@/api/manage";
import {hintLevelLabel, hintPlainText} from "@/components/event/challenges/hintModel";
import {withTimeDecayFloor} from "@/components/event/manage/scoringFloor";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {attachmentActionError, hintCostChanges, hintCostDraftValid} from "./attachmentModel";
import {descriptionFirstLine} from "./challengeOrder";
import {decayOptions, decayProblem, dynamicErrors, dynamicValid, numberOf, scoringSummary, staticPointsValid, type DynamicProfile, type ScoringMode} from "./scoringModel";
import {hintIndicator, taskBadges, type HintIndicator, type StandReadiness} from "./taskRowModel";

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

// A required whole-number field with the /manage required marker and its
// inline error.
function RequiredNumber({id, title, help, value, min, max, error, disabled, onChange}: {
    id: string; title: string; help: string; value: string; min: number; max?: number; error: string; disabled: boolean; onChange: (value: string) => void;
}) {
    return <div className="event-manage-field event-task__number">
        <ManageFieldLabel htmlFor={id} title={title} help={help} required />
        <input id={id} className="event-manage-input" type="number" inputMode="numeric" min={min} max={max} step={1} required value={Number.isNaN(Number(value)) ? "" : value}
            aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={changeEvent => onChange(changeEvent.target.value)} disabled={disabled} />
        {error && <p className="event-manage-validation" id={`${id}-error`} role="alert">{error}</p>}
    </div>;
}

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
    const errors = draft.kind === "dynamic" ? dynamicErrors(draft.profile) : {max: "", min: "", floor: ""};
    const fieldID = `task-${challenge.ID}`;

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
            {draft.kind === "static" && <RequiredNumber id={`${fieldID}-points`} title={t("manage.challenges.scoring.staticPoints")} help={t("manage.challenges.task.staticPointsHelp")}
                value={draft.points} min={1} error={valid ? "" : t("manage.challenges.scoring.staticInvalid")} disabled={locked} onChange={points => setDraft({...draft, points})} />}
            {draft.kind === "dynamic" && <>
                <div className="event-manage-field event-task__kind">{t("manage.challenges.scoring.decay")}
                    <EventSelect ariaLabel={t("manage.challenges.scoring.decay")} value={String(draft.profile.Mode)} options={decayOptions()} onValueChange={mode => updateProfile({Mode: Number(mode) as ScoringMode})} disabled={locked} /></div>
                <RequiredNumber id={`${fieldID}-max`} title={t("manage.challenges.task.from")} help={t("manage.scoring.maxHelp")} value={String(draft.profile.MaxPoints)} min={1}
                    error={errors.max} disabled={locked} onChange={value => updateProfile({MaxPoints: numberOf(value)})} />
                <RequiredNumber id={`${fieldID}-min`} title={t("manage.challenges.task.to")} help={t("manage.scoring.minHelp")} value={String(draft.profile.MinPoints)} min={0}
                    error={errors.min} disabled={locked} onChange={value => updateProfile({MinPoints: numberOf(value)})} />
                {draft.profile.Mode !== 3 && <RequiredNumber id={`${fieldID}-floor`} title={t("manage.scoring.floor")} help={t("manage.scoring.floorHelp")} value={String(draft.profile.FloorAtPercent)} min={1} max={100}
                    error={errors.floor} disabled={locked} onChange={value => updateProfile({FloorAtPercent: numberOf(value)})} />}
            </>}
        </div>
        {problem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{problem}</p>}
        {changed && !forced && <button className="ib-btn ib-btn--sm ib-btn--primary event-task__save" type="button" disabled={locked || !valid || !!problem} onClick={() => void save()}>{t("common.save")}</button>}
    </section>;
}

// «Підказки»: on/off plus the event's price per hint (the catalog sets only the level).
function TaskHints({eventID, attachmentID, challenge, hintsDisabled, disabled, onSaved}: {
    eventID: string; attachmentID: string; challenge: EventBoardChallenge; hintsDisabled: boolean; disabled: boolean; onSaved: () => Promise<unknown>;
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
            {hintsDisabled && <p className="event-task__note">{t("manage.challenges.task.hintsDisabledByEvent")}</p>}
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

// «Показ»: whether participants see the task.
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
        <h4 id={`task-board-${challenge.ID}`}>{t("manage.challenges.task.displayTitle")}</h4>
        <EventSwitch className="event-manage-form__switch" checked={challenge.Published} onCheckedChange={checked => void toggle(checked)} disabled={disabled || saving} label={t("manage.exercises.challenge.showOnBoard")} />
    </section>;
}

// Lightbulb + count with an explaining tooltip; muted and struck when
// participants do not see the hints.
export function HintMark({hints}: {hints: HintIndicator}) {
    return <EventTooltip content={hints.tooltip}>{id => <span className={`event-task__hints${hints.shown ? "" : " is-hidden"}`} aria-describedby={id}>
        {hints.shown ? <Lightbulb size={14} aria-hidden="true" /> : <LightbulbOff size={14} aria-hidden="true" />}{hints.count}
        <span className="event-manage-visually-hidden">{hints.tooltip}</span>
    </span>}</EventTooltip>;
}

// One task of a set: a thin row (name, first description line, badges) that
// expands into «Оцінювання», «Підказки» and «Показ».
export function TaskRow({eventID, attachment, challenge, scoring, lifecycle, hintsDisabled, infrastructureMissing = false, stand, canManage, editURL, onSaved, onRemove}: {
    eventID: string; attachment: EventExerciseAttachment; challenge: EventBoardChallenge; scoring: ManageScoring; lifecycle: ManageLifecycle;
    hintsDisabled: boolean; infrastructureMissing?: boolean; stand: StandReadiness | null; canManage: boolean; editURL: string | null; onSaved: () => Promise<unknown>; onRemove: () => void;
}) {
    const [open, setOpen] = useState(false);
    const hints = hintIndicator(challenge, hintsDisabled);
    const line = descriptionFirstLine(challenge.Snapshot.description);
    const panelID = `task-panel-${challenge.ID}`;
    return <li className={`event-task${open ? " is-open" : ""}`}>
        <button type="button" className="event-task__row" aria-expanded={open} aria-controls={panelID} onClick={() => setOpen(current => !current)}>
            <ChevronRight className="event-task__chevron" size={16} aria-hidden="true" />
            <span className="event-task__text"><strong>{challenge.Snapshot.name}</strong>{line && <span>{line}</span>}</span>
            <span className="event-task__badges">
                {infrastructureMissing && <span className="ib-tag ib-tag--sm ib-tag--danger">{t("manage.challenges.task.infraMissing")}</span>}
                {hints && <HintMark hints={hints} />}
                {taskBadges(challenge, stand).map(badge => <span key={badge.key} className={`ib-tag ib-tag--sm${badge.tone ? ` ib-tag--${badge.tone}` : ""}`}>{badge.label}</span>)}
            </span>
        </button>
        {open && <div className="event-task__panel" id={panelID}>
            <TaskScoring key={`${challenge.Points}:${JSON.stringify(challenge.ScoringOverride)}`} eventID={eventID} attachmentID={attachment.ID} challenge={challenge} scoring={scoring} lifecycle={lifecycle} disabled={!canManage} onSaved={onSaved} />
            <TaskHints key={challenge.Hints.map(hint => `${hint.ID}:${hint.Cost}`).join("|")} eventID={eventID} attachmentID={attachment.ID} challenge={challenge} hintsDisabled={hintsDisabled} disabled={!canManage} onSaved={onSaved} />
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
