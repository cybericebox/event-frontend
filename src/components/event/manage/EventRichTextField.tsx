"use client";

import {useState} from "react";
import type {ContentValue} from "@/types/eventContent";
import {insertableContentVariable, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {type ContentRichText} from "@/components/event/content/richTextState";
import {EventSelect} from "@/components/ui/EventSelect";
import {FieldLabel} from "./FieldLabel";
import {EventRichTextEditor} from "./EventLexicalEditor";
import {useEventLinkOptions} from "./useEventLinkOptions";

function validLink(value: string) {
    if (!value || /[\\\r\n\t]/.test(value) || value.startsWith("//")) return false;
    if (value.startsWith("/") || value.startsWith("#")) return true;
    try {const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password;} catch {return false;}
}

export function EventRichTextField({eventID, label, value, required = true, error, disabled, catalog, values, dateDisplays, onChange}: {
    eventID: string;
    label: string;
    value: ContentRichText;
    required?: boolean;
    error?: string;
    disabled?: boolean;
    catalog: ContentVariableDefinition[];
    values: Record<string, ContentValue>;
    dateDisplays?: Record<string, {format: "date-time" | "date" | "time" | "short" | "custom"; pattern?: string}>;
    onChange: (value: ContentRichText) => void;
}) {
    const {options, pagesError} = useEventLinkOptions(eventID, values);
    const [insertLink, setInsertLink] = useState<((href: string) => void) | null>(null);
    const [linkPreset, setLinkPreset] = useState("custom");
    const [href, setHref] = useState("");
    const selectedHref = linkPreset === "custom" ? href.trim() : linkPreset;
    return <div className="event-manage-field event-rich-text-field">
        <FieldLabel label={label} required={required} help="Виділіть текст і скористайтеся панеллю форматування.\nЗаголовки, списки, цитати, код і посилання відображаються у попередньому перегляді.\nВставлений Markdown перетворюється на форматований текст.\nЗмінні показують поточні значення події." />
        <div className={error ? "is-invalid" : ""}>
            <EventRichTextEditor value={value} onChange={onChange} variables={catalog.filter(insertableContentVariable)} values={values} dateDisplays={dateDisplays} disabled={disabled} ariaLabel={label}
                onEditLink={insert => {setInsertLink(() => insert); setLinkPreset("custom"); setHref("");}} />
        </div>
        {insertLink && <div className="event-rich-text-field__link">
            <EventSelect ariaLabel="Сторінка для посилання" value={linkPreset} options={[...options, {value: "custom", label: "Своя адреса"}]} onValueChange={setLinkPreset} />
            {linkPreset === "custom" && <input className="event-manage-input" aria-label="Адреса посилання" placeholder="https://… або /rules" value={href} onChange={event => setHref(event.target.value)} onKeyDown={event => {if (event.key === "Enter" && validLink(selectedHref)) {event.preventDefault(); insertLink(selectedHref); setInsertLink(null);}}} />}
            <button type="button" className="ib-btn ib-btn--sm" disabled={!validLink(selectedHref)} onClick={() => {insertLink(selectedHref); setInsertLink(null);}}>Додати</button>
            <button type="button" className="ib-btn ib-btn--sm" onClick={() => setInsertLink(null)}>Скасувати</button>
            {pagesError && <small>Не вдалося завантажити додаткові сторінки. Власну адресу можна ввести вручну.</small>}
        </div>}
        {error && <p className="event-content-editor__field-error" role="alert">{error}</p>}
    </div>;
}
