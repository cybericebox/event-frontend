import {describe, expect, it} from "vitest";
import {attemptQueryParams, emptyAttemptFilters, utcBound} from "./manageAttempts";
import {csvFileName} from "./csvDownload";

describe("attempt filters", () => {
    it("reads datetime-local bounds as UTC", () => {
        expect(utcBound("2026-09-29T10:15")).toBe("2026-09-29T10:15:00Z");
        expect(utcBound("")).toBeNull();
        expect(utcBound("nonsense")).toBeNull();
    });

    it("maps every filter to its query parameter", () => {
        const params = attemptQueryParams({teamID: "t", participantID: "p", challengeID: "c", correct: false, from: "2026-09-29T10:00", to: "2026-09-29T11:00"}, "cur");
        expect(params.toString()).toBe("pageSize=20&teamId=t&participantId=p&challengeId=c&correct=false&from=2026-09-29T10%3A00%3A00Z&to=2026-09-29T11%3A00%3A00Z&cursor=cur");
        expect(attemptQueryParams(emptyAttemptFilters, null, null).toString()).toBe("");
    });

    it("names CSV exports by UTC date", () => {
        expect(csvFileName("attempts", new Date("2026-09-29T23:30:00Z"))).toBe("attempts-2026-09-29.csv");
    });
});
