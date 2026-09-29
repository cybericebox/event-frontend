"use client";

import {ArrowDown, ArrowUp, ChevronDown, Copy, GitBranch, GripVertical, PencilLine, Trash2} from "lucide-react";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {EventRichTextEditor} from "@/components/event/manage/EventLexicalEditor";
import {emptyRichText, richTextPlainText} from "@/components/event/content/richTextState";
import {changeInput, isChoiceInput, isFormField, reorderBlocks} from "@/components/event/manage/participantFormEditor";
import {FormConditionEditor, FormFileSettings, FormOptionsEditor} from "@/components/event/manage/FormFieldControls";
import {useBlockDrag} from "@/components/event/manage/useBlockDrag";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

export type FieldsScope = "participant" | "team";

const inputOptions: {value: FormField["input"]; label: string}[] = [
    {value: "text", label: t("manage.fields.input.text")},
    {value: "long_text", label: t("manage.fields.input.longText")},
    {value: "number", label: t("manage.fields.input.number")},
    {value: "select", label: t("manage.fields.input.select")},
    {value: "multi_select", label: t("manage.fields.input.multiSelect")},
    {value: "checkbox", label: t("manage.fields.input.checkbox")},
    {value: "file", label: t("manage.fields.input.file")},
];

function blockKind(block: FormBlock): string {
    if (isFormField(block)) return t("manage.fields.block.question");
    if (block.type === "section") return t("manage.fields.block.section");
    if (block.type === "text") return t("manage.fields.block.text");
    if (block.type === "divider") return t("manage.fields.block.divider");
    return block.type;
}

// One line of the collapsed card: the question and its *, then small hints
// (answer type, editable later, shown on condition) that give way first.
function CardTitle({block, scope}: {block: FormBlock; scope: FieldsScope}) {
    if (!isFormField(block)) {
        const summary = block.type === "section" ? block.label : block.type === "text" ? richTextPlainText(block.richText) : "";
        return <><strong>{blockKind(block)}</strong>{summary && <span className="event-content-editor__block-summary">{summary}</span>}</>;
    }
    const editable = scope === "team" ? t("manage.fields.editor.editableTeam") : t("manage.fields.editor.editableParticipant");
    return <span className="event-form-card__title">
        <span className={`event-form-card__question${block.label.trim() ? "" : " is-empty"}`}>{block.label.trim() || t("manage.fields.editor.untitledQuestion")}</span>
        {block.required && <span className="event-field-required" aria-label={t("manage.fields.requiredField")}>*</span>}
        <span className="event-form-card__meta">
            <span>{inputOptions.find(option => option.value === block.input)?.label}</span>
            {block.editable && <span className="event-form-card__icon" title={editable} role="img" aria-label={editable}><PencilLine size={14} aria-hidden="true" /></span>}
            {block.condition && <span className="event-form-card__icon" title={t("manage.fields.card.conditional")} role="img" aria-label={t("manage.fields.card.conditional")}><GitBranch size={14} aria-hidden="true" /></span>}
        </span>
    </span>;
}

// A card of the fields editor with the page constructor's behaviour: the
// header row toggles it (not its action buttons), the chevron is last, and the
// drag handle reorders cards.
export function FormBlockCard({blocks, index, scope, canEdit, disabled, open, selected, error, onSelect, onToggle, onDragStateChange, onChange, onMove, onDuplicate, onDelete}: {
    blocks: FormBlock[];
    index: number;
    scope: FieldsScope;
    canEdit: boolean;
    disabled: boolean;
    open: boolean;
    selected: boolean;
    error?: string;
    onSelect: () => void;
    onToggle: () => void;
    onDragStateChange: (dragging: boolean) => void;
    onChange: (blocks: FormBlock[]) => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    const block = blocks[index];
    const drag = useBlockDrag({blockID: block.id, onDragStateChange, onReorder: (sourceID, targetID) => onChange(reorderBlocks(blocks, sourceID, targetID))});
    const n = index + 1;
    const bodyID = `form-block-body-${block.id}`;
    const toggleLabel = open ? t("manage.blocks.toggle.collapse") : t("manage.blocks.toggle.expand");
    const update = (value: FormBlock) => onChange(blocks.map((item, position) => position === index ? value : item));
    const outsideActions = (target: EventTarget) => !(target as Element).closest(".event-content-editor__block-actions");

    return <section className={`event-content-editor__block event-form-card${selected ? " is-selected" : ""}${open ? " is-open" : ""}${error ? " is-invalid" : ""}`} data-editor-block-id={block.id} aria-label={`${blockKind(block)} ${n}`} tabIndex={0}
        onClick={event => {if (outsideActions(event.target)) onSelect();}} onFocusCapture={event => {if (outsideActions(event.target)) onSelect();}}
        onKeyDown={event => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); onSelect(); if (!open) onToggle();}}}>
        {/* The whole row toggles the card except its action buttons; the title and
            chevron buttons have no handlers of their own, their clicks bubble here. */}
        <div className="event-content-editor__block-head" onClick={event => {if (outsideActions(event.target)) onToggle();}}>
            <button type="button" className="event-content-editor__block-title" aria-expanded={open} aria-controls={bodyID}><span className="event-content-editor__order">{n}</span><CardTitle block={block} scope={scope} /></button>
            {canEdit && <div className="event-content-editor__block-actions">
                <EventTooltip content={t("manage.blocks.drag.tooltip")}>{id => <button type="button" className="event-content-editor__drag" aria-label={t("manage.blocks.drag.aria", {n})} aria-describedby={id} disabled={disabled} {...drag}><GripVertical size={16} /></button>}</EventTooltip>
                <button type="button" aria-label={t("manage.fields.editor.moveUp", {n})} disabled={index === 0 || disabled} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>
                <button type="button" aria-label={t("manage.fields.editor.moveDown", {n})} disabled={index === blocks.length - 1 || disabled} onClick={() => onMove(1)}><ArrowDown size={16} /></button>
                <button type="button" aria-label={t("manage.blocks.duplicateAria", {n})} disabled={disabled} onClick={onDuplicate}><Copy size={16} /></button>
                <button className="event-content-editor__danger" type="button" aria-label={t("manage.fields.editor.delete", {n})} disabled={disabled} onClick={onDelete}><Trash2 size={16} /></button>
            </div>}
            <button type="button" className="event-content-editor__block-toggle" aria-expanded={open} aria-controls={bodyID} aria-label={toggleLabel}><ChevronDown size={18} aria-hidden="true" /></button>
        </div>
        {error && open && <p className="event-content-editor__block-error" role="alert">{error}</p>}
        {open && <div className="event-content-editor__block-body" id={bodyID}>{isFormField(block) ? <>
            <div className="event-form-card__main">
                <label className="event-manage-field"><span>{t("manage.fields.block.question")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label} onChange={e => update({...block, label: e.target.value})} disabled={disabled} placeholder={t("manage.fields.editor.questionPlaceholder")} /></label>
                <div className="event-manage-field"><span>{t("manage.fields.editor.answerType")}</span><EventSelect ariaLabel={t("manage.fields.editor.answerTypeFor", {n})} value={block.input} options={inputOptions} disabled={disabled} onValueChange={value => onChange(changeInput(blocks, index, value as FormField["input"]))} /></div>
                <div className="event-form-card__switches">
                    <EventSwitch className="event-manage-form__switch" checked={!!block.required} onCheckedChange={checked => update({...block, required: checked})} disabled={disabled} label={t("manage.fields.editor.answerRequired")} />
                    <EventSwitch className="event-manage-form__switch" checked={!!block.editable} onCheckedChange={checked => update({...block, editable: checked || undefined})} disabled={disabled} label={scope === "team" ? t("manage.fields.editor.editableTeam") : t("manage.fields.editor.editableParticipant")} />
                </div>
            </div>
            <label className="event-manage-field"><span>{scope === "team" ? t("manage.fields.editor.helpTeam") : t("manage.fields.editor.helpParticipant")}</span><input className="event-manage-input" value={block.help ?? ""} onChange={e => update({...block, help: e.target.value})} disabled={disabled} placeholder={t("manage.fields.editor.optional")} /></label>
            {isChoiceInput(block.input) && <FormOptionsEditor blocks={blocks} index={index} disabled={disabled} onChange={onChange} />}
            {block.input === "file" && <FormFileSettings blocks={blocks} index={index} disabled={disabled} onChange={onChange} />}
            <FormConditionEditor blocks={blocks} index={index} disabled={disabled} onChange={onChange} />
        </> : block.type === "section" ? <label className="event-manage-field"><span>{t("manage.fields.block.section")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label ?? ""} onChange={e => update({...block, label: e.target.value})} disabled={disabled} /></label>
            : block.type === "text" ? <div className="event-manage-field"><span>{t("manage.fields.block.text")}<span className="event-field-required">*</span></span><EventRichTextEditor value={block.richText ?? emptyRichText()} onChange={value => update({...block, richText: value})} variables={[]} values={{}} disabled={disabled} ariaLabel={t("manage.fields.block.text")} /></div>
                : block.type === "divider" ? <p>{t("manage.fields.editor.dividerNote")}</p> : <p>{t("manage.fields.editor.unsupported")}</p>}</div>}
    </section>;
}
