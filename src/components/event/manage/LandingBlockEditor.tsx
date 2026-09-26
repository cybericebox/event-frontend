"use client";

import {useRef, useState, type ChangeEvent, type Ref} from "react";
import {ArrowDown, ArrowUp, Braces, Plus, Trash2, X} from "lucide-react";
import type {ContentBlock, ContentValue} from "@/types/eventContent";
import {contentVariableByName, contentVariableCatalog, initialVisibilityValue, visibilityOperators, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";

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

export function LandingBlockEditor({block, index, count, values, canEdit, onUpdate, onMove, onDelete}: {
    block: ContentBlock;
    index: number;
    count: number;
    values: Record<string, ContentValue>;
    canEdit: boolean;
    onUpdate: (value: ContentBlock) => void;
    onMove: (direction: -1 | 1) => void;
    onDelete: () => void;
}) {
    const [variableOpen, setVariableOpen] = useState(false);
    const [variableSearch, setVariableSearch] = useState("");
    const [rulesOpen, setRulesOpen] = useState(!!block.visibility?.length);
    const textRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const selection = useRef({start: 0, end: 0});
    const field = block.type === "section" ? "label" : "markdown";
    const text = block[field] ?? "";
    const filteredVariables = contentVariableCatalog.filter(variable => `${variable.label} ${variable.name}`.toLocaleLowerCase("uk").includes(variableSearch.toLocaleLowerCase("uk")));

    function rememberSelection() {
        const input = textRef.current;
        if (input) selection.current = {start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length};
    }

    function insertVariable(variable: ContentVariableDefinition) {
        if (!canEdit) return;
        const {start, end} = selection.current;
        const token = `{{${variable.name}}}`;
        const next = text.slice(0, Math.min(start, text.length)) + token + text.slice(Math.min(end, text.length));
        onUpdate({...withBinding(block, variable), [field]: next});
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
        const variable = contentVariableByName.get("event.isPublished")!;
        const nextBlock = withBinding(block, variable);
        onUpdate({...nextBlock, visibility: [...(nextBlock.visibility ?? []), {variable: variable.name, operator: "equals", value: true}]});
        setRulesOpen(true);
    }

    return <section className="event-content-editor__block" aria-label={`${block.type === "section" ? "Розділ" : "Текст"} ${index + 1}`}>
        <div className="event-content-editor__block-head">
            <div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{block.type === "section" ? "Розділ" : "Текст"}</strong></div>
            {canEdit && <div className="event-content-editor__block-actions">
                <button type="button" title="Перемістити вище" aria-label={`Перемістити блок ${index + 1} вище`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>
                <button type="button" title="Перемістити нижче" aria-label={`Перемістити блок ${index + 1} нижче`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></button>
                <button type="button" className="event-content-editor__danger" title="Видалити блок" aria-label={`Видалити блок ${index + 1}`} onClick={onDelete}><Trash2 size={16} /></button>
            </div>}
        </div>
        <div className="event-content-editor__block-body">
            <label className="event-manage-field"><span>{block.type === "section" ? "Заголовок розділу" : "Вміст (Markdown)"}</span>
                {block.type === "section"
                    ? <input ref={textRef as Ref<HTMLInputElement>} className="event-manage-input" value={text} onChange={event => onUpdate({...block, label: event.target.value})} onSelect={rememberSelection} onClick={rememberSelection} onKeyUp={rememberSelection} disabled={!canEdit} placeholder="Назва розділу" />
                    : <textarea ref={textRef as Ref<HTMLTextAreaElement>} className="event-manage-input event-content-editor__textarea" value={text} onChange={event => onUpdate({...block, markdown: event.target.value})} onSelect={rememberSelection} onClick={rememberSelection} onKeyUp={rememberSelection} disabled={!canEdit} placeholder="Напишіть текст сторінки…" rows={7} />}
            </label>
            <div className="event-content-editor__tools">
                <div className="event-content-editor__picker">
                    <button className="ib-btn ib-btn--sm" type="button" aria-expanded={variableOpen} disabled={!canEdit} onClick={() => {rememberSelection(); setVariableOpen(!variableOpen);}}><Braces size={15} /> Вставити змінну</button>
                    {variableOpen && <div className="event-content-editor__variable-menu">
                        <div className="event-content-editor__variable-head"><strong>Змінні події</strong><button type="button" aria-label="Закрити список змінних" onClick={() => setVariableOpen(false)}><X size={15} /></button></div>
                        <input className="event-manage-input" value={variableSearch} onChange={event => setVariableSearch(event.target.value)} placeholder="Знайти змінну" aria-label="Знайти змінну" autoFocus />
                        <div className="event-content-editor__variable-list">{filteredVariables.map(variable => <button key={variable.name} type="button" onClick={() => insertVariable(variable)}><strong>{variable.label}</strong><code>{variable.name}</code><small>Зараз: {displayValue(values[variable.name])}</small></button>)}</div>
                    </div>}
                </div>
                <button className="event-content-editor__rules-toggle" type="button" aria-expanded={rulesOpen} onClick={() => setRulesOpen(!rulesOpen)}>{block.visibility?.length ? `Умови показу: ${block.visibility.length}` : "Умови показу"}</button>
            </div>
            {rulesOpen && <div className="event-content-editor__rules">
                <p>Блок з’явиться, лише коли виконуються всі умови.</p>
                {(block.visibility ?? []).map((rule, ruleIndex) => {
                    const definition = contentVariableByName.get(rule.variable);
                    const format = definition?.format ?? "text";
                    const operators = visibilityOperators(format);
                    return <div className="event-content-editor__rule" key={ruleIndex}>
                        <select className="event-manage-input" aria-label={`Змінна умови ${ruleIndex + 1}`} value={rule.variable} disabled={!canEdit} onChange={event => {
                            const nextVariable = contentVariableByName.get(event.target.value);
                            if (nextVariable) setRule(ruleIndex, {variable: nextVariable.name, operator: visibilityOperators(nextVariable.format)[0].value, value: initialVisibilityValue(nextVariable.format)});
                        }}>{!definition && <option value={rule.variable}>{rule.variable}</option>}{contentVariableCatalog.map(variable => <option key={variable.name} value={variable.name}>{variable.label}</option>)}</select>
                        <select className="event-manage-input" aria-label={`Порівняння умови ${ruleIndex + 1}`} value={rule.operator} disabled={!canEdit} onChange={event => setRule(ruleIndex, {...rule, operator: event.target.value})}>{!operators.some(option => option.value === rule.operator) && <option value={rule.operator}>{rule.operator}</option>}{operators.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                        {format === "boolean" ? <select className="event-manage-input" aria-label={`Значення умови ${ruleIndex + 1}`} value={rule.value === true ? "true" : "false"} disabled={!canEdit} onChange={event => setRule(ruleIndex, {...rule, value: event.target.value === "true"})}><option value="true">Так</option><option value="false">Ні</option></select>
                            : <input className="event-manage-input" aria-label={`Значення умови ${ruleIndex + 1}`} type={format === "number" ? "number" : format === "date-time" ? "datetime-local" : "text"} value={format === "date-time" ? localDateTime(rule.value) : String(rule.value ?? "")} disabled={!canEdit} onChange={(event: ChangeEvent<HTMLInputElement>) => setRule(ruleIndex, {...rule, value: format === "number" ? Number(event.target.value) : format === "date-time" ? event.target.value ? new Date(event.target.value).toISOString() : "" : event.target.value})} />}
                        {canEdit && <button type="button" className="event-content-editor__rule-remove" aria-label={`Видалити умову ${ruleIndex + 1}`} onClick={() => onUpdate({...block, visibility: (block.visibility ?? []).filter((_, itemIndex) => itemIndex !== ruleIndex)})}><X size={16} /></button>}
                    </div>;
                })}
                {canEdit && <button className="ib-btn ib-btn--sm" type="button" onClick={addRule}><Plus size={15} /> Додати умову</button>}
            </div>}
        </div>
    </section>;
}
