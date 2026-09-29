import {describe, expect, it} from "vitest";
import {scoreboardAccess} from "./scoreboardModel";
import {apiReadable, audiences, infoAvailability, phases, visibilities} from "./scoreboardMatrix.fixture";

describe("scoreboard access matrix: audience × visibility × phase", () => {
    for (const audience of audiences) for (const visibility of visibilities) for (const phase of phases) {
        it(`${audience}, visibility ${visibility}, ${phase}`, () => {
            const staff = audience === "staff";
            const started = phase !== "before";
            const access = scoreboardAccess(infoAvailability(audience, visibility, phase), staff, started);
            const audienceSees = staff || visibility === 2 || (visibility === 1 && audience === "participant");
            // The page and its nav item exist in every phase for its audience.
            expect(access.nav).toBe(audienceSees);
            // Results are read only when the API serves them, and never before the start.
            expect(access.fetch).toBe(started && audienceSees);
            if (access.fetch) expect(apiReadable(audience, visibility, phase)).toBe(true);
            const message = !audienceSees ? visibility === 0 ? "scoreboard.hidden" : "scoreboard.participantsOnly" : started ? null : "scoreboard.afterStart";
            expect(access.message).toBe(message);
            expect(access.live).toBe(staff);
        });
    }
});
