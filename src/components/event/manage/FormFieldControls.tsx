"use client";

import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {addOption, conditionSources, defaultCondition, initialConditionValue, invalidOptions, isFormField, moveOption, removeOption, renameOption} from "@/components/event/manage/participantFormEditor";
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

// «Умова показу»: always shown, or only when an earlier answer matches.
export function FormConditionEditor({blocks, index, disabled, onChange}: Props) {
    const field = fieldAt(blocks, index);
    if (!field) return null;
    const sources = conditionSources(blocks, index);
    const condition = field.condition;
    const source = condition ? sources.find(item => item.key === condition.fieldKey) : undefined;
    const n = index + 1;
    const update = (next: FormField["condition"]) => onChange(blocks.map((block, position) => position === index ? {...field, condition: next} : block));
    return <div className="event-manage-form__condition" role="group" aria-label={t("manage.fields.editor.visibilityFor", {n})}>
        <span className="event-manage-form__condition-label">{t("manage.fields.editor.visibility")}</span>
        <div className="ib-seg ib-seg--sm" role="group" aria-label={t("manage.fields.editor.visibility")}>
            <button type="button" aria-pressed={!condition} disabled={disabled} onClick={() => update(undefined)}>{t("manage.fields.editor.visibilityAlways")}</button>
            <button type="button" aria-pressed={!!condition} disabled={disabled || (!condition && sources.length === 0)} onClick={() => {if (!condition) update(defaultCondition(blocks, index));}}>{t("manage.fields.editor.visibilityConditional")}</button>
        </div>
        {!condition && sources.length === 0 && <small>{t("manage.fields.editor.visibilityNoSource")}</small>}
        {condition && <div className="event-manage-form__condition-fields">
            <div className="event-manage-field"><span>{t("manage.fields.editor.conditionSourceLabel")}</span><EventSelect ariaLabel={t("manage.fields.editor.conditionSource", {n})} value={condition.fieldKey} options={[...(!source ? [{value: condition.fieldKey, label: t("manage.fields.editor.missingQuestion")}] : []), ...sources.map(item => ({value: item.key, label: item.label || t("manage.fields.editor.untitledQuestion")}))]} disabled={disabled} onValueChange={value => {const next = sources.find(item => item.key === value); if (next) update({fieldKey: value, operator: condition.operator, value: initialConditionValue(next)});}} /></div>
            <div className="event-manage-field"><span>{t("manage.fields.editor.conditionOperatorLabel")}</span><EventSelect ariaLabel={t("manage.fields.editor.conditionOperator", {n})} value={condition.operator} options={[{value: "equals", label: t("manage.fields.editor.equals")}, {value: "not_equals", label: t("manage.fields.editor.notEquals")}]} disabled={disabled} onValueChange={value => update({...condition, operator: value as "equals" | "not_equals"})} /></div>
            <div className="event-manage-field"><span>{t("manage.fields.editor.value")}</span>{source?.input === "checkbox"
                ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n})} value={String(condition.value === true)} options={[{value: "true", label: t("common.yes")}, {value: "false", label: t("common.no")}]} disabled={disabled} onValueChange={value => update({...condition, value: value === "true"})} />
                : source?.input === "select"
                    ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n})} value={String(condition.value)} options={(source.options ?? []).filter(option => option.trim()).map(option => ({value: option, label: option}))} disabled={disabled} onValueChange={value => update({...condition, value})} />
                    : <input className="event-manage-input" aria-label={t("manage.fields.editor.conditionValue", {n})} type={source?.input === "number" ? "number" : "text"} value={String(condition.value)} onChange={e => update({...condition, value: source?.input === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value})} disabled={disabled} placeholder={t("manage.fields.editor.value")} />}</div>
        </div>}
    </div>;
}
