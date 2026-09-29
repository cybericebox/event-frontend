import {ApiErrorCode, apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {t} from "@/i18n/t";
import type {EventChallengeHint, EventExerciseAttachment, HintCostInput} from "@/api/manageChallenges";

export type AttachmentKind = "catalog" | "fork" | "own";

// catalog: pinned catalog exercise; fork: the event's copy of one; own: created in the event.
export function attachmentKind(attachment: Pick<EventExerciseAttachment, "Scope" | "Fork">): AttachmentKind {
    if (attachment.Scope === "catalog") return "catalog";
    return attachment.Fork ? "fork" : "own";
}

export function attachmentScopeLabel(kind: AttachmentKind): string {
    return t(`manage.exercises.scope.${kind}`);
}

// «версія N» is the catalog version ordinal, never the event's Revision counter.
export function attachmentVersionLabel(attachment: Pick<EventExerciseAttachment, "VersionNumber">): string {
    return t("manage.exercises.version", {number: attachment.VersionNumber});
}

export function isDetached(attachment: Pick<EventExerciseAttachment, "Status">): boolean {
    return attachment.Status === 2;
}

// The catalog editor lives in its own app; it returns to `returnURL` when done.
export function exercisesAppURL(origin: string, page: "detail" | "new", input: {eventID: string; returnURL: string; exerciseID?: string}): string {
    const query = new URLSearchParams();
    if (page === "detail" && input.exerciseID) query.set("id", input.exerciseID);
    query.set("event", input.eventID);
    query.set("return", input.returnURL);
    return `${origin}/${page}?${query.toString()}`;
}

// Hint cost drafts: "" resets to the default cost (null), a number overrides it.
// Only hints whose effective value changes are sent.
export function hintCostChanges(hints: EventChallengeHint[], drafts: Record<string, string>): HintCostInput[] {
    return hints.flatMap((hint): HintCostInput[] => {
        if (!(hint.ID in drafts)) return [];
        const raw = drafts[hint.ID].trim();
        if (raw === "") return hint.Overridden ? [{HintID: hint.ID, Cost: null}] : [];
        const cost = Number(raw);
        return cost === hint.Cost ? [] : [{HintID: hint.ID, Cost: cost}];
    });
}

export function hintCostDraftValid(value: string): boolean {
    const raw = value.trim();
    if (raw === "") return true;
    const cost = Number(raw);
    return Number.isInteger(cost) && cost >= 0 && cost <= 10000;
}

// Detach: without attempts the server deletes the attachment. With attempts it
// answers 409 1810 until the request carries confirm=true.
export async function detachWithConfirm(detach: (confirm: boolean) => Promise<void>, confirmed: boolean): Promise<"detached" | "needs-confirm"> {
    try {
        await detach(confirmed);
        return "detached";
    } catch (error) {
        if (!confirmed && error instanceof ManageApiError && error.code === ApiErrorCode.ExerciseDetachNeedsConfirm) return "needs-confirm";
        throw error;
    }
}

export function attachmentActionError(error: unknown, fallback: string): string {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}
