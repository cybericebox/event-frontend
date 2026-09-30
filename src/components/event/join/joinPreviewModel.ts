// The organizer's preview of the registration: which screens a participant walks through
// and how the application ends. Pure; the page keeps the state, nothing is sent anywhere.
export type JoinOutcome = "approved" | "pending" | "rejected";
export type JoinPreviewStep = "form" | "result" | "team" | "done";

export const joinOutcomes: JoinOutcome[] = ["approved", "pending", "rejected"];

// Registration: 0 = by invitation, 1 = with approval, 2 = open. Open and invitation end in
// «Ви зареєстровані», with approval the application waits for a decision.
export function defaultOutcome(registration: number): JoinOutcome {
    return registration === 1 ? "pending" : "approved";
}

// The step after `step`: the team is only offered to an approved participant of a team event.
export function nextStep(step: JoinPreviewStep, {outcome, teamMode}: {outcome: JoinOutcome; teamMode: boolean}): JoinPreviewStep {
    if (step === "form") return "result";
    if (step === "result") return teamMode && outcome === "approved" ? "team" : "done";
    return "done";
}
