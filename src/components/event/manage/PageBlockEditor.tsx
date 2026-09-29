"use client";

import {useEffect, useId, useRef, useState, type ChangeEvent} from "react";
import * as Popover from "@radix-ui/react-popover";
import Image from "next/image";
import {ArrowDown, ArrowUp, Braces, Copy, GripVertical, ImagePlus, Plus, Trash2, Wand2, X} from "lucide-react";
import type {ContentBlock, ContentValue} from "@/types/eventContent";
import {emptyRichText, richTextPlainText, type ContentRichText} from "@/components/event/content/richTextState";
import {initialVisibilityValue, insertableContentVariable, visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {blockPalette} from "./blockPalette";
import {uploadManageBannerImage} from "@/api/manage";
import {FieldLabel} from "./FieldLabel";
import {EventRichTextField} from "./EventRichTextField";
import {blockValidationField} from "./validatePageBlocks";
import {contentImageURL, replaceVariables} from "@/components/event/content/ContentBlocks";
import {anchorError, anchorFromText, maxAnchorLength} from "./blockAnchor";
import {dateDisplayOptions, formatDateTime, validDatePattern} from "@/components/event/content/dateDisplay";
import {useEventLinkOptions} from "./useEventLinkOptions";
import {DateVariableFormatControls} from "./DateVariableFormatControls";
import {updateBlockRichText} from "./richTextBlockUpdate";
import {t} from "@/i18n/t";

export {FieldLabel} from "./FieldLabel";

const textHelpKeys: Record<string, string> = {
    label: "manage.blocks.help.label",
    title: "manage.blocks.help.title",
    sub: "manage.blocks.help.sub",
    text: "manage.blocks.help.text",
    by: "manage.blocks.help.by",
    kicker: "manage.blocks.help.kicker",
    note: "manage.blocks.help.note",
    tocTitle: "manage.blocks.help.tocTitle",
    "action:label": "manage.blocks.help.actionLabel",
    "action:href": "manage.blocks.help.actionHref",
    "secondaryAction:label": "manage.blocks.help.secondaryActionLabel",
    "secondaryAction:href": "manage.blocks.help.secondaryActionHref",
};

function textHelp(field: string): string | undefined {
    const helpKey = textHelpKeys[field];
    return helpKey ? t(helpKey) : undefined;
}

function localDateTime(value: ContentValue, seconds = false): string {
    if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) return "";
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, seconds ? 19 : 16);
}

function displayValue(value: ContentValue | undefined): string {
    if (value === undefined || value === null || value === "") return t("manage.blocks.variable.noValue");
    if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
    return String(value);
}

function withBinding(block: ContentBlock, variable: ContentVariableDefinition): ContentBlock {
    if (block.variables?.some(binding => binding.name === variable.name)) return block;
    return {...block, variables: [...(block.variables ?? []), {name: variable.name, format: variable.format}]};
}

const variableToken = /\{\{([a-z][a-zA-Z0-9.]*)\}\}/g;

function badge(name: string): HTMLSpanElement {
    const node = document.createElement("span");
    node.className = "event-content-editor__variable-token";
    node.dataset.variable = name;
    node.contentEditable = "false";
    node.textContent = name;
    return node;
}

function renderBadges(editor: HTMLElement, raw: string) {
    const lines = raw.split("\n");
    const nodes: Node[] = [];
    lines.forEach((line, lineIndex) => {
        if (lineIndex) nodes.push(document.createElement("br"));
        let position = 0;
        for (const match of line.matchAll(variableToken)) {
            const start = match.index ?? 0;
            if (start > position) nodes.push(document.createTextNode(line.slice(position, start)));
            nodes.push(badge(match[1]));
            nodes.push(document.createTextNode("\u200b"));
            position = start + match[0].length;
        }
        if (position < line.length) nodes.push(document.createTextNode(line.slice(position)));
    });
    editor.replaceChildren(...nodes);
}

function serializeBadges(editor: HTMLElement): string {
    function read(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replaceAll("\u00a0", " ").replaceAll("\u200b", "");
        if (!(node instanceof HTMLElement)) return "";
        if (node.dataset.variable) return `{{${node.dataset.variable}}}`;
        if (node.tagName === "BR") return "\n";
        return readChildren(node);
    }
    function readChildren(parent: Node): string {
        let result = "";
        for (const child of parent.childNodes) {
            if (child instanceof HTMLElement && (child.tagName === "DIV" || child.tagName === "P") && result && !result.endsWith("\n")) result += "\n";
            result += read(child);
        }
        return result;
    }
    return readChildren(editor);
}

function EditorTextField({label, value, placeholder, multiline, compact, required, help, error, disabled, catalog, values, variableFormats, variableNames, hideLabel = false, onInsertVariable, onChangeValue}: {
    label: string; value: string; placeholder: string; multiline: boolean; compact: boolean; required: boolean; help?: string; disabled: boolean;
    error?: string;
    catalog: ContentVariableDefinition[]; values: Record<string, ContentValue>;
    variableFormats?: ContentVariableDefinition["format"][];
    variableNames?: string[];
    hideLabel?: boolean;
    onInsertVariable: (variable: ContentVariableDefinition, next: string) => void;
    onChangeValue: (value: string) => void;
}) {
    const id = useId();
    const inputRef = useRef<HTMLDivElement | null>(null);
    const selection = useRef<Range | null>(null);
    const lastEmitted = useRef(value);
    const [variableOpen, setVariableOpen] = useState(false);
    const [variableSearch, setVariableSearch] = useState("");
    const filteredVariables = catalog.filter(variable => insertableContentVariable(variable) && (!variableFormats || variableFormats.includes(variable.format)) && (!variableNames || variableNames.includes(variable.name)) && `${variable.label} ${variable.name}`.toLocaleLowerCase("uk").includes(variableSearch.toLocaleLowerCase("uk")));
    useEffect(() => {
        if (!inputRef.current || value === lastEmitted.current) return;
        renderBadges(inputRef.current, value);
        lastEmitted.current = value;
    }, [value]);
    useEffect(() => {
        if (inputRef.current) renderBadges(inputRef.current, value);
        // Initial DOM content only; later external values use the effect above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    function remember() {
        const current = window.getSelection();
        const range = current?.rangeCount ? current.getRangeAt(0) : null;
        if (range && inputRef.current?.contains(range.commonAncestorContainer)) selection.current = range.cloneRange();
    }
    function emit() {
        if (!inputRef.current) return;
        const next = serializeBadges(inputRef.current);
        lastEmitted.current = next;
        onChangeValue(next);
        remember();
    }
    function insert(variable: ContentVariableDefinition) {
        const editor = inputRef.current;
        if (!editor) return;
        editor.focus();
        const range = selection.current && editor.contains(selection.current.commonAncestorContainer)
            ? selection.current.cloneRange() : document.createRange();
        if (!editor.contains(range.commonAncestorContainer)) range.selectNodeContents(editor);
        if (!selection.current || !editor.contains(selection.current.commonAncestorContainer)) range.collapse(false);
        const token = badge(variable.name);
        range.deleteContents();
        range.insertNode(token);
        const spacer = document.createTextNode("\u200b");
        token.after(spacer);
        range.setStartAfter(spacer);
        range.collapse(true);
        const current = window.getSelection();
        current?.removeAllRanges();
        current?.addRange(range);
        selection.current = range.cloneRange();
        const next = serializeBadges(editor);
        lastEmitted.current = next;
        onInsertVariable(variable, next);
        setVariableOpen(false);
        setVariableSearch("");
        requestAnimationFrame(() => { editor.focus(); remember(); });
    }
    return <div className="event-manage-field">
        {!hideLabel && <FieldLabel label={label} required={required} help={help} />}
        <div className={`event-content-editor__field-control${multiline ? " event-content-editor__field-control--multiline" : ""}`}>
            <div id={id} ref={inputRef} role="textbox" aria-label={label} aria-multiline={multiline} aria-required={required} aria-readonly={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
                className={`event-manage-input event-content-editor__badge-input${multiline ? compact ? " event-content-editor__textarea--compact" : " event-content-editor__textarea" : ""}${error ? " is-invalid" : ""}`}
                contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder}
                onInput={emit} onKeyUp={remember} onMouseUp={remember} onBlur={remember}
                onMouseDown={event => {const token = (event.target as HTMLElement).closest(".event-content-editor__variable-token"); if (!token || !inputRef.current?.contains(token)) return; event.preventDefault(); inputRef.current.focus(); const range = document.createRange(); range.selectNode(token); const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(range); selection.current = range.cloneRange();}}
                onKeyDown={event => {if (!multiline && event.key === "Enter") event.preventDefault();}}
                onPaste={event => {event.preventDefault(); const plain = event.clipboardData.getData("text/plain"); document.execCommand("insertText", false, multiline ? plain : plain.replace(/[\r\n]+/g, " ")); emit();}} />
            <Popover.Root open={variableOpen} onOpenChange={open => {setVariableOpen(open); if (!open) setVariableSearch("");}} modal={false}>
                <div className="event-content-editor__picker"><Popover.Trigger asChild><button className="event-content-editor__field-variable" type="button" aria-label={t("manage.blocks.variable.insertInto", {label})} title={t("manage.blocks.variable.insert")} disabled={disabled} onMouseDown={remember}><Braces size={16} /></button></Popover.Trigger></div>
                <Popover.Portal><Popover.Content className="event-content-editor__variable-menu" side="bottom" align="end" sideOffset={7} collisionPadding={12} onCloseAutoFocus={event => event.preventDefault()}>
                    <div className="event-content-editor__variable-head"><strong>{t("manage.blocks.variable.listTitle", {label})}</strong><Popover.Close type="button" aria-label={t("manage.blocks.variable.closeList")}><X size={15} /></Popover.Close></div>
                    <input className="event-manage-input" value={variableSearch} onChange={event => setVariableSearch(event.target.value)} placeholder={t("manage.blocks.variable.search")} aria-label={t("manage.blocks.variable.search")} />
                    <div className="event-content-editor__variable-list">{filteredVariables.map(variable => <button key={variable.name} type="button" onClick={() => insert(variable)}><strong>{variable.label}</strong><code>{variable.name}</code><small>{t("manage.blocks.variable.current", {value: displayValue(values[variable.name])})}</small></button>)}</div>
                </Popover.Content></Popover.Portal>
            </Popover.Root>
        </div>
        {error && <p className="event-content-editor__field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>;
}

function EditorLinkField({eventID, label, value, placeholder, required, help, error, disabled, catalog, values, onInsertVariable, onChangeValue}: {
    eventID: string; label: string; value: string; placeholder: string; required: boolean; help?: string; error?: string; disabled: boolean;
    catalog: ContentVariableDefinition[]; values: Record<string, ContentValue>;
    onInsertVariable: (variable: ContentVariableDefinition, next: string) => void;
    onChangeValue: (value: string) => void;
}) {
    const {options, pagesError} = useEventLinkOptions(eventID, values);
    const preset = options.some(option => option.value === value) ? value : "custom";
    return <div className="event-content-editor__link-target">
        <div className="event-manage-field"><FieldLabel label={label} required={required} help={help} /><EventSelect ariaLabel={t("manage.blocks.link.targetAria", {label})} value={preset} options={[...options, {value: "custom", label: t("manage.blocks.link.custom")}]} disabled={disabled} onValueChange={next => onChangeValue(next === "custom" ? "" : next)} /></div>
        {preset === "custom" && <EditorTextField label={t("manage.blocks.link.addressFor", {label: label.toLocaleLowerCase("uk")})} value={value} placeholder={placeholder} multiline={false} compact={false} required={required} error={error} disabled={disabled} catalog={catalog} values={values} variableNames={["event.tag"]} hideLabel onInsertVariable={onInsertVariable} onChangeValue={onChangeValue} />}
        {preset !== "custom" && error && <p className="event-content-editor__field-error" role="alert">{error}</p>}
        {pagesError && <small className="event-content-editor__hint">{t("manage.blocks.link.pagesError")}</small>}
    </div>;
}

export function PageBlockEditor({eventID, coverImage, block, index, count, anchorsInUse = [], values, catalog, canEdit, selected = false, error, onSelect, onUpdate, onMove, onReorder, onDuplicate, onDelete}: {
    eventID: string;
    coverImage: string;
    block: ContentBlock;
    index: number;
    count: number;
    // Other blocks' ids and anchors: an anchor must differ from all of them.
    anchorsInUse?: string[];
    values: Record<string, ContentValue>;
    catalog: ContentVariableDefinition[];
    canEdit: boolean;
    selected?: boolean;
    error?: string;
    onSelect: () => void;
    onUpdate: (value: ContentBlock | ((current: ContentBlock) => ContentBlock)) => void;
    onMove: (direction: -1 | 1) => void;
    onReorder: (sourceID: string, targetID: string) => void;
    onDuplicate?: () => void;
    onDelete: () => void;
}) {
    const pointerID = useRef<number | null>(null);
    const dropTarget = useRef<HTMLElement | null>(null);
    const dragGhost = useRef<HTMLElement | null>(null);
    const dragOffset = useRef({x: 0, y: 0});
    const lastHoverID = useRef("");
    const [rulesOpen, setRulesOpen] = useState(!!block.visibility?.length);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageError, setImageError] = useState("");
    const [imageDragOver, setImageDragOver] = useState(false);
    const [logoUpload, setLogoUpload] = useState<{group: number; error: string; busy: boolean} | null>(null);
    const anchorProblem = anchorError(block.anchor ?? "", anchorsInUse);
    const contentVariableByName = new Map(catalog.map(variable => [variable.name, variable]));
    const errorField = error ? blockValidationField(error, block) : null;
    const errorMessage = error?.replace(/^[^:\d]+ \d+: /, "").replace(/^./, first => first.toLocaleUpperCase("uk"));

    function blockAt(clientX: number, clientY: number): HTMLElement | null {
        return document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-editor-block-id]") ?? null;
    }

    function clearDropTarget() {
        document.removeEventListener("pointerup", clearDropTarget);
        document.removeEventListener("pointercancel", clearDropTarget);
        dropTarget.current?.classList.remove("is-drop-target");
        dropTarget.current = null;
        document.querySelector<HTMLElement>(`[data-editor-block-id="${block.id}"]`)?.classList.remove("is-dragging");
        dragGhost.current?.remove();
        dragGhost.current = null;
        lastHoverID.current = "";
        pointerID.current = null;
    }

    function beginDrag(event: React.PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        const source = event.currentTarget.closest<HTMLElement>("[data-editor-block-id]");
        if (!source) return;
        const bounds = source.getBoundingClientRect();
        dragOffset.current = {x: event.clientX - bounds.left, y: event.clientY - bounds.top};
        const ghost = source.cloneNode(true) as HTMLElement;
        ghost.removeAttribute("data-editor-block-id");
        ghost.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
        ghost.classList.add("event-content-editor__drag-ghost");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.width = `${bounds.width}px`;
        ghost.style.left = `${bounds.left}px`;
        ghost.style.top = `${bounds.top}px`;
        document.body.appendChild(ghost);
        dragGhost.current = ghost;
        source.classList.add("is-dragging");
        pointerID.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        document.addEventListener("pointerup", clearDropTarget);
        document.addEventListener("pointercancel", clearDropTarget);
    }

    function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
        if (pointerID.current !== event.pointerId) return;
        if (dragGhost.current) {
            dragGhost.current.style.left = `${event.clientX - dragOffset.current.x}px`;
            dragGhost.current.style.top = `${event.clientY - dragOffset.current.y}px`;
        }
        const target = blockAt(event.clientX, event.clientY);
        const targetID = target?.dataset.editorBlockId ?? "";
        if (!targetID || targetID === block.id || targetID === lastHoverID.current) return;
        lastHoverID.current = targetID;
        onReorder(block.id, targetID);
    }

    function fieldValue(field: string): string {
        if (field.startsWith("item:")) {
            const [, index, key] = field.split(":");
            return block.items?.[Number(index)]?.[key as "label" | "value"] ?? "";
        }
        if (field === "action:label") return block.action?.label ?? "";
        if (field === "action:href") return block.action?.href ?? "";
        if (field === "secondaryAction:label") return block.secondaryAction?.label ?? "";
        if (field === "secondaryAction:href") return block.secondaryAction?.href ?? "";
        return block[field as "label" | "title" | "sub" | "text" | "by" | "kicker" | "note" | "tocTitle"] ?? "";
    }

    function changeField(field: string, value: string, base = block): ContentBlock {
        const existing = base.dateDisplays?.[field];
        const remaining = existing && Object.fromEntries(Object.entries(existing).filter(([name]) => value.includes(`{{${name}}}`)));
        const dateDisplays = existing ? {...base.dateDisplays, [field]: remaining ?? {}} : base.dateDisplays;
        base = {...base, dateDisplays};
        if (field.startsWith("item:")) {
            const [, index, key] = field.split(":");
            return {...base, items: (base.items ?? []).map((item, position) => position === Number(index) ? {...item, [key]: value} : item)};
        }
        if (field === "action:label" || field === "action:href") {
            const action = {...(base.action ?? {label: "", href: ""}), [field.split(":")[1]]: value};
            return {...base, action: block.type !== "cta" && !action.label && !action.href ? undefined : action};
        }
        if (field === "secondaryAction:label" || field === "secondaryAction:href") {
            const secondaryAction = {...(base.secondaryAction ?? {label: "", href: ""}), [field.split(":")[1]]: value};
            return {...base, secondaryAction: !secondaryAction.label && !secondaryAction.href ? undefined : secondaryAction};
        }
        return {...base, [field]: value};
    }

    function removeItem(itemIndex: number) {
        const dateDisplays = Object.fromEntries(Object.entries(block.dateDisplays ?? {}).flatMap(([field, formats]) => {
            const match = /^item:(\d+):(label|value|richText)$/.exec(field);
            if (!match) return [[field, formats]];
            const position = Number(match[1]);
            if (position === itemIndex) return [];
            return [[`item:${position > itemIndex ? position - 1 : position}:${match[2]}`, formats]];
        }));
        onUpdate({...block, dateDisplays, items: (block.items ?? []).filter((_, position) => position !== itemIndex), openItem: block.openItem === undefined || block.openItem === itemIndex ? undefined : block.openItem > itemIndex ? block.openItem - 1 : block.openItem});
    }

    function inputField(field: string, label: string, placeholder = "", multiline = false, required = false, help?: string, compact = false) {
        const itemPart = field.startsWith("item:") ? field.split(":")[2] : "";
        const itemError = itemPart === "label"
            ? block.type === "faq" ? t("manage.blocks.item.error.question") : block.type === "doc" ? t("manage.blocks.item.error.sectionTitle") : t("manage.blocks.item.error.label")
            : block.type === "timeline" ? t("manage.blocks.item.error.eventName") : block.type === "faq" ? t("manage.blocks.item.error.answer") : block.type === "doc" ? t("manage.blocks.item.error.sectionText") : t("manage.blocks.item.error.value");
        const missingItem = !!errorMessage && !!itemPart && !fieldValue(field).trim();
        const fieldError = errorField === field ? itemPart && missingItem ? itemError : errorMessage : undefined;
        const itemHelp = itemPart === "label"
            ? block.type === "timeline" ? t("manage.blocks.item.help.timelineLabel") : block.type === "faq" ? t("manage.blocks.item.help.faqLabel") : block.type === "doc" ? t("manage.blocks.item.help.docLabel") : t("manage.blocks.item.help.label")
            : block.type === "timeline" ? t("manage.blocks.item.help.timelineValue") : block.type === "faq" ? t("manage.blocks.item.help.faqValue") : t("manage.blocks.item.help.value");
        if (field === "action:href" || field === "secondaryAction:href") return <EditorLinkField eventID={eventID} label={label} value={fieldValue(field)} placeholder={placeholder} required={required} help={help ?? textHelp(field)} error={errorField === field ? errorMessage : undefined} disabled={!canEdit} catalog={catalog} values={values}
            onInsertVariable={(variable, next) => onUpdate(changeField(field, next, withBinding(block, variable)))} onChangeValue={value => onUpdate(changeField(field, value))} />;
        return <><EditorTextField label={label} value={fieldValue(field)} placeholder={placeholder}
            multiline={multiline} compact={compact} required={required} help={help ?? (itemPart ? itemHelp : textHelp(field))} error={fieldError} disabled={!canEdit} catalog={catalog} values={values}
            variableFormats={block.type === "timeline" && itemPart === "value" ? ["text", "number", "boolean"] : undefined}
            onInsertVariable={(variable, next) => onUpdate(changeField(field, next, withBinding(block, variable)))}
            onChangeValue={value => onUpdate(changeField(field, value))} />
            <DateVariableFormatControls field={field} value={fieldValue(field)} block={block} catalog={catalog} values={values} disabled={!canEdit} onUpdate={onUpdate} /></>;
    }

    function richValue(field: string): ContentRichText {
        if (!field.startsWith("item:")) return block.richText ?? emptyRichText();
        const index = Number(field.split(":")[1]);
        return block.items?.[index]?.richText ?? emptyRichText();
    }


    function richField(field: string, label: string) {
        const fieldError = errorField === field ? field.startsWith("item:") ? block.type === "doc" ? t("manage.blocks.item.error.sectionText") : t("manage.blocks.item.error.answer") : errorMessage : undefined;
        return <><EventRichTextField eventID={eventID} label={label} value={richValue(field)} error={fieldError} disabled={!canEdit} catalog={catalog} values={values} dateDisplays={block.dateDisplays?.[field]}
            onChange={value => onUpdate(updateBlockRichText(block, field, value, catalog))} />
            <DateVariableFormatControls field={field} value={richValue(field)} block={block} catalog={catalog} values={values} disabled={!canEdit} onUpdate={onUpdate} /></>;
    }

    async function uploadBanner(file: File | undefined) {
        if (!file) return;
        setImageError("");
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
            setImageError(t("manage.blocks.image.invalid"));
            return;
        }
        setUploadingImage(true);
        try {
            const imageURL = await uploadManageBannerImage(eventID, file);
            onUpdate(current => ({...current, imageSource: "custom", imageURL}));
        } catch {
            setImageError(t("manage.blocks.image.uploadFailed"));
        } finally { setUploadingImage(false); }
    }

    function actionPosition() {
        return <div className="event-manage-field"><FieldLabel label={t("manage.blocks.action.position")} required help={t("manage.blocks.action.positionHelp")} /><EventSelect ariaLabel={t("manage.blocks.action.position")} value={block.actionAlignment ?? "end"} options={[{value: "start", label: t("manage.blocks.align.left")}, {value: "center", label: t("manage.blocks.align.center")}, {value: "end", label: t("manage.blocks.align.right")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, actionAlignment: value})} /></div>;
    }

    function actionKind(secondary = false) {
        const key = secondary ? "secondaryAction" : "action";
        const current = block[key];
        return <div className="event-manage-field"><FieldLabel label={secondary ? t("manage.blocks.action.secondKind") : t("manage.blocks.action.kind")} required={!secondary || !!current?.label} help={t("manage.blocks.action.kindHelp")} /><EventSelect ariaLabel={secondary ? t("manage.blocks.action.secondKind") : t("manage.blocks.action.kind")} value={current?.kind ?? "link"} options={[{value: "link", label: t("manage.blocks.action.kindLink")}, {value: "join_event", label: t("manage.blocks.action.kindJoin")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, [key]: {...(current ?? {label: "", href: ""}), kind: value as "link" | "join_event", href: ""}})} /></div>;
    }

    function showFromControls() {
        const source = block.showFromSource ?? "none";
        return <>
            <div className="event-manage-field"><FieldLabel label={t("manage.blocks.showFrom.label")} help={t("manage.blocks.showFrom.help")} /><EventSelect ariaLabel={t("manage.blocks.showFrom.aria")} value={source} options={[{value: "none", label: t("manage.blocks.showFrom.none")}, {value: "event", label: t("manage.blocks.showFrom.event")}, {value: "custom", label: t("manage.blocks.date.custom")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, showFromSource: value as "none" | "event" | "custom", showFromVariable: "", showFromDate: ""})} /></div>
            {source === "event" && <div className={`event-manage-field${errorField === "showFromVariable" ? " is-invalid" : ""}`}><FieldLabel label={t("manage.blocks.showFrom.eventDate")} required help={t("manage.blocks.showFrom.eventDateHelp")} /><EventSelect ariaLabel={t("manage.blocks.showFrom.eventDateAria")} value={block.showFromVariable ?? ""} placeholder={t("manage.blocks.date.pick")} options={catalog.filter(item => item.format === "date-time").map(item => ({value: item.name, label: item.label}))} disabled={!canEdit} onValueChange={value => {const variable = contentVariableByName.get(value); onUpdate(variable ? {...withBinding(block, variable), showFromVariable: variable.name} : {...block, showFromVariable: ""});}} />{errorField === "showFromVariable" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
            {source === "custom" && <div className={`event-manage-field${errorField === "showFromDate" ? " is-invalid" : ""}`}><FieldLabel label={t("manage.blocks.showFrom.custom")} required help={t("manage.blocks.showFrom.customHelp")} /><EventDateTimePicker ariaLabel={t("manage.blocks.showFrom.customAria")} value={localDateTime(block.showFromDate ?? "", true)} showSeconds disabled={!canEdit} onChange={value => onUpdate({...block, showFromDate: value ? new Date(value).toISOString() : ""})} />{errorField === "showFromDate" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
            <label className="event-manage-field"><FieldLabel label={t("manage.blocks.hideAfter.label")} help={t("manage.blocks.hideAfter.help")} /><span className="event-content-editor__checkbox"><input type="checkbox" checked={!!block.hideAfterFinish} disabled={!canEdit} onChange={event => onUpdate({...block, hideAfterFinish: event.target.checked})} />{t("manage.blocks.hideAfter.checkbox")}</span></label>
        </>;
    }

    function countdownSource(optional: boolean) {
        const source = block.dateSource ?? (block.targetDate ? "custom" : block.targetVariable ? "event" : optional ? "none" : "event");
        return <>
            <div className="event-manage-field"><FieldLabel label={t("manage.blocks.countdown.source")} required={!optional} help={t("manage.blocks.countdown.sourceHelp")} /><EventSelect ariaLabel={t("manage.blocks.countdown.source")} value={source} options={[...(optional ? [{value: "none", label: t("manage.blocks.countdown.none")}] : []), {value: "event", label: t("manage.blocks.countdown.fromSchedule")}, {value: "custom", label: t("manage.blocks.date.custom")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, dateSource: value, targetVariable: value === "event" ? block.targetVariable : "", targetDate: value === "custom" ? block.targetDate : ""})} /></div>
            {source === "event" && <div className={`event-manage-field${errorField === "targetVariable" ? " is-invalid" : ""}`}><FieldLabel label={t("manage.blocks.countdown.scheduleDate")} required help={t("manage.blocks.countdown.scheduleDateHelp")} /><EventSelect value={block.targetVariable ?? ""} ariaLabel={t("manage.blocks.countdown.scheduleDateAria")} placeholder={t("manage.blocks.date.pick")} options={catalog.filter(item => item.format === "date-time").map(item => ({value: item.name, label: item.label}))} disabled={!canEdit} onValueChange={value => {const variable = contentVariableByName.get(value); onUpdate(variable ? {...withBinding(block, variable), targetVariable: variable.name, targetDate: ""} : {...block, targetVariable: ""});}} />{errorField === "targetVariable" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
            {source === "custom" && <div className={`event-manage-field${errorField === "targetDate" ? " is-invalid" : ""}`}><FieldLabel label={t("manage.blocks.date.custom")} required help={t("manage.blocks.countdown.customHelp")} /><EventDateTimePicker ariaLabel={t("manage.blocks.countdown.customAria")} value={localDateTime(block.targetDate ?? "", true)} showSeconds disabled={!canEdit} onChange={value => onUpdate({...block, targetVariable: "", targetDate: value ? new Date(value).toISOString() : ""})} />{errorField === "targetDate" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
        </>;
    }

    function countdownDisplay() {
        return <div className="event-manage-field"><FieldLabel label={t("manage.blocks.timer.display")} required help={t("manage.blocks.timer.displayHelp")} /><EventSelect ariaLabel={t("manage.blocks.timer.display")} value={block.timerDisplay ?? "segments"} options={[{value: "segments", label: t("manage.blocks.timer.segments")}, {value: "compact", label: t("manage.blocks.timer.compact")}, {value: "tiles", label: t("manage.blocks.timer.tiles")}, {value: "focus", label: t("manage.blocks.timer.focus")}, {value: "dial", label: t("manage.blocks.timer.dial")}, {value: "ledger", label: t("manage.blocks.layout.rows")}, {value: "poster", label: t("manage.blocks.timer.poster")}, {value: "tracks", label: t("manage.blocks.timer.tracks")}, {value: "flip", label: t("manage.blocks.timer.flip")}, {value: "ticker", label: t("manage.blocks.timer.ticker")}, {value: "stairs", label: t("manage.blocks.timer.stairs")}, {value: "orbits", label: t("manage.blocks.timer.orbits")}, {value: "matrix", label: t("manage.blocks.timer.matrix")}, {value: "ribbon", label: t("manage.blocks.timer.ribbon")}, {value: "rings", label: t("manage.blocks.timer.rings")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerDisplay: value as NonNullable<ContentBlock["timerDisplay"]>})} /></div>;
    }

    function timelineTimeField(item: NonNullable<ContentBlock["items"]>[number], itemIndex: number) {
        const source = item.dateSource === "custom" ? "custom" : item.dateVariable ?? "";
        const fieldPrefix = "item:" + itemIndex + ":";
        const updateItem = (update: Partial<typeof item>, base = block) => ({...base, items: (base.items ?? []).map((entry, position) => position === itemIndex ? {...entry, ...update} : entry)});
        return <div className="event-content-editor__time-settings">
            <div className={"event-manage-field" + (errorField === fieldPrefix + "dateVariable" ? " is-invalid" : "")}>
                <FieldLabel label={t("manage.blocks.timeline.time")} required help={t("manage.blocks.timeline.timeHelp")} />
                <EventSelect ariaLabel={t("manage.blocks.timeline.timeAria", {n: itemIndex + 1})} value={source} placeholder={t("manage.blocks.timeline.pickDateTime")} options={[...catalog.filter(variable => variable.format === "date-time").map(variable => ({value: variable.name, label: variable.label})), {value: "custom", label: t("manage.blocks.date.custom")}]} disabled={!canEdit} onValueChange={next => {
                    const variable = contentVariableByName.get(next);
                    const base = variable ? withBinding(block, variable) : block;
                    onUpdate(updateItem(next === "custom" ? {dateSource: "custom", dateVariable: "", dateValue: ""} : {dateSource: "event", dateVariable: next, dateValue: ""}, base));
                }} />
                {errorField === fieldPrefix + "dateVariable" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}
            </div>
            {item.dateSource === "custom" && <div className={"event-manage-field" + (errorField === fieldPrefix + "dateValue" ? " is-invalid" : "")}>
                <FieldLabel label={t("manage.blocks.date.custom")} required help={t("manage.blocks.timeline.customHelp")} />
                <EventDateTimePicker ariaLabel={t("manage.blocks.timeline.customAria", {n: itemIndex + 1})} value={localDateTime(item.dateValue ?? "", true)} showSeconds disabled={!canEdit} onChange={value => onUpdate(updateItem({dateValue: value ? new Date(value).toISOString() : ""}))} />
                {errorField === fieldPrefix + "dateValue" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}
            </div>}
        </div>;
    }

    function timelineFormatField(item: NonNullable<ContentBlock["items"]>[number], itemIndex: number) {
        const format = item.dateFormat ?? "date-time";
        const currentDate = item.dateSource === "custom" ? item.dateValue ?? "" : String(values[item.dateVariable ?? ""] ?? "");
        const example = currentDate && (format !== "custom" || validDatePattern(item.datePattern ?? "")) ? formatDateTime(currentDate, format, item.datePattern) : "";
        const updateItem = (update: Partial<typeof item>) => ({...block, items: (block.items ?? []).map((entry, position) => position === itemIndex ? {...entry, ...update} : entry)});
        return <div className="event-content-editor__timeline-format">
            <div className="event-manage-field"><FieldLabel label={t("manage.blocks.timeline.format")} required help={t("manage.blocks.timeline.formatHelp")} /><EventSelect ariaLabel={t("manage.blocks.timeline.formatAria", {n: itemIndex + 1})} value={format} options={[...dateDisplayOptions]} disabled={!canEdit} onValueChange={value => onUpdate(updateItem({dateFormat: value as typeof format}))} /></div>
            {format === "custom" && <div className={"event-manage-field" + (errorField === `item:${itemIndex}:datePattern` ? " is-invalid" : "")}><FieldLabel label={t("manage.blocks.timeline.customFormat")} required help={t("manage.blocks.timeline.customFormatHelp")} /><input className={"event-manage-input" + (errorField === `item:${itemIndex}:datePattern` ? " is-invalid" : "")} aria-label={t("manage.blocks.timeline.customFormatAria", {n: itemIndex + 1})} value={item.datePattern ?? ""} placeholder="dd.MM.yyyy HH:mm:ss" disabled={!canEdit} onChange={event => onUpdate(updateItem({datePattern: event.target.value}))} />{errorField === `item:${itemIndex}:datePattern` && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
            {example && <small className="event-content-editor__hint">{t("manage.blocks.timeline.example", {example})}</small>}
        </div>;
    }

    function setRule(ruleIndex: number, update: NonNullable<ContentBlock["visibility"]>[number]) {
        const variable = contentVariableByName.get(update.variable);
        const nextBlock = variable ? withBinding(block, variable) : block;
        const visibility = [...(nextBlock.visibility ?? [])];
        visibility[ruleIndex] = update;
        onUpdate({...nextBlock, visibility});
    }

    function addRule() {
        const variable = contentVariableByName.get("event.isStarted") ?? catalog[0];
        if (!variable) return;
        const nextBlock = withBinding(block, variable);
        onUpdate({...nextBlock, visibility: [...(nextBlock.visibility ?? []), {variable: variable.name, operator: "equals", value: initialVisibilityValue(variable.format)}]});
        setRulesOpen(true);
    }

    const blockLabel = blockPalette.find(item => item.type === block.type)?.label ?? block.type;
    const rawSummary = block.type === "section" ? block.label : block.title || (block.type === "text" ? richTextPlainText(block.richText, values) : "");
    const summaryField = block.type === "section" ? "label" : "title";
    const blockSummary = block.type === "text" && !block.title ? rawSummary ?? "" : replaceVariables(rawSummary ?? "", values, new Map((block.variables ?? []).map(variable => [variable.name, variable.format])), false, block.dateDisplays?.[summaryField]);
    return <section className={`event-content-editor__block${selected ? " is-selected" : ""}${error ? " is-invalid" : ""}`} data-editor-block-id={block.id} aria-label={`${blockLabel} ${index + 1}`} aria-describedby={selected && error && !errorField ? `block-error-${block.id}` : undefined} tabIndex={0} onClick={event => {if (!(event.target as Element).closest(".event-content-editor__block-actions")) onSelect();}} onFocusCapture={event => {if (!(event.target as Element).closest(".event-content-editor__block-actions")) onSelect();}} onKeyDown={event => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); onSelect();}}}>
        <div className="event-content-editor__block-head">
            <div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{blockLabel}</strong>{blockSummary && <span className="event-content-editor__block-summary">{blockSummary}</span>}</div>
            {canEdit && <div className="event-content-editor__block-actions">
                <EventTooltip content={t("manage.blocks.drag.tooltip")}>{id => <button type="button" className="event-content-editor__drag" aria-label={t("manage.blocks.drag.aria", {n: index + 1})} aria-describedby={id} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={clearDropTarget} onPointerCancel={clearDropTarget}><GripVertical size={16} /></button>}</EventTooltip>
                <EventTooltip content={t("manage.blocks.move.up")}>{id => <button type="button" aria-label={t("manage.blocks.move.upAria", {n: index + 1})} aria-describedby={id} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>}</EventTooltip>
                <EventTooltip content={t("manage.blocks.move.down")}>{id => <button type="button" aria-label={t("manage.blocks.move.downAria", {n: index + 1})} aria-describedby={id} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></button>}</EventTooltip>
                {onDuplicate && <EventTooltip content={t("manage.blocks.duplicate")}>{id => <button type="button" aria-label={t("manage.blocks.duplicateAria", {n: index + 1})} aria-describedby={id} onClick={onDuplicate}><Copy size={16} /></button>}</EventTooltip>}
                <EventTooltip content={t("manage.blocks.delete.tooltip")}>{id => <button type="button" className="event-content-editor__danger" aria-label={t("manage.blocks.delete.aria", {n: index + 1})} aria-describedby={id} onClick={onDelete}><Trash2 size={16} /></button>}</EventTooltip>
            </div>}
        </div>
        {error && selected && !errorField && <p className="event-content-editor__block-error" id={`block-error-${block.id}`} role="alert">{errorMessage}</p>}
        {selected && <div className="event-content-editor__block-body">
            {block.type === "section" && inputField("label", t("manage.blocks.section.heading"), t("manage.blocks.field.sectionTitle"), false, true)}
            {block.type === "section" && <div className="event-manage-field"><FieldLabel label={t("manage.blocks.section.align")} required help={t("manage.blocks.section.alignHelp")} /><EventSelect ariaLabel={t("manage.blocks.section.align")} value={block.variant ?? "left"} options={[{value: "left", label: t("manage.blocks.align.left")}, {value: "center", label: t("manage.blocks.align.center")}, {value: "right", label: t("manage.blocks.align.right")}, {value: "justify", label: t("manage.blocks.align.justify")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {block.type === "text" && richField("richText", t("manage.blocks.text.content"))}
            {block.type === "text" && <div className="event-manage-field"><FieldLabel label={t("manage.blocks.text.width")} required help={t("manage.blocks.text.widthHelp")} /><EventSelect ariaLabel={t("manage.blocks.text.width")} value={block.variant ?? "narrow"} options={[{value: "narrow", label: t("manage.blocks.text.narrow")}, {value: "wide", label: t("manage.blocks.text.wide")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {["hero", "banner", "facts", "timeline", "doc", "faq", "cta", "countdown", "partners"].includes(block.type) && inputField("title", block.type === "hero" ? t("manage.blocks.field.title") : block.type === "banner" ? t("manage.blocks.field.bannerCaption") : t("manage.blocks.field.heading"), block.type === "banner" || block.type === "cta" ? t("manage.blocks.field.optional") : t("manage.blocks.field.blockTitle"), false, block.type === "hero", block.type === "faq" ? t("manage.blocks.faq.titleHelp") : block.type === "cta" ? t("manage.blocks.cta.titleHelp") : block.type === "countdown" ? t("manage.blocks.countdown.titleHelp") : undefined)}
            {block.type === "banner" && <>
                <div className={`event-manage-field${errorField === "imageSource" ? " is-invalid" : ""}`}><FieldLabel label={t("manage.blocks.banner.image")} required help={t("manage.blocks.banner.imageHelp")} /><EventSelect ariaLabel={t("manage.blocks.banner.imageAria")} value={block.imageSource ?? "preview"} options={[{value: "preview", label: coverImage ? t("manage.blocks.banner.cover") : t("manage.blocks.banner.coverMissing"), disabled: !coverImage}, {value: "custom", label: t("manage.blocks.banner.custom")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, imageSource: value})} />{errorField === "imageSource" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>
                {block.imageSource === "custom" && <div className={`event-manage-field${errorField === "imageURL" ? " is-invalid" : ""}`}><FieldLabel label={t("manage.blocks.banner.custom")} required help={t("manage.blocks.banner.customHelp")} /><label className={`event-brand-drop event-content-editor__upload${imageDragOver ? " is-over" : ""}`} onDragOver={event => {event.preventDefault(); setImageDragOver(true);}} onDragLeave={() => setImageDragOver(false)} onDrop={event => {event.preventDefault(); setImageDragOver(false); if (canEdit && !uploadingImage) void uploadBanner(event.dataTransfer.files[0]);}}><ImagePlus size={22} /><span className="event-brand-drop__action"><strong>{uploadingImage ? t("manage.blocks.upload.busy") : block.imageURL ? t("manage.blocks.banner.replace") : t("manage.blocks.banner.attach")}</strong><small>{t("manage.blocks.upload.dropHint")}</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!canEdit || uploadingImage} onChange={event => void uploadBanner(event.target.files?.[0])} /></label>{block.imageURL && <p className="event-content-editor__hint">{t("manage.blocks.banner.attached")}</p>}{errorField === "imageURL" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}{imageError && <p className="event-manage-validation" role="alert">{imageError}</p>}</div>}
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.banner.margins")} required help={t("manage.blocks.banner.marginsHelp")} /><EventSelect ariaLabel={t("manage.blocks.banner.margins")} value={block.variant ?? "frame"} options={[{value: "edge", label: t("manage.blocks.banner.edge")}, {value: "frame", label: t("manage.blocks.banner.frame")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {block.title && <div className="event-manage-field"><FieldLabel label={t("manage.blocks.banner.captionPosition")} required help={t("manage.blocks.banner.captionPositionHelp")} /><EventSelect ariaLabel={t("manage.blocks.banner.captionPositionAria")} value={block.layout ?? "left"} options={[{value: "left", label: t("manage.blocks.align.left")}, {value: "center", label: t("manage.blocks.align.center")}, {value: "right", label: t("manage.blocks.align.right")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, layout: value})} /></div>}
                <label className="event-manage-field"><FieldLabel label={t("manage.blocks.banner.width")} required help={t("manage.blocks.banner.widthHelp")} /><span className="event-content-editor__range"><input type="range" min="50" max="100" step="5" value={block.widthPercent ?? 100} disabled={!canEdit} aria-label={t("manage.blocks.banner.widthAria")} onChange={event => onUpdate({...block, widthPercent: Number(event.target.value)})} /><output>{block.widthPercent ?? 100}%</output></span></label>
            </>}
            {block.type === "hero" && <>
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.style.label")} required help={t("manage.blocks.hero.styleHelp")} /><EventSelect ariaLabel={t("manage.blocks.hero.styleAria")} value={block.variant ?? "mass"} options={[{value: "mass", label: t("manage.blocks.style.branded")}, {value: "plain", label: t("manage.blocks.style.plain")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.hero.composition")} required help={t("manage.blocks.hero.compositionHelp")} /><EventSelect ariaLabel={t("manage.blocks.hero.compositionAria")} value={block.layout ?? "split"} options={[{value: "split", label: t("manage.blocks.hero.split")}, {value: "center", label: t("manage.blocks.layout.allCenter")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, layout: value})} /></div>
                {inputField("by", t("manage.blocks.hero.by"), t("manage.blocks.default.heroBy"))}
                {inputField("kicker", t("manage.blocks.hero.kicker"), t("manage.blocks.field.optional"))}
            </>}
            {block.type === "facts" && <div className="event-manage-field"><FieldLabel label={t("manage.blocks.layout.label")} required help={t("manage.blocks.facts.layoutHelp")} /><EventSelect ariaLabel={t("manage.blocks.facts.layoutAria")} value={block.variant ?? "strip"} options={[{value: "strip", label: t("manage.blocks.facts.strip")}, {value: "rows", label: t("manage.blocks.layout.rows")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {block.type === "timeline" && <div className="event-manage-field"><FieldLabel label={t("manage.blocks.layout.label")} required help={t("manage.blocks.timeline.layoutHelp")} /><EventSelect ariaLabel={t("manage.blocks.timeline.layoutAria")} value={block.variant ?? "grid"} options={[{value: "grid", label: t("manage.blocks.timeline.grid")}, {value: "list", label: t("manage.blocks.timeline.list")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {["hero", "facts", "timeline", "faq"].includes(block.type) && <>
                {block.type !== "hero" && inputField("sub", t("manage.blocks.field.sub"), t("manage.blocks.field.optional"), false, false, block.type === "faq" ? t("manage.blocks.faq.subHelp") : undefined)}
                {block.type === "faq" && <div className="event-manage-field"><FieldLabel label={t("manage.blocks.faq.openItem")} help={t("manage.blocks.faq.openItemHelp")} /><EventSelect ariaLabel={t("manage.blocks.faq.openItemAria")} value={block.openItem === undefined ? "none" : String(block.openItem)} options={[{value: "none", label: t("manage.blocks.faq.openNone")}, ...(block.items ?? []).map((_, position) => ({value: String(position), label: t("manage.blocks.faq.question", {n: position + 1})}))]} disabled={!canEdit} onValueChange={value => onUpdate({...block, openItem: value === "none" ? undefined : Number(value)})} /></div>}
                {(block.items ?? []).map((item, itemIndex) => <div className={`event-content-editor__item${block.type === "faq" ? " event-content-editor__item--faq" : block.type === "timeline" ? " event-content-editor__item--timeline" : ""}`} key={itemIndex}>
                    {block.type === "faq" && <div className="event-content-editor__item-head"><strong>{t("manage.blocks.faq.question", {n: itemIndex + 1})}</strong>{canEdit && <button className="event-content-editor__item-delete" type="button" aria-label={t("manage.blocks.faq.deleteAria", {n: itemIndex + 1})} onClick={() => removeItem(itemIndex)}><Trash2 size={15} /></button>}</div>}
                    {block.type === "timeline" && <div className="event-content-editor__item-head"><strong>{t("manage.blocks.item.title", {n: itemIndex + 1})}</strong>{canEdit && <button type="button" aria-label={t("manage.blocks.item.deleteAria", {n: itemIndex + 1})} onClick={() => removeItem(itemIndex)}><X size={16} /></button>}</div>}
                    {block.type === "timeline" ? <><div className="event-content-editor__timeline-row">{timelineTimeField(item, itemIndex)}{inputField(`item:${itemIndex}:value`, t("manage.blocks.timeline.event"), "", false, true)}</div>{timelineFormatField(item, itemIndex)}</> : <>{inputField(`item:${itemIndex}:label`, block.type === "faq" ? t("manage.blocks.faq.questionLabel") : t("manage.blocks.field.label"), "", false, true)}{block.type === "faq" ? richField(`item:${itemIndex}:richText`, t("manage.blocks.faq.answer")) : inputField(`item:${itemIndex}:value`, t("manage.blocks.field.value"), "", false, true)}{canEdit && block.type !== "faq" && <button className="event-content-editor__rule-remove" type="button" aria-label={t("manage.blocks.item.deleteAria", {n: itemIndex + 1})} onClick={() => removeItem(itemIndex)}><X size={16} /></button>}</>}
                </div>)}
                {canEdit && (block.type !== "hero" || (block.items?.length ?? 0) < 4) && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate({...block, items: [...(block.items ?? []), block.type === "timeline" ? {dateSource: "event", dateVariable: "", dateFormat: "date-time", value: ""} : block.type === "faq" ? {label: "", richText: emptyRichText()} : {label: "", value: ""}]})}><Plus size={15} /> {block.type === "hero" ? t("manage.blocks.hero.addFact") : t("manage.blocks.item.add")}</button>}
            </>}
            {block.type === "doc" && <>
                {inputField("tocTitle", t("manage.blocks.doc.tocTitle"), t("manage.blocks.default.tocTitle"), false, false, t("manage.blocks.doc.tocTitleHelp"))}
                {inputField("sub", t("manage.blocks.field.sub"), t("manage.blocks.field.optional"))}
                {(block.items ?? []).map((item, itemIndex) => <div className="event-content-editor__item event-content-editor__item--faq" key={itemIndex}>
                    <div className="event-content-editor__item-head"><strong>{t("manage.blocks.doc.section", {n: itemIndex + 1})}</strong>{canEdit && <button className="event-content-editor__item-delete" type="button" aria-label={t("manage.blocks.doc.deleteAria", {n: itemIndex + 1})} onClick={() => removeItem(itemIndex)}><Trash2 size={15} /></button>}</div>
                    {inputField(`item:${itemIndex}:label`, t("manage.blocks.field.sectionTitle"), "", false, true)}
                    {richField(`item:${itemIndex}:richText`, t("manage.blocks.doc.sectionText"))}
                </div>)}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate({...block, items: [...(block.items ?? []), {label: "", richText: emptyRichText()}]})}><Plus size={15} /> {t("manage.blocks.doc.add")}</button>}
            </>}
            {block.type === "hero" && <>
                {countdownSource(true)}
                {(block.targetVariable || block.targetDate) && <>{countdownDisplay()}<div className="event-manage-field"><FieldLabel label={t("manage.blocks.countdown.size")} required help={t("manage.blocks.hero.sizeHelp")} /><EventSelect ariaLabel={t("manage.blocks.hero.sizeAria")} value={block.timerSize ?? "xl"} options={[{value: "large", label: t("manage.blocks.size.large")}, {value: "xl", label: t("manage.blocks.size.xl")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerSize: value})} /></div></>}
                {inputField("note", t("manage.blocks.hero.note"), t("manage.blocks.field.optional"))}
            </>}
            {["cta", "countdown"].includes(block.type) && inputField("text", t("manage.blocks.field.description"), t("manage.blocks.field.optional"), false, false, block.type === "cta" ? t("manage.blocks.cta.textHelp") : block.type === "countdown" ? t("manage.blocks.countdown.textHelp") : undefined)}
            {block.type === "cta" && <>
                {actionKind()}
                {inputField("action:label", t("manage.blocks.cta.buttonText"), t("manage.blocks.cta.buttonPlaceholder"), false, true)}
                {block.action?.kind !== "join_event" && inputField("action:href", t("manage.blocks.cta.buttonLink"), t("manage.blocks.cta.linkPlaceholder"), false, true)}
                {actionKind(true)}
                {inputField("secondaryAction:label", t("manage.blocks.cta.secondary"), t("manage.blocks.field.optional"), false, !!block.secondaryAction?.href || block.secondaryAction?.kind === "join_event")}
                {block.secondaryAction?.kind !== "join_event" && inputField("secondaryAction:href", t("manage.blocks.cta.secondaryLink"), "/rules", false, !!block.secondaryAction?.label)}
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.style.label")} required help={t("manage.blocks.cta.styleHelp")} /><EventSelect value={block.variant ?? "plain"} ariaLabel={t("manage.blocks.cta.styleAria")} options={[{value: "plain", label: t("manage.blocks.style.plain")}, {value: "mass", label: t("manage.blocks.style.branded")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {block.action?.label && actionPosition()}
            </>}
            {block.type === "countdown" && <>{countdownSource(false)}{countdownDisplay()}
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.layout.label")} required help={t("manage.blocks.countdown.layoutHelp")} /><EventSelect ariaLabel={t("manage.blocks.countdown.layoutAria")} value={block.variant ?? "split"} options={[{value: "split", label: t("manage.blocks.countdown.split")}, {value: "center", label: t("manage.blocks.layout.allCenter")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {block.variant !== "center" && (block.title || block.text) && <div className="event-manage-field"><FieldLabel label={t("manage.blocks.countdown.vertical")} required help={t("manage.blocks.countdown.verticalHelp")} /><EventSelect ariaLabel={t("manage.blocks.countdown.vertical")} value={block.verticalAlignment ?? "center"} options={[{value: "start", label: t("manage.blocks.align.top")}, {value: "center", label: t("manage.blocks.align.center")}, {value: "end", label: t("manage.blocks.align.bottom")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, verticalAlignment: value})} /></div>}
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.countdown.size")} required help={t("manage.blocks.countdown.sizeHelp")} /><EventSelect ariaLabel={t("manage.blocks.countdown.sizeAria")} value={block.timerSize ?? "large"} options={[{value: "large", label: t("manage.blocks.size.large")}, {value: "xl", label: t("manage.blocks.size.xl")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerSize: value})} /></div>
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.style.label")} required help={t("manage.blocks.countdown.surfaceHelp")} /><EventSelect ariaLabel={t("manage.blocks.countdown.surfaceAria")} value={block.surface ?? "plain"} options={[{value: "plain", label: t("manage.blocks.countdown.plain")}, {value: "frame", label: t("manage.blocks.countdown.frame")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, surface: value})} /></div>
                {showFromControls()}
            </>}
            {block.type === "partners" && <>
                {inputField("sub", t("manage.blocks.field.sub"), t("manage.blocks.field.optional"))}
                {inputField("text", t("manage.blocks.partners.about"), t("manage.blocks.field.optional"), true, false, t("manage.blocks.partners.aboutHelp"))}
                {(block.groups ?? []).map((group, groupIndex) => {
                    const updateGroup = (update: (current: typeof group) => typeof group) => onUpdate(current => ({...current, groups: (current.groups ?? []).map((entry, position) => position === groupIndex ? update(entry) : entry)}));
                    return <div className="event-content-editor__item event-content-editor__item--faq" key={groupIndex}>
                        <div className="event-content-editor__item-head"><strong>{t("manage.blocks.partners.group", {n: groupIndex + 1})}</strong>{canEdit && <button className="event-content-editor__item-delete" type="button" aria-label={t("manage.blocks.partners.deleteGroupAria", {n: groupIndex + 1})} onClick={() => onUpdate(current => ({...current, groups: (current.groups ?? []).filter((_, position) => position !== groupIndex)}))}><Trash2 size={15} /></button>}</div>
                        <div className="event-manage-field"><FieldLabel label={t("manage.blocks.partners.groupTitle")} help={t("manage.blocks.partners.groupTitleHelp")} /><input className="event-manage-input" aria-label={t("manage.blocks.partners.groupTitleAria", {n: groupIndex + 1})} value={group.title ?? ""} placeholder={t("manage.blocks.default.partnersTitle")} maxLength={120} disabled={!canEdit} onChange={event => updateGroup(current => ({...current, title: event.target.value}))} /></div>
                        {group.items.length > 0 && <ul className="event-partner-logos">{group.items.map((logo, logoIndex) => {
                            const updateLogo = (update: Partial<typeof logo>) => updateGroup(current => ({...current, items: current.items.map((entry, position) => position === logoIndex ? {...entry, ...update} : entry)}));
                            const preview = contentImageURL(logo.imageURL);
                            return <li className="event-partner-logo" key={logoIndex}>
                                <span className="event-partner-logo__preview">{preview ? <Image src={preview} alt="" width={96} height={32} unoptimized /> : <ImagePlus size={18} aria-hidden="true" />}</span>
                                <input className="event-manage-input" aria-label={t("manage.blocks.partners.nameAria", {n: logoIndex + 1, group: groupIndex + 1})} value={logo.name} placeholder={t("manage.blocks.partners.namePlaceholder")} maxLength={120} disabled={!canEdit} onChange={event => updateLogo({name: event.target.value})} />
                                <input className="event-manage-input" aria-label={t("manage.blocks.partners.linkAria", {n: logoIndex + 1, group: groupIndex + 1})} value={logo.href ?? ""} placeholder={t("manage.blocks.partners.linkPlaceholder")} disabled={!canEdit} onChange={event => updateLogo({href: event.target.value || undefined})} />
                                {canEdit && <button className="event-content-editor__rule-remove" type="button" aria-label={t("manage.blocks.partners.deleteLogoAria", {n: logoIndex + 1, group: groupIndex + 1})} onClick={() => updateGroup(current => ({...current, items: current.items.filter((_, position) => position !== logoIndex)}))}><X size={16} /></button>}
                            </li>;
                        })}</ul>}
                        {canEdit && group.items.length < 24 && <label className="event-brand-drop event-content-editor__upload"><ImagePlus size={20} /><span className="event-brand-drop__action"><strong>{logoUpload?.group === groupIndex && logoUpload.busy ? t("manage.blocks.upload.busy") : t("manage.blocks.partners.addLogo")}</strong><small>{t("manage.blocks.partners.logoHint")}</small></span><input type="file" accept="image/png,image/webp,image/jpeg,image/gif" disabled={logoUpload?.busy} onChange={event => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file) return;
                            if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
                                setLogoUpload({group: groupIndex, error: t("manage.blocks.partners.logoInvalid"), busy: false});
                                return;
                            }
                            setLogoUpload({group: groupIndex, error: "", busy: true});
                            void uploadManageBannerImage(eventID, file).then(imageURL => {
                                const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 120);
                                updateGroup(current => ({...current, items: [...current.items, {name, imageURL}]}));
                                setLogoUpload(null);
                            }, () => setLogoUpload({group: groupIndex, error: t("manage.blocks.partners.logoUploadFailed"), busy: false}));
                        }} /></label>}
                        {logoUpload?.group === groupIndex && logoUpload.error && <p className="event-manage-validation" role="alert">{logoUpload.error}</p>}
                    </div>;
                })}
                {errorField === "groups" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}
                {canEdit && (block.groups?.length ?? 0) < 10 && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate(current => ({...current, groups: [...(current.groups ?? []), {title: "", items: []}]}))}><Plus size={15} /> {t("manage.blocks.partners.addGroup")}</button>}
            </>}
            {block.type === "divider" && <div className="event-content-editor__item">
                <div className="event-manage-field"><FieldLabel label={t("manage.blocks.divider.spacing")} required help={t("manage.blocks.divider.spacingHelp")} /><EventSelect value={block.size ?? "md"} ariaLabel={t("manage.blocks.divider.spacingAria")} options={[{value: "sm", label: t("manage.blocks.size.small")}, {value: "md", label: t("manage.blocks.size.medium")}, {value: "lg", label: t("manage.blocks.size.large")}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, size: value})} /></div>
                <label className="event-manage-field"><FieldLabel label={t("manage.blocks.divider.line")} help={t("manage.blocks.divider.lineHelp")} /><input type="checkbox" checked={!!block.line} disabled={!canEdit} onChange={event => onUpdate({...block, line: event.target.checked})} /></label>
            </div>}
            <div className={`event-manage-field${anchorProblem || errorField === "anchor" ? " is-invalid" : ""}`}>
                <FieldLabel label={t("manage.blocks.anchor.label")} help={t("manage.blocks.anchor.help")} />
                <div className="event-anchor-field"><span aria-hidden="true">#</span><input className="event-manage-input" aria-label={t("manage.blocks.anchor.aria")} aria-invalid={!!anchorProblem} value={block.anchor ?? ""} placeholder={t("manage.blocks.anchor.placeholder")} maxLength={maxAnchorLength} disabled={!canEdit} onChange={event => onUpdate({...block, anchor: event.target.value.toLowerCase() || undefined})} />
                    {canEdit && <EventTooltip content={t("manage.blocks.anchor.fromHeadingTooltip")}>{id => <button className="ib-btn ib-btn--sm" type="button" aria-describedby={id} disabled={!anchorFromText(block.type === "section" ? block.label ?? "" : block.title ?? "")} onClick={() => onUpdate({...block, anchor: anchorFromText(block.type === "section" ? block.label ?? "" : block.title ?? "")})}><Wand2 size={15} /> {t("manage.blocks.anchor.fromHeading")}</button>}</EventTooltip>}</div>
                {(anchorProblem || errorField === "anchor") && <p className="event-content-editor__field-error" role="alert">{anchorProblem ?? errorMessage}</p>}
            </div>
            <div className="event-content-editor__tools"><FieldLabel label={t("manage.blocks.visibility.label")} help={t("manage.blocks.visibility.help")} /><button className="event-content-editor__rules-toggle" type="button" aria-expanded={rulesOpen} onClick={() => setRulesOpen(!rulesOpen)}>{block.visibility?.length ? t("manage.blocks.visibility.conditional", {count: block.visibility.length}) : t("manage.blocks.visibility.always")}</button></div>
            {rulesOpen && <div className="event-content-editor__rules">
                <p>{t("manage.blocks.visibility.note")}</p>
                {(block.visibility ?? []).map((rule, ruleIndex) => {
                    const definition = contentVariableByName.get(rule.variable);
                    const format = definition?.format ?? "text";
                    const operators = visibilityOperators(format);
                    return <div className="event-content-editor__rule" key={ruleIndex}>
                        <EventSelect ariaLabel={t("manage.blocks.rule.variable", {n: ruleIndex + 1})} value={rule.variable} disabled={!canEdit} options={[...(!definition ? [{value: rule.variable, label: rule.variable}] : []), ...catalog.map(variable => ({value: variable.name, label: variable.label}))]} onValueChange={value => {
                            const nextVariable = contentVariableByName.get(value);
                            if (nextVariable) setRule(ruleIndex, {variable: nextVariable.name, operator: visibilityOperators(nextVariable.format)[0].value, value: initialVisibilityValue(nextVariable.format)});
                        }} />
                        <EventSelect ariaLabel={t("manage.blocks.rule.operator", {n: ruleIndex + 1})} value={rule.operator} disabled={!canEdit} options={[...(!operators.some(option => option.value === rule.operator) ? [{value: rule.operator, label: rule.operator}] : []), ...operators]} onValueChange={value => setRule(ruleIndex, {...rule, operator: value})} />
                        {format === "boolean" ? <EventSelect ariaLabel={t("manage.blocks.rule.value", {n: ruleIndex + 1})} value={rule.value === true ? "true" : "false"} disabled={!canEdit} options={[{value: "true", label: t("common.yes")}, {value: "false", label: t("common.no")}]} onValueChange={value => setRule(ruleIndex, {...rule, value: value === "true"})} />
                            : format === "date-time" ? <EventDateTimePicker ariaLabel={t("manage.blocks.rule.dateTime", {n: ruleIndex + 1})} value={localDateTime(rule.value)} disabled={!canEdit} onChange={value => setRule(ruleIndex, {...rule, value: value ? new Date(value).toISOString() : ""})} />
                            : <input className="event-manage-input" aria-label={t("manage.blocks.rule.value", {n: ruleIndex + 1})} type={format === "number" ? "number" : "text"} value={String(rule.value ?? "")} disabled={!canEdit} onChange={(event: ChangeEvent<HTMLInputElement>) => setRule(ruleIndex, {...rule, value: format === "number" ? Number(event.target.value) : event.target.value})} />}
                        {canEdit && <button type="button" className="event-content-editor__rule-remove" aria-label={t("manage.blocks.rule.delete", {n: ruleIndex + 1})} onClick={() => onUpdate({...block, visibility: (block.visibility ?? []).filter((_, itemIndex) => itemIndex !== ruleIndex)})}><X size={16} /></button>}
                    </div>;
                })}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={addRule}><Plus size={15} /> {t("manage.blocks.rule.add")}</button>}
            </div>}
        </div>}
    </section>;
}
