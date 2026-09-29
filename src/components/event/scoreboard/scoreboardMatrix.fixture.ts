import type {ResultsAvailability} from "@/types/resultsAvailability";

// Test fixture: the API's results policy (decideResultsAvailability and the
// freeze in AP Backend useCase/event), so the page is checked against every
// audience × visibility × phase × freeze combination the server can send.
export type Audience = "guest" | "applicant" | "participant" | "staff";
export type Visibility = 0 | 1 | 2;
export type Phase = "before" | "during" | "after";

export const audiences: Audience[] = ["guest", "applicant", "participant", "staff"];
export const visibilities: Visibility[] = [0, 1, 2];
export const phases: Phase[] = ["before", "during", "after"];

// The availability in the info the page gets: the public info for guests and
// applicants (and for staff, whose info is also the guest view), the
// participant info for an approved participant.
export function infoAvailability(audience: Audience, visibility: Visibility, phase: Phase): ResultsAvailability {
    if (visibility === 0) return "hidden";
    if (visibility === 1 && audience !== "participant") return "participants_only";
    return phase === "before" ? "not_started" : "available";
}

// Whether the API serves the results to this viewer now.
export function apiReadable(audience: Audience, visibility: Visibility, phase: Phase): boolean {
    if (audience === "staff") return true;
    return infoAvailability(audience, visibility, phase) === "available";
}

// The freeze applies to non-staff while it is active (it ends at the finish).
export function freezeApplied(audience: Audience, phase: Phase, freezeActive: boolean): boolean {
    return freezeActive && phase === "during" && audience !== "staff";
}
