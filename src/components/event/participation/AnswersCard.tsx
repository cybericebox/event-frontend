"use client";

import {useState, type FormEvent, type ReactNode} from "react";
import {CircleHelp, Lock} from "lucide-react";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswer, ParticipantAnswers} from "@/api/participantForm";
import {isFileAnswer, uploadSelfAnswerFile, type AnswerFile} from "@/api/answerFiles";
import {AnswerFileInput} from "@/components/event/AnswerFileInput";
import {DateAnswerInput} from "@/components/event/DateAnswerInput";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {visibleFieldKeys} from "@/components/event/formVisibility";
import {dateModeOf, isFormField} from "@/components/event/manage/participantFormEditor";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {answerGroups, hasChangeable, isChangeable, isDirty, isEmptyAnswer, missingRequired} from "./answersModel";
import {Card} from "./participationBlocks";
import {AnswerValue} from "./participationParts";

const asText = (value: ParticipantAnswer | undefined) => typeof value === "string" || typeof value === "number" ? String(value) : "";

function Control({field, id, value, onChange, disabled, upload}: {field: FormField; id: string; value: ParticipantAnswer | undefined; onChange: (value: ParticipantAnswer) => void; disabled: boolean; upload: (key: string, file: File) => Promise<AnswerFile>}) {
    switch (field.input) {
        case "file": return <AnswerFileInput id={id} field={field} value={isFileAnswer(value) ? value : undefined} upload={file => upload(field.key, file)} onChange={next => onChange(next ?? "")} disabled={disabled} />;
        case "date": return <DateAnswerInput id={id} mode={dateModeOf(field)} value={typeof value === "string" ? value : ""} onChange={onChange} ariaLabel={field.label} disabled={disabled} />;
        case "long_text": return <textarea id={id} className="event-manage-input" rows={4} value={asText(value)} onChange={event => onChange(event.target.value)} disabled={disabled} />;
        case "number": return <input id={id} className="event-manage-input" type="number" value={asText(value)} onChange={event => onChange(event.target.value === "" ? "" : Number(event.target.value))} disabled={disabled} />;
        case "checkbox": return <EventCheckbox id={id} checked={value === true} onCheckedChange={onChange} disabled={disabled} label={t("common.yes")} />;
        case "select": return <EventSelect value={asText(value)} ariaLabel={field.label} disabled={disabled} onValueChange={onChange}
            options={[{value: "", label: t("common.chooseOption")}, ...(field.options ?? []).map(option => ({value: option, label: option}))]} />;
        case "multi_select": {
            const current = Array.isArray(value) ? value : [];
            return <span className="event-pp-field__options" id={id}>{(field.options ?? []).map(option => <EventCheckbox key={option} checked={current.includes(option)} disabled={disabled} label={option}
                onCheckedChange={checked => onChange(checked ? [...current, option] : current.filter(item => item !== option))} />)}</span>;
        }
        default: return <input id={id} className="event-manage-input" type="text" value={asText(value)} onChange={event => onChange(event.target.value)} disabled={disabled} />;
    }
}

const groupedInput = (input: FormField["input"]) => input === "checkbox" || input === "multi_select" || input === "file" || input === "date";

function AnswersForm({form, saved, fillable, scope, error, onCancel, onSave}: {
    form: ParticipantForm; saved: ParticipantAnswers; fillable: readonly string[]; scope: "participant" | "team"; error: string;
    onCancel: () => void; onSave: (draft: ParticipantAnswers) => Promise<void>;
}) {
    const [draft, setDraft] = useState<ParticipantAnswers>(saved);
    const [busy, setBusy] = useState(false);
    const [invalid, setInvalid] = useState<string[]>([]);
    const [discard, setDiscard] = useState(false);
    const dirty = isDirty(form, saved, draft, fillable);
    const shown = visibleFieldKeys(form.Document.blocks, draft);
    const change = (key: string, value: ParticipantAnswer) => {
        setDraft(current => ({...current, [key]: value}));
        setInvalid(current => current.filter(item => item !== key));
    };
    const upload = (key: string, file: File) => uploadSelfAnswerFile(scope, key, file);
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const missing = missingRequired(form, draft, fillable);
        setInvalid(missing);
        if (missing.length) return;
        setBusy(true);
        try { await onSave(draft); } finally { setBusy(false); }
    };
    return <form className="event-pp-form" onSubmit={event => void submit(event)} noValidate>
        {answerGroups(form).map(group => <section className="event-pp-form__group" key={group.id} aria-label={group.title ?? t("participation.form.general")}>
            {group.title && <h3>{group.title}</h3>}
            <div className="event-pp-form__grid">{group.blocks.map(block => {
                if (block.type === "text") return <div key={block.id} className="is-wide"><EventRichTextView value={block.richText} /></div>;
                if (!isFormField(block) || !shown.has(block.key)) return null;
                const id = `pp-${scope}-${block.id}`;
                const editable = isChangeable(block, fillable);
                const wide = block.input === "long_text" || block.input === "multi_select" || block.input === "file";
                const failed = invalid.includes(block.key);
                return <div key={block.id} className={`event-pp-field${wide ? " is-wide" : ""}${failed ? " is-invalid" : ""}`} role={groupedInput(block.input) ? "group" : undefined} aria-label={groupedInput(block.input) ? block.label : undefined}>
                    <span className="event-pp-field__label">
                        <label htmlFor={id}>{block.label}</label>
                        {block.required && <span className="event-field-required" aria-hidden="true">*</span>}
                        {block.help && <EventTooltip content={block.help}>{tip => <button type="button" className="event-brand-help" aria-label={t("manage.fields.aboutField", {title: block.label})} aria-describedby={tip}><CircleHelp size={14} /></button>}</EventTooltip>}
                        {!editable && <EventTooltip content={t("participation.form.locked")}>{tip => <button type="button" className="event-pp-field__lock" aria-label={t("participation.form.lockedAria", {title: block.label})} aria-describedby={tip}><Lock aria-hidden="true" /></button>}</EventTooltip>}
                    </span>
                    {editable ? <Control field={block} id={id} value={draft[block.key]} onChange={value => change(block.key, value)} disabled={busy} upload={upload} />
                        : <div className="event-pp-field__value" id={id}><AnswerValue field={block} value={saved[block.key]} /></div>}
                    {failed && <span className="event-pp-field__error" role="alert">{t("participation.form.required", {title: block.label})}</span>}
                </div>;
            })}</div>
        </section>)}
        {error && <p className="event-pp-field__error" role="alert">{error}</p>}
        {dirty && <div className="event-pp-savebar" role="region" aria-label={t("participation.form.saveBar")}>
            <div className="event-pp-savebar__text"><strong>{t("participation.form.dirty")}</strong><small>{t("participation.form.dirtyNote")}</small></div>
            <div className="event-pp-savebar__actions">
                <button type="button" className="ib-btn" disabled={busy} onClick={() => setDiscard(true)}>{t("common.cancel")}</button>
                <EventButton type="submit" className="ib-btn ib-btn--primary" busy={busy}>{t("common.save")}</EventButton>
            </div>
        </div>}
        {!dirty && <div className="event-part__actions"><button type="button" className="ib-btn" onClick={onCancel}>{t("participation.form.close")}</button></div>}
        <ConfirmDialog open={discard} onCancel={() => setDiscard(false)} title={t("participation.form.discardTitle")} description={t("participation.form.discardText")}
            cancelLabel={t("participation.form.keepEditing")} confirmLabel={t("participation.form.discard")} onConfirm={() => { setDiscard(false); onCancel(); }} />
    </form>;
}

// The read view of the answers: groups, labels and values; a required field still owed is marked «Заповніть».
function AnswersRead({form, answers, missing}: {form: ParticipantForm; answers: ParticipantAnswers; missing: readonly string[]}) {
    const shown = visibleFieldKeys(form.Document.blocks, answers);
    return <dl className="event-pp-answers">{answerGroups(form).map(group => <GroupRows key={group.id} title={group.title}>
        {group.blocks.filter(isFormField).filter(field => shown.has(field.key)).map(field => <FieldRowRead key={field.key} field={field} value={answers[field.key]} owed={missing.includes(field.key)} />)}
    </GroupRows>)}</dl>;
}

function GroupRows({title, children}: {title: string | null; children: ReactNode}) {
    return <>{title && <h3 className="event-pp-answers__group">{title}</h3>}{children}</>;
}

function FieldRowRead({field, value, owed}: {field: FormField; value: ParticipantAnswer | undefined; owed: boolean}) {
    return <>
        <dt>{field.label}{field.help && <EventTooltip content={field.help}>{tip => <button type="button" className="event-brand-help" aria-label={t("manage.fields.aboutField", {title: field.label})} aria-describedby={tip}><CircleHelp size={14} /></button>}</EventTooltip>}</dt>
        <dd>{owed && isEmptyAnswer(value) ? <span className="ib-tag ib-tag--warn">{t("participation.missing.badge")}</span> : <AnswerValue field={field} value={value} />}</dd>
    </>;
}

// «Анкета» / «Анкета команди»: the answers read-only with «Редагувати», which opens the form. `canEdit` is false for
// a member reading the team's card or once the event is over; `whyReadOnly` says why.
export function AnswersCard({title, note, form, answers, missing, canEdit, whyReadOnly, scope, onSave}: {
    title: string; note?: string; form: ParticipantForm; answers: ParticipantAnswers; missing: readonly string[]; canEdit: boolean; whyReadOnly?: string; scope: "participant" | "team";
    onSave: (draft: ParticipantAnswers) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");
    const editable = canEdit && hasChangeable(form, missing);
    const save = async (draft: ParticipantAnswers) => {
        setError("");
        try { await onSave(draft); setEditing(false); } catch (failure) { setError(failure instanceof Error ? failure.message : t("participation.form.saveFailed")); }
    };
    const action = editable && !editing ? <button type="button" className="ib-btn ib-btn--sm" onClick={() => { setError(""); setEditing(true); }}>{t("participation.form.edit")}</button> : undefined;
    return <Card title={title} note={note} actions={action}>
        {missing.length > 0 && !editing && <p className="event-pp-invite__note"><span className="ib-tag ib-tag--warn">{t("participation.missing.badge")}</span> {t("participation.form.missingNote")}</p>}
        {editing ? <AnswersForm form={form} saved={answers} fillable={missing} scope={scope} error={error} onCancel={() => setEditing(false)} onSave={save} />
            : <AnswersRead form={form} answers={answers} missing={missing} />}
        {!editable && !editing && whyReadOnly && <p className="event-part__note">{whyReadOnly}</p>}
    </Card>;
}
