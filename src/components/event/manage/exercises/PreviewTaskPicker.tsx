"use client";

import {useDeferredValue, useEffect, useId, useRef, useState, type KeyboardEvent} from "react";
import {useQuery} from "@tanstack/react-query";
import {getPreviewCatalog, type PreviewCatalogItem} from "@/api/managePreviewSettings";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";

type Chosen = {ExerciseVersionID: string; VariantID: string};

// «Завдання з каталогу»: a search combobox whose dropdown lists the matching tasks as checkbox rows. Tasks that
// cannot be previewed stay in the list, muted, with the reason; the choosable ones come first.
export function PreviewTaskPicker({eventID, selected, onAdd, onRemove, onVariant}: {
    eventID: string; selected: Chosen[];
    onAdd: (item: PreviewCatalogItem, variantPosition: number) => void;
    onRemove: (versionID: string) => void;
    onVariant: (item: PreviewCatalogItem, variantPosition: number) => void;
}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const deferred = useDeferredValue(search.trim());
    const [active, setActive] = useState(-1);
    const box = useRef<HTMLDivElement>(null);
    const catalog = useQuery({queryKey: ["event-preview-catalog", eventID, deferred], queryFn: () => getPreviewCatalog(eventID, deferred), enabled: open, refetchOnWindowFocus: false, placeholderData: previous => previous});
    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {if (!box.current?.contains(event.target as Node)) setOpen(false);};
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);
    const items = catalog.data ?? [];
    const options = [...items.filter(item => item.Eligible), ...items.filter(item => !item.Eligible)];
    const selectable = options.flatMap((item, index) => item.Eligible && item.Variants.length > 0 ? [index] : []);
    const chosenOf = (item: PreviewCatalogItem) => selected.find(x => x.ExerciseVersionID === item.ExerciseVersionID);
    const toggle = (item: PreviewCatalogItem) => chosenOf(item) ? onRemove(item.ExerciseVersionID) : onAdd(item, item.Variants[0].Position);
    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Escape") {if (open) {event.preventDefault(); setOpen(false);} return;}
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {setOpen(true); return;}
            if (selectable.length === 0) return;
            const at = selectable.indexOf(active);
            setActive(selectable[event.key === "ArrowDown" ? (at + 1) % selectable.length : (at <= 0 ? selectable.length - 1 : at - 1)]);
            return;
        }
        if (open && active >= 0 && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            const item = options[active];
            if (item) toggle(item);
        } else if (event.key === "Enter") event.preventDefault();
    }
    return <div ref={box} className="event-preview-picker" onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);}}>
        <label className="event-manage-field" htmlFor={`${id}-search`}><span>{t("manage.previewSettings.catalog")}</span>
            <input id={`${id}-search`} className="event-manage-input" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
                autoComplete="off" maxLength={100} value={search} placeholder={t("manage.previewSettings.search")}
                onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={event => {setSearch(event.target.value); setActive(-1); setOpen(true);}} onKeyDown={onKeyDown} />
        </label>
        {open && <div id={`${id}-list`} role="listbox" aria-multiselectable="true" aria-label={t("manage.previewSettings.catalog")} className="event-preview-picker__list" onMouseDown={event => {if (!(event.target instanceof HTMLSelectElement)) event.preventDefault();}}>
            {catalog.isPending ? <EventLoading compact />
                : catalog.isError ? <EventLoadError compact message={t("manage.previewSettings.catalogFailed")} error={catalog.error} onRetry={() => void catalog.refetch()} />
                : options.length === 0 ? <EmptyState compact message={t("manage.previewSettings.noMatches")} />
                : options.map((item, index) => {
                    const chosen = chosenOf(item);
                    if (!item.Eligible) return <div key={item.ID} role="option" aria-disabled="true" aria-selected="false" className="event-preview-picker__option is-muted">
                        <strong>{item.Name}</strong><span>{t(`manage.previewSettings.reason.${item.Reason}`)}</span>
                    </div>;
                    return <div key={item.ID} id={`${id}-option-${index}`} role="option" aria-selected={!!chosen} className={`event-preview-picker__option${index === active ? " is-active" : ""}`}>
                        <label className="event-exercise-editor__check"><input type="checkbox" tabIndex={-1} checked={!!chosen} disabled={item.Variants.length === 0} onChange={() => toggle(item)} />{item.Name}</label>
                        {chosen && item.Variants.length > 1 && <select className="event-manage-input" aria-label={t("manage.previewSettings.variant", {name: item.Name})} value={item.Variants.find(variant => variant.ID === chosen.VariantID)?.Position ?? item.Variants[0].Position} onChange={event => onVariant(item, Number(event.target.value))}>
                            {item.Variants.map(variant => <option key={variant.ID} value={variant.Position}>{t("manage.previewSettings.variantNumber", {number: variant.Index + 1})}</option>)}
                        </select>}
                    </div>;
                })}
        </div>}
    </div>;
}
