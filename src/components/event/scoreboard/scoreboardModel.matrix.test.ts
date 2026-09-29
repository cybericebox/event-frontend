import {describe, expect, it} from "vitest";
import {scoreboardAccess} from "./scoreboardModel";
import {apiReadable, audiences, infoAvailability, phases, visibilities} from "./scoreboardMatrix.fixture";

describe("scoreboard access matrix: audience × visibility × phase", () => {
    for (const audience of audiences) for (const visibility of visibilities) for (const phase of phases) {
        it(`${audience}, visibility ${visibility}, ${phase}`, () => {
            const access = scoreboardAccess(infoAvailability(audience, visibility, phase), audience === "staff");
            const audienceSees = apiReadable(audience, visibility);
            // The page, its nav item and its data exist in every phase for its audience.
            expect(access.nav).toBe(audienceSees);
            expect(access.fetch).toBe(audienceSees);
            expect(access.message).toBe(audienceSees ? null : visibility === 0 ? "scoreboard.hidden" : "scoreboard.participantsOnly");
        });
    }
});
