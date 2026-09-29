"use client";

import type {ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {visibleFieldKeys} from "@/components/event/formVisibility";
import {t} from "@/i18n/t";

function present(value: ParticipantAnswers[string] | undefined): boolean {
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

// Answers to send with the registration form: only visible, filled fields.
// `send` is false when the form is off or optional and left empty.
export function collectFormAnswers(form: ParticipantForm | null | undefined, answers: ParticipantAnswers): {send: boolean; answers: ParticipantAnswers; error?: string} {
    const send = !!form?.Enabled && (form.Required || Object.values(answers).some(present));
    const sent: ParticipantAnswers = {};
    if (!send || !form) return {send: false, answers: sent};
    const shown = visibleFieldKeys(form.Document.blocks, answers);
    for (const block of form.Document.blocks) {
        if (!isFormField(block) || !shown.has(block.key)) continue;
        const answer = answers[block.key];
        if (block.required && !present(answer)) return {send, answers: sent, error: t("forms.field.requiredMissing", {label: block.label})};
        if (present(answer)) sent[block.key] = answer!;
    }
    return {send, answers: sent};
}

export function ParticipantFormFields({form, answers, onChange, idPrefix = "join"}: {
    form: ParticipantForm;
    answers: ParticipantAnswers;
    onChange: (answers: ParticipantAnswers) => void;
    idPrefix?: string;
}) {
    const shown = visibleFieldKeys(form.Document.blocks, answers);
    return <div className="event-join-form"><h2>{t("forms.field.title")}</h2><p>{form.Required ? t("forms.field.requiredHint") : t("forms.field.optionalHint")}</p>
        {form.Document.blocks.map(block => {
            if (isFormField(block)) {
                if (!shown.has(block.key)) return null;
                const key = block.key;
                const id = `${idPrefix}-${block.id}`;
                const update = (value: ParticipantAnswers[string]) => onChange({...answers, [key]: value});
                return <div className="event-join-question" key={block.id}><label htmlFor={id}><strong>{block.label}</strong>{block.required && <span className="event-field-required" aria-label={t("forms.field.required")}>*</span>}</label>{block.help && <p>{block.help}</p>}
                    {block.input === "long_text" ? <textarea id={id} className="event-join-input" rows={4} value={String(answers[key] ?? "")} onChange={e => update(e.target.value)} />
                        : block.input === "number" ? <input id={id} className="event-join-input" type="number" value={typeof answers[key] === "number" ? answers[key] as number : ""} onChange={e => update(e.target.value === "" ? "" : Number(e.target.value))} />
                        : block.input === "checkbox" ? <label className="event-join-choice"><input id={id} type="checkbox" checked={answers[key] === true} onChange={e => update(e.target.checked)} />{t("common.yes")}</label>
                        : block.input === "select" ? <select id={id} className="event-join-input" value={String(answers[key] ?? "")} onChange={e => update(e.target.value)}><option value="">{t("common.chooseOption")}</option>{(block.options ?? []).map(option => <option value={option} key={option}>{option}</option>)}</select>
                        : block.input === "multi_select" ? <div className="event-join-options" id={id}>{(block.options ?? []).map(option => <label className="event-join-choice" key={option}><input type="checkbox" checked={Array.isArray(answers[key]) && (answers[key] as string[]).includes(option)} onChange={e => {const previous = Array.isArray(answers[key]) ? answers[key] as string[] : []; update(e.target.checked ? [...previous, option] : previous.filter(item => item !== option));}} />{option}</label>)}</div>
                        : <input id={id} className="event-join-input" type="text" value={String(answers[key] ?? "")} onChange={e => update(e.target.value)} />}
                </div>;
            }
            if (block.type === "section") return <h3 key={block.id}>{block.label}</h3>;
            if (block.type === "text") return <div className="event-join-markdown" key={block.id}><EventRichTextView value={block.richText} /></div>;
            if (block.type === "divider") return <hr key={block.id} />;
            return null;
        })}
    </div>;
}
