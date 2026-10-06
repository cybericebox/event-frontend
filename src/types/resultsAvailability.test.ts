import {describe, expect, it} from "vitest";
import {resultsLinkVisible, viewerResultsAvailability} from "./resultsAvailability";

describe("results availability", () => {
    it("opens the results to the event staff whatever the audience setting", () => {
        for (const availability of ["hidden", "participants_only", "not_started", "available"] as const) {
            expect(viewerResultsAvailability(availability, true)).toBe("available");
            expect(viewerResultsAvailability(availability, false)).toBe(availability);
        }
    });

    it("links the page before the start too", () => {
        expect(resultsLinkVisible("not_started")).toBe(true);
        expect(resultsLinkVisible("participants_only")).toBe(false);
    });
});
