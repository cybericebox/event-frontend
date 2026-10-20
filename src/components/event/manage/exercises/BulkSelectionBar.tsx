"use client";

import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Eye, EyeOff, SlidersHorizontal, Unlink, X} from "lucide-react";
import {
    bulkDetachEventExercises, bulkSetEventExerciseScoring, bulkSetEventExerciseVisibility, getEventBoardChallenges, getEventExerciseAttachments,
    type BulkExerciseResult, type ChallengeScoringOverride,
} from "@/api/manageChallenges";
import type {ManageLifecycle} from "@/api/manage";
import {apiErrorText} from "@/api/apiErrors";
import {DialogModal} from "@/components/event/DialogModal";
import {withTimeDecayFloor} from "@/components/event/manage/scoringFloor";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {t, tPlural} from "@/i18n/t";
import {runBulk, type BulkOutcome} from "./bulkModel";
import type {BoardSet} from "./challengeOrder";
import {MAX_TASK_POINTS, decayOptions, decayProblem, dynamicErrors, dynamicValid, numberOf, type DynamicProfile, type ScoringMode} from "./scoringModel";
import {RequiredNumber} from "./TaskRow";

type Kind = "show" | "hide" | "scoring" | "detach";
type ScoringKind = "event" | "static" | "dynamic";
const boardsKey = (eventID: string) => ["event-exercise-boards", eventID];

// The selection bar of «Завдання»: the count and the bulk actions on the selected sets. Each set follows the single
// action's rules on the server; the bar shows the progress in the busy label, then «Змінено N. Пропущено M.» with the
// reasons. The caches of the changed sets are updated in place (no broad invalidation).
export function BulkSelectionBar({eventID, sets, selected, scoringForced, lifecycle, onClear, onRemoved}: {
    eventID: string; sets: BoardSet[]; selected: string[]; scoringForced: boolean; lifecycle: ManageLifecycle;
    onClear: () => void; onRemoved: (ids: string[]) => void;
}) {
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<{kind: Kind; done: number; total: number} | null>(null);
    const [dialog, setDialog] = useState<"scoring" | "detach" | null>(null);
    const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
    const [kind, setKind] = useState<ScoringKind>("event");
    const [profile, setProfile] = useState<DynamicProfile>({Mode: 1, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50});
    const names = new Map(sets.map(set => [set.attachment.ID, set.attachment.ExerciseName || t("manage.exercises.set")]));
    const chosen = sets.filter(set => selected.includes(set.attachment.ID));
    const attempted = chosen.filter(set => set.attachment.HasAttempts);
    const failed = (error: unknown) => apiErrorText(error, t("manage.exercises.bulk.failed"));

    function patchSets(ids: string[], change: (set: BoardSet) => BoardSet) {
        queryClient.setQueriesData<BoardSet[]>({queryKey: boardsKey(eventID)}, current => current?.map(set => ids.includes(set.attachment.ID) ? change(set) : set));
    }

    async function run(action: Kind, call: (chunk: string[]) => Promise<BulkExerciseResult>, onChunk?: (changed: string[]) => void | Promise<void>) {
        if (busy) return;
        setOutcome(null);
        const result = await runBulk([...selected], call, {onProgress: (done, total) => setBusy({kind: action, done, total}), onChunk: changed => void onChunk?.(changed), failed});
        setBusy(null);
        setOutcome(result);
        return result;
    }

    const visibility = (published: boolean) => void run(published ? "show" : "hide", chunk => bulkSetEventExerciseVisibility(eventID, chunk, published),
        changed => patchSets(changed, set => ({...set, challenges: set.challenges.map(challenge => ({...challenge, Published: published}))})));

    async function applyScoring() {
        const override: ChallengeScoringOverride | null = kind === "event" ? null : kind === "static" ? {Mode: 0, MinPoints: 0, MaxPoints: 0, FloorAtPercent: 0} : withTimeDecayFloor(profile);
        await run("scoring", chunk => bulkSetEventExerciseScoring(eventID, chunk, override), async changed => {
            // The effective points follow the new scoring: re-read only the changed sets' boards.
            for (const id of changed) {
                const challenges = (await getEventBoardChallenges(eventID, id)).sort((a, b) => a.Order - b.Order);
                patchSets([id], set => ({...set, challenges}));
            }
        });
        setDialog(null);
    }

    async function detach() {
        const result = await run("detach", chunk => bulkDetachEventExercises(eventID, chunk, true));
        setDialog(null);
        if (!result || result.changed.length === 0) return;
        // The removed sets leave the list: the fresh attachment list, with the boards already shown for the rest.
        const removed = new Set(result.changed);
        const fresh = await getEventExerciseAttachments(eventID);
        const active = fresh.filter(item => item.Status === 0);
        const shown = (queryClient.getQueriesData<BoardSet[]>({queryKey: boardsKey(eventID)}).find(([, data]) => data)?.[1] ?? []).filter(set => !removed.has(set.attachment.ID));
        queryClient.setQueryData([...boardsKey(eventID), active.map(item => `${item.ID}:${item.Revision}`).join("|")],
            shown.map(set => ({...set, attachment: active.find(item => item.ID === set.attachment.ID) ?? set.attachment})));
        queryClient.setQueryData(["event-exercise-attachments", eventID], fresh);
        onRemoved(result.changed);
    }

    const label = (action: Kind) => busy?.kind === action ? t(`manage.exercises.bulk.busy.${action}`, {done: busy.done, total: busy.total}) : t("common.busy.saving");
    const errors = kind === "dynamic" ? dynamicErrors(profile) : {max: "", min: "", floor: ""};
    const problem = kind === "dynamic" ? decayProblem(profile.Mode, lifecycle) : "";
    const scoringValid = kind !== "dynamic" || (dynamicValid(profile) && !problem);
    const count = selected.length;

    return <div className="event-bulk-bar" role="region" aria-label={t("manage.exercises.bulk.label")}>
        <div className="event-bulk-bar__row">
            <strong className="event-bulk-bar__count">{tPlural("manage.exercises.bulk.selected", count)}</strong>
            <div className="event-bulk-bar__actions">
                <EventButton className="ib-btn ib-btn--sm" type="button" disabled={!!busy} busy={busy?.kind === "show"} busyLabel={label("show")} onClick={() => visibility(true)}><Eye size={14} aria-hidden="true" />{t("manage.exercises.bulk.show")}</EventButton>
                <EventButton className="ib-btn ib-btn--sm" type="button" disabled={!!busy} busy={busy?.kind === "hide"} busyLabel={label("hide")} onClick={() => visibility(false)}><EyeOff size={14} aria-hidden="true" />{t("manage.exercises.bulk.hide")}</EventButton>
                {!scoringForced && <button className="ib-btn ib-btn--sm" type="button" disabled={!!busy} onClick={() => setDialog("scoring")}><SlidersHorizontal size={14} aria-hidden="true" />{t("manage.exercises.bulk.scoring")}</button>}
                <button className="ib-btn ib-btn--sm" type="button" disabled={!!busy} onClick={() => setDialog("detach")}><Unlink size={14} aria-hidden="true" />{t("manage.exercises.bulk.detach")}</button>
                <button className="ib-icon-btn ib-icon-btn--sm" type="button" disabled={!!busy} aria-label={t("manage.exercises.bulk.clear")} onClick={() => {setOutcome(null); onClear();}}><X size={16} aria-hidden="true" /></button>
            </div>
        </div>
        {outcome && <div className="event-bulk-bar__result" role="status">
            <p>{t("manage.exercises.bulk.result", {changed: outcome.changed.length, skipped: outcome.skipped.length})}</p>
            {outcome.skipped.length > 0 && <ul>{outcome.skipped.map(skip => <li key={skip.id}>{t("manage.exercises.bulk.skippedItem", {name: names.get(skip.id) ?? t("manage.exercises.set"), reason: skip.reason})}</li>)}</ul>}
        </div>}
        <ConfirmDialog open={dialog === "detach"} onCancel={() => setDialog(null)} tone="danger" busy={busy?.kind === "detach"} busyLabel={label("detach")}
            title={tPlural("manage.exercises.bulk.detachTitle", count)} confirmLabel={t("manage.exercises.bulk.detachConfirm")} onConfirm={() => void detach()}
            description={t("manage.exercises.bulk.detachBody")}>
            {attempted.length > 0 && <div className="event-bulk-bar__attempted" data-bulk-attempted>
                <strong>{t("manage.exercises.bulk.detachAttempted")}</strong>
                <ul>{attempted.map(set => <li key={set.attachment.ID}>{names.get(set.attachment.ID)}</li>)}</ul>
            </div>}
        </ConfirmDialog>
        <DialogModal open={dialog === "scoring"} onClose={() => {if (!busy) setDialog(null);}} size="md" title={tPlural("manage.exercises.bulk.scoringTitle", count)} description={t("manage.exercises.bulk.scoringBody")}
            footer={<><button className="ib-btn" type="button" disabled={!!busy} onClick={() => setDialog(null)}>{t("common.cancel")}</button>
                <EventButton className="ib-btn ib-btn--primary" type="button" disabled={!scoringValid} busy={busy?.kind === "scoring"} busyLabel={label("scoring")} onClick={() => void applyScoring()}>{t("manage.exercises.bulk.apply")}</EventButton></>}>
            <div className="event-task__fields">
                <div className="event-manage-field event-task__kind">{t("manage.challenges.task.scoringKind")}
                    <EventSelect ariaLabel={t("manage.challenges.task.scoringKind")} value={kind} onValueChange={value => setKind(value as ScoringKind)} disabled={!!busy} options={[
                        {value: "event", label: t("manage.challenges.task.scoringEvent")},
                        {value: "static", label: t("manage.challenges.scoring.static")},
                        {value: "dynamic", label: t("manage.challenges.scoring.dynamic")},
                    ]} /></div>
                {kind === "static" && <p className="event-task__summary">{t("manage.exercises.bulk.staticNote")}</p>}
                {kind === "dynamic" && <>
                    <div className="event-manage-field event-task__kind">{t("manage.challenges.scoring.decay")}
                        <EventSelect ariaLabel={t("manage.challenges.scoring.decay")} value={String(profile.Mode)} options={decayOptions()} disabled={!!busy} onValueChange={mode => setProfile({...profile, Mode: Number(mode) as ScoringMode})} /></div>
                    <RequiredNumber id="bulk-scoring-max" title={t("manage.challenges.task.from")} help={t("manage.scoring.maxHelp")} value={String(profile.MaxPoints)} min={1} max={MAX_TASK_POINTS}
                        error={errors.max} disabled={!!busy} onChange={value => setProfile({...profile, MaxPoints: numberOf(value)})} />
                    <RequiredNumber id="bulk-scoring-min" title={t("manage.challenges.task.to")} help={t("manage.scoring.minHelp")} value={String(profile.MinPoints)} min={0} max={MAX_TASK_POINTS}
                        error={errors.min} disabled={!!busy} onChange={value => setProfile({...profile, MinPoints: numberOf(value)})} />
                    {profile.Mode !== 3 && <RequiredNumber id="bulk-scoring-floor" title={t("manage.scoring.floor")} help={t("manage.scoring.floorHelp")} value={String(profile.FloorAtPercent)} min={1} max={100}
                        error={errors.floor} disabled={!!busy} onChange={value => setProfile({...profile, FloorAtPercent: numberOf(value)})} />}
                </>}
            </div>
            {problem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{problem}</p>}
        </DialogModal>
    </div>;
}
