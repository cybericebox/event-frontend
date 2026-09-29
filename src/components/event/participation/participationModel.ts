import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswer, ParticipantAnswers} from "@/api/participantForm";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {t} from "@/i18n/t";
import {isFileAnswer} from "@/api/answerFiles";

export function formFields(form: ParticipantForm | null | undefined): FormField[] {
    return form?.Enabled ? form.Document.blocks.filter(isFormField) : [];
}

export function formatAnswer(value: ParticipantAnswer | unknown): string {
    if (value === undefined || value === null || value === "") return "—";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
    if (typeof value === "boolean") return value ? t("participation.answer.yes") : t("participation.answer.no");
    if (isFileAnswer(value)) return value.name;
    if (typeof value === "object") return "—";
    return String(value);
}

// The form restricted to fields the participant or captain may still change.
export function editableForm(form: ParticipantForm): ParticipantForm {
    return {...form, Required: false, Document: {blocks: form.Document.blocks.filter(block => isFormField(block) && block.editable)}};
}

// Only changed editable keys are sent; the backend keeps everything else.
export function changedEditableAnswers(form: ParticipantForm, before: ParticipantAnswers, after: ParticipantAnswers): ParticipantAnswers {
    const changed: ParticipantAnswers = {};
    for (const field of formFields(form)) {
        if (!field.editable || !(field.key in after)) continue;
        if (JSON.stringify(before[field.key] ?? null) !== JSON.stringify(after[field.key] ?? null)) changed[field.key] = after[field.key];
    }
    return changed;
}

export function rosterLine(memberCount: number, max: number | null | undefined, min: number | null | undefined): string {
    const parts = [max ? t("participation.roster.ofMax", {count: memberCount, max}) : String(memberCount)];
    if (min && min > 1) parts.push(t("participation.roster.min", {min}));
    return parts.join(" · ");
}
