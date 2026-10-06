import {afterAll, beforeAll, describe, expect, it} from "vitest";
import type {HintUnlock} from "@/api/manageChallenges";
import {emptyHintFilters, filterHintUnlocks} from "./HintUnlocksLog";

const unlock = (team: string, by: string, challenge: string, at: string) => ({TeamID: team, TeamName: team, EventChallengeID: challenge, ChallengeName: challenge, HintID: `${team}-${challenge}`, HintIndex: 0, UnlockedBy: by, UnlockedByName: by, UnlockedAt: at, Cost: 5}) as HintUnlock;

describe("hint log filters", () => {
    const zone = process.env.TZ;
    beforeAll(() => { process.env.TZ = "Europe/Kyiv"; });
    afterAll(() => { process.env.TZ = zone; });
    const items = [unlock("a", "u1", "c1", "2026-09-29T07:00:00Z"), unlock("b", "u2", "c2", "2026-09-29T09:00:00Z")];

    it("filters by team, participant and task", () => {
        expect(filterHintUnlocks(items, emptyHintFilters)).toHaveLength(2);
        expect(filterHintUnlocks(items, {...emptyHintFilters, teamID: "a"}).map(item => item.TeamID)).toEqual(["a"]);
        expect(filterHintUnlocks(items, {...emptyHintFilters, participantID: "u2"}).map(item => item.TeamID)).toEqual(["b"]);
        expect(filterHintUnlocks(items, {...emptyHintFilters, challengeID: "c1"}).map(item => item.TeamID)).toEqual(["a"]);
    });

    it("reads the period in local time: from inclusive, to exclusive", () => {
        // 10:00 Kyiv = 07:00 UTC.
        expect(filterHintUnlocks(items, {...emptyHintFilters, from: "2026-09-29T10:00"}).map(item => item.TeamID)).toEqual(["a", "b"]);
        expect(filterHintUnlocks(items, {...emptyHintFilters, from: "2026-09-29T10:01"}).map(item => item.TeamID)).toEqual(["b"]);
        expect(filterHintUnlocks(items, {...emptyHintFilters, to: "2026-09-29T12:00"}).map(item => item.TeamID)).toEqual(["a"]);
    });
});
