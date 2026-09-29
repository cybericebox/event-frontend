"use client";

import type {ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswers} from "@/api/participantForm";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {dateModeOf, isFormField} from "@/components/event/manage/participantFormEditor";
import {visibleFieldKeys} from "@/components/event/formVisibility";
import {AnswerFileInput} from "@/components/event/AnswerFileInput";
import {DateAnswerInput} from "@/components/event/DateAnswerInput";
import {isFileAnswer, uploadSelfAnswerFile} from "@/api/answerFiles";
import {t} from "@/i18n/t";
import {EventCheckbox} from "@/components/ui/EventCheckbox";

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

// Questions the participant cannot change: not editable and already answered
// (an organizer's CSV import prefilled them).
export function lockedFieldKeys(form: ParticipantForm | null | undefined, stored: ParticipantAnswers | undefined): Set<string> {
    const locked = new Set<string>();
    for (const block of form?.Document.blocks ?? []) {
        if (isFormField(block) && !block.editable && present(stored?.[block.key])) locked.add(block.key);
    }
    return locked;
}

export function ParticipantFormFields({form, answers, onChange, idPrefix = "join", locked}: {
    form: ParticipantForm;
    answers: ParticipantAnswers;
    onChange: (answers: ParticipantAnswers) => void;
    idPrefix?: string;
    locked?: ReadonlySet<string>;
}) {
    const shown = visibleFieldKeys(form.Document.blocks, answers);
    return <div className="event-join-form"><h2>{t("forms.field.title")}</h2><p>{form.Required ? t("forms.field.requiredHint") : t("forms.field.optionalHint")}</p>
        {form.Document.blocks.map(block => {
            if (isFormField(block)) {
                if (!shown.has(block.key)) return null;
                const key = block.key;
                const id = `${idPrefix}-${block.id}`;
                const update = (value: ParticipantAnswers[string]) => onChange({...answers, [key]: value});
                const Question = locked?.has(key) ? "fieldset" : "div";
                return <Question className="event-join-question" key={block.id} disabled={locked?.has(key) || undefined}><label htmlFor={id}><strong>{block.label}</strong>{block.required && <span className="event-field-required" aria-label={t("forms.field.required")}>*</span>}</label>{block.help && <p>{block.help}</p>}
                    {block.input === "file" ? <AnswerFileInput id={id} field={block} value={isFileAnswer(answers[key]) ? answers[key] : undefined} upload={file => uploadSelfAnswerFile("participant", key, file)} onChange={value => {const next = {...answers}; if (value) next[key] = value; else delete next[key]; onChange(next);}} />
                        : block.input === "date" ? <DateAnswerInput id={id} mode={dateModeOf(block)} value={typeof answers[key] === "string" ? answers[key] : ""} onChange={value => update(value)} ariaLabel={block.label} />
                        : block.input === "long_text" ? <textarea id={id} className="event-join-input" rows={4} value={String(answers[key] ?? "")} onChange={e => update(e.target.value)} />
                        : block.input === "number" ? <input id={id} className="event-join-input" type="number" value={typeof answers[key] === "number" ? answers[key] as number : ""} onChange={e => update(e.target.value === "" ? "" : Number(e.target.value))} />
                        : block.input === "checkbox" ? <EventCheckbox className="event-join-choice" id={id} checked={answers[key] === true} onCheckedChange={checked => update(checked)} label={t("common.yes")} />
                        : block.input === "select" ? <select id={id} className="event-join-input" value={String(answers[key] ?? "")} onChange={e => update(e.target.value)}><option value="">{t("common.chooseOption")}</option>{(block.options ?? []).map(option => <option value={option} key={option}>{option}</option>)}</select>
                        : block.input === "multi_select" ? <div className="event-join-options" id={id}>{(block.options ?? []).map(option => <EventCheckbox className="event-join-choice" key={option} checked={Array.isArray(answers[key]) && (answers[key] as string[]).includes(option)} onCheckedChange={checked => {const previous = Array.isArray(answers[key]) ? answers[key] as string[] : []; update(checked ? [...previous, option] : previous.filter(item => item !== option));}} label={option} />)}</div>
                        : <input id={id} className="event-join-input" type="text" value={String(answers[key] ?? "")} onChange={e => update(e.target.value)} />}
                    {locked?.has(key) && <small>{t("forms.field.lockedByOrganizer")}</small>}
                </Question>;
            }
            if (block.type === "section") return <h3 key={block.id}>{block.label}</h3>;
            if (block.type === "text") return <div className="event-join-markdown" key={block.id}><EventRichTextView value={block.richText} /></div>;
            if (block.type === "divider") return <hr key={block.id} />;
            return null;
        })}
    </div>;
}
