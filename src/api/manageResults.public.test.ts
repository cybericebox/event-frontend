import {describe, expect, it} from "vitest";
import {resultsSnapshotSchema} from "./manageResults";

const entry = {Rank: 1, TeamID: "01900000-0000-7000-8000-000000000001", TeamName: "Frost", Points: 100, Solved: 1};

describe("public results contract", () => {
    it("accepts the public projection without activity timestamps", () => {
        const results = resultsSnapshotSchema.parse({Revision: 7, Scoreboard: [entry], Timeline: []});
        expect(results.Scoreboard).toEqual([entry]);
    });

    it("does not retain activity timestamps from an older payload", () => {
        const results = resultsSnapshotSchema.parse({Revision: 7, GeneratedAt: "2026-10-20T10:00:00Z", Scoreboard: [{...entry, LastSolveAt: "2026-10-20T09:59:00Z"}], Timeline: []});
        expect(results).not.toHaveProperty("GeneratedAt");
        expect(results.Scoreboard[0]).not.toHaveProperty("LastSolveAt");
    });
});
