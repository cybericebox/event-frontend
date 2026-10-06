import {z} from "zod";

export const ResultsAvailabilitySchema = z.enum(["available", "hidden", "participants_only", "not_started"]);
export type ResultsAvailability = z.infer<typeof ResultsAvailabilitySchema>;

// Older API responses carry only CanViewResults.
export function resultsAvailability(info: {CanViewResults: boolean; ResultsAvailability?: ResultsAvailability}): ResultsAvailability {
    return info.ResultsAvailability ?? (info.CanViewResults ? "available" : "hidden");
}

// The board is linked when it is readable now or will be after the start.
export function resultsLinkVisible(availability: ResultsAvailability): boolean {
    return availability === "available" || availability === "not_started";
}

// The event's staff (moderators and organizers) always read the results, like
// the API does for them; the public info carries only the guest view.
export function viewerResultsAvailability(availability: ResultsAvailability, staff: boolean): ResultsAvailability {
    return staff ? "available" : availability;
}
