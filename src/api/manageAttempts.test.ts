import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {attemptQueryParams, emptyAttemptFilters} from "./manageAttempts";
import {csvFileName} from "./csvDownload";

describe("attempt filters", () => {
    const zone = process.env.TZ;
    beforeAll(() => { process.env.TZ = "Europe/Kyiv"; });
    afterAll(() => { process.env.TZ = zone; });

    it("sends the viewer's local period bounds as UTC", () => {
        const params = attemptQueryParams({teamID: "t", participantID: "p", challengeID: "c", correct: false, from: "2026-09-29T10:00", to: "2026-09-29T11:00"}, "cur", 50);
        expect(params.toString()).toBe("pageSize=50&teamId=t&participantId=p&challengeId=c&correct=false&from=2026-09-29T07%3A00%3A00.000Z&to=2026-09-29T08%3A00%3A00.000Z&cursor=cur");
        expect(attemptQueryParams({...emptyAttemptFilters, from: "nonsense"}).toString()).toBe("pageSize=25");
        expect(attemptQueryParams(emptyAttemptFilters, null, null).toString()).toBe("");
    });

    it("names CSV exports by UTC date", () => {
        expect(csvFileName("attempts", new Date("2026-09-29T23:30:00Z"))).toBe("attempts-2026-09-29.csv");
    });
});
