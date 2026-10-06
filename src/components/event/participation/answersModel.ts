import type {FormBlock, FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {ParticipantAnswer, ParticipantAnswers} from "@/api/participantForm";
import {isFormField} from "@/components/event/manage/participantFormEditor";
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

// Whether the draft differs from the saved answers on a field the person may change.
export function isDirty(form: ParticipantForm, saved: ParticipantAnswers, draft: ParticipantAnswers, fillable: readonly string[]): boolean {
    return form.Document.blocks.filter(isFormField).some(field => isChangeable(field, fillable)
        && JSON.stringify(saved[field.key] ?? null) !== JSON.stringify(draft[field.key] ?? null)
        && !(isEmptyAnswer(saved[field.key]) && isEmptyAnswer(draft[field.key])));
}

// Something to edit: any field the person may change.
export function hasChangeable(form: ParticipantForm, fillable: readonly string[]): boolean {
    return form.Document.blocks.filter(isFormField).some(field => !field.staffOnly && isChangeable(field, fillable));
}
