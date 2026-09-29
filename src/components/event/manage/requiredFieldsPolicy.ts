import type {FormField, ParticipantForm, ParticipantFormInput} from "@/api/manageParticipantForm";
import {formFields} from "./listColumns";

// What to do with people (teams) who answered before a required field was
// added: nobody is ever locked out; the choice only decides whether they are
// asked to fill the new fields and whether that also blocks submitting solutions.
export type PolicyChoice = {RequireExisting: boolean; BlockSubmissions: boolean};
export const newRegistrationsOnly: PolicyChoice = {RequireExisting: false, BlockSubmissions: false};

// The required questions the saved form did not ask yet: new ones, ones just
// made required, or all of them when the form itself just became required.
// Staff-only questions are never required from participants.
export function newRequiredFields(saved: ParticipantForm | null | undefined, draft: ParticipantFormInput): FormField[] {
    if (!draft.Enabled || !draft.Required) return [];
    const wasAsked = !!saved?.Enabled && !!saved.Required;
    const before = new Map(formFields(saved?.Document.blocks).map(field => [field.key, field]));
    return formFields(draft.Document.blocks).filter(field => field.required && !field.staffOnly && (!wasAsked || !before.get(field.key)?.required));
}

// Asking only makes sense when someone already answered.
export function policyQuestion(saved: ParticipantForm | null | undefined, draft: ParticipantFormInput): FormField[] {
    return (saved?.Answered ?? 0) > 0 ? newRequiredFields(saved, draft) : [];
}
