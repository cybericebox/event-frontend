import {describe, expect, it} from "vitest";
import {resultsSnapshotSchema} from "./manageResults";

const id = "01900000-0000-7000-8000-000000000001";

describe("resultsSnapshotSchema", () => {
    it("never leaves a hidden name blank", () => {
        const snapshot = resultsSnapshotSchema.parse({
            Revision: 1, GeneratedAt: "2026-01-01T00:00:00Z", Timeline: [],
            Scoreboard: [
                {Rank: 1, TeamID: id, TeamName: "", NameHidden: true, Points: 10, LastSolveAt: null},
                {Rank: 2, TeamID: id, TeamName: "Frost", NameHidden: false, Points: 5, LastSolveAt: null},
            ],
        });
        expect(snapshot.Scoreboard[0].TeamName).not.toBe("");
        expect(snapshot.Scoreboard[1].TeamName).toBe("Frost");
    });
});
