"use client";

import {useState, type FormEvent} from "react";
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
import {InfrastructureIcon} from "./InfrastructureIcon";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventLoading} from "@/components/event/EventLoading";
import {EventButton} from "@/components/ui/EventButton";

const infrastructureFilters: InfrastructureFilter[] = ["all", "yes", "no"];

const difficulties = new Set(["trivial", "easy", "medium", "hard", "insane"]);

function difficultyLabel(value: string): string {
    return difficulties.has(value) ? t(`manage.exercises.difficulty.${value}`) : value;
}

// Catalog picker: own event exercises first, preview per variant, variant mode.
export function AttachExerciseDialog({eventID, open, onClose, onAttached}: {
    eventID: string; open: boolean; onClose: () => void; onAttached: () => Promise<unknown>;
}) {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [infrastructure, setInfrastructure] = useState<InfrastructureFilter>("all");
    const [selected, setSelected] = useState<PublishedExerciseChoice | null>(null);
    const [variant, setVariant] = useState(0);
    const [variantMode, setVariantMode] = useState<0 | 1>(0);
    const [busy, setBusy] = useState(false);
    const catalog = useQuery({queryKey: ["event-exercise-catalog", eventID, search, infrastructure], queryFn: () => getPublishedExerciseChoices(eventID, search, infrastructure), enabled: open, refetchOnWindowFocus: false});
    const preview = useQuery({
        queryKey: ["event-exercise-preview", eventID, selected?.PublishedVersionID, variant],
        queryFn: () => getPublishedExercisePreview(eventID, selected!.PublishedVersionID, variant),
        enabled: open && !!selected, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const variantCount = preview.data?.ID === selected?.ID ? preview.data?.VariantCount ?? 1 : 1;

    function select(choice: PublishedExerciseChoice) {
        setSelected(current => current?.ID === choice.ID ? null : choice);
        setVariant(0);
        setVariantMode(0);
    }

    function close() {
        if (busy) return;
        setSelected(null);
        onClose();
    }

    async function attach() {
        if (!selected || selected.Attached || busy) return;
        setBusy(true);
        try {
            await attachEventExercise(eventID, selected.PublishedVersionID, variantMode, variantMode === 1 ? variant : null);
            await onAttached();
            toast.success(t("manage.exercises.attachDialog.done"));
            setSelected(null);
            onClose();
        } catch (error) {
            toast.error(attachmentActionError(error, t("manage.exercises.attachDialog.failed")));
        } finally {setBusy(false);}
    }

    return <DialogModal open={open} onClose={close} size="md" title={t("manage.exercises.attach")} description={t("manage.exercises.attachDialog.description")}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={close}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="button" disabled={busy || !selected || selected.Attached} onClick={() => void attach()} busy={busy}>{t("common.add")}</EventButton></>}>
        <div className="event-exercise-picker">
            <form className="event-exercise-editor__search" onSubmit={(submitEvent: FormEvent<HTMLFormElement>) => {submitEvent.preventDefault(); setSearch(searchInput.trim());}}>
                <label className="event-manage-field" htmlFor="exercise-search">{t("manage.exercises.attachDialog.search")}<input id="exercise-search" className="event-manage-input" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={t("manage.exercises.attachDialog.searchPlaceholder")} maxLength={100} /></label>
                <button className="ib-btn" type="submit"><Search aria-hidden="true" />{t("manage.exercises.attachDialog.find")}</button>
            </form>
            <div className="event-exercise-picker__filter" role="group" aria-label={t("manage.exercises.attachDialog.infrastructure")}>
                <span>{t("manage.exercises.attachDialog.infrastructure")}</span>
                <div className="event-manage-participants__filters">{infrastructureFilters.map(option => <button key={option} className="event-manage-participants__filter" type="button" aria-pressed={infrastructure === option} onClick={() => setInfrastructure(option)}>{t(`manage.exercises.attachDialog.infrastructureFilter.${option}`)}</button>)}</div>
            </div>
            {catalog.isPending ? <EventLoading compact label={t("manage.exercises.attachDialog.catalogLoading")} />
                : catalog.isError ? <div className="event-manage-feedback event-manage-feedback--error" role="alert">{t("manage.exercises.attachDialog.catalogFailed")} <button className="ib-btn ib-btn--sm" type="button" onClick={() => void catalog.refetch()}>{t("common.retry")}</button></div>
                : catalog.data.length === 0 ? <EmptyState compact message={t("manage.exercises.attachDialog.noResults")} />
                : <ul className="event-exercise-picker__list">{catalog.data.map(choice => <li key={choice.ID}>
                    <button type="button" className={`event-exercise-picker__item${selected?.ID === choice.ID ? " is-selected" : ""}`} aria-pressed={selected?.ID === choice.ID} disabled={choice.Attached} onClick={() => select(choice)}>
                        <span className="event-exercise-picker__name"><strong>{choice.Name}</strong>{choice.Infrastructure && <InfrastructureIcon interactive={false} />}</span>
                        {choice.Description && <span className="event-exercise-picker__desc">{choice.Description}</span>}
                        <span className="event-exercise-picker__tags">
                            <span className="ib-tag ib-tag--sm">{t(choice.Scope === "event" ? "manage.exercises.scope.own" : "manage.exercises.scope.catalog")}</span>
                            {choice.Attached && <span className="ib-tag ib-tag--sm ib-tag--ok">{t("manage.exercises.attachDialog.attached")}</span>}
                        </span>
                    </button>
                </li>)}</ul>}
            {selected && <div className="event-exercise-editor__preview" aria-live="polite">
                {preview.isPending ? <EventLoading compact /> : preview.isError ? <p role="alert">{t("manage.exercises.attachDialog.previewFailed")}</p> : <>
                    <div className="event-exercise-editor__preview-head"><h3>{preview.data.Name}</h3>
                        {variantCount > 1 && <EventSelect ariaLabel={t("manage.exercises.attachDialog.previewVariant")} value={String(variant)} options={Array.from({length: variantCount}, (_, index) => ({value: String(index), label: t("manage.exercises.attachDialog.variant", {number: index + 1})}))} onValueChange={value => setVariant(Number(value))} />}
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
