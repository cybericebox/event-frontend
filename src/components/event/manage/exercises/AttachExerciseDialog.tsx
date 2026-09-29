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
import {pluralUk} from "@/components/event/challenges/challengeBoardModel";
import {attachmentActionError} from "./attachmentModel";
import {InfrastructureIcon} from "./InfrastructureIcon";

const infrastructureFilters: {value: InfrastructureFilter; label: string}[] = [
    {value: "all", label: "Усі"}, {value: "yes", label: "Є"}, {value: "no", label: "Немає"},
];

const difficulty: Record<string, string> = {trivial: "дуже легке", easy: "легке", medium: "середнє", hard: "складне", insane: "дуже складне"};

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
            toast.success("Набір додано");
            setSelected(null);
            onClose();
        } catch (error) {
            toast.error(attachmentActionError(error, "Не вдалося додати набір."));
        } finally {setBusy(false);}
    }

    return <DialogModal open={open} onClose={close} size="md" title="Додати набір" description="Опубліковані набори каталогу й завдання, створені в цій події."
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={close}>Скасувати</button>
            <button className="ib-btn ib-btn--primary" type="button" disabled={busy || !selected || selected.Attached} onClick={() => void attach()}>{busy ? "Додаємо…" : "Додати"}</button></>}>
        <div className="event-exercise-picker">
            <form className="event-exercise-editor__search" onSubmit={(submitEvent: FormEvent<HTMLFormElement>) => {submitEvent.preventDefault(); setSearch(searchInput.trim());}}>
                <label className="event-manage-field" htmlFor="exercise-search">Пошук<input id="exercise-search" className="event-manage-input" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Назва або опис" maxLength={100} /></label>
                <button className="ib-btn" type="submit"><Search aria-hidden="true" />Знайти</button>
            </form>
            <div className="event-exercise-picker__filter" role="group" aria-label="Інфраструктура">
                <span>Інфраструктура</span>
                <div className="event-manage-participants__filters">{infrastructureFilters.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" aria-pressed={infrastructure === option.value} onClick={() => setInfrastructure(option.value)}>{option.label}</button>)}</div>
            </div>
            {catalog.isPending ? <p className="event-challenge-manager__empty">Завантажуємо каталог…</p>
                : catalog.isError ? <div className="event-manage-feedback event-manage-feedback--error" role="alert">Не вдалося завантажити каталог. <button className="ib-btn ib-btn--sm" type="button" onClick={() => void catalog.refetch()}>Повторити</button></div>
                : catalog.data.length === 0 ? <p className="event-challenge-manager__empty">За цим запитом наборів немає.</p>
                : <ul className="event-exercise-picker__list">{catalog.data.map(choice => <li key={choice.ID}>
                    <button type="button" className={`event-exercise-picker__item${selected?.ID === choice.ID ? " is-selected" : ""}`} aria-pressed={selected?.ID === choice.ID} disabled={choice.Attached} onClick={() => select(choice)}>
                        <span className="event-exercise-picker__name"><strong>{choice.Name}</strong>{choice.Infrastructure && <InfrastructureIcon interactive={false} />}</span>
                        {choice.Description && <span className="event-exercise-picker__desc">{choice.Description}</span>}
                        <span className="event-exercise-picker__tags">
                            <span className="ib-tag ib-tag--sm">{choice.Scope === "event" ? "Завдання події" : "Каталог"}</span>
                            {choice.Attached && <span className="ib-tag ib-tag--sm ib-tag--ok">Уже додано</span>}
                        </span>
                    </button>
                </li>)}</ul>}
            {selected && <div className="event-exercise-editor__preview" aria-live="polite">
                {preview.isPending ? <p>Завантажуємо…</p> : preview.isError ? <p role="alert">Не вдалося завантажити попередній перегляд.</p> : <>
                    <div className="event-exercise-editor__preview-head"><h3>{preview.data.Name}</h3>
                        {variantCount > 1 && <EventSelect ariaLabel="Варіант для перегляду" value={String(variant)} options={Array.from({length: variantCount}, (_, index) => ({value: String(index), label: `Варіант ${index + 1}`}))} onValueChange={value => setVariant(Number(value))} />}
                    </div>
                    <p>{preview.data.Tasks.length} {pluralUk(preview.data.Tasks.length, "завдання", "завдання", "завдань")}{variantCount > 1 ? ` · ${variantCount} ${pluralUk(variantCount, "варіант", "варіанти", "варіантів")}` : ""}</p>
                    <ol>{preview.data.Tasks.map((task, index) => <li key={`${index}-${task.Name}`}><strong>{task.Name}</strong><span>{difficulty[task.Difficulty] ?? task.Difficulty}</span>{task.HintCount > 0 && <span>{task.HintCount} {pluralUk(task.HintCount, "підказка", "підказки", "підказок")}</span>}</li>)}</ol>
                    {variantCount > 1 && <fieldset className="event-exercise-picker__variants">
                        <legend>Варіанти</legend>
                        <label className="event-exercise-editor__check"><input type="radio" name="variant-mode" checked={variantMode === 0} onChange={() => setVariantMode(0)} />Свій варіант для кожної команди</label>
                        <label className="event-exercise-editor__check"><input type="radio" name="variant-mode" checked={variantMode === 1} onChange={() => setVariantMode(1)} />Для всіх — варіант {variant + 1}</label>
                    </fieldset>}
                </>}
            </div>}
        </div>
    </DialogModal>;
}
