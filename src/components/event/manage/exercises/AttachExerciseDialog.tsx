"use client";

import {useLayoutEffect, useRef, useState, type FormEvent} from "react";
import {useSessionDraftState} from "../manualDraft";
import Link from "next/link";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery} from "@tanstack/react-query";
import {Search} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    attachEventExercise, getPublishedExerciseChoices, getPublishedExercisePreview,
    type AttachedFilter, type CatalogDifficulty, type InfrastructureFilter, type PublishedExerciseChoice,
} from "@/api/manageChallenges";
import {DialogModal} from "@/components/event/DialogModal";
import {EventSelect} from "@/components/ui/EventSelect";
import {t, tPlural} from "@/i18n/t";
import {attachmentActionError} from "./attachmentModel";
import {isNotEnoughReserved} from "../resources/resourcesModel";
import {InfrastructureIcon} from "./InfrastructureIcon";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventLoading} from "@/components/event/EventLoading";
import {EventButton} from "@/components/ui/EventButton";
import {CatalogTagSelect} from "./CatalogTagSelect";
import {EventMultiSelect} from "@/components/ui/EventMultiSelect";
import {ResourceHeavyTag, ResourcesLine} from "./ResourceMarks";
import {CatalogStatsList} from "./CatalogStats";

const infrastructureFilters: InfrastructureFilter[] = ["all", "yes", "no"];
const attachedFilters: AttachedFilter[] = ["all", "no", "yes"];
// The catalog's levels in order, then sets without a difficulty.
const difficultyFilters: CatalogDifficulty[] = ["elementary", "trivial", "easy", "medium", "hard", "insane", "none"];

const difficulties = new Set(["elementary", "trivial", "easy", "medium", "hard", "insane"]);

function difficultyLabel(value: string): string {
    return difficulties.has(value) ? t(`manage.exercises.difficulty.${value}`) : value;
}

type AttachDraft = {selected: PublishedExerciseChoice[]; variant: number; variantMode: 0 | 1};
type AttachFailure = {id: string; name: string; message: string};
const emptyDraft: AttachDraft = {selected: [], variant: 0, variantMode: 0};

// Catalog picker: own event exercises first, a checkbox on every card. One
// picked set keeps the preview per variant and the variant mode; several are
// attached one request at a time with a variant per team. The selection lives
// outside the list, so it survives search and filter changes.
// Without event infrastructure, sets that need it are listed but disabled
// (the filter starts at «Немає»).
export function AttachExerciseDialog({eventID, infrastructureAllowed, published = false, open, onClose, onAttached}: {
    eventID: string; infrastructureAllowed: boolean; published?: boolean; open: boolean; onClose: () => void; onAttached: () => Promise<unknown>;
}) {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [infrastructure, setInfrastructure] = useState<InfrastructureFilter>(infrastructureAllowed ? "all" : "no");
    const [tags, setTags] = useState<string[]>([]);
    const [levels, setLevels] = useState<CatalogDifficulty[]>([]);
    const [attached, setAttached] = useState<AttachedFilter>("all");
    const defaultInfrastructure: InfrastructureFilter = infrastructureAllowed ? "all" : "no";
    const filtered = search !== "" || tags.length > 0 || levels.length > 0 || attached !== "all" || infrastructure !== defaultInfrastructure;
    // The last run's failures, shown in the dialog with each set's message.
    const [failures, setFailures] = useState<{items: AttachFailure[]; total: number}>({items: [], total: 0});
    // 72508: the reservation cannot hold the set for all teams; the organizer can ask for an extension.
    const [needsExtension, setNeedsExtension] = useState(false);
    const [draft, setDraft] = useSessionDraftState<AttachDraft>("exercise-attachments", emptyDraft);
    const latestDraft = useRef(draft);
    useLayoutEffect(() => {latestDraft.current = draft;}, [draft]);
    const picked = Array.isArray(draft?.selected) ? draft.selected : [];
    const variant = draft?.variant ?? 0;
    const variantMode = draft?.variantMode ?? 0;
    const setVariant = (value: number) => setDraft(current => ({...current, variant: value}));
    const setVariantMode = (value: 0 | 1) => setDraft(current => ({...current, variantMode: value}));
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState({current: 0, total: 0});
    // Filtered on the server: the list stops at 100, so a client-side filter would miss sets past it.
    const catalog = useQuery({
        queryKey: ["event-exercise-catalog", eventID, search, infrastructure, tags, levels, attached],
        queryFn: () => getPublishedExerciseChoices(eventID, {search, infrastructure, tags, difficulties: levels, attached}),
        enabled: open, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const shown = catalog.data?.length ?? 0;
    const matched = catalog.data?.[0]?.MatchedCount ?? shown;
    const available = catalog.data?.[0]?.AvailableCount ?? null;
    const unavailable = (choice: PublishedExerciseChoice) => choice.Infrastructure && !infrastructureAllowed;
    const selectable = (choice: PublishedExerciseChoice) => !choice.Attached && !unavailable(choice);
    // A picked set is read through the latest list, so one that became attached drops out.
    const listed = new Map((catalog.data ?? []).map(choice => [choice.ID, choice]));
    const selection = picked.map(choice => listed.get(choice.ID) ?? choice).filter(selectable);
    const pickedIDs = new Set(selection.map(choice => choice.ID));
    const single = selection.length === 1 ? selection[0] : null;
    const shownSelectable = (catalog.data ?? []).filter(selectable);
    const preview = useQuery({
        queryKey: ["event-exercise-preview", eventID, single?.PublishedVersionID, variant],
        queryFn: () => getPublishedExercisePreview(eventID, single!.PublishedVersionID, variant),
        enabled: open && !!single, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const variantCount = preview.data?.ID === single?.ID ? preview.data?.VariantCount ?? 1 : 1;

    function clearFeedback() {
        setFailures({items: [], total: 0});
        setNeedsExtension(false);
    }

    // Any change of the picked sets starts the variant choice over, as picking another set did.
    function setSelection(update: (current: PublishedExerciseChoice[]) => PublishedExerciseChoice[]) {
        clearFeedback();
        setDraft(current => ({selected: update(Array.isArray(current?.selected) ? current.selected : []), variant: 0, variantMode: 0}));
    }

    function toggle(choice: PublishedExerciseChoice) {
        if (!selectable(choice)) return;
        setSelection(current => current.some(item => item.ID === choice.ID) ? current.filter(item => item.ID !== choice.ID) : [...current, choice]);
    }

    function selectShown() {
        setSelection(current => [...current, ...shownSelectable.filter(choice => !current.some(item => item.ID === choice.ID))]);
    }


    function resetFilters() {
        setSearchInput(""); setSearch(""); setTags([]); setLevels([]); setAttached("all"); setInfrastructure(defaultInfrastructure);
    }

    function close() {
        if (busy) return;
        setDraft(emptyDraft);
        clearFeedback();
        onClose();
    }

    // One request at a time; a failed set does not stop the rest. One picked set
    // keeps its variant choice, several get a variant per team.
    async function attach() {
        const items = selection;
        if (items.length === 0 || busy) return;
        const one = items.length === 1;
        const failed: AttachFailure[] = [];
        const added = new Set<string>();
        let extension = false;
        clearFeedback();
        setBusy(true);
        try {
            for (const [index, item] of items.entries()) {
                setProgress({current: index + 1, total: items.length});
                try {
                    await attachEventExercise(eventID, item.PublishedVersionID, one ? variantMode : 0, one && variantMode === 1 ? variant : null);
                    added.add(item.ID);
                } catch (error) {
                    failed.push({id: item.ID, name: item.Name, message: attachmentActionError(error, t("manage.exercises.attachDialog.failed"))});
                    extension ||= isNotEnoughReserved(error);
                }
            }
            if (added.size > 0) {
                // The sets are attached: a failed refresh must not read as a failed attach.
                await onAttached().catch(() => undefined);
                toast.success(one ? t("manage.exercises.attachDialog.done") : tPlural("manage.exercises.attachDialog.doneMany", added.size));
            }
        } finally {
            setBusy(false);
            setProgress({current: 0, total: 0});
        }
        // Shown in the dialog: the organizer can retry or pick other sets.
        setFailures({items: failed, total: items.length});
        setNeedsExtension(extension);
        const current = latestDraft.current;
        const remaining = (Array.isArray(current?.selected) ? current.selected : []).filter(item => !added.has(item.ID));
        if (failed.length === 0 && remaining.length === 0) {setDraft(emptyDraft); onClose(); return;}
        if (added.size > 0) setDraft({selected: remaining, variant: 0, variantMode: 0});
    }

    const busyLabel = progress.total > 1 ? t("manage.exercises.attachDialog.addingProgress", {current: progress.current, total: progress.total}) : t("common.busy.adding");

    return <DialogModal open={open} onClose={close} size="lg" title={t("manage.exercises.attach")} description={t("manage.exercises.attachDialog.description")}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={close}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="button" disabled={busy || selection.length === 0} onClick={() => void attach()} busy={busy} busyLabel={busyLabel}>{t("common.add")}</EventButton></>}>
        <div className="event-exercise-picker">
            <form className="event-exercise-editor__search" onSubmit={(submitEvent: FormEvent<HTMLFormElement>) => {submitEvent.preventDefault(); setSearch(searchInput.trim());}}>
                <label className="event-manage-field" htmlFor="exercise-search">{t("manage.exercises.attachDialog.search")}<input id="exercise-search" className="event-manage-input" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={t("manage.exercises.attachDialog.searchPlaceholder")} maxLength={100} /></label>
                <button className="ib-btn" type="submit"><Search aria-hidden="true" />{t("manage.exercises.attachDialog.find")}</button>
            </form>
            {/* The filters in one row of selects: several choices for tags and
                difficulty, one for infrastructure and «already added». */}
            <div className="event-exercise-picker__filters">
                <CatalogTagSelect eventID={eventID} value={tags} onChange={setTags} enabled={open} />
                <EventMultiSelect ariaLabel={t("manage.exercises.attachDialog.difficultyFilter.label")} label={t("manage.exercises.attachDialog.difficultyFilter.label")}
                    emptyLabel={t("manage.exercises.attachDialog.difficultyFilter.any")} value={levels} onChange={next => setLevels(difficultyFilters.filter(level => next.includes(level)))}
                    options={difficultyFilters.map(level => ({value: level, label: level === "none" ? t("manage.exercises.attachDialog.difficultyFilter.none") : t(`manage.exercises.difficulty.${level}`)}))} />
                <EventSelect ariaLabel={t("manage.exercises.attachDialog.infrastructure")} value={infrastructure} onValueChange={value => setInfrastructure(value as InfrastructureFilter)}
                    options={infrastructureFilters.map(option => ({value: option, label: t(`manage.exercises.attachDialog.infrastructureChoice.${option}`)}))} />
                <EventSelect ariaLabel={t("manage.exercises.attachDialog.attachedFilter.label")} value={attached} onValueChange={value => setAttached(value as AttachedFilter)}
                    options={attachedFilters.map(option => ({value: option, label: t(`manage.exercises.attachDialog.attachedChoice.${option}`)}))} />
                {filtered && <button className="ib-btn ib-btn--ghost ib-btn--sm" type="button" onClick={resetFilters}>{t("manage.exercises.attachDialog.resetFilters")}</button>}
            </div>
            {!infrastructureAllowed && (infrastructure === "yes" || (infrastructure === "all" && !!catalog.data?.some(choice => choice.Infrastructure))) && <p className="event-exercise-picker__notice" role="status">
                {t(published ? "manage.exercises.attachDialog.noInfrastructure" : "manage.exercises.attachDialog.noInfrastructureWithHint")}
            </p>}
            {catalog.isSuccess && shown > 0 && <p className="event-exercise-picker__count" aria-live="polite">
                {available !== null ? t("manage.exercises.attachDialog.count", {shown, total: available}) : t("manage.exercises.attachDialog.countShown", {shown})}
                {matched > shown && <> · {t("manage.exercises.attachDialog.countLimited", {matched})}</>}
            </p>}
            {catalog.isSuccess && shown > 0 && <div className="event-exercise-picker__selection">
                <span className="event-exercise-picker__selected" aria-live="polite">{t("manage.exercises.attachDialog.selectedCount", {count: selection.length})}</span>
                <button className="ib-btn ib-btn--ghost ib-btn--sm" type="button" disabled={shownSelectable.every(choice => pickedIDs.has(choice.ID))} onClick={selectShown}>{t("manage.exercises.attachDialog.selectShown")}</button>
                {selection.length > 0 && <button className="ib-btn ib-btn--ghost ib-btn--sm" type="button" onClick={() => setSelection(() => [])}>{t("manage.exercises.attachDialog.clearSelection")}</button>}
            </div>}
            {catalog.isPending ? <EventLoading compact label={t("manage.exercises.attachDialog.catalogLoading")} />
                : catalog.isError ? <EventLoadError compact message={t("manage.exercises.attachDialog.catalogFailed")} error={catalog.error} onRetry={() => void catalog.refetch()} />
                : catalog.data.length === 0 ? (filtered
                    ? <EmptyState compact message={t("manage.exercises.attachDialog.noFilterResults")} action={<button className="ib-btn ib-btn--sm" type="button" onClick={resetFilters}>{t("manage.exercises.attachDialog.resetFilters")}</button>} />
                    : <EmptyState compact message={t("manage.exercises.attachDialog.noResults")} />)
                : <ul className="event-exercise-picker__list">{catalog.data.map(choice => <li key={choice.ID}
                    className={`event-exercise-picker__row${pickedIDs.has(choice.ID) ? " is-selected" : ""}${selectable(choice) ? "" : " is-disabled"}`}>
                    {/* The whole card is the checkbox's label: a click anywhere on it, or Space on the box, toggles the set. */}
                    <label className="event-exercise-picker__item">
                        <span className="event-exercise-picker__name"><input type="checkbox" className="event-exercise-picker__check" checked={pickedIDs.has(choice.ID)} disabled={!selectable(choice)}
                            aria-label={t("manage.exercises.attachDialog.select", {name: choice.Name})} aria-describedby={unavailable(choice) && !choice.Attached ? `exercise-reason-${choice.ID}` : undefined}
                            onChange={() => toggle(choice)} /><strong>{choice.Name}</strong>{choice.Infrastructure && <InfrastructureIcon interactive={false} />}</span>
                        {choice.Description && <span className="event-exercise-picker__desc">{choice.Description}</span>}
                        <span className="event-exercise-picker__tags">
                            {choice.Tags.map(tag => <span key={tag} className="ib-tag ib-tag--sm ib-tag--category">{tag}</span>)}
                            <span className="ib-tag ib-tag--sm">{t(choice.Scope === "event" ? "manage.exercises.scope.own" : "manage.exercises.scope.catalog")}</span>
                            {choice.Attached && <span className="ib-tag ib-tag--sm ib-tag--ok">{t("manage.exercises.attachDialog.attached")}</span>}
                            <ResourceHeavyTag show={choice.ResourceHeavy} />
                        </span>
                        <ResourcesLine resources={choice.Resources} className="event-exercise-picker__resources" />
                        {unavailable(choice) && !choice.Attached && <span className="event-exercise-picker__reason" id={`exercise-reason-${choice.ID}`}>{t(published ? "manage.exercises.attachDialog.needsInfrastructureAfter" : "manage.exercises.attachDialog.needsInfrastructure")}</span>}
                    </label>
                    {/* Outside the row's button (no button in a button): the count opens the subtask names. */}
                    <CatalogStatsList average={choice.AvgDifficulty} count={choice.TaskCount} names={choice.TaskNames} className="event-exercise-picker__stats" />
                </li>)}</ul>}
            {failures.items.length > 0 && (failures.total === 1
                ? <p className="event-manage-feedback event-manage-feedback--error" role="alert">{failures.items[0].message}</p>
                : <div className="event-manage-feedback event-manage-feedback--error event-exercise-picker__failures" role="alert">
                    <p>{tPlural("manage.exercises.attachDialog.failedList", failures.items.length, {total: failures.total})}</p>
                    <ul>{failures.items.map(failure => <li key={failure.id}><strong>{failure.name}</strong><span>{failure.message}</span></li>)}</ul>
                </div>)}
            {needsExtension && <Link className="ib-btn" href="/manage/resources?request=1" onClick={close}>{t("manage.exercises.attachDialog.requestExtension")}</Link>}
            {selection.length > 1 && <p className="event-exercise-picker__count">{t("manage.exercises.attachDialog.multiVariants")}</p>}
            {single && <div className="event-exercise-editor__preview" aria-live="polite">
                {preview.isPending ? <EventLoading compact /> : preview.isError ? <EventLoadError compact message={t("manage.exercises.attachDialog.previewFailed")} error={preview.error} onRetry={() => void preview.refetch()} /> : <>
                    <div className="event-exercise-editor__preview-head"><h3>{preview.data.Name}</h3>
                        {variantCount > 1 && <EventSelect ariaLabel={t("manage.exercises.attachDialog.previewVariant")} value={String(variant)} options={Array.from({length: variantCount}, (_, index) => index).map(index => ({value: String(index), label: t("manage.exercises.attachDialog.variant", {number: index + 1})}))} onValueChange={value => setVariant(Number(value))} />}
                    </div>
                    <p>{tPlural("manage.exercises.meta.challenges", preview.data.Tasks.length)}{variantCount > 1 ? ` · ${tPlural("manage.exercises.meta.variants", variantCount)}` : ""}</p>
                    <ol>{preview.data.Tasks.map((task, index) => <li key={`${index}-${task.Name}`}><strong>{task.Name}</strong><span>{difficultyLabel(task.Difficulty)}</span>{task.HintCount > 0 && <span>{tPlural("manage.exercises.attachDialog.hints", task.HintCount)}</span>}</li>)}</ol>
                    {variantCount > 1 && <fieldset className="event-exercise-picker__variants">
                        <legend>{t("manage.exercises.attachDialog.variants")}</legend>
                        <label className="event-exercise-editor__check"><input type="radio" name="variant-mode" checked={variantMode === 0} onChange={() => setVariantMode(0)} />{t("manage.exercises.attachDialog.variantPerTeam")}</label>
                        <label className="event-exercise-editor__check"><input type="radio" name="variant-mode" checked={variantMode === 1} onChange={() => setVariantMode(1)} />{t("manage.exercises.attachDialog.variantForAll", {number: variant + 1})}</label>
                    </fieldset>}
                </>}
            </div>}
        </div>
    </DialogModal>;
}
