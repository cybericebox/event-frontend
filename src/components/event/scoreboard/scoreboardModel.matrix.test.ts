import {describe, expect, it} from "vitest";
import {scoreboardAccess} from "./scoreboardModel";
import {apiReadable, audiences, canOpenLive, effectiveLiveAudience, infoAvailability, liveAudiences, liveButton, phases, visibilities} from "./scoreboardMatrix.fixture";

describe("scoreboard access matrix: audience × visibility × phase × live audience", () => {
    for (const audience of audiences) for (const visibility of visibilities) for (const phase of phases) for (const live of liveAudiences) {
        it(`${audience}, visibility ${visibility}, ${phase}, live ${live}`, () => {
            const staff = audience === "staff";
            const started = phase !== "before";
            const liveOpen = audience === "participant" ? canOpenLive(visibility, phase, live) : effectiveLiveAudience(live, visibility) === "public";
            const access = scoreboardAccess(infoAvailability(audience, visibility, phase), staff, started, liveOpen);
            const audienceSees = staff || visibility === 2 || (visibility === 1 && audience === "participant");
            // The page and its nav item exist in every phase for its audience.
            expect(access.nav).toBe(audienceSees);
            // Results are read only when the API serves them, and never before the start.
            expect(access.fetch).toBe(started && audienceSees);
            if (access.fetch) expect(apiReadable(audience, visibility, phase)).toBe(true);
            const message = !audienceSees ? visibility === 0 ? "scoreboard.hidden" : "scoreboard.participantsOnly" : started ? null : "scoreboard.afterStart";
            expect(access.message).toBe(message);
            expect(access.live).toBe(liveButton(audience, visibility, phase, live));
        });
    }
});
