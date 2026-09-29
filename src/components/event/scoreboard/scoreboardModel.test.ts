import {describe, expect, it} from "vitest";
import {chartTeamIDs, unitCount} from "./scoreboardModel";
import type {ManageResultsSnapshot} from "@/api/manageResults";

const snapshot = (chartTeams: number) => ({
    Revision: 1, GeneratedAt: "", Timeline: [], TotalTeams: 4,
    Scoreboard: ["a", "b", "c", "d"].map((id, index) => ({Rank: index + 1, TeamID: id, TeamName: id, Points: 0, Solved: 0, LastSolveAt: null})),
    Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
    Display: {ChartEnabled: true, ChartTeams: chartTeams, RowsLimit: null},
}) as ManageResultsSnapshot;

describe("scoreboard model", () => {
    it("uses the event wording for counts", () => {
        expect(unitCount(1, true)).toBe("1 команда");
        expect(unitCount(3, true)).toBe("3 команди");
        expect(unitCount(12, false)).toBe("12 учасників");
        expect(unitCount(21, false)).toBe("21 учасник");
    });

    it("charts the top teams plus the own team", () => {
        expect(chartTeamIDs(snapshot(2))).toEqual(["a", "b"]);
        expect(chartTeamIDs(snapshot(2), "d")).toEqual(["a", "b", "d"]);
        expect(chartTeamIDs(snapshot(2), "b")).toEqual(["a", "b"]);
    });
});
