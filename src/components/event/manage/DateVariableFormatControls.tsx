import type {ContentBlock, ContentValue} from "@/types/eventContent";
import {richTextVariableNames, type ContentRichText} from "../content/richTextState";
import type {ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {dateDisplayOptions, formatDateTime, validDatePattern} from "@/components/event/content/dateDisplay";
import {EventSelect} from "@/components/ui/EventSelect";
import {FieldLabel} from "./FieldLabel";
import {t} from "@/i18n/t";

export function DateVariableFormatControls({field, value, block, catalog, values, disabled, onUpdate}: {
    field: string;
    value: string | ContentRichText;
    block: ContentBlock;
    catalog: ContentVariableDefinition[];
    values: Record<string, ContentValue>;
    disabled: boolean;
    onUpdate: (block: ContentBlock) => void;
}) {
    const names = (typeof value === "string" ? [...new Set([...value.matchAll(/\{\{([a-z][a-zA-Z0-9.]*)\}\}/g)].map(match => match[1]))] : [...richTextVariableNames(value)])
        .filter(name => catalog.some(variable => variable.name === name && variable.format === "date-time"));
    if (!names.length) return null;
    function setDisplay(name: string, update: {format?: "date-time" | "date" | "time" | "short" | "custom"; pattern?: string}) {
        const current = block.dateDisplays?.[field]?.[name] ?? {format: "date-time" as const};
        onUpdate({...block, dateDisplays: {
            ...block.dateDisplays,
            [field]: {...block.dateDisplays?.[field], [name]: {...current, ...update}},
        }});
    }
    return <div className="event-content-editor__date-displays">{names.map(name => {
        const display = block.dateDisplays?.[field]?.[name];
        const format = display?.format ?? "date-time";
        const date = values[name];
        const preview = typeof date === "string" && !Number.isNaN(Date.parse(date)) && (format !== "custom" || validDatePattern(display?.pattern ?? ""))
            ? formatDateTime(date, format, display?.pattern) : "";
        const invalid = format === "custom" && !validDatePattern(display?.pattern ?? "");
        const label = catalog.find(variable => variable.name === name)?.label ?? name;
        return <div className="event-content-editor__date-display" key={name}>
            <div className="event-manage-field"><FieldLabel label={t("manage.editor.dateFormat.label", {label})} help={t("manage.editor.dateFormat.help")} /><EventSelect ariaLabel={t("manage.editor.dateFormat.selectLabel", {label, field})} value={format} options={[...dateDisplayOptions]} disabled={disabled} onValueChange={next => setDisplay(name, {format: next as typeof format})} /></div>
            {format === "custom" && <div className="event-manage-field"><FieldLabel label={t("manage.editor.dateFormat.custom")} required help={t("manage.editor.dateFormat.customHelp")} /><input className={`event-manage-input${invalid ? " is-invalid" : ""}`} aria-label={t("manage.editor.dateFormat.customLabel", {label, field})} value={display?.pattern ?? ""} placeholder="dd.MM.yyyy HH:mm" disabled={disabled} onChange={event => setDisplay(name, {pattern: event.target.value})} />{invalid && <p className="event-content-editor__field-error" role="alert">{t("manage.validation.dateFormatField")}</p>}</div>}
            {preview && <small className="event-content-editor__hint">{t("manage.editor.dateFormat.preview", {preview})}</small>}
        </div>;
    })}</div>;
}
