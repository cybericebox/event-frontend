"use client";

import {useEffect, useId, useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {Check, X} from "lucide-react";
import {getPublishedExerciseTags} from "@/api/manageChallenges";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";

const tagLimit = 50;
const sameTag = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

// Tag filter of the catalog picker: a combobox over the tags of the exercises
// this event may attach, selected tags as removable chips. Only tags the API
// returns can be picked. An empty field lists the most used. Suggestions keep
// the previous list while the next prefix loads (no flash).
export function CatalogTagFilter({eventID, value, onChange, enabled}: {
    eventID: string; value: string[]; onChange: (value: string[]) => void; enabled: boolean;
}) {
    const [draft, setDraft] = useState("");
    const [prefix, setPrefix] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const listID = useId();
    const inputID = useId();

    useEffect(() => {
        const id = setTimeout(() => setPrefix(draft.trim()), draft.trim() ? 200 : 0);
        return () => clearTimeout(id);
    }, [draft]);

    const tags = useQuery({
        queryKey: ["event-exercise-catalog-tags", eventID, prefix],
        queryFn: () => getPublishedExerciseTags(eventID, prefix, tagLimit),
        enabled: enabled && open, refetchOnWindowFocus: false, placeholderData: keepPreviousData,
    });
    const options = tags.data ?? [];
    const selected = (tag: string) => value.some(item => sameTag(item, tag));

    function toggle(tag: string) {
        onChange(selected(tag) ? value.filter(item => !sameTag(item, tag)) : [...value, tag]);
    }

    return <div className="event-tag-filter">
        <label className="event-manage-field" htmlFor={inputID}>{t("manage.exercises.attachDialog.tags")}</label>
        <div className="event-tag-filter__field">
            {value.map(tag => <span key={tag} className="ib-tag ib-tag--sm event-tag-filter__chip">
                {tag}
                <button type="button" aria-label={t("manage.exercises.attachDialog.tagsRemove", {tag})} onClick={() => onChange(value.filter(item => item !== tag))}><X aria-hidden="true" size={12} /></button>
            </span>)}
            <input id={inputID} className="event-tag-filter__input" value={draft} role="combobox" aria-autocomplete="list" aria-expanded={open}
                aria-controls={open ? listID : undefined} aria-activedescendant={open && active >= 0 ? `${listID}-${active}` : undefined}
                placeholder={value.length ? "" : t("manage.exercises.attachDialog.tagsPlaceholder")} maxLength={50}
                onChange={event => {setDraft(event.target.value); setOpen(true); setActive(-1);}}
                onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
                onKeyDown={event => {
                    if (event.key === "ArrowDown" && options.length) {event.preventDefault(); setOpen(true); setActive(index => (index + 1) % options.length);}
                    else if (event.key === "ArrowUp" && options.length) {event.preventDefault(); setActive(index => index <= 0 ? options.length - 1 : index - 1);}
                    else if (event.key === "Enter") {event.preventDefault(); if (active >= 0 && options[active]) toggle(options[active].Tag);}
                    else if (event.key === "Escape" && open) {event.stopPropagation(); event.preventDefault(); setOpen(false); setActive(-1);}
                    else if (event.key === "Backspace" && draft === "" && value.length) onChange(value.slice(0, -1));
                }} />
        </div>
        <p className="event-tag-filter__hint">{t("manage.exercises.attachDialog.tagsHint")}</p>
        {open && <div id={listID} role="listbox" aria-multiselectable="true" aria-label={t("manage.exercises.attachDialog.tags")} className="event-tag-filter__menu">
            {tags.isPending ? <EventLoading compact label={t("manage.exercises.attachDialog.tagsLoading")} />
                // The button must not blur the input: that would close the list before the click lands.
                : tags.isError ? <div className="event-tag-filter__state" onPointerDown={event => event.preventDefault()}><EventLoadError compact message={t("manage.exercises.attachDialog.tagsFailed")} error={tags.error} onRetry={() => void tags.refetch()} /></div>
                : options.length === 0 ? <EmptyState compact message={t("manage.exercises.attachDialog.tagsEmpty")} />
                : options.map(({Tag, ExerciseCount}, index) => <div key={Tag} id={`${listID}-${index}`} role="option" aria-selected={selected(Tag)}
                    className={`event-tag-filter__option${active === index ? " is-active" : ""}`}
                    onPointerDown={event => {event.preventDefault(); toggle(Tag);}}>
                    <span className="event-tag-filter__check">{selected(Tag) && <Check aria-hidden="true" size={12} />}</span>
                    <span className="event-tag-filter__name">{Tag}</span>
                    <span className="event-tag-filter__count">{ExerciseCount}</span>
                </div>)}
        </div>}
    </div>;
}
