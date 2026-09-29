"use client";

import {useState} from "react";
import {ArrowDown, ArrowUp, Plus, Trash2, X} from "lucide-react";
import type {ConditionOperator, FileKind, FormBlock, FormField} from "@/api/manageParticipantForm";
import {DateAnswerInput, formatDateAnswer} from "@/components/event/DateAnswerInput";
import {addOption, conditionOperators, conditionSources, dateModeOf, defaultFileMB, fileKinds, maxFileMB, officeFileKinds, defaultCondition, initialConditionValue, invalidOptions, isFormField, moveOption, removeOption, renameOption} from "@/components/event/manage/participantFormEditor";
import {FieldLabel} from "@/components/event/manage/FieldLabel";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
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

// A «Файл» question: allowed formats (several may be ticked) and the size
// limit. One file per answer.
export function FormFileSettings({blocks, index, disabled, onChange}: Props) {
    const field = fieldAt(blocks, index);
    if (!field) return null;
    const types = field.fileTypes ?? [];
    const update = (patch: Partial<FormField>) => onChange(blocks.map((block, position) => position === index ? {...field, ...patch} : block));
    const size = field.maxSizeMB ?? defaultFileMB;
    const sizeInvalid = !Number.isInteger(size) || size < 1 || size > maxFileMB;
    const sizeID = `${field.id}-file-size`;
    // Keeps the formats in their fixed order.
    const setKinds = (kinds: FileKind[], checked: boolean) => update({fileTypes: fileKinds.filter(kind => kinds.includes(kind) ? checked : types.includes(kind))});
    const kindBox = (kind: FileKind) => <EventCheckbox key={kind} checked={types.includes(kind)} disabled={disabled} label={t(`manage.fields.fileKind.${kind}`)} onCheckedChange={checked => setKinds([kind], checked)} />;
    return <div className="event-form-file-settings">
        <div className="event-manage-field" role="group" aria-label={t("manage.fields.editor.fileTypesFor", {n: index + 1})}>
            <span>{t("manage.fields.editor.fileTypes")}<span className="event-field-required">*</span></span>
            <div className="event-form-file-settings__types">
                {(["pdf", "image"] as FileKind[]).map(kind => kindBox(kind))}
                <div className="event-form-file-settings__group">
                    <EventCheckbox checked={officeFileKinds.every(kind => types.includes(kind))} disabled={disabled} label={t("manage.fields.fileKind.office")} onCheckedChange={checked => setKinds(officeFileKinds, checked)} />
                    <div className="event-form-file-settings__sub">{officeFileKinds.map(kind => kindBox(kind))}</div>
                </div>
                {(["text", "archive"] as FileKind[]).map(kind => kindBox(kind))}
            </div>
            {!types.length && <p className="event-content-editor__field-error">{t("manage.fields.editor.fileTypesEmpty")}</p>}
        </div>
        <div className="event-manage-field"><label htmlFor={sizeID}>{t("manage.fields.editor.fileSize")}</label>
            <input id={sizeID} className="event-manage-input event-form-file-settings__size" type="number" min={1} max={maxFileMB} step={1} value={Number.isNaN(size) ? "" : size} aria-invalid={sizeInvalid} disabled={disabled} onChange={e => update({maxSizeMB: e.target.value === "" ? Number.NaN : Number(e.target.value)})} />
            <small>{t("manage.fields.editor.fileSizeHint", {max: maxFileMB})}</small>
        </div>
    </div>;
}

// «Дата» settings: a day or a date with time, and optional earliest and latest answers.
export function FormDateSettings({blocks, index, disabled, onChange}: Props) {
    const field = fieldAt(blocks, index);
    if (!field) return null;
    const mode = dateModeOf(field);
    const update = (patch: Partial<FormField>) => onChange(blocks.map((block, position) => position === index ? {...field, ...patch} : block));
    const n = index + 1;
    return <div className="event-form-date-settings">
        <div className="event-manage-field"><span>{t("manage.fields.editor.dateMode")}</span>
            <div className="ib-seg ib-seg--sm" role="group" aria-label={t("manage.fields.editor.dateModeFor", {n})}>
                {(["date", "datetime"] as const).map(option => <button key={option} type="button" aria-pressed={mode === option} disabled={disabled} onClick={() => {if (option !== mode) update({dateMode: option, minDate: undefined, maxDate: undefined});}}>{t(`manage.fields.editor.dateMode.${option}`)}</button>)}
            </div>
        </div>
        <div className="event-manage-field"><span>{t("manage.fields.editor.minDate")}</span><DateAnswerInput mode={mode} value={field.minDate ?? ""} onChange={value => update({minDate: value || undefined})} ariaLabel={t("manage.fields.editor.minDateFor", {n})} disabled={disabled} /></div>
        <div className="event-manage-field"><span>{t("manage.fields.editor.maxDate")}</span><DateAnswerInput mode={mode} value={field.maxDate ?? ""} onChange={value => update({maxDate: value || undefined})} ariaLabel={t("manage.fields.editor.maxDateFor", {n})} disabled={disabled} /></div>
    </div>;
}

const operatorLabel: Record<ConditionOperator, string> = {
    equals: t("manage.fields.editor.equals"), not_equals: t("manage.fields.editor.notEquals"),
    before: t("manage.fields.editor.before"), after: t("manage.fields.editor.after"),
};

function conditionSummary(condition: NonNullable<FormField["condition"]>, source: FormField | undefined): string {
    const question = source?.label || t("manage.fields.editor.untitledQuestion");
    const value = source?.input === "checkbox" ? condition.value === true ? t("common.yes") : t("common.no")
        : source?.input === "date" ? formatDateAnswer(dateModeOf(source), String(condition.value)) : String(condition.value);
    const keys: Record<ConditionOperator, string> = {
        equals: "manage.fields.editor.visibilitySummaryEquals", not_equals: "manage.fields.editor.visibilitySummaryNotEquals",
        before: "manage.fields.editor.visibilitySummaryBefore", after: "manage.fields.editor.visibilitySummaryAfter",
    };
    return t(keys[condition.operator], {question, value});
}

// «Показати питання»: the page constructor's compact «Показати блок» row. Collapsed
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
                <EventSelect ariaLabel={t("manage.fields.editor.conditionSource", {n})} value={condition.fieldKey} options={[...(!source ? [{value: condition.fieldKey, label: t("manage.fields.editor.missingQuestion")}] : []), ...sources.map(item => ({value: item.key, label: item.label || t("manage.fields.editor.untitledQuestion")}))]} disabled={disabled} onValueChange={value => {const next = sources.find(item => item.key === value); if (next) update({fieldKey: value, operator: conditionOperators(next).includes(condition.operator) ? condition.operator : "equals", value: initialConditionValue(next)});}} />
                <EventSelect ariaLabel={t("manage.fields.editor.conditionOperator", {n})} value={condition.operator} options={conditionOperators(source).map(operator => ({value: operator, label: operatorLabel[operator]}))} disabled={disabled} onValueChange={value => update({...condition, operator: value as ConditionOperator})} />
                {source?.input === "checkbox"
                    ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n})} value={String(condition.value === true)} options={[{value: "true", label: t("common.yes")}, {value: "false", label: t("common.no")}]} disabled={disabled} onValueChange={value => update({...condition, value: value === "true"})} />
                    : source?.input === "date"
                    ? <DateAnswerInput mode={dateModeOf(source)} value={String(condition.value)} onChange={value => update({...condition, value})} ariaLabel={t("manage.fields.editor.conditionValue", {n})} disabled={disabled} allowClear={false} />
                    : source?.input === "select"
                        ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n})} value={String(condition.value)} options={(source.options ?? []).filter(option => option.trim()).map(option => ({value: option, label: option}))} disabled={disabled} onValueChange={value => update({...condition, value})} />
                        : <input className="event-manage-input" aria-label={t("manage.fields.editor.conditionValue", {n})} type={source?.input === "number" ? "number" : "text"} value={String(condition.value)} onChange={e => update({...condition, value: source?.input === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value})} disabled={disabled} placeholder={t("manage.fields.editor.value")} />}
                {!disabled && <button type="button" className="event-content-editor__rule-remove" aria-label={t("manage.fields.editor.removeCondition", {n})} onClick={() => update(undefined)}><X size={16} /></button>}
            </div>}
            {!condition && !disabled && <button className="ib-btn ib-btn--sm" type="button" disabled={sources.length === 0} onClick={() => update(defaultCondition(blocks, index))}><Plus size={15} /> {t("manage.fields.editor.addCondition")}</button>}
        </div>}
    </div>;
}
