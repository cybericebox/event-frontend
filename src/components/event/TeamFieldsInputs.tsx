"use client";

import {useParticipantPreview, previewAnswerFile} from "./ParticipantPreview";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {dateModeOf, isFormField} from "@/components/event/manage/participantFormEditor";
import {visibleFieldKeys} from "@/components/event/formVisibility";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers, ParticipantAnswer} from "@/api/participantForm";
import {t} from "@/i18n/t";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import {EventSelect} from "@/components/ui/EventSelect";
import {AnswerFileInput} from "@/components/event/AnswerFileInput";
import {DateAnswerInput} from "@/components/event/DateAnswerInput";
import {isFileAnswer, uploadSelfAnswerFile, type AnswerFile} from "@/api/answerFiles";

// editableOnly renders just the questions that may change later (plus the
// fillable ones: required fields the person still owes, fillable once even
// when not editable); visibility is still worked out on the whole form, so a
// condition on a locked question holds.
// upload stores a «Файл» answer; by default the participant or captain uploads
// on the event site, staff pass the /manage upload. A cleared file is "".
export function TeamFieldsInputs({form, answers, onChange, disabled, editableOnly = false, staffOnly = false, fillable = [], errors = {}, upload = (key, file) => uploadSelfAnswerFile("team", key, file)}: {
    form: ParticipantForm;
    answers: ParticipantAnswers;
    onChange: (key: string, value: ParticipantAnswer) => void;
    disabled?: boolean;
    editableOnly?: boolean;
    // Organizer view: only the staff-only questions (conditions still see every answer).
    staffOnly?: boolean;
    fillable?: readonly string[];
    // Client validation by field key: shown under the field and tied to its control.
    errors?: Readonly<Record<string, string>>;
    upload?: (key: string, file: File) => Promise<AnswerFile>;
}) {
    const preview = useParticipantPreview();
    if (!form.Enabled) return null;
    const shown = visibleFieldKeys(form.Document.blocks, answers);
    return <div className="grid gap-4">
        {form.Document.blocks.map(block => {
            if (editableOnly && (!isFormField(block) || !(block.editable || fillable.includes(block.key)))) return null;
            if (staffOnly && (!isFormField(block) || !block.staffOnly)) return null;
            if (block.type === "section") return <h3 key={block.id}>{block.label}</h3>;
            if (block.type === "divider") return <hr key={block.id} />;
            if (block.type === "text") return <EventRichTextView key={block.id} value={block.richText} />;
            if (!isFormField(block) || !shown.has(block.key)) return null;
            const value = answers[block.key];
            const required = form.Required && !!block.required;
            // choices carry their own <label>, so their field is a group, not a label
            const Field = block.input === "checkbox" || block.input === "multi_select" || block.input === "file" || block.input === "date" ? "div" : "label";
            const error = errors[block.key];
            const errorID = `team-field-${block.id}-error`;
            const invalid = error ? {"aria-invalid": true, "aria-describedby": errorID} as const : {};
            return <Field className="event-manage-field" key={block.id} role={Field === "div" ? "group" : undefined} aria-label={Field === "div" ? block.label : undefined} {...(Field === "div" ? invalid : {})}><span>{block.label}{block.required && <span className="event-field-required"> *</span>}</span>{block.help && <small>{block.help}</small>}
                {block.input === "file" ? <AnswerFileInput id={`team-${block.id}`} field={block} value={isFileAnswer(value) ? value : undefined} upload={file => preview.active ? previewAnswerFile(file) : upload(block.key, file)} onChange={next => onChange(block.key, next ?? "")} disabled={disabled} />
                    : block.input === "date" ? <DateAnswerInput mode={dateModeOf(block)} value={typeof value === "string" ? value : ""} onChange={next => onChange(block.key, next)} ariaLabel={block.label} disabled={disabled} />
                    : block.input === "long_text" ? <textarea className="event-manage-input" value={String(value ?? "")} onChange={e => onChange(block.key, e.target.value)} required={required} disabled={disabled} rows={3} {...invalid} />
                    : block.input === "checkbox" ? <EventCheckbox checked={value === true} onCheckedChange={checked => onChange(block.key, checked)} disabled={disabled} label={t("common.yes")} />
                    : block.input === "number" ? <input className="event-manage-input" type="number" value={value === undefined ? "" : String(value)} onChange={e => onChange(block.key, e.target.value === "" ? "" : Number(e.target.value))} required={required} disabled={disabled} {...invalid} />
                    : block.input === "select" ? <EventSelect value={String(value ?? "")} ariaLabel={block.label} disabled={disabled} onValueChange={next => onChange(block.key, next)} options={[{value: "", label: t("common.chooseOption")}, ...(block.options ?? []).map(option => ({value: option, label: option}))]} />
                    : block.input === "multi_select" ? <span className="grid gap-2">{(block.options ?? []).map(option => <EventCheckbox key={option} checked={Array.isArray(value) && value.includes(option)} onCheckedChange={checked => onChange(block.key, checked ? [...(Array.isArray(value) ? value : []), option] : (Array.isArray(value) ? value : []).filter(item => item !== option))} disabled={disabled} label={option} />)}</span>
                    : <input className="event-manage-input" type="text" value={String(value ?? "")} onChange={e => onChange(block.key, e.target.value)} required={required} disabled={disabled} {...invalid} />}
                {error && <span className="ib-field__error" id={errorID} role="alert">{error}</span>}
            </Field>;
        })}
    </div>;
}
