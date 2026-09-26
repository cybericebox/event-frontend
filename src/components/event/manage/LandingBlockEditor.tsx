"use client";

import {useRef, useState, type ChangeEvent} from "react";
import {ArrowDown, ArrowUp, Braces, CircleHelp, Plus, Trash2, X} from "lucide-react";
import type {ContentBlock, ContentValue} from "@/types/eventContent";
import {initialVisibilityValue, visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {blockPalette} from "./blockPalette";

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

function FieldLabel({label, required = false, help}: {label: string; required?: boolean; help?: string}) {
    return <span className="event-content-editor__field-label">{label}{required && <span className="event-content-editor__required" aria-label="Обов’язкове поле">*</span>}{help && <EventTooltip content={help}>{id => <button className="event-content-editor__help" type="button" aria-label={`Пояснення: ${label}`} aria-describedby={id} onClick={event => event.preventDefault()}><CircleHelp size={14} aria-hidden="true" /></button>}</EventTooltip>}</span>;
}

function EditorTextField({field, label, value, placeholder, multiline, compact, required, help, disabled, onActivate, onRemember, onChangeValue}: {
    field: string; label: string; value: string; placeholder: string; multiline: boolean; compact: boolean; required: boolean; help?: string; disabled: boolean;
    onActivate: (field: string, input: EditableInput) => void;
    onRemember: (input: EditableInput) => void;
    onChangeValue: (value: string) => void;
}) {
    const common = {
        className: `event-manage-input${multiline ? compact ? " event-content-editor__textarea--compact" : " event-content-editor__textarea" : ""}`,
        value, disabled, placeholder, required,
        onFocus: (event: React.FocusEvent<EditableInput>) => onActivate(field, event.currentTarget),
        onSelect: (event: React.SyntheticEvent<EditableInput>) => onRemember(event.currentTarget),
        onClick: (event: React.MouseEvent<EditableInput>) => onRemember(event.currentTarget),
        onKeyUp: (event: React.KeyboardEvent<EditableInput>) => onRemember(event.currentTarget),
        onChange: (event: React.ChangeEvent<EditableInput>) => onChangeValue(event.target.value),
    };
    return <label className="event-manage-field"><FieldLabel label={label} required={required} help={help} />{multiline ? <textarea {...common} rows={compact ? 3 : 7} /> : <input {...common} />}</label>;
}

export function LandingBlockEditor({block, index, count, values, catalog, canEdit, landing = false, heroFirst = false, onUpdate, onMove, onDelete}: {
    block: ContentBlock;
    index: number;
    count: number;
    values: Record<string, ContentValue>;
    catalog: ContentVariableDefinition[];
    canEdit: boolean;
    landing?: boolean;
    heroFirst?: boolean;
    onUpdate: (value: ContentBlock) => void;
    onMove: (direction: -1 | 1) => void;
    onDelete: () => void;
}) {
    const [variableOpen, setVariableOpen] = useState(false);
    const [variableSearch, setVariableSearch] = useState("");
    const [rulesOpen, setRulesOpen] = useState(!!block.visibility?.length);
    const textRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const selection = useRef({start: 0, end: 0});
    const activeField = useRef(block.type === "section" ? "label" : block.type === "text" ? "markdown" : "title");
    const contentVariableByName = new Map(catalog.map(variable => [variable.name, variable]));
    const filteredVariables = catalog.filter(variable => `${variable.label} ${variable.name}`.toLocaleLowerCase("uk").includes(variableSearch.toLocaleLowerCase("uk")));

    function rememberSelection(input: HTMLInputElement | HTMLTextAreaElement) {
        selection.current = {start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length};
    }

    function activateField(field: string, input: HTMLInputElement | HTMLTextAreaElement) {
        activeField.current = field;
        textRef.current = input;
        rememberSelection(input);
    }

    function fieldValue(field: string): string {
        if (field.startsWith("item:")) {
            const [, index, key] = field.split(":");
            return block.items?.[Number(index)]?.[key as "label" | "value"] ?? "";
        }
        if (field === "action:label") return block.action?.label ?? "";
        if (field === "secondaryAction:label") return block.secondaryAction?.label ?? "";
        return block[field as "label" | "markdown" | "title" | "sub" | "text" | "by" | "kicker" | "note" | "tocTitle"] ?? "";
    }

    function changeField(field: string, value: string, base = block): ContentBlock {
        if (field.startsWith("item:")) {
            const [, index, key] = field.split(":");
            return {...base, items: (base.items ?? []).map((item, position) => position === Number(index) ? {...item, [key]: value} : item)};
        }
        if (field === "action:label") {
            const action = {...(base.action ?? {href: ""}), label: value};
            return {...base, action: block.type === "hero" && !action.label && !action.href ? undefined : action};
        }
        if (field === "secondaryAction:label") {
            const secondaryAction = {...(base.secondaryAction ?? {href: ""}), label: value};
            return {...base, secondaryAction: !secondaryAction.label && !secondaryAction.href ? undefined : secondaryAction};
        }
        return {...base, [field]: value};
    }

    function inputField(field: string, label: string, placeholder = "", multiline = false, required = false, help?: string, compact = false) {
        return <EditorTextField field={field} label={label} value={fieldValue(field)} placeholder={placeholder}
            multiline={multiline} compact={compact} required={required} help={help} disabled={!canEdit} onActivate={activateField} onRemember={rememberSelection}
            onChangeValue={value => onUpdate(changeField(field, value))} />;
    }

    function insertVariable(variable: ContentVariableDefinition) {
        if (!canEdit) return;
        const {start, end} = selection.current;
        const token = `{{${variable.name}}}`;
        const field = activeField.current;
        const text = fieldValue(field);
        const next = text.slice(0, Math.min(start, text.length)) + token + text.slice(Math.min(end, text.length));
        onUpdate(changeField(field, next, withBinding(block, variable)));
        setVariableOpen(false);
        setVariableSearch("");
        requestAnimationFrame(() => {
            textRef.current?.focus();
            textRef.current?.setSelectionRange(start + token.length, start + token.length);
            selection.current = {start: start + token.length, end: start + token.length};
        });
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
    return <section className="event-content-editor__block" aria-label={`${blockLabel} ${index + 1}`}>
        <div className="event-content-editor__block-head">
            <div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{blockLabel}</strong></div>
            {canEdit && <div className="event-content-editor__block-actions">
                <EventTooltip content="Перемістити вище">{id => <button type="button" aria-label={`Перемістити блок ${index + 1} вище`} aria-describedby={id} disabled={index === 0 || (heroFirst && index === 1)} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>}</EventTooltip>
                <EventTooltip content="Перемістити нижче">{id => <button type="button" aria-label={`Перемістити блок ${index + 1} нижче`} aria-describedby={id} disabled={index === count - 1 || (heroFirst && index === 0)} onClick={() => onMove(1)}><ArrowDown size={16} /></button>}</EventTooltip>
                <EventTooltip content="Видалити блок">{id => <button type="button" className="event-content-editor__danger" aria-label={`Видалити блок ${index + 1}`} aria-describedby={id} onClick={onDelete}><Trash2 size={16} /></button>}</EventTooltip>
            </div>}
        </div>
        <div className="event-content-editor__block-body">
            {block.type === "section" && inputField("label", "Заголовок розділу", "Назва розділу", false, true)}
            {block.type === "text" && inputField("markdown", "Вміст (Markdown)", "Напишіть текст сторінки…", true, true, "Підтримуються заголовки, списки, посилання, цитати й код. HTML не підтримується.")}
            {["hero", "facts", "timeline", "doc", "faq", "cta", "countdown"].includes(block.type) && inputField("title", block.type === "hero" ? "Назва" : "Заголовок", "Назва блока", false, block.type === "hero" || block.type === "cta")}
            {block.type === "hero" && <>
                <div className="event-manage-field"><FieldLabel label="Оформлення" /><EventSelect ariaLabel="Оформлення героя" value={landing ? block.variant ?? "mass" : "plain"} options={landing ? [{value: "mass", label: "Брендове"}, {value: "plain", label: "Звичайне"}] : [{value: "plain", label: "Звичайне"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
                {inputField("by", "Рядок організатора", "Подія CyberICEBox")}
                {inputField("kicker", "Надзаголовок", "Необов’язково")}
            </>}
            {["hero", "facts", "timeline", "faq"].includes(block.type) && <>
                {block.type !== "hero" && inputField("sub", "Пояснення", "Необов’язково")}
                {(block.items ?? []).map((item, itemIndex) => <div className={`event-content-editor__item${block.type === "faq" ? " event-content-editor__item--faq" : ""}`} key={itemIndex}>
                    {block.type === "faq" && <div className="event-content-editor__item-head"><strong>Питання {itemIndex + 1}</strong>{canEdit && <button type="button" aria-label={`Видалити питання ${itemIndex + 1}`} onClick={() => onUpdate({...block, items: (block.items ?? []).filter((_, position) => position !== itemIndex)})}><Trash2 size={15} /></button>}</div>}
                    {inputField(`item:${itemIndex}:label`, block.type === "timeline" ? "Час" : block.type === "faq" ? "Питання" : "Підпис", "", false, true)}
                    {inputField(`item:${itemIndex}:value`, block.type === "timeline" ? "Подія" : block.type === "faq" ? "Відповідь" : "Значення", "", block.type === "faq", true, block.type === "faq" ? "Можна використовувати Markdown для списків і посилань." : undefined, block.type === "faq")}
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
                    {inputField(`item:${itemIndex}:value`, "Текст розділу", "Markdown", true, true, "Підтримуються списки, посилання й виділення. HTML не підтримується.", true)}
                </div>)}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={() => onUpdate({...block, items: [...(block.items ?? []), {label: "", value: ""}]})}><Plus size={15} /> Додати розділ</button>}
            </>}
            {block.type === "hero" && <>
                <div className="event-manage-field"><FieldLabel label="Відлік" help="Дата береться зі змінної події. Відлік можна вимкнути." /><EventSelect ariaLabel="Дата відліку героя" value={block.targetVariable ?? ""} placeholder="Без відліку" options={[{value: "", label: "Без відліку"}, ...catalog.filter(item => item.format === "date-time").map(item => ({value: item.name, label: item.label}))]} disabled={!canEdit} onValueChange={value => {const variable = contentVariableByName.get(value); onUpdate(variable ? {...withBinding(block, variable), targetVariable: variable.name} : {...block, targetVariable: ""});}} /></div>
                {inputField("action:label", "Головна дія", "Текст кнопки")}
                <label className="event-manage-field"><FieldLabel label="Посилання головної дії" help="Внутрішній шлях від / або повне посилання HTTPS." /><input className="event-manage-input" value={block.action?.href ?? ""} disabled={!canEdit} onChange={event => {const action = {...(block.action ?? {label: ""}), href: event.target.value}; onUpdate({...block, action: !action.label && !action.href ? undefined : action});}} placeholder="/challenges" /></label>
                {inputField("secondaryAction:label", "Друга дія", "Необов’язково")}
                <label className="event-manage-field"><FieldLabel label="Посилання другої дії" /><input className="event-manage-input" value={block.secondaryAction?.href ?? ""} disabled={!canEdit} onChange={event => {const secondaryAction = {...(block.secondaryAction ?? {label: ""}), href: event.target.value}; onUpdate({...block, secondaryAction: !secondaryAction.label && !secondaryAction.href ? undefined : secondaryAction});}} placeholder="/p/rules" /></label>
                {inputField("note", "Примітка", "Необов’язково")}
            </>}
            {["cta", "countdown"].includes(block.type) && inputField("text", "Опис", "Необов’язково")}
            {block.type === "cta" && <>
                {inputField("action:label", "Текст кнопки", "Перейти", false, true)}
                <label className="event-manage-field"><FieldLabel label="Посилання кнопки" required help="Внутрішній шлях від / або повне посилання HTTPS." /><input className="event-manage-input" value={block.action?.href ?? ""} required disabled={!canEdit} onChange={event => onUpdate({...block, action: {...(block.action ?? {label: ""}), href: event.target.value}})} placeholder="/p/rules або https://…" /></label>
                <div className="event-manage-field"><FieldLabel label="Оформлення" /><EventSelect value={block.variant ?? "plain"} ariaLabel="Оформлення блока" options={[{value: "plain", label: "Звичайне"}, {value: "mass", label: "Брендове"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, variant: value})} /></div>
            </>}
            {block.type === "countdown" && <div className="event-manage-field"><FieldLabel label="Дата, до якої рахувати" required help="Відлік може використовувати будь-яку дозволену цій сторінці змінну дати." /><EventSelect value={block.targetVariable ?? ""} ariaLabel="Дата зворотного відліку" placeholder="Оберіть змінну дати" options={catalog.filter(item => item.format === "date-time").map(item => ({value: item.name, label: item.label}))} disabled={!canEdit} onValueChange={value => {
                const variable = contentVariableByName.get(value);
                onUpdate(variable ? {...withBinding(block, variable), targetVariable: variable.name} : {...block, targetVariable: ""});
            }} /></div>}
            {block.type === "divider" && <div className="event-content-editor__item">
                <div className="event-manage-field"><FieldLabel label="Відступ" /><EventSelect value={block.size ?? "md"} ariaLabel="Відступ роздільника" options={[{value: "sm", label: "Малий"}, {value: "md", label: "Середній"}, {value: "lg", label: "Великий"}]} disabled={!canEdit} onValueChange={value => onUpdate({...block, size: value})} /></div>
                <label className="event-manage-field"><span>Лінія</span><input type="checkbox" checked={!!block.line} disabled={!canEdit} onChange={event => onUpdate({...block, line: event.target.checked})} /></label>
            </div>}
            <div className="event-content-editor__tools">
                {block.type !== "divider" && <div className="event-content-editor__picker">
                    <button className="ib-btn ib-btn--sm" type="button" aria-expanded={variableOpen} disabled={!canEdit} onClick={() => {if (textRef.current) rememberSelection(textRef.current); setVariableOpen(!variableOpen);}}><Braces size={15} /> Вставити змінну</button>
                    {variableOpen && <div className="event-content-editor__variable-menu">
                        <div className="event-content-editor__variable-head"><strong>Змінні події</strong><button type="button" aria-label="Закрити список змінних" onClick={() => setVariableOpen(false)}><X size={15} /></button></div>
                        <input className="event-manage-input" value={variableSearch} onChange={event => setVariableSearch(event.target.value)} placeholder="Знайти змінну" aria-label="Знайти змінну" autoFocus />
                        <div className="event-content-editor__variable-list">{filteredVariables.map(variable => <button key={variable.name} type="button" onClick={() => insertVariable(variable)}><strong>{variable.label}</strong><code>{variable.name}</code><small>Зараз: {displayValue(values[variable.name])}</small></button>)}</div>
                    </div>}
                </div>}
                <button className="event-content-editor__rules-toggle" type="button" aria-expanded={rulesOpen} onClick={() => setRulesOpen(!rulesOpen)}>{block.visibility?.length ? `Умови показу: ${block.visibility.length}` : "Умови показу"}</button>
            </div>
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
                            : <input className="event-manage-input" aria-label={`Значення умови ${ruleIndex + 1}`} type={format === "number" ? "number" : format === "date-time" ? "datetime-local" : "text"} value={format === "date-time" ? localDateTime(rule.value) : String(rule.value ?? "")} disabled={!canEdit} onChange={(event: ChangeEvent<HTMLInputElement>) => setRule(ruleIndex, {...rule, value: format === "number" ? Number(event.target.value) : format === "date-time" ? event.target.value ? new Date(event.target.value).toISOString() : "" : event.target.value})} />}
                        {canEdit && <button type="button" className="event-content-editor__rule-remove" aria-label={`Видалити умову ${ruleIndex + 1}`} onClick={() => onUpdate({...block, visibility: (block.visibility ?? []).filter((_, itemIndex) => itemIndex !== ruleIndex)})}><X size={16} /></button>}
                    </div>;
                })}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={addRule}><Plus size={15} /> Додати умову</button>}
            </div>}
        </div>
    </section>;
}
