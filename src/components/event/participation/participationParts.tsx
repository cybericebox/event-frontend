"use client";

import {useState, type FormEvent, type ReactNode} from "react";
import {apiErrorMessage} from "@/api/apiErrors";
import {EventTeamError} from "@/api/eventTeams";
import {ParticipantJoinError, type ParticipantAnswers} from "@/api/participantForm";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {t} from "@/i18n/t";
import {formatAnswer, formFields} from "./participationModel";
import {EventButton} from "@/components/ui/EventButton";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {isFileAnswer, selfAnswerFileUrl} from "@/api/answerFiles";
import {formatDateAnswer} from "@/components/event/DateAnswerInput";
import {dateModeOf} from "@/components/event/manage/participantFormEditor";

// Pieces shared by «Мій профіль учасника» and «Моя команда».

export function errorText(error: unknown, fallback: string): string {
    if (error instanceof EventTeamError || error instanceof ParticipantJoinError) return apiErrorMessage(error.code, fallback);
    return fallback;
}

export function Section({title, note, children}: {title: string; note?: ReactNode; children: ReactNode}) {
    return <section className="event-part" aria-label={title}>
        <header className="event-part__head"><h2>{title}</h2>{note && <p>{note}</p>}</header>
        {children}
    </section>;
}

export type Confirm = {title: string; text: string; action: string; danger?: boolean; run: () => Promise<void>} | null;

export function TeamConfirm({confirm, onClose}: {confirm: Confirm; onClose: () => void}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    return <ConfirmDialog open={!!confirm} onCancel={() => {setError(""); onClose();}} tone={confirm?.danger ? "danger" : "default"} busy={busy} error={error}
        title={confirm?.title ?? ""} description={confirm?.text} confirmLabel={confirm?.action ?? ""} onConfirm={async () => {
            if (!confirm) return;
            setBusy(true);
            setError("");
            try { await confirm.run(); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : ""); } finally { setBusy(false); }
        }} />;
}

export function FieldsEditor({form, answers, onCancel, onSave}: {form: ParticipantForm; answers: ParticipantAnswers; onCancel: () => void; onSave: (answers: ParticipantAnswers) => Promise<void>}) {
    const [draft, setDraft] = useState<ParticipantAnswers>(answers);
    const [busy, setBusy] = useState(false);
    return <form className="event-part__form" onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try { await onSave(draft); } finally { setBusy(false); }
    }}>
        <TeamFieldsInputs form={{...form, Required: false}} editableOnly answers={draft} onChange={(key, value) => setDraft(current => ({...current, [key]: value}))} disabled={busy} />
        <div className="event-part__actions"><EventButton type="submit" className="ib-btn ib-btn--primary" disabled={busy} busy={busy}>{t("common.save")}</EventButton><button type="button" className="ib-btn" disabled={busy} onClick={onCancel}>{t("common.cancel")}</button></div>
    </form>;
}

export function FieldRows({form, answers, canEdit, onEdit}: {form: ParticipantForm; answers: Record<string, unknown>; canEdit: boolean; onEdit: () => void}) {
    const fields = formFields(form);
    if (!fields.length) return null;
    const anyEditable = canEdit && fields.some(field => field.editable);
    return <>
        <dl className="event-part__rows">{fields.map(field => <FieldRow key={field.key} label={field.label}><span className="event-part__field-value"><AnswerValue field={field} value={answers[field.key]} /></span></FieldRow>)}</dl>
        {anyEditable && <div className="event-part__actions"><button type="button" className="ib-btn ib-btn--sm" onClick={onEdit}>{t("participation.editFields")}</button></div>}
    </>;
}

// A file answer downloads, a date reads in the viewer's words; the rest is text.
export function AnswerValue({field, value}: {field: FormField; value: unknown}) {
    if (isFileAnswer(value)) return <a className="ib-link" href={selfAnswerFileUrl(value.id)} download>{value.name}</a>;
    if (field.input === "date" && typeof value === "string" && value) return <>{formatDateAnswer(dateModeOf(field), value)}</>;
    return <>{formatAnswer(value)}</>;
}

export function FieldRow({label, children}: {label: string; children: ReactNode}) {
    return <><dt>{label}</dt><dd>{children}</dd></>;
}
