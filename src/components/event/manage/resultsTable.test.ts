import {describe, expect, it} from "vitest";
import type {ModeratorResultsTeam} from "@/api/manageResults";
import {matchesResultsFilter, pageOf, resultsStatus, selectResults} from "./resultsTable";

const team = (id: string, patch: Partial<ModeratorResultsTeam> = {}): ModeratorResultsTeam => ({
    Rank: null, TeamID: id, Name: id, RealName: id, Pseudonym: null, Individual: false, Hidden: false, Admitted: true,
    Points: 0, Solved: 0, LastSolveAt: null, Hints: 0, HintPoints: 0, Solves: [], ...patch,
});

const teams = [
    team("Альфа", {Rank: 1, Points: 500, Solved: 3, LastSolveAt: "2026-09-29T10:30:00Z", Solves: [{ChallengeID: "c1", ChallengeName: "Web", Points: 300, SolvedAt: "2026-09-29T10:00:00Z", FirstBlood: true}]}),
    team("Прихована", {Hidden: true, Points: 400, Solved: 2, LastSolveAt: "2026-09-29T10:10:00Z", Hints: 2, HintPoints: 50}),
    team("Бета", {Rank: 2, Points: 100, Solved: 1, LastSolveAt: "2026-09-29T11:00:00Z", RealName: "Олена Коваль", Pseudonym: "neo"}),
    team("Гамма", {Admitted: false}),
];

describe("moderator results table", () => {
    it("names the status of every team", () => {
        expect(teams.map(resultsStatus)).toEqual(["ranked", "hidden", "ranked", "notAdmitted"]);
    });

    it("keeps the server order for the place and searches every name", () => {
        const sort = {key: "@rank", desc: false};
        expect(selectResults(teams, "", [], sort).map(row => row.Name)).toEqual(["Альфа", "Прихована", "Бета", "Гамма"]);
        expect(selectResults(teams, "коваль", [], sort).map(row => row.Name)).toEqual(["Бета"]);
        expect(selectResults(teams, "NEO", [], sort).map(row => row.Name)).toEqual(["Бета"]);
    });

    it("sorts by a column and puts empty values last both ways", () => {
        expect(selectResults(teams, "", [], {key: "@last", desc: false}).map(row => row.Name)).toEqual(["Прихована", "Альфа", "Бета", "Гамма"]);
        expect(selectResults(teams, "", [], {key: "@last", desc: true}).map(row => row.Name)).toEqual(["Бета", "Альфа", "Прихована", "Гамма"]);
        expect(selectResults(teams, "", [], {key: "@points", desc: false})[0].Name).toBe("Гамма");
    });

    it("applies typed column filters", () => {
        expect(matchesResultsFilter(teams[0], {Key: "@points", Op: "range", Type: "number", From: 400, FromExclusive: true})).toBe(true);
        expect(matchesResultsFilter(teams[1], {Key: "@points", Op: "range", Type: "number", From: 400, FromExclusive: true})).toBe(false);
        expect(matchesResultsFilter(teams[3], {Key: "@status", Op: "any", Values: ["notAdmitted"]})).toBe(true);
        expect(matchesResultsFilter(teams[0], {Key: "@firstBlood", Op: "bool", Value: true})).toBe(true);
        expect(matchesResultsFilter(teams[2], {Key: "@firstBlood", Op: "bool", Value: true})).toBe(false);
        expect(matchesResultsFilter(teams[2], {Key: "@last", Op: "range", Type: "date", From: "2026-09-29T10:45:00Z"})).toBe(true);
        expect(matchesResultsFilter(teams[3], {Key: "@last", Op: "range", Type: "date", From: "2026-09-29T10:45:00Z"})).toBe(false);
        expect(selectResults(teams, "", [{Key: "@hints", Op: "range", Type: "number", From: 1}], {key: "@rank", desc: false}).map(row => row.Name)).toEqual(["Прихована"]);
    });

    it("pages the selection", () => {
        expect(pageOf([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    });
});
