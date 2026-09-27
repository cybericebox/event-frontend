"use client";

import {useId, useRef, useState, type ChangeEvent} from "react";
import {ArrowDown, ArrowUp, Braces, GripVertical, ImagePlus, Plus, Trash2, X} from "lucide-react";
import type {ContentBlock, ContentValue} from "@/types/eventContent";
import {initialVisibilityValue, visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {blockPalette} from "./blockPalette";
import {uploadManageBannerImage} from "@/api/manage";
import {FieldLabel} from "./FieldLabel";
import {RichMarkdownField} from "./RichMarkdownField";

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
    "action:href": "Куди веде основна кнопка.\n• Внутрішній шлях починається з /.\n• Зовнішнє посилання має починатися з https://.\n• У шлях можна вставити змінну.",
    "secondaryAction:label": "Текст додаткової кнопки.\nДля показу потрібне також її посилання.",
    "secondaryAction:href": "Куди веде додаткова кнопка.\n• Внутрішній шлях починається з /.\n• Зовнішнє посилання має починатися з https://.",
};

function localDateTime(value: ContentValue): string {
    if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) return "";
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
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

type EditableInput = HTMLInputElement | HTMLTextAreaElement;

function EditorTextField({label, value, placeholder, multiline, compact, required, help, disabled, catalog, values, onInsertVariable, onChangeValue}: {
    label: string; value: string; placeholder: string; multiline: boolean; compact: boolean; required: boolean; help?: string; disabled: boolean;
    catalog: ContentVariableDefinition[]; values: Record<string, ContentValue>;
    onInsertVariable: (variable: ContentVariableDefinition, next: string) => void;
    onChangeValue: (value: string) => void;
}) {
    const id = useId();
    const inputRef = useRef<EditableInput | null>(null);
    const selection = useRef({start: value.length, end: value.length});
    const [variableOpen, setVariableOpen] = useState(false);
    const [variableSearch, setVariableSearch] = useState("");
    const filteredVariables = catalog.filter(variable => `${variable.label} ${variable.name}`.toLocaleLowerCase("uk").includes(variableSearch.toLocaleLowerCase("uk")));
    function remember(input: EditableInput) {
        selection.current = {start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length};
    }
    function insert(variable: ContentVariableDefinition) {
        const {start, end} = selection.current;
        const token = `{{${variable.name}}}`;
        const next = value.slice(0, Math.min(start, value.length)) + token + value.slice(Math.min(end, value.length));
        onInsertVariable(variable, next);
        setVariableOpen(false);
        setVariableSearch("");
        requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(start + token.length, start + token.length);
            selection.current = {start: start + token.length, end: start + token.length};
        });
    }
    const common = {
        id,
        "aria-label": label,
        className: `event-manage-input${multiline ? compact ? " event-content-editor__textarea--compact" : " event-content-editor__textarea" : ""}`,
        value, disabled, placeholder, required,
        onSelect: (event: React.SyntheticEvent<EditableInput>) => remember(event.currentTarget),
        onClick: (event: React.MouseEvent<EditableInput>) => remember(event.currentTarget),
        onKeyUp: (event: React.KeyboardEvent<EditableInput>) => remember(event.currentTarget),
        onChange: (event: React.ChangeEvent<EditableInput>) => {
            remember(event.target);
            onChangeValue(event.target.value);
        },
    };
    return <div className="event-manage-field">
        <FieldLabel label={label} required={required} help={help} />
        <div className={`event-content-editor__field-control${multiline ? " event-content-editor__field-control--multiline" : ""}`}>
            {multiline ? <textarea {...common} ref={node => {inputRef.current = node;}} rows={compact ? 3 : 7} /> : <input {...common} ref={node => {inputRef.current = node;}} />}
            <div className="event-content-editor__picker">
                <button className="event-content-editor__field-variable" type="button" aria-label={`Вставити змінну в поле «${label}»`} title="Вставити змінну" aria-expanded={variableOpen} disabled={disabled} onClick={() => {if (inputRef.current) remember(inputRef.current); setVariableOpen(!variableOpen);}}><Braces size={16} /></button>
                {variableOpen && <div className="event-content-editor__variable-menu">
                    <div className="event-content-editor__variable-head"><strong>Змінні для поля «{label}»</strong><button type="button" aria-label="Закрити список змінних" onClick={() => setVariableOpen(false)}><X size={15} /></button></div>
                    <input className="event-manage-input" value={variableSearch} onChange={event => setVariableSearch(event.target.value)} placeholder="Знайти змінну" aria-label="Знайти змінну" autoFocus />
                    <div className="event-content-editor__variable-list">{filteredVariables.map(variable => <button key={variable.name} type="button" onClick={() => insert(variable)}><strong>{variable.label}</strong><code>{variable.name}</code><small>Зараз: {displayValue(values[variable.name])}</small></button>)}</div>
                </div>}
            </div>
        </div>
    </div>;
}

export function LandingBlockEditor({eventID, coverImage, block, index, count, values, catalog, canEdit, selected = false, onSelect, onUpdate, onMove, onReorder, onDelete}: {
    eventID: string;
    coverImage: string;
    block: ContentBlock;
    index: number;
    count: number;
    values: Record<string, ContentValue>;
    catalog: ContentVariableDefinition[];
    canEdit: boolean;
    selected?: boolean;
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

    function inputField(field: string, label: string, placeholder = "", multiline = false, required = false, help?: string, compact = false) {
        const itemPart = field.startsWith("item:") ? field.split(":")[2] : "";
        const itemHelp = itemPart === "label"
            ? block.type === "timeline" ? "Час або дата цього етапу.\nПоказується перед назвою події." : block.type === "faq" ? "Питання, яке учасник бачить у списку." : block.type === "doc" ? "Назва розділу.\nПоказується в тексті та у змісті." : "Короткий підпис поруч зі значенням."
            : block.type === "timeline" ? "Назва події в розкладі.\nПоказується поруч із часом." : block.type === "faq" ? "Відповідь, яка відкривається під питанням.\nПідтримує Markdown." : "Значення цього пункту.\nДля фактів і героя може містити змінні події.";
        return <EditorTextField label={label} value={fieldValue(field)} placeholder={placeholder}
            multiline={multiline} compact={compact} required={required} help={help ?? (itemPart ? itemHelp : textHelp[field])} disabled={!canEdit} catalog={catalog} values={values}
            onInsertVariable={(variable, next) => onUpdate(changeField(field, next, withBinding(block, variable)))}
            onChangeValue={value => onUpdate(changeField(field, value))} />;
    }

    function richField(field: string, label: string) {
        return <RichMarkdownField label={label} value={fieldValue(field)} disabled={!canEdit} catalog={catalog} values={values}
            onChange={value => onUpdate(changeField(field, value))}
            onInsertVariable={(variable, value) => onUpdate(changeField(field, value, withBinding(block, variable)))} />;
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
            {source === "event" && <div className="event-manage-field"><FieldLabel label="Дата з розкладу" required help="Оберіть момент із розділу «Публікація і час».\nВідлік оновиться, якщо цей момент у розкладі зміниться." /><EventSelect value={block.targetVariable ?? ""} ariaLabel="Дата з розкладу для відліку" placeholder="Оберіть дату" options={catalog.filter(item => item.format === "date-time").map(item => ({value: item.name, label: item.label}))} disabled={!canEdit} onValueChange={value => {const variable = contentVariableByName.get(value); onUpdate(variable ? {...withBinding(block, variable), targetVariable: variable.name, targetDate: ""} : {...block, targetVariable: ""});}} /></div>}
            {source === "custom" && <div className="event-manage-field"><FieldLabel label="Своя дата й час" required help="Вкажіть фіксовані дату й час.\nЧас вводиться у вашому місцевому часовому поясі та зберігається як точний момент." /><EventDateTimePicker ariaLabel="Своя дата й час відліку" value={localDateTime(block.targetDate ?? "")} disabled={!canEdit} onChange={value => onUpdate({...block, targetVariable: "", targetDate: value ? new Date(value).toISOString() : ""})} /></div>}
        </>;
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
    const blockSummary = block.type === "section" ? block.label : block.title || (block.type === "text" ? block.markdown : "");
    return <section className={`event-content-editor__block${selected ? " is-selected" : ""}`} data-editor-block-id={block.id} aria-label={`${blockLabel} ${index + 1}`} tabIndex={0} onClick={event => {if (!(event.target as Element).closest(".event-content-editor__block-actions")) onSelect();}} onFocusCapture={event => {if (!(event.target as Element).closest(".event-content-editor__block-actions")) onSelect();}} onKeyDown={event => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); onSelect();}}}>
        <div className="event-content-editor__block-head">
            <div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{blockLabel}</strong>{blockSummary && <span className="event-content-editor__block-summary">{blockSummary}</span>}</div>
            {canEdit && <div className="event-content-editor__block-actions">
                <EventTooltip content="Перетягніть блок: у списку одразу звільниться нове місце. Для клавіатури скористайтеся стрілками.">{id => <button type="button" className="event-content-editor__drag" aria-label={`Перетягнути блок ${index + 1}`} aria-describedby={id} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={clearDropTarget} onPointerCancel={clearDropTarget}><GripVertical size={16} /></button>}</EventTooltip>
                <EventTooltip content="Перемістити вище">{id => <button type="button" aria-label={`Перемістити блок ${index + 1} вище`} aria-describedby={id} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>}</EventTooltip>
                <EventTooltip content="Перемістити нижче">{id => <button type="button" aria-label={`Перемістити блок ${index + 1} нижче`} aria-describedby={id} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></button>}</EventTooltip>
                <EventTooltip content="Видалити блок">{id => <button type="button" className="event-content-editor__danger" aria-label={`Видалити блок ${index + 1}`} aria-describedby={id} onClick={onDelete}><Trash2 size={16} /></button>}</EventTooltip>
            </div>}
        </div>
        {selected && <div className="event-content-editor__block-body">
            {block.type === "section" && inputField("label", "Заголовок розділу", "Назва розділу", false, true)}
            {block.type === "section" && <div className="event-manage-field"><FieldLabel label="Вирівнювання заголовка" required help="Вирівнює текст заголовка в межах секції: ліворуч, по центру, праворуч або по ширині." /><EventSelect ariaLabel="Вирівнювання заголовка" value={block.variant ?? "left"} options={[{value: "left", label: "Ліворуч"}, {value: "center", label: "По центру"}, {value: "right", label: "Праворуч"}, {value: "justify", label: "По ширині"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {block.type === "text" && richField("markdown", "Вміст")}
            {block.type === "text" && <div className="event-manage-field"><FieldLabel label="Ширина тексту" required help="Для читання обмежує довжину рядка. На всю ширину підходить для таблиць та широкого вмісту." /><EventSelect ariaLabel="Ширина тексту" value={block.variant ?? "narrow"} options={[{value: "narrow", label: "Для читання"}, {value: "wide", label: "На всю ширину"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {block.type === "text" && <div className="event-manage-field"><FieldLabel label="Вирівнювання тексту" required help="Вирівнює весь вміст цього блока.\n• Ліворуч, по центру або праворуч — відносно секції.\n• По ширині — розтягує рядки між обома краями." /><EventSelect ariaLabel="Вирівнювання тексту" value={block.layout ?? "left"} options={[{value: "left", label: "Ліворуч"}, {value: "center", label: "По центру"}, {value: "right", label: "Праворуч"}, {value: "justify", label: "По ширині"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, layout: value})} /></div>}
            {["hero", "banner", "facts", "timeline", "doc", "faq", "cta", "countdown"].includes(block.type) && inputField("title", block.type === "hero" ? "Назва" : block.type === "banner" ? "Підпис поверх фото" : "Заголовок", block.type === "banner" ? "Необов’язково" : "Назва блока", false, block.type === "hero" || block.type === "cta")}
            {block.type === "banner" && <>
                <div className="event-manage-field"><FieldLabel label="Зображення банера" required help="Джерело зображення для цього блока.\n• Обкладинка події — повторно використовує файл із розділу «Загальне».\n• Окреме зображення — власний файл лише для цього банера.\nЗміна банера не змінює обкладинку події." /><EventSelect ariaLabel="Джерело зображення банера" value={block.imageSource ?? "preview"} options={[{value: "preview", label: coverImage ? "Обкладинка події" : "Обкладинка події (не завантажена)", disabled: !coverImage}, {value: "custom", label: "Окреме зображення"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, imageSource: value})} /></div>
                {block.imageSource === "custom" && <div className="event-manage-field"><FieldLabel label="Окреме зображення" required help="PNG, JPEG або WebP до 5 МБ. Перетягніть файл у поле або виберіть з пристрою. Зображення показується лише в цьому банері." /><label className={`event-brand-drop event-content-editor__upload${imageDragOver ? " is-over" : ""}`} onDragOver={event => {event.preventDefault(); setImageDragOver(true);}} onDragLeave={() => setImageDragOver(false)} onDrop={event => {event.preventDefault(); setImageDragOver(false); if (canEdit && !uploadingImage) void uploadBanner(event.dataTransfer.files[0]);}}><ImagePlus size={22} /><span className="event-brand-drop__action"><strong>{uploadingImage ? "Завантажуємо…" : block.imageURL ? "Замінити зображення" : "Прикріпити зображення"}</strong><small>або перетягніть сюди</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={!canEdit || uploadingImage} onChange={event => void uploadBanner(event.target.files?.[0])} /></label>{block.imageURL && <p className="event-content-editor__hint">Окреме зображення прикріплено.</p>}{imageError && <p className="event-manage-validation" role="alert">{imageError}</p>}</div>}
                <div className="event-manage-field"><FieldLabel label="Поля навколо банера" required help="Як банер стоїть у секції.\n• Без полів — банер доходить до країв секції.\n• У рамці — банер має відступи та заокруглені кути.\nФактичну ширину задає повзунок нижче." /><EventSelect ariaLabel="Поля навколо банера" value={block.variant ?? "frame"} options={[{value: "edge", label: "Без полів"}, {value: "frame", label: "У рамці сторінки"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {block.title && <div className="event-manage-field"><FieldLabel label="Розташування підпису" required help="Вирівнює підпис поверх фото.\nОберіть сторону, де підпис не закриває важливу частину зображення." /><EventSelect ariaLabel="Розташування підпису банера" value={block.layout ?? "left"} options={[{value: "left", label: "Ліворуч"}, {value: "center", label: "По центру"}, {value: "right", label: "Праворуч"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, layout: value})} /></div>}
                <label className="event-manage-field"><FieldLabel label="Ширина банера" required help="Частка ширини сторінки. Висота зображення змінюється пропорційно його власним розмірам. На вузьких екранах банер займає всю доступну ширину." /><span className="event-content-editor__range"><input type="range" min="50" max="100" step="5" value={block.widthPercent ?? 100} disabled={!canEdit} aria-label="Ширина банера у відсотках" onChange={event => onUpdate({...block, widthPercent: Number(event.target.value)})} /><output>{block.widthPercent ?? 100}%</output></span></label>
            </>}
            {block.type === "hero" && <>
                <div className="event-manage-field"><FieldLabel label="Оформлення" required help="Брендове використовує основний колір події; звичайне — фон сторінки." /><EventSelect ariaLabel="Оформлення героя" value={block.variant ?? "mass"} options={[{value: "mass", label: "Брендове"}, {value: "plain", label: "Звичайне"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                <div className="event-manage-field"><FieldLabel label="Композиція" required help="Розташування фактів, відліку й дій.\n• Дві зони — на широкому екрані факти ліворуч, відлік праворуч. На вузькому екрані вони йдуть один під одним.\n• По центру — увесь вміст вирівняний по центральній осі." /><EventSelect ariaLabel="Композиція героя" value={block.layout ?? "split"} options={[{value: "split", label: "Дві зони"}, {value: "center", label: "Усе по центру"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, layout: value})} /></div>
                {(block.targetVariable || block.targetDate) && <div className="event-manage-field"><FieldLabel label="Розмір відліку" required help="Розмір чисел у відліку.\n• Великий — помітний поруч з іншим вмістом.\n• Дуже великий — головний акцент секції." /><EventSelect ariaLabel="Розмір відліку героя" value={block.timerSize ?? "xl"} options={[{value: "large", label: "Великий"}, {value: "xl", label: "Дуже великий"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerSize: value})} /></div>}
                {inputField("by", "Рядок організатора", "Подія CyberICEBox")}
                {inputField("kicker", "Надзаголовок", "Необов’язково")}
            </>}
            {block.type === "facts" && <div className="event-manage-field"><FieldLabel label="Розкладка" required help="Як розташувати підписи та значення.\n• Смуга — факти у кількох колонках, значення більші.\n• Рядки — підпис ліворуч, значення праворуч. На вузькому екрані вони стають один під одним." /><EventSelect ariaLabel="Розкладка фактів" value={block.variant ?? "strip"} options={[{value: "strip", label: "Смуга"}, {value: "rows", label: "Рядки"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {block.type === "timeline" && <div className="event-manage-field"><FieldLabel label="Розкладка" required help="Як показати етапи розкладу.\n• Картки в ряд — етапи розміщуються поруч, доки вистачає місця.\n• Вертикальний список — кожен етап на окремому рядку." /><EventSelect ariaLabel="Розкладка розкладу" value={block.variant ?? "grid"} options={[{value: "grid", label: "Картки в ряд"}, {value: "list", label: "Вертикальний список"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>}
            {["hero", "facts", "timeline", "faq"].includes(block.type) && <>
                {block.type !== "hero" && inputField("sub", "Пояснення", "Необов’язково")}
                {block.type === "faq" && <div className="event-manage-field"><FieldLabel label="Відкрите питання" help="Яка відповідь видима під час першого відкриття сторінки.\nУчасник може сам відкривати й закривати інші питання." /><EventSelect ariaLabel="Питання, відкрите спочатку" value={block.openItem === undefined ? "none" : String(block.openItem)} options={[{value: "none", label: "Жодне"}, ...(block.items ?? []).map((_, position) => ({value: String(position), label: `Питання ${position + 1}`}))]} disabled={!canEdit} onValueChange={value => onUpdate({...block, openItem: value === "none" ? undefined : Number(value)})} /></div>}
                {(block.items ?? []).map((item, itemIndex) => <div className={`event-content-editor__item${block.type === "faq" ? " event-content-editor__item--faq" : ""}`} key={itemIndex}>
                    {block.type === "faq" && <div className="event-content-editor__item-head"><strong>Питання {itemIndex + 1}</strong>{canEdit && <button type="button" aria-label={`Видалити питання ${itemIndex + 1}`} onClick={() => onUpdate({...block, items: (block.items ?? []).filter((_, position) => position !== itemIndex), openItem: block.openItem === undefined || block.openItem === itemIndex ? undefined : block.openItem > itemIndex ? block.openItem - 1 : block.openItem})}><Trash2 size={15} /></button>}</div>}
                    {inputField(`item:${itemIndex}:label`, block.type === "timeline" ? "Час" : block.type === "faq" ? "Питання" : "Підпис", "", false, true)}
                    {block.type === "faq" ? richField(`item:${itemIndex}:value`, "Відповідь") : inputField(`item:${itemIndex}:value`, block.type === "timeline" ? "Подія" : "Значення", "", false, true)}
                    {canEdit && block.type !== "faq" && <button className="event-content-editor__rule-remove" type="button" aria-label={`Видалити пункт ${itemIndex + 1}`} onClick={() => onUpdate({...block, items: (block.items ?? []).filter((_, position) => position !== itemIndex)})}><X size={16} /></button>}
                </div>)}
                {canEdit && (block.type !== "hero" || (block.items?.length ?? 0) < 4) && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate({...block, items: [...(block.items ?? []), {label: "", value: ""}]})}><Plus size={15} /> {block.type === "hero" ? "Додати факт" : "Додати пункт"}</button>}
            </>}
            {block.type === "doc" && <>
                {inputField("tocTitle", "Назва змісту", "Зміст", false, false, "Підпис переліку розділів праворуч від тексту.")}
                {inputField("sub", "Пояснення", "Необов’язково")}
                {(block.items ?? []).map((item, itemIndex) => <div className="event-content-editor__item event-content-editor__item--faq" key={itemIndex}>
                    <div className="event-content-editor__item-head"><strong>Розділ {itemIndex + 1}</strong>{canEdit && <button type="button" aria-label={`Видалити розділ ${itemIndex + 1}`} onClick={() => onUpdate({...block, items: (block.items ?? []).filter((_, position) => position !== itemIndex)})}><Trash2 size={15} /></button>}</div>
                    {inputField(`item:${itemIndex}:label`, "Назва розділу", "", false, true)}
                    {richField(`item:${itemIndex}:value`, "Текст розділу")}
                </div>)}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate({...block, items: [...(block.items ?? []), {label: "", value: ""}]})}><Plus size={15} /> Додати розділ</button>}
            </>}
            {block.type === "hero" && <>
                {countdownSource(true)}
                {inputField("action:label", "Головна дія", "Текст кнопки")}
                {inputField("action:href", "Посилання головної дії", "/challenges")}
                {inputField("secondaryAction:label", "Друга дія", "Необов’язково")}
                {inputField("secondaryAction:href", "Посилання другої дії", "/p/rules")}
                {((block.action?.label && block.action?.href) || (block.secondaryAction?.label && block.secondaryAction?.href)) && actionPosition()}
                {inputField("note", "Примітка", "Необов’язково")}
            </>}
            {["cta", "countdown"].includes(block.type) && inputField("text", "Опис", "Необов’язково")}
            {block.type === "cta" && <>
                {inputField("action:label", "Текст кнопки", "Перейти", false, true)}
                {inputField("action:href", "Посилання кнопки", "/p/rules або https://…", false, true)}
                {inputField("secondaryAction:label", "Друга дія", "Необов’язково")}
                {inputField("secondaryAction:href", "Посилання другої дії", "/p/rules")}
                <div className="event-manage-field"><FieldLabel label="Оформлення" required help="Звичайне використовує фон сторінки, брендове — колір події." /><EventSelect value={block.variant ?? "plain"} ariaLabel="Оформлення блока" options={[{value: "plain", label: "Звичайне"}, {value: "mass", label: "Брендове"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {actionPosition()}
            </>}
            {block.type === "countdown" && <>{countdownSource(false)}
                <div className="event-manage-field"><FieldLabel label="Розкладка" required help="Розмістити пояснення ліворуч від відліку або всю секцію по центру." /><EventSelect ariaLabel="Розкладка відліку" value={block.variant ?? "split"} options={[{value: "split", label: "Текст ліворуч, відлік праворуч"}, {value: "center", label: "Усе по центру"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                <div className="event-manage-field"><FieldLabel label="Розмір відліку" required help="Великий підходить для звичайної секції, дуже великий сильніше виділяє числа." /><EventSelect ariaLabel="Розмір окремого відліку" value={block.timerSize ?? "large"} options={[{value: "large", label: "Великий"}, {value: "xl", label: "Дуже великий"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, timerSize: value})} /></div>
                <div className="event-manage-field"><FieldLabel label="Оформлення" required help="Без рамки — секція йде безперервно зі сторінкою. У рамці — відлік виділений усередині секції, як у попередньому вигляді головної сторінки." /><EventSelect ariaLabel="Оформлення окремого відліку" value={block.surface ?? "plain"} options={[{value: "plain", label: "Без рамки"}, {value: "frame", label: "У рамці"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, surface: value})} /></div>
                {inputField("action:label", "Кнопка під відліком", "Необов’язково")}
                {inputField("action:href", "Посилання кнопки", "/challenges")}
                {actionPosition()}
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
