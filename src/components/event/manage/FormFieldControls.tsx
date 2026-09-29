"use client";

import {useState} from "react";
import {ArrowDown, ArrowUp, Plus, Trash2, X} from "lucide-react";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {addOption, conditionSources, defaultCondition, initialConditionValue, invalidOptions, isFormField, moveOption, removeOption, renameOption} from "@/components/event/manage/participantFormEditor";
import {FieldLabel} from "@/components/event/manage/FieldLabel";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";

type Props = {blocks: FormBlock[]; index: number; disabled: boolean; onChange: (blocks: FormBlock[]) => void};

function fieldAt(blocks: FormBlock[], index: number): FormField | null {
    const block = blocks[index];
    return block && isFormField(block) ? block : null;
}

// Answer options of a choice question: one row per option.
export function FormOptionsEditor({blocks, index, disabled, onChange}: Props) {
    const field = fieldAt(blocks, index);
    if (!field) return null;
    const options = field.options ?? [];
    const invalid = invalidOptions(options);
    return <div className="event-manage-field" role="group" aria-label={t("manage.fields.editor.optionsFor", {n: index + 1})}>
        <span>{t("manage.fields.editor.options")}<span className="event-field-required">*</span></span>
        <div className="event-form-options">{options.map((option, position) => {
            const problem = invalid.has(position) ? option.trim() ? t("manage.fields.editor.optionRepeated") : t("manage.fields.editor.optionEmpty") : null;
            const errorID = `${field.id}-option-${position}-error`;
            return <div className="event-form-options__row" key={position}>
                <input className="event-manage-input" value={option} aria-label={t("manage.fields.editor.option", {n: position + 1})} aria-invalid={!!problem} aria-describedby={problem ? errorID : undefined} placeholder={t("manage.fields.editor.option", {n: position + 1})} disabled={disabled} onChange={e => onChange(renameOption(blocks, index, position, e.target.value))} />
                {!disabled && <div className="event-content-editor__block-actions">
                    <button type="button" aria-label={t("manage.fields.editor.moveOptionUp", {n: position + 1})} disabled={position === 0} onClick={() => onChange(moveOption(blocks, index, position, -1))}><ArrowUp size={16} /></button>
                    <button type="button" aria-label={t("manage.fields.editor.moveOptionDown", {n: position + 1})} disabled={position === options.length - 1} onClick={() => onChange(moveOption(blocks, index, position, 1))}><ArrowDown size={16} /></button>
                    <button className="event-content-editor__danger" type="button" aria-label={t("manage.fields.editor.removeOption", {n: position + 1})} disabled={options.length === 1} onClick={() => onChange(removeOption(blocks, index, position))}><Trash2 size={16} /></button>
                </div>}
                {problem && <p className="event-content-editor__field-error" id={errorID}>{problem}</p>}
            </div>;
        })}</div>
        {!disabled && <button className="ib-btn ib-btn--sm event-form-options__add" type="button" onClick={() => onChange(addOption(blocks, index))}><Plus size={15} /> {t("manage.fields.editor.addOption")}</button>}
    </div>;
}

function conditionSummary(condition: NonNullable<FormField["condition"]>, source: FormField | undefined): string {
    const question = source?.label || t("manage.fields.editor.untitledQuestion");
    const value = source?.input === "checkbox" ? condition.value === true ? t("common.yes") : t("common.no") : String(condition.value);
    return condition.operator === "equals" ? t("manage.fields.editor.visibilitySummaryEquals", {question, value}) : t("manage.fields.editor.visibilitySummaryNotEquals", {question, value});
}

// «Показ питання»: the page constructor's compact «Показ блока» row. Collapsed
// it names the rule; open it edits the one condition on an earlier question.
export function FormConditionEditor({blocks, index, disabled, onChange}: Props) {
    const field = fieldAt(blocks, index);
    const [open, setOpen] = useState(!!field?.condition);
    if (!field) return null;
    const sources = conditionSources(blocks, index);
    const condition = field.condition;
    const source = condition ? sources.find(item => item.key === condition.fieldKey) : undefined;
    const n = index + 1;
    const update = (next: FormField["condition"]) => onChange(blocks.map((block, position) => position === index ? {...field, condition: next} : block));
    return <div className="event-manage-form__condition" role="group" aria-label={t("manage.fields.editor.visibilityFor", {n})}>
        <div className="event-content-editor__tools"><FieldLabel label={t("manage.fields.editor.visibility")} help={t("manage.fields.editor.visibilityHelp")} /><button className="event-content-editor__rules-toggle" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{condition ? conditionSummary(condition, source) : t("manage.fields.editor.visibilityAlways")}</button></div>
        {open && <div className="event-content-editor__rules">
            <p>{sources.length || condition ? t("manage.fields.editor.visibilityNote") : t("manage.fields.editor.visibilityNoSource")}</p>
            {condition && <div className="event-content-editor__rule">
                <EventSelect ariaLabel={t("manage.fields.editor.conditionSource", {n})} value={condition.fieldKey} options={[...(!source ? [{value: condition.fieldKey, label: t("manage.fields.editor.missingQuestion")}] : []), ...sources.map(item => ({value: item.key, label: item.label || t("manage.fields.editor.untitledQuestion")}))]} disabled={disabled} onValueChange={value => {const next = sources.find(item => item.key === value); if (next) update({fieldKey: value, operator: condition.operator, value: initialConditionValue(next)});}} />
                <EventSelect ariaLabel={t("manage.fields.editor.conditionOperator", {n})} value={condition.operator} options={[{value: "equals", label: t("manage.fields.editor.equals")}, {value: "not_equals", label: t("manage.fields.editor.notEquals")}]} disabled={disabled} onValueChange={value => update({...condition, operator: value as "equals" | "not_equals"})} />
                {source?.input === "checkbox"
                    ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n})} value={String(condition.value === true)} options={[{value: "true", label: t("common.yes")}, {value: "false", label: t("common.no")}]} disabled={disabled} onValueChange={value => update({...condition, value: value === "true"})} />
                    : source?.input === "select"
                        ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n})} value={String(condition.value)} options={(source.options ?? []).filter(option => option.trim()).map(option => ({value: option, label: option}))} disabled={disabled} onValueChange={value => update({...condition, value})} />
                        : <input className="event-manage-input" aria-label={t("manage.fields.editor.conditionValue", {n})} type={source?.input === "number" ? "number" : "text"} value={String(condition.value)} onChange={e => update({...condition, value: source?.input === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value})} disabled={disabled} placeholder={t("manage.fields.editor.value")} />}
                {!disabled && <button type="button" className="event-content-editor__rule-remove" aria-label={t("manage.fields.editor.removeCondition", {n})} onClick={() => update(undefined)}><X size={16} /></button>}
            </div>}
            {!condition && !disabled && <button className="ib-btn ib-btn--sm" type="button" disabled={sources.length === 0} onClick={() => update(defaultCondition(blocks, index))}><Plus size={15} /> {t("manage.fields.editor.addCondition")}</button>}
        </div>}
    </div>;
}
