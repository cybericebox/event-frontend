"use client";

import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {visibleFieldKeys} from "@/components/event/formVisibility";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers, ParticipantAnswer} from "@/api/participantForm";
import {t} from "@/i18n/t";

// editableOnly renders just the questions that may change later; visibility is
// still worked out on the whole form, so a condition on a locked question holds.
export function TeamFieldsInputs({form, answers, onChange, disabled, editableOnly = false}: {
    form: ParticipantForm;
    answers: ParticipantAnswers;
    onChange: (key: string, value: ParticipantAnswer) => void;
    disabled?: boolean;
    editableOnly?: boolean;
}) {
    if (!form.Enabled) return null;
    const shown = visibleFieldKeys(form.Document.blocks, answers);
    return <div className="grid gap-4">
        {form.Document.blocks.map(block => {
            if (editableOnly && (!isFormField(block) || !block.editable)) return null;
            if (block.type === "section") return <h3 key={block.id}>{block.label}</h3>;
            if (block.type === "divider") return <hr key={block.id} />;
            if (block.type === "text") return <EventRichTextView key={block.id} value={block.richText} />;
            if (!isFormField(block) || !shown.has(block.key)) return null;
            const value = answers[block.key];
            const required = form.Required && !!block.required;
            return <label className="event-manage-field" key={block.id}><span>{block.label}{block.required && <span className="event-field-required"> *</span>}</span>{block.help && <small>{block.help}</small>}
                {block.input === "long_text" ? <textarea className="event-manage-input" value={String(value ?? "")} onChange={e => onChange(block.key, e.target.value)} required={required} disabled={disabled} rows={3} />
                    : block.input === "checkbox" ? <input type="checkbox" checked={value === true} onChange={e => onChange(block.key, e.target.checked)} disabled={disabled} />
                    : block.input === "number" ? <input className="event-manage-input" type="number" value={value === undefined ? "" : String(value)} onChange={e => onChange(block.key, e.target.value === "" ? "" : Number(e.target.value))} required={required} disabled={disabled} />
                    : block.input === "select" ? <select className="event-manage-input" value={String(value ?? "")} onChange={e => onChange(block.key, e.target.value)} required={required} disabled={disabled}><option value="">{t("common.chooseOption")}</option>{(block.options ?? []).map(option => <option value={option} key={option}>{option}</option>)}</select>
                    : block.input === "multi_select" ? <span className="grid gap-2">{(block.options ?? []).map(option => <span key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => onChange(block.key, e.target.checked ? [...(Array.isArray(value) ? value : []), option] : (Array.isArray(value) ? value : []).filter(item => item !== option))} disabled={disabled} /> {option}</span>)}</span>
                    : <input className="event-manage-input" type="text" value={String(value ?? "")} onChange={e => onChange(block.key, e.target.value)} required={required} disabled={disabled} />}
            </label>;
        })}
    </div>;
}
