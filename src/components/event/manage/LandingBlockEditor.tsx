"use client";

import {useEffect, useId, useRef, useState, type ChangeEvent} from "react";
import * as Popover from "@radix-ui/react-popover";
import {ArrowDown, ArrowUp, Braces, GripVertical, ImagePlus, Plus, Trash2, X} from "lucide-react";
import type {ContentBlock, ContentValue} from "@/types/eventContent";
import {initialVisibilityValue, insertableContentVariable, visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {blockPalette} from "./blockPalette";
import {uploadManageBannerImage} from "@/api/manage";
import {FieldLabel} from "./FieldLabel";
import {RichMarkdownField} from "./RichMarkdownField";
import {blockValidationField} from "./validatePageBlocks";
import {replaceVariables} from "@/components/event/content/ContentBlocks";
import {dateDisplayOptions, formatDateTime, validDatePattern} from "@/components/event/content/dateDisplay";
import {useEventLinkOptions} from "./useEventLinkOptions";
import {DateVariableFormatControls} from "./DateVariableFormatControls";

export {FieldLabel} from "./FieldLabel";

const textHelp: Record<string, string> = {
    label: "Заголовок відділяє наступний вміст на сторінці.",
    markdown: "Основний текст сторінки.\n• Підтримуються заголовки, списки, посилання, цитати й код.\n• HTML не підтримується.",
    title: "Назва блока.\n• У банері показується поверх зображення.\n• У герої стає головним заголовком сторінки.",
    sub: "Короткий опис під заголовком блока.",
    text: "Пояснення поруч із кнопкою або відліком.",
    by: "Рядок організатора над назвою події.",
    kicker: "Короткий надзаголовок перед назвою події.",
    note: "Дрібна примітка під діями героя.",
    tocTitle: "Підпис навігації за розділами.\n• На широкому екрані зміст стоїть праворуч від тексту.\n• На вузькому екрані переміщується над текстом.",
    "action:label": "Текст основної кнопки блока.",
    "action:href": "Куди веде основна кнопка.\n• Внутрішній шлях починається з /.\n• Зовнішнє посилання має починатися з https://.\n• У шлях можна вставити тег події.",
    "secondaryAction:label": "Текст додаткової кнопки.\nДля показу потрібне також її посилання.",
    "secondaryAction:href": "Куди веде додаткова кнопка.\n• Внутрішній шлях починається з /.\n• Зовнішнє посилання має починатися з https://.",
};

function localDateTime(value: ContentValue, seconds = false): string {
    if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) return "";
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, seconds ? 19 : 16);
}

function displayValue(value: ContentValue | undefined): string {
    if (value === undefined || value === null || value === "") return "Немає значення";
    if (typeof value === "boolean") return value ? "Так" : "Ні";
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

function EditorTextField({label, value, placeholder, multiline, compact, required, help, error, disabled, catalog, values, variableFormats, variableNames, hideLabel = false, suppressErrorText = false, errorTextId, onInsertVariable, onChangeValue}: {
    label: string; value: string; placeholder: string; multiline: boolean; compact: boolean; required: boolean; help?: string; disabled: boolean;
    error?: string;
    catalog: ContentVariableDefinition[]; values: Record<string, ContentValue>;
    variableFormats?: ContentVariableDefinition["format"][];
    variableNames?: string[];
    hideLabel?: boolean;
    suppressErrorText?: boolean;
    errorTextId?: string;
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
            <div id={id} ref={inputRef} role="textbox" aria-label={label} aria-multiline={multiline} aria-required={required} aria-readonly={disabled} aria-invalid={!!error} aria-describedby={error ? suppressErrorText ? errorTextId : `${id}-error` : undefined}
                className={`event-manage-input event-content-editor__badge-input${multiline ? compact ? " event-content-editor__textarea--compact" : " event-content-editor__textarea" : ""}${error ? " is-invalid" : ""}`}
                contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder}
                onInput={emit} onKeyUp={remember} onMouseUp={remember} onBlur={remember}
                onMouseDown={event => {const token = (event.target as HTMLElement).closest(".event-content-editor__variable-token"); if (!token || !inputRef.current?.contains(token)) return; event.preventDefault(); inputRef.current.focus(); const range = document.createRange(); range.selectNode(token); const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(range); selection.current = range.cloneRange();}}
                onKeyDown={event => {if (!multiline && event.key === "Enter") event.preventDefault();}}
                onPaste={event => {event.preventDefault(); const plain = event.clipboardData.getData("text/plain"); document.execCommand("insertText", false, multiline ? plain : plain.replace(/[\r\n]+/g, " ")); emit();}} />
            <Popover.Root open={variableOpen} onOpenChange={open => {setVariableOpen(open); if (!open) setVariableSearch("");}} modal={false}>
                <div className="event-content-editor__picker"><Popover.Trigger asChild><button className="event-content-editor__field-variable" type="button" aria-label={`Вставити змінну в поле «${label}»`} title="Вставити змінну" disabled={disabled} onMouseDown={remember}><Braces size={16} /></button></Popover.Trigger></div>
                <Popover.Portal><Popover.Content className="event-content-editor__variable-menu" side="bottom" align="end" sideOffset={7} collisionPadding={12} onCloseAutoFocus={event => event.preventDefault()}>
                    <div className="event-content-editor__variable-head"><strong>Змінні для поля «{label}»</strong><Popover.Close type="button" aria-label="Закрити список змінних"><X size={15} /></Popover.Close></div>
                    <input className="event-manage-input" value={variableSearch} onChange={event => setVariableSearch(event.target.value)} placeholder="Знайти змінну" aria-label="Знайти змінну" />
                    <div className="event-content-editor__variable-list">{filteredVariables.map(variable => <button key={variable.name} type="button" onClick={() => insert(variable)}><strong>{variable.label}</strong><code>{variable.name}</code><small>Зараз: {displayValue(values[variable.name])}</small></button>)}</div>
                </Popover.Content></Popover.Portal>
            </Popover.Root>
        </div>
        {error && !suppressErrorText && <p className="event-content-editor__field-error" id={`${id}-error`} role="alert">{error}</p>}
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
        <div className="event-manage-field"><FieldLabel label={label} required={required} help={help} /><EventSelect ariaLabel={`${label}: сторінка або своя адреса`} value={preset} options={[...options, {value: "custom", label: "Своя адреса"}]} disabled={disabled} onValueChange={next => onChangeValue(next === "custom" ? "" : next)} /></div>
        {preset === "custom" && <EditorTextField label={`Адреса для ${label.toLocaleLowerCase("uk")}`} value={value} placeholder={placeholder} multiline={false} compact={false} required={required} error={error} disabled={disabled} catalog={catalog} values={values} variableNames={["event.tag"]} hideLabel onInsertVariable={onInsertVariable} onChangeValue={onChangeValue} />}
        {preset !== "custom" && error && <p className="event-content-editor__field-error" role="alert">{error}</p>}
        {pagesError && <small className="event-content-editor__hint">Додаткові сторінки не завантажилися. Адресу можна ввести вручну.</small>}
    </div>;
}

export function LandingBlockEditor({eventID, coverImage, block, index, count, values, catalog, canEdit, selected = false, error, onSelect, onUpdate, onMove, onReorder, onDelete}: {
    eventID: string;
    coverImage: string;
    block: ContentBlock;
    index: number;
    count: number;
    values: Record<string, ContentValue>;
    catalog: ContentVariableDefinition[];
    canEdit: boolean;
    selected?: boolean;
    error?: string;
    onSelect: () => void;
    onUpdate: (value: ContentBlock | ((current: ContentBlock) => ContentBlock)) => void;
    onMove: (direction: -1 | 1) => void;
    onReorder: (sourceID: string, targetID: string) => void;
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
    const contentVariableByName = new Map(catalog.map(variable => [variable.name, variable]));
    const errorField = error ? blockValidationField(error, block) : null;
    const errorMessage = error?.replace(/^Блок \d+: /, "").replace(/^./, first => first.toLocaleUpperCase("uk"));

    function blockAt(clientX: number, clientY: number): HTMLElement | null {
        return document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-editor-block-id]") ?? null;
    }

    function clearDropTarget() {
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
        return block[field as "label" | "markdown" | "title" | "sub" | "text" | "by" | "kicker" | "note" | "tocTitle"] ?? "";
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
            const match = /^item:(\d+):(label|value)$/.exec(field);
            if (!match) return [[field, formats]];
            const position = Number(match[1]);
            if (position === itemIndex) return [];
            return [[`item:${position > itemIndex ? position - 1 : position}:${match[2]}`, formats]];
        }));
        onUpdate({...block, dateDisplays, items: (block.items ?? []).filter((_, position) => position !== itemIndex), openItem: block.openItem === undefined || block.openItem === itemIndex ? undefined : block.openItem > itemIndex ? block.openItem - 1 : block.openItem});
    }

    function inputField(field: string, label: string, placeholder = "", multiline = false, required = false, help?: string, compact = false) {
        const itemPart = field.startsWith("item:") ? field.split(":")[2] : "";
        const itemHelp = itemPart === "label"
            ? block.type === "timeline" ? "Час або дата цього етапу.\nПоказується перед назвою події." : block.type === "faq" ? "Питання, яке учасник бачить у списку." : block.type === "doc" ? "Назва розділу.\nПоказується в тексті та у змісті." : "Короткий підпис поруч зі значенням."
            : block.type === "timeline" ? "Назва події в розкладі.\nПоказується поруч із часом.\nДату й час вибирайте в окремому полі «Час»." : block.type === "faq" ? "Відповідь, яка відкривається під питанням.\nПідтримує Markdown." : "Значення цього пункту.\nДля фактів і героя може містити змінні події.";
        if (field === "action:href" || field === "secondaryAction:href") return <EditorLinkField eventID={eventID} label={label} value={fieldValue(field)} placeholder={placeholder} required={required} help={help ?? textHelp[field]} error={errorField === field ? errorMessage : undefined} disabled={!canEdit} catalog={catalog} values={values}
            onInsertVariable={(variable, next) => onUpdate(changeField(field, next, withBinding(block, variable)))} onChangeValue={value => onUpdate(changeField(field, value))} />;
        return <><EditorTextField label={label} value={fieldValue(field)} placeholder={placeholder}
            multiline={multiline} compact={compact} required={required} help={help ?? (itemPart ? itemHelp : textHelp[field])} error={errorField === field ? errorMessage : undefined} suppressErrorText={!!itemPart && block.type !== "faq" && block.type !== "timeline"} errorTextId={itemPart ? `item-${block.id}-${field.split(":")[1]}-error` : undefined} disabled={!canEdit} catalog={catalog} values={values}
            variableFormats={block.type === "timeline" && itemPart === "value" ? ["text", "number", "boolean"] : undefined}
            onInsertVariable={(variable, next) => onUpdate(changeField(field, next, withBinding(block, variable)))}
            onChangeValue={value => onUpdate(changeField(field, value))} />
            <DateVariableFormatControls field={field} value={fieldValue(field)} block={block} catalog={catalog} values={values} disabled={!canEdit} onUpdate={onUpdate} /></>;
    }

    function richField(field: string, label: string) {
        return <><RichMarkdownField eventID={eventID} label={label} value={fieldValue(field)} error={errorField === field ? errorMessage : undefined} disabled={!canEdit} catalog={catalog} values={values}
            onChange={value => onUpdate(changeField(field, value))}
            onInsertVariable={(variable, value) => onUpdate(changeField(field, value, withBinding(block, variable)))} />
            <DateVariableFormatControls field={field} value={fieldValue(field)} block={block} catalog={catalog} values={values} disabled={!canEdit} onUpdate={onUpdate} /></>;
    }

    async function uploadBanner(file: File | undefined) {
        if (!file) return;
        setImageError("");
        if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
            setImageError("Оберіть PNG, JPEG або WebP до 5 МБ.");
            return;
        }
        setUploadingImage(true);
        try {
            const imageURL = await uploadManageBannerImage(eventID, file);
            onUpdate(current => ({...current, imageSource: "custom", imageURL}));
        } catch {
            setImageError("Не вдалося прикріпити зображення. Спробуйте ще раз.");
        } finally { setUploadingImage(false); }
    }

    function actionPosition() {
        return <div className="event-manage-field"><FieldLabel label="Розташування кнопок" required help="Положення кнопок у блоці.\n• Ліворуч — поруч із текстом або біля лівого краю відліку.\n• По центру — посередині секції.\n• Праворуч — біля правого краю.\nНа вузьких екранах кнопки можуть переноситися." /><EventSelect ariaLabel="Розташування кнопок" value={block.actionAlignment ?? "end"} options={[{value: "start", label: "Ліворуч"}, {value: "center", label: "По центру"}, {value: "end", label: "Праворуч"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, actionAlignment: value})} /></div>;
    }

    function countdownSource(optional: boolean) {
        const source = block.dateSource ?? (block.targetDate ? "custom" : block.targetVariable ? "event" : optional ? "none" : "event");
        return <>
            <div className="event-manage-field"><FieldLabel label="Джерело дати відліку" required={!optional} help="Оберіть, до якого моменту рахувати час.\n• За розкладом — дата оновлюється разом із налаштуваннями події.\n• Своя дата й час — фіксований момент, незалежний від розкладу." /><EventSelect ariaLabel="Джерело дати відліку" value={source} options={[...(optional ? [{value: "none", label: "Без відліку"}] : []), {value: "event", label: "За розкладом події"}, {value: "custom", label: "Своя дата й час"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, dateSource: value, targetVariable: value === "event" ? block.targetVariable : "", targetDate: value === "custom" ? block.targetDate : ""})} /></div>
            {source === "event" && <div className={`event-manage-field${errorField === "targetVariable" ? " is-invalid" : ""}`}><FieldLabel label="Дата з розкладу" required help="Оберіть момент із розділу «Публікація і час».\nВідлік оновиться, якщо цей момент у розкладі зміниться." /><EventSelect value={block.targetVariable ?? ""} ariaLabel="Дата з розкладу для відліку" placeholder="Оберіть дату" options={catalog.filter(item => item.format === "date-time").map(item => ({value: item.name, label: item.label}))} disabled={!canEdit} onValueChange={value => {const variable = contentVariableByName.get(value); onUpdate(variable ? {...withBinding(block, variable), targetVariable: variable.name, targetDate: ""} : {...block, targetVariable: ""});}} />{errorField === "targetVariable" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
            {source === "custom" && <div className={`event-manage-field${errorField === "targetDate" ? " is-invalid" : ""}`}><FieldLabel label="Своя дата й час" required help="Вкажіть фіксовані дату й час.\nЧас вводиться у вашому місцевому часовому поясі та зберігається як точний момент." /><EventDateTimePicker ariaLabel="Своя дата й час відліку" value={localDateTime(block.targetDate ?? "", true)} showSeconds disabled={!canEdit} onChange={value => onUpdate({...block, targetVariable: "", targetDate: value ? new Date(value).toISOString() : ""})} />{errorField === "targetDate" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
        </>;
    }

    function countdownDisplay() {
        return <div className="event-manage-field"><FieldLabel label="Вигляд лічильника" required help="Оберіть спосіб показу часу до вибраної дати.\n• Числа з підписами — дні, години, хвилини й секунди окремо.\n• Компактний — один рядок із часом.\n• Плитки — кожна частина часу в окремій комірці." /><EventSelect ariaLabel="Вигляд лічильника" value={block.timerDisplay ?? "segments"} options={[{value: "segments", label: "Числа з підписами"}, {value: "compact", label: "Компактний рядок"}, {value: "tiles", label: "Числа в плитках"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerDisplay: value as NonNullable<ContentBlock["timerDisplay"]>})} /></div>;
    }

    function timelineTimeField(item: NonNullable<ContentBlock["items"]>[number], itemIndex: number) {
        const source = item.dateSource === "custom" ? "custom" : item.dateVariable ?? "";
        const fieldPrefix = "item:" + itemIndex + ":";
        const updateItem = (update: Partial<typeof item>, base = block) => ({...base, items: (base.items ?? []).map((entry, position) => position === itemIndex ? {...entry, ...update} : entry)});
        return <div className="event-content-editor__time-settings">
            <div className={"event-manage-field" + (errorField === fieldPrefix + "dateVariable" ? " is-invalid" : "")}>
                <FieldLabel label="Час" required help="Оберіть дату й час із розкладу події або вкажіть власний момент.\nДата з розкладу оновлюється разом із подією." />
                <EventSelect ariaLabel={"Час етапу " + (itemIndex + 1)} value={source} placeholder="Оберіть дату й час" options={[...catalog.filter(variable => variable.format === "date-time").map(variable => ({value: variable.name, label: variable.label})), {value: "custom", label: "Своя дата й час"}]} disabled={!canEdit} onValueChange={next => {
                    const variable = contentVariableByName.get(next);
                    const base = variable ? withBinding(block, variable) : block;
                    onUpdate(updateItem(next === "custom" ? {dateSource: "custom", dateVariable: "", dateValue: ""} : {dateSource: "event", dateVariable: next, dateValue: ""}, base));
                }} />
                {errorField === fieldPrefix + "dateVariable" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}
            </div>
            {item.dateSource === "custom" && <div className={"event-manage-field" + (errorField === fieldPrefix + "dateValue" ? " is-invalid" : "")}>
                <FieldLabel label="Своя дата й час" required help="Фіксовані дата й час для цього пункту розкладу.\nВкажіть дату перед зміною часу." />
                <EventDateTimePicker ariaLabel={"Своя дата й час етапу " + (itemIndex + 1)} value={localDateTime(item.dateValue ?? "", true)} showSeconds disabled={!canEdit} onChange={value => onUpdate(updateItem({dateValue: value ? new Date(value).toISOString() : ""}))} />
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
            <div className="event-manage-field"><FieldLabel label="Формат часу" required help="Виберіть вигляд дати та часу в цьому пункті.\nСвій формат використовує: dd — день, MM — місяць, yyyy — рік, HH — години, mm — хвилини, ss — секунди." /><EventSelect ariaLabel={"Формат часу етапу " + (itemIndex + 1)} value={format} options={[...dateDisplayOptions]} disabled={!canEdit} onValueChange={value => onUpdate(updateItem({dateFormat: value as typeof format}))} /></div>
            {format === "custom" && <div className={"event-manage-field" + (errorField === `item:${itemIndex}:datePattern` ? " is-invalid" : "")}><FieldLabel label="Свій формат" required help="Приклад: dd.MM.yyyy HH:mm:ss.\nТекст у квадратних дужках показується без змін, наприклад [о] HH:mm." /><input className={"event-manage-input" + (errorField === `item:${itemIndex}:datePattern` ? " is-invalid" : "")} aria-label={"Свій формат часу етапу " + (itemIndex + 1)} value={item.datePattern ?? ""} placeholder="dd.MM.yyyy HH:mm:ss" disabled={!canEdit} onChange={event => onUpdate(updateItem({datePattern: event.target.value}))} />{errorField === `item:${itemIndex}:datePattern` && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>}
            {example && <small className="event-content-editor__hint">На сторінці: {example}</small>}
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
    const rawSummary = block.type === "section" ? block.label : block.title || (block.type === "text" ? block.markdown : "");
    const summaryField = block.type === "section" ? "label" : block.type === "text" && !block.title ? "markdown" : "title";
    const blockSummary = replaceVariables(rawSummary ?? "", values, new Map((block.variables ?? []).map(variable => [variable.name, variable.format])), false, block.dateDisplays?.[summaryField]);
    return <section className={`event-content-editor__block${selected ? " is-selected" : ""}${error ? " is-invalid" : ""}`} data-editor-block-id={block.id} aria-label={`${blockLabel} ${index + 1}`} aria-describedby={selected && error && !errorField ? `block-error-${block.id}` : undefined} tabIndex={0} onClick={event => {if (!(event.target as Element).closest(".event-content-editor__block-actions")) onSelect();}} onFocusCapture={event => {if (!(event.target as Element).closest(".event-content-editor__block-actions")) onSelect();}} onKeyDown={event => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); onSelect();}}}>
        <div className="event-content-editor__block-head">
            <div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{blockLabel}</strong>{blockSummary && <span className="event-content-editor__block-summary">{blockSummary}</span>}</div>
            {canEdit && <div className="event-content-editor__block-actions">
                <EventTooltip content="Перетягніть блок: у списку одразу звільниться нове місце. Для клавіатури скористайтеся стрілками.">{id => <button type="button" className="event-content-editor__drag" aria-label={`Перетягнути блок ${index + 1}`} aria-describedby={id} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={clearDropTarget} onPointerCancel={clearDropTarget}><GripVertical size={16} /></button>}</EventTooltip>
                <EventTooltip content="Перемістити вище">{id => <button type="button" aria-label={`Перемістити блок ${index + 1} вище`} aria-describedby={id} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>}</EventTooltip>
                <EventTooltip content="Перемістити нижче">{id => <button type="button" aria-label={`Перемістити блок ${index + 1} нижче`} aria-describedby={id} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></button>}</EventTooltip>
                <EventTooltip content="Видалити блок">{id => <button type="button" className="event-content-editor__danger" aria-label={`Видалити блок ${index + 1}`} aria-describedby={id} onClick={onDelete}><Trash2 size={16} /></button>}</EventTooltip>
            </div>}
        </div>
        {error && selected && !errorField && <p className="event-content-editor__block-error" id={`block-error-${block.id}`} role="alert">{errorMessage}</p>}
        {selected && <div className="event-content-editor__block-body">
            {block.type === "section" && inputField("label", "Заголовок розділу", "Назва розділу", false, true)}
            {block.type === "section" && <div className="event-manage-field"><FieldLabel label="Вирівнювання заголовка" required help="Вирівнює текст заголовка в межах секції: ліворуч, по центру, праворуч або по ширині." /><EventSelect ariaLabel="Вирівнювання заголовка" value={block.variant ?? "left"} options={[{value: "left", label: "Ліворуч"}, {value: "center", label: "По центру"}, {value: "right", label: "Праворуч"}, {value: "justify", label: "По ширині"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {block.type === "text" && richField("markdown", "Вміст")}
            {block.type === "text" && <div className="event-manage-field"><FieldLabel label="Ширина тексту" required help="Визначає максимальну ширину вмісту.\n• Для читання — коротші рядки, зручні для довгого тексту.\n• На всю ширину — для таблиць і широкого вмісту." /><EventSelect ariaLabel="Ширина тексту" value={block.variant ?? "narrow"} options={[{value: "narrow", label: "Для читання"}, {value: "wide", label: "На всю ширину"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {["hero", "banner", "facts", "timeline", "doc", "faq", "cta", "countdown"].includes(block.type) && inputField("title", block.type === "hero" ? "Назва" : block.type === "banner" ? "Підпис поверх фото" : "Заголовок", block.type === "banner" ? "Необов’язково" : "Назва блока", false, block.type === "hero" || block.type === "cta")}
            {block.type === "banner" && <>
                <div className={`event-manage-field${errorField === "imageSource" ? " is-invalid" : ""}`}><FieldLabel label="Зображення банера" required help="Джерело зображення для цього блока.\n• Обкладинка події — повторно використовує файл із розділу «Загальне».\n• Окреме зображення — власний файл лише для цього банера.\nЗміна банера не змінює обкладинку події." /><EventSelect ariaLabel="Джерело зображення банера" value={block.imageSource ?? "preview"} options={[{value: "preview", label: coverImage ? "Обкладинка події" : "Обкладинка події (не завантажена)", disabled: !coverImage}, {value: "custom", label: "Окреме зображення"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, imageSource: value})} />{errorField === "imageSource" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}</div>
                {block.imageSource === "custom" && <div className={`event-manage-field${errorField === "imageURL" ? " is-invalid" : ""}`}><FieldLabel label="Окреме зображення" required help="PNG, JPEG або WebP до 5 МБ. Перетягніть файл у поле або виберіть з пристрою. Зображення показується лише в цьому банері." /><label className={`event-brand-drop event-content-editor__upload${imageDragOver ? " is-over" : ""}`} onDragOver={event => {event.preventDefault(); setImageDragOver(true);}} onDragLeave={() => setImageDragOver(false)} onDrop={event => {event.preventDefault(); setImageDragOver(false); if (canEdit && !uploadingImage) void uploadBanner(event.dataTransfer.files[0]);}}><ImagePlus size={22} /><span className="event-brand-drop__action"><strong>{uploadingImage ? "Завантажуємо…" : block.imageURL ? "Замінити зображення" : "Прикріпити зображення"}</strong><small>або перетягніть сюди</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={!canEdit || uploadingImage} onChange={event => void uploadBanner(event.target.files?.[0])} /></label>{block.imageURL && <p className="event-content-editor__hint">Окреме зображення прикріплено.</p>}{errorField === "imageURL" && <p className="event-content-editor__field-error" role="alert">{errorMessage}</p>}{imageError && <p className="event-manage-validation" role="alert">{imageError}</p>}</div>}
                <div className="event-manage-field"><FieldLabel label="Поля навколо банера" required help="Як банер стоїть у секції.\n• Без полів — банер доходить до країв секції.\n• У рамці — банер має відступи та заокруглені кути.\nФактичну ширину задає повзунок нижче." /><EventSelect ariaLabel="Поля навколо банера" value={block.variant ?? "frame"} options={[{value: "edge", label: "Без полів"}, {value: "frame", label: "У рамці сторінки"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {block.title && <div className="event-manage-field"><FieldLabel label="Розташування підпису" required help="Вирівнює підпис поверх фото.\nОберіть сторону, де підпис не закриває важливу частину зображення." /><EventSelect ariaLabel="Розташування підпису банера" value={block.layout ?? "left"} options={[{value: "left", label: "Ліворуч"}, {value: "center", label: "По центру"}, {value: "right", label: "Праворуч"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, layout: value})} /></div>}
                <label className="event-manage-field"><FieldLabel label="Ширина банера" required help="Частка ширини сторінки. Висота зображення змінюється пропорційно його власним розмірам. На вузьких екранах банер займає всю доступну ширину." /><span className="event-content-editor__range"><input type="range" min="50" max="100" step="5" value={block.widthPercent ?? 100} disabled={!canEdit} aria-label="Ширина банера у відсотках" onChange={event => onUpdate({...block, widthPercent: Number(event.target.value)})} /><output>{block.widthPercent ?? 100}%</output></span></label>
            </>}
            {block.type === "hero" && <>
                <div className="event-manage-field"><FieldLabel label="Оформлення" required help="Брендове використовує основний колір події; звичайне — фон сторінки." /><EventSelect ariaLabel="Оформлення героя" value={block.variant ?? "mass"} options={[{value: "mass", label: "Брендове"}, {value: "plain", label: "Звичайне"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                <div className="event-manage-field"><FieldLabel label="Композиція" required help="Розташування фактів, відліку й дій.\n• Дві зони — на широкому екрані факти ліворуч, відлік праворуч. На вузькому екрані вони йдуть один під одним.\n• По центру — увесь вміст вирівняний по центральній осі." /><EventSelect ariaLabel="Композиція героя" value={block.layout ?? "split"} options={[{value: "split", label: "Дві зони"}, {value: "center", label: "Усе по центру"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, layout: value})} /></div>
                {inputField("by", "Рядок організатора", "Подія CyberICEBox")}
                {inputField("kicker", "Надзаголовок", "Необов’язково")}
            </>}
            {block.type === "facts" && <div className="event-manage-field"><FieldLabel label="Розкладка" required help="Як розташувати підписи та значення.\n• Смуга — факти у кількох колонках, значення більші.\n• Рядки — підпис ліворуч, значення праворуч. На вузькому екрані вони стають один під одним." /><EventSelect ariaLabel="Розкладка фактів" value={block.variant ?? "strip"} options={[{value: "strip", label: "Смуга"}, {value: "rows", label: "Рядки"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {block.type === "timeline" && <div className="event-manage-field"><FieldLabel label="Розкладка" required help="Як показати етапи розкладу.\n• Картки в ряд — етапи розміщуються поруч, доки вистачає місця.\n• Вертикальний список — кожен етап на окремому рядку." /><EventSelect ariaLabel="Розкладка розкладу" value={block.variant ?? "grid"} options={[{value: "grid", label: "Картки в ряд"}, {value: "list", label: "Вертикальний список"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {["hero", "facts", "timeline", "faq"].includes(block.type) && <>
                {block.type !== "hero" && inputField("sub", "Пояснення", "Необов’язково")}
                {block.type === "faq" && <div className="event-manage-field"><FieldLabel label="Відкрите питання" help="Яка відповідь видима під час першого відкриття сторінки.\nУчасник може сам відкривати й закривати інші питання." /><EventSelect ariaLabel="Питання, відкрите спочатку" value={block.openItem === undefined ? "none" : String(block.openItem)} options={[{value: "none", label: "Жодне"}, ...(block.items ?? []).map((_, position) => ({value: String(position), label: `Питання ${position + 1}`}))]} disabled={!canEdit} onValueChange={value => onUpdate({...block, openItem: value === "none" ? undefined : Number(value)})} /></div>}
                {(block.items ?? []).map((item, itemIndex) => <div className={`event-content-editor__item${block.type === "faq" ? " event-content-editor__item--faq" : block.type === "timeline" ? " event-content-editor__item--timeline" : ""}`} key={itemIndex}>
                    {block.type === "faq" && <div className="event-content-editor__item-head"><strong>Питання {itemIndex + 1}</strong>{canEdit && <button type="button" aria-label={`Видалити питання ${itemIndex + 1}`} onClick={() => removeItem(itemIndex)}><Trash2 size={15} /></button>}</div>}
                    {block.type === "timeline" && <div className="event-content-editor__item-head"><strong>Пункт {itemIndex + 1}</strong>{canEdit && <button type="button" aria-label={`Видалити пункт ${itemIndex + 1}`} onClick={() => removeItem(itemIndex)}><X size={16} /></button>}</div>}
                    {block.type === "timeline" ? <><div className="event-content-editor__timeline-row">{timelineTimeField(item, itemIndex)}{inputField(`item:${itemIndex}:value`, "Подія", "", false, true)}</div>{timelineFormatField(item, itemIndex)}</> : <>{inputField(`item:${itemIndex}:label`, block.type === "faq" ? "Питання" : "Підпис", "", false, true)}{block.type === "faq" ? richField(`item:${itemIndex}:value`, "Відповідь") : inputField(`item:${itemIndex}:value`, "Значення", "", false, true)}{canEdit && block.type !== "faq" && <button className="event-content-editor__rule-remove" type="button" aria-label={`Видалити пункт ${itemIndex + 1}`} onClick={() => removeItem(itemIndex)}><X size={16} /></button>}</>}
                    {block.type !== "faq" && block.type !== "timeline" && errorField?.startsWith(`item:${itemIndex}:`) && <p className="event-content-editor__field-error event-content-editor__item-error" id={`item-${block.id}-${itemIndex}-error`} role="alert">{errorMessage}</p>}
                </div>)}
                {canEdit && (block.type !== "hero" || (block.items?.length ?? 0) < 4) && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate({...block, items: [...(block.items ?? []), block.type === "timeline" ? {dateSource: "event", dateVariable: "", dateFormat: "date-time", value: ""} : {label: "", value: ""}]})}><Plus size={15} /> {block.type === "hero" ? "Додати факт" : "Додати пункт"}</button>}
            </>}
            {block.type === "doc" && <>
                {inputField("tocTitle", "Назва змісту", "Зміст", false, false, "Підпис переліку розділів праворуч від тексту.")}
                {inputField("sub", "Пояснення", "Необов’язково")}
                {(block.items ?? []).map((item, itemIndex) => <div className="event-content-editor__item event-content-editor__item--faq" key={itemIndex}>
                    <div className="event-content-editor__item-head"><strong>Розділ {itemIndex + 1}</strong>{canEdit && <button type="button" aria-label={`Видалити розділ ${itemIndex + 1}`} onClick={() => removeItem(itemIndex)}><Trash2 size={15} /></button>}</div>
                    {inputField(`item:${itemIndex}:label`, "Назва розділу", "", false, true)}
                    {richField(`item:${itemIndex}:value`, "Текст розділу")}
                </div>)}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate({...block, items: [...(block.items ?? []), {label: "", value: ""}]})}><Plus size={15} /> Додати розділ</button>}
            </>}
            {block.type === "hero" && <>
                {countdownSource(true)}
                {(block.targetVariable || block.targetDate) && <>{countdownDisplay()}<div className="event-manage-field"><FieldLabel label="Розмір відліку" required help="Розмір чисел у відліку.\n• Великий — помітний поруч з іншим вмістом.\n• Дуже великий — головний акцент секції." /><EventSelect ariaLabel="Розмір відліку героя" value={block.timerSize ?? "xl"} options={[{value: "large", label: "Великий"}, {value: "xl", label: "Дуже великий"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerSize: value})} /></div></>}
                {inputField("action:label", "Головна дія", "Текст кнопки")}
                {inputField("action:href", "Посилання головної дії", "/challenges")}
                {inputField("secondaryAction:label", "Друга дія", "Необов’язково")}
                {inputField("secondaryAction:href", "Посилання другої дії", "/rules")}
                {((block.action?.label && block.action?.href) || (block.secondaryAction?.label && block.secondaryAction?.href)) && actionPosition()}
                {inputField("note", "Примітка", "Необов’язково")}
            </>}
            {["cta", "countdown"].includes(block.type) && inputField("text", "Опис", "Необов’язково")}
            {block.type === "cta" && <>
                {inputField("action:label", "Текст кнопки", "Перейти", false, true)}
                {inputField("action:href", "Посилання кнопки", "/rules або https://…", false, true)}
                {inputField("secondaryAction:label", "Друга дія", "Необов’язково")}
                {inputField("secondaryAction:href", "Посилання другої дії", "/rules")}
                <div className="event-manage-field"><FieldLabel label="Оформлення" required help="Звичайне використовує фон сторінки, брендове — колір події." /><EventSelect value={block.variant ?? "plain"} ariaLabel="Оформлення блока" options={[{value: "plain", label: "Звичайне"}, {value: "mass", label: "Брендове"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {(block.action?.label && block.action?.href) && actionPosition()}
            </>}
            {block.type === "countdown" && <>{countdownSource(false)}{countdownDisplay()}
                <div className="event-manage-field"><FieldLabel label="Розкладка" required help="Розмістити пояснення ліворуч від відліку або всю секцію по центру." /><EventSelect ariaLabel="Розкладка відліку" value={block.variant ?? "split"} options={[{value: "split", label: "Текст ліворуч, відлік праворуч"}, {value: "center", label: "Усе по центру"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {block.variant !== "center" && (block.title || block.text) && <div className="event-manage-field"><FieldLabel label="Положення тексту за висотою" required help="Розміщення лівої частини відносно відліку й кнопки праворуч.\n• Зверху — біля верхнього краю.\n• По центру — посередині.\n• Знизу — біля нижнього краю.\nНа вузькому екрані частини стають одна під одною." /><EventSelect ariaLabel="Положення тексту за висотою" value={block.verticalAlignment ?? "center"} options={[{value: "start", label: "Зверху"}, {value: "center", label: "По центру"}, {value: "end", label: "Знизу"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, verticalAlignment: value})} /></div>}
                <div className="event-manage-field"><FieldLabel label="Розмір відліку" required help="Великий підходить для звичайної секції, дуже великий сильніше виділяє числа." /><EventSelect ariaLabel="Розмір окремого відліку" value={block.timerSize ?? "large"} options={[{value: "large", label: "Великий"}, {value: "xl", label: "Дуже великий"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerSize: value})} /></div>
                <div className="event-manage-field"><FieldLabel label="Оформлення" required help="Без рамки — секція йде безперервно зі сторінкою. У рамці — відлік виділений усередині секції, як у попередньому вигляді головної сторінки." /><EventSelect ariaLabel="Оформлення окремого відліку" value={block.surface ?? "plain"} options={[{value: "plain", label: "Без рамки"}, {value: "frame", label: "У рамці"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, surface: value})} /></div>
                {inputField("action:label", "Кнопка під відліком", "Необов’язково")}
                {inputField("action:href", "Посилання кнопки", "/challenges")}
                {(block.action?.label && block.action?.href) && actionPosition()}
            </>}
            {block.type === "divider" && <div className="event-content-editor__item">
                <div className="event-manage-field"><FieldLabel label="Відступ" required help="За замовчуванням блоки йдуть без проміжків. Додайте роздільник між ними, щоб задати малий, середній або великий відступ." /><EventSelect value={block.size ?? "md"} ariaLabel="Відступ роздільника" options={[{value: "sm", label: "Малий"}, {value: "md", label: "Середній"}, {value: "lg", label: "Великий"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, size: value})} /></div>
                <label className="event-manage-field"><FieldLabel label="Лінія" help="Показати тонкий роздільник посередині відступу." /><input type="checkbox" checked={!!block.line} disabled={!canEdit} onChange={event => onUpdate({...block, line: event.target.checked})} /></label>
            </div>}
            <div className="event-content-editor__tools"><FieldLabel label="Показ блока" help="Коли блок видно на сторінці.\n• Завжди — без додаткових умов.\n• За умовами — показується лише за вибраних значень події.\nЯкщо умов кілька, виконатися мають усі." /><button className="event-content-editor__rules-toggle" type="button" aria-expanded={rulesOpen} onClick={() => setRulesOpen(!rulesOpen)}>{block.visibility?.length ? `За умовами: ${block.visibility.length}` : "Завжди"}</button></div>
            {rulesOpen && <div className="event-content-editor__rules">
                <p>Блок з’явиться, лише коли виконуються всі умови.</p>
                {(block.visibility ?? []).map((rule, ruleIndex) => {
                    const definition = contentVariableByName.get(rule.variable);
                    const format = definition?.format ?? "text";
                    const operators = visibilityOperators(format);
                    return <div className="event-content-editor__rule" key={ruleIndex}>
                        <EventSelect ariaLabel={`Змінна умови ${ruleIndex + 1}`} value={rule.variable} disabled={!canEdit} options={[...(!definition ? [{value: rule.variable, label: rule.variable}] : []), ...catalog.map(variable => ({value: variable.name, label: variable.label}))]} onValueChange={value => {
                            const nextVariable = contentVariableByName.get(value);
                            if (nextVariable) setRule(ruleIndex, {variable: nextVariable.name, operator: visibilityOperators(nextVariable.format)[0].value, value: initialVisibilityValue(nextVariable.format)});
                        }} />
                        <EventSelect ariaLabel={`Порівняння умови ${ruleIndex + 1}`} value={rule.operator} disabled={!canEdit} options={[...(!operators.some(option => option.value === rule.operator) ? [{value: rule.operator, label: rule.operator}] : []), ...operators]} onValueChange={value => setRule(ruleIndex, {...rule, operator: value})} />
                        {format === "boolean" ? <EventSelect ariaLabel={`Значення умови ${ruleIndex + 1}`} value={rule.value === true ? "true" : "false"} disabled={!canEdit} options={[{value: "true", label: "Так"}, {value: "false", label: "Ні"}]} onValueChange={value => setRule(ruleIndex, {...rule, value: value === "true"})} />
                            : format === "date-time" ? <EventDateTimePicker ariaLabel={`Дата й час умови ${ruleIndex + 1}`} value={localDateTime(rule.value)} disabled={!canEdit} onChange={value => setRule(ruleIndex, {...rule, value: value ? new Date(value).toISOString() : ""})} />
                            : <input className="event-manage-input" aria-label={`Значення умови ${ruleIndex + 1}`} type={format === "number" ? "number" : "text"} value={String(rule.value ?? "")} disabled={!canEdit} onChange={(event: ChangeEvent<HTMLInputElement>) => setRule(ruleIndex, {...rule, value: format === "number" ? Number(event.target.value) : event.target.value})} />}
                        {canEdit && <button type="button" className="event-content-editor__rule-remove" aria-label={`Видалити умову ${ruleIndex + 1}`} onClick={() => onUpdate({...block, visibility: (block.visibility ?? []).filter((_, itemIndex) => itemIndex !== ruleIndex)})}><X size={16} /></button>}
                    </div>;
                })}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={addRule}><Plus size={15} /> Додати умову</button>}
            </div>}
        </div>}
    </section>;
}
