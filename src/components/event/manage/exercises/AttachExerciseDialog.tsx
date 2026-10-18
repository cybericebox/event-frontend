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
    type InfrastructureFilter, type PublishedExerciseChoice,
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
import {CatalogTagFilter} from "./CatalogTagFilter";
import {ResourceHeavyTag, ResourcesLine} from "./ResourceMarks";

const infrastructureFilters: InfrastructureFilter[] = ["all", "yes", "no"];

const difficulties = new Set(["elementary", "trivial", "easy", "medium", "hard", "insane"]);

function difficultyLabel(value: string): string {
    return difficulties.has(value) ? t(`manage.exercises.difficulty.${value}`) : value;
}

// Catalog picker: own event exercises first, preview per variant, variant mode.
// Without event infrastructure, sets that need it are listed but disabled
// (the filter starts at «Немає»).
export function AttachExerciseDialog({eventID, infrastructureAllowed, published = false, open, onClose, onAttached, selectionAdapter}: {
    eventID: string; infrastructureAllowed: boolean; published?: boolean; open: boolean; onClose: () => void; onAttached: () => Promise<unknown>;
    selectionAdapter?: {variantInfrastructure?: Record<string, Record<number, boolean>>; availableVariants?: Record<string, number[]>; ineligible?: {ID: string; Name: string; Reason: string}[]; attachedVersionIDs: string[]; onSelect: (choice: PublishedExerciseChoice, variant: number) => Promise<unknown>};
}) {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [infrastructure, setInfrastructure] = useState<InfrastructureFilter>(infrastructureAllowed ? "all" : "no");
    const [tags, setTags] = useState<string[]>([]);
    const [attachError, setAttachError] = useState("");
    // 72508: the reservation cannot hold the set for all teams; the organizer can ask for an extension.
    const [needsExtension, setNeedsExtension] = useState(false);
    const [draft, setDraft] = useSessionDraftState<{selected: PublishedExerciseChoice; variant: number; variantMode: 0 | 1} | null>(selectionAdapter ? "preview-exercise-attachment" : "exercise-attachment", null);
    const latestDraft = useRef(draft);
    useLayoutEffect(() => {latestDraft.current = draft;}, [draft]);
    const selected = draft?.selected ?? null;
    const variant = draft?.variant ?? 0;
    const variantMode = draft?.variantMode ?? 0;
    const setVariant = (value: number) => setDraft(current => current && {...current, variant: value});
    const setVariantMode = (value: 0 | 1) => setDraft(current => current && {...current, variantMode: value});
    const [busy, setBusy] = useState(false);
    const eligiblePositions = (choice: PublishedExerciseChoice) => (selectionAdapter?.availableVariants?.[choice.PublishedVersionID] ?? []).filter(position => {
        const dynamic = selectionAdapter?.variantInfrastructure?.[choice.PublishedVersionID]?.[position] ?? (infrastructureAllowed && choice.Infrastructure);
        return infrastructure === "all" || (infrastructure === "yes" ? dynamic : !dynamic);
    });
    const ineligibleReasons = new Map((selectionAdapter?.ineligible ?? []).map(item => [item.ID, item.Reason]));
    const catalog = useQuery({queryKey: ["event-exercise-catalog", eventID, search, infrastructure, tags, selectionAdapter?.attachedVersionIDs, selectionAdapter?.availableVariants, selectionAdapter?.variantInfrastructure, selectionAdapter?.ineligible], queryFn: async () => (await getPublishedExerciseChoices(eventID, search, selectionAdapter?.availableVariants ? "all" : infrastructure, tags)).filter(choice => !selectionAdapter?.availableVariants || eligiblePositions(choice).length > 0 || ineligibleReasons.has(choice.ID)).map(choice => selectionAdapter ? {...choice, Attached: selectionAdapter.attachedVersionIDs.includes(choice.PublishedVersionID)} : choice), enabled: open, refetchOnWindowFocus: false, placeholderData: previous => previous});
    // Preview picker: tasks that cannot be chosen stay listed, muted, after the choosable ones, each with its reason.
    const mutedItems = (() => {
        if (!selectionAdapter?.ineligible || !catalog.data) return [];
        const listed = new Set(catalog.data.map(choice => choice.ID));
        const needle = search.toLowerCase();
        const extra = tags.length > 0 ? [] : selectionAdapter.ineligible.filter(item => !listed.has(item.ID) && item.Name.toLowerCase().includes(needle));
        return [...catalog.data.filter(choice => ineligibleReasons.has(choice.ID)).map(choice => ({ID: choice.ID, Name: choice.Name, Reason: ineligibleReasons.get(choice.ID)!})), ...extra];
    })();
    const selectableItems = catalog.data?.filter(choice => !ineligibleReasons.has(choice.ID)) ?? [];
    const preview = useQuery({
        queryKey: ["event-exercise-preview", eventID, selected?.PublishedVersionID, variant],
        queryFn: () => getPublishedExercisePreview(eventID, selected!.PublishedVersionID, variant),
        enabled: open && !!selected, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const variantCount = preview.data?.ID === selected?.ID ? preview.data?.VariantCount ?? 1 : 1;

    const variantPositions = selectionAdapter?.availableVariants && selected ? eligiblePositions(selected) : Array.from({length: variantCount}, (_, index) => index);
    const variantAvailable = !selectionAdapter?.availableVariants || variantPositions.includes(variant);

    const unavailable = (choice: PublishedExerciseChoice) => selectionAdapter?.availableVariants ? eligiblePositions(choice).length === 0 : choice.Infrastructure && !infrastructureAllowed;

    function select(choice: PublishedExerciseChoice) {
        setAttachError("");
        setNeedsExtension(false);
        setDraft(current => current?.selected.ID === choice.ID ? null : {selected: choice, variant: eligiblePositions(choice)[0] ?? 0, variantMode: 0});
    }

    function close() {
        if (busy) return;
        setDraft(null);
        setAttachError("");
        setNeedsExtension(false);
        onClose();
    }

    async function attach() {
        if (!selected || selected.Attached || unavailable(selected) || !variantAvailable || busy) return;
        const submitted = draft;
        setBusy(true);
        try {
            if (selectionAdapter) await selectionAdapter.onSelect(selected, variant);
            else await attachEventExercise(eventID, selected.PublishedVersionID, variantMode, variantMode === 1 ? variant : null);
            await onAttached();
            toast.success(t("manage.exercises.attachDialog.done"));
            if (latestDraft.current === submitted) {setDraft(null); onClose();}
        } catch (error) {
            // Shown in the dialog: the organizer picks another set.
            setAttachError(attachmentActionError(error, t("manage.exercises.attachDialog.failed")));
            setNeedsExtension(isNotEnoughReserved(error));
        } finally {setBusy(false);}
    }

    return <DialogModal open={open} onClose={close} size="md" title={t("manage.exercises.attach")} description={t("manage.exercises.attachDialog.description")}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={close}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="button" disabled={busy || !selected || selected.Attached || unavailable(selected) || !variantAvailable} onClick={() => void attach()} busy={busy}>{t("common.add")}</EventButton></>}>
        <div className="event-exercise-picker">
            <form className="event-exercise-editor__search" onSubmit={(submitEvent: FormEvent<HTMLFormElement>) => {submitEvent.preventDefault(); setSearch(searchInput.trim());}}>
                <label className="event-manage-field" htmlFor="exercise-search">{t("manage.exercises.attachDialog.search")}<input id="exercise-search" className="event-manage-input" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={t("manage.exercises.attachDialog.searchPlaceholder")} maxLength={100} /></label>
                <button className="ib-btn" type="submit"><Search aria-hidden="true" />{t("manage.exercises.attachDialog.find")}</button>
            </form>
            <CatalogTagFilter eventID={eventID} value={tags} onChange={setTags} enabled={open} />
            <div className="event-exercise-picker__filter" role="group" aria-label={t("manage.exercises.attachDialog.infrastructure")}>
                <span>{t("manage.exercises.attachDialog.infrastructure")}</span>
                <div className="ib-seg ib-seg--sm">{infrastructureFilters.map(option => <button key={option} type="button" aria-pressed={infrastructure === option} onClick={() => setInfrastructure(option)}>{t(`manage.exercises.attachDialog.infrastructureFilter.${option}`)}</button>)}</div>
            </div>
            {!infrastructureAllowed && (infrastructure === "yes" || (infrastructure === "all" && selectableItems.some(choice => choice.Infrastructure))) && <p className="event-exercise-picker__notice" role="status">
                {t(published ? "manage.exercises.attachDialog.noInfrastructure" : "manage.exercises.attachDialog.noInfrastructureWithHint")}
            </p>}
            {catalog.isPending ? <EventLoading compact label={t("manage.exercises.attachDialog.catalogLoading")} />
                : catalog.isError ? <EventLoadError compact message={t("manage.exercises.attachDialog.catalogFailed")} error={catalog.error} onRetry={() => void catalog.refetch()} />
                : selectableItems.length === 0 && mutedItems.length === 0 ? <EmptyState compact message={t("manage.exercises.attachDialog.noResults")} />
                : <ul className="event-exercise-picker__list">{selectableItems.map(choice => <li key={choice.ID}>
                    <button type="button" className={`event-exercise-picker__item${selected?.ID === choice.ID ? " is-selected" : ""}`} aria-pressed={selected?.ID === choice.ID} disabled={choice.Attached || unavailable(choice)} onClick={() => select(choice)}>
                        <span className="event-exercise-picker__name"><strong>{choice.Name}</strong>{choice.Infrastructure && <InfrastructureIcon interactive={false} />}</span>
                        {choice.Description && <span className="event-exercise-picker__desc">{choice.Description}</span>}
                        <span className="event-exercise-picker__tags">
                            {choice.Tags.map(tag => <span key={tag} className="ib-tag ib-tag--sm ib-tag--category">{tag}</span>)}
                            <span className="ib-tag ib-tag--sm">{t(choice.Scope === "event" ? "manage.exercises.scope.own" : "manage.exercises.scope.catalog")}</span>
                            {choice.Attached && <span className="ib-tag ib-tag--sm ib-tag--ok">{t("manage.exercises.attachDialog.attached")}</span>}
                            <ResourceHeavyTag show={choice.ResourceHeavy} />
                        </span>
                        <ResourcesLine resources={choice.Resources} className="event-exercise-picker__resources" />
                        {unavailable(choice) && !choice.Attached && <span className="event-exercise-picker__reason">{t(published ? "manage.exercises.attachDialog.needsInfrastructureAfter" : "manage.exercises.attachDialog.needsInfrastructure")}</span>}
                    </button>
                </li>)}{mutedItems.map(item => <li key={item.ID} className="event-exercise-picker__muted">
                    <strong>{item.Name}</strong>
                    <span className="event-exercise-picker__muted-reason">{t(`manage.previewSettings.reason.${item.Reason}`)}</span>
                </li>)}</ul>}
            {attachError && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{attachError}</p>}
            {needsExtension && <Link className="ib-btn" href="/manage/resources?request=1" onClick={close}>{t("manage.exercises.attachDialog.requestExtension")}</Link>}
            {selected && <div className="event-exercise-editor__preview" aria-live="polite">
                {preview.isPending ? <EventLoading compact /> : preview.isError ? <EventLoadError compact message={t("manage.exercises.attachDialog.previewFailed")} error={preview.error} onRetry={() => void preview.refetch()} /> : <>
                    <div className="event-exercise-editor__preview-head"><h3>{preview.data.Name}</h3>
                        {variantCount > 1 && <EventSelect ariaLabel={t("manage.exercises.attachDialog.previewVariant")} value={String(variant)} options={variantPositions.map(index => ({value: String(index), label: t("manage.exercises.attachDialog.variant", {number: index + 1})}))} onValueChange={value => setVariant(Number(value))} />}
                    </div>
                    <p>{tPlural("manage.exercises.meta.challenges", preview.data.Tasks.length)}{variantCount > 1 ? ` · ${tPlural("manage.exercises.meta.variants", variantCount)}` : ""}</p>
                    <ol>{preview.data.Tasks.map((task, index) => <li key={`${index}-${task.Name}`}><strong>{task.Name}</strong><span>{difficultyLabel(task.Difficulty)}</span>{task.HintCount > 0 && <span>{tPlural("manage.exercises.attachDialog.hints", task.HintCount)}</span>}</li>)}</ol>
                    {variantCount > 1 && !selectionAdapter && <fieldset className="event-exercise-picker__variants">
                        <legend>{t("manage.exercises.attachDialog.variants")}</legend>
                        <label className="event-exercise-editor__check"><input type="radio" name="variant-mode" checked={variantMode === 0} onChange={() => setVariantMode(0)} />{t("manage.exercises.attachDialog.variantPerTeam")}</label>
                        <label className="event-exercise-editor__check"><input type="radio" name="variant-mode" checked={variantMode === 1} onChange={() => setVariantMode(1)} />{t("manage.exercises.attachDialog.variantForAll", {number: variant + 1})}</label>
                    </fieldset>}
                </>}
            </div>}
        </div>
    </DialogModal>;
}
