import type {FormBlock, FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswer, ParticipantAnswers} from "@/api/participantForm";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {sameValue} from "../manage/notifications/notificationModel";
import {visibleFieldKeys} from "@/components/event/formVisibility";

export type AnswerGroup = {id: string; title: string | null; blocks: FormBlock[]};

// The form's blocks cut into groups at each «Розділ»; blocks before the first heading form an untitled group.
// Staff-only questions never reach a participant.
export function answerGroups(form: ParticipantForm): AnswerGroup[] {
    const groups: AnswerGroup[] = [];
    let current: AnswerGroup = {id: "start", title: null, blocks: []};
    for (const block of form.Document.blocks) {
        if (block.type === "section") {
            groups.push(current);
            current = {id: block.id, title: block.label ?? null, blocks: []};
        } else if (block.type !== "divider" && !(isFormField(block) && block.staffOnly)) {
            current.blocks.push(block);
        }
    }
    groups.push(current);
    return groups.filter(group => group.blocks.some(isFormField));
}

export const isEmptyAnswer = (value: ParticipantAnswer | undefined): boolean =>
    value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

// A field the person may change now: editable, or a required one still owed.
export const isChangeable = (field: FormField, fillable: readonly string[]) => !!field.editable || fillable.includes(field.key);

// Visible required fields the person can change and left empty; `key` → error kind.
export function missingRequired(form: ParticipantForm, answers: ParticipantAnswers, fillable: readonly string[]): string[] {
    const shown = visibleFieldKeys(form.Document.blocks, answers);
    return form.Document.blocks.filter(isFormField)
        .filter(field => field.required && shown.has(field.key) && isChangeable(field, fillable) && isEmptyAnswer(answers[field.key]))
        .map(field => field.key);
}

// Multiple choices are an unordered set; text/content arrays elsewhere keep their order.
export function sameAnswer(field: Pick<FormField, "input">, left: ParticipantAnswer | undefined, right: ParticipantAnswer | undefined): boolean {
    if (isEmptyAnswer(left) && isEmptyAnswer(right)) return true;
    const normalize = (value: ParticipantAnswer | undefined) => field.input === "multi_select" && Array.isArray(value) ? [...new Set(value)].sort() : value ?? null;
    return sameValue(normalize(left), normalize(right));
}

// Whether the draft differs from the saved answers on a field the person may change.
export function isDirty(form: ParticipantForm, saved: ParticipantAnswers, draft: ParticipantAnswers, fillable: readonly string[]): boolean {
    return form.Document.blocks.filter(isFormField).some(field => isChangeable(field, fillable)
        && !sameAnswer(field, saved[field.key], draft[field.key]));
}

// Something to edit: any field the person may change.
export function hasChangeable(form: ParticipantForm, fillable: readonly string[]): boolean {
    return form.Document.blocks.filter(isFormField).some(field => !field.staffOnly && isChangeable(field, fillable));
}
