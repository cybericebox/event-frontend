import {afterEach, describe, expect, it, vi} from "vitest";
vi.mock("@/utils/origins", async importOriginal => ({
    ...await importOriginal<typeof import("@/utils/origins")>(),
    requireApiOrigin: () => "https://api.example.org",
}));
import {
    AnalyticsInactiveSchema, AnalyticsTasksSchema, getAnalyticsInactive, getAnalyticsScores, getAnalyticsTaskDetail, getAnalyticsTasks, getAnalyticsWrongAnswers, inactiveExportPath, scoresQuery,
} from "./manageAnalyticsTasks";

afterEach(() => vi.unstubAllGlobals());

const eventID = "01900000-0000-7000-8000-000000000001";
const task = {
    ChallengeID: "c1", Name: "Web 1", Difficulty: "easy", Points: 100, GroupID: "00000000-0000-0000-0000-000000000000", GroupName: "", Attempts: 4, Correct: 1, TeamsTried: 2, TeamsOpened: 2, Solves: 1,
    SolveRate: 0.5, MedianSinceStartSeconds: 1200, MedianSinceOpenSeconds: null, FirstBloodTeam: "Blue", FirstBloodAt: "2026-09-29T10:20:00Z", HintsOpened: 1, HintPoints: 10,
    Calibration: {Verdict: "insufficient", ExpectedMin: 0.55, ExpectedMax: 0.9},
};

function stubFetch(data: unknown) {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
    }));
    return calls;
}

describe("tasks and progress API", () => {
    it("parses the tasks and tolerates null lists and null medians", () => {
        const parsed = AnalyticsTasksSchema.parse({Tasks: [task], Groups: null, Period: {From: "a", To: "b"}});
        expect(parsed.Groups).toEqual([]);
        expect(parsed.Tasks[0]).toMatchObject({MedianSinceStartSeconds: 1200, MedianSinceOpenSeconds: null, FirstBloodTeam: "Blue"});
    });
    it("rejects an unknown calibration verdict", () => {
        expect(AnalyticsTasksSchema.safeParse({Tasks: [{...task, Calibration: {Verdict: "weird", ExpectedMin: 0, ExpectedMax: 1}}], Groups: [], Period: {From: "a", To: "b"}}).success).toBe(false);
    });
    it("asks for the tasks, a task and its wrong answers with the period", async () => {
        const calls = stubFetch({Tasks: [], Groups: [], Period: {From: "a", To: "b"}});
        await getAnalyticsTasks(eventID, {from: "2026-09-29T10:00:00.000Z", to: null});
        expect(calls[0]).toBe(`https://api.example.org/api/events/${eventID}/manage/analytics/tasks?from=2026-09-29T10%3A00%3A00.000Z`);
        stubFetch({Answers: null, Period: {From: "a", To: "b"}});
        await expect(getAnalyticsWrongAnswers(eventID, "c/1")).resolves.toEqual({Answers: [], Period: {From: "a", To: "b"}});
        const detail = stubFetch({Task: task, Series: null, FailedTeams: null, HintEffect: {With: {Teams: 0, Solved: 0, SolveRate: 0, MedianSeconds: null}, Without: {Teams: 0, Solved: 0, SolveRate: 0, MedianSeconds: null}}, Period: {From: "a", To: "b"}, RefreshedAt: null, Final: false});
        await getAnalyticsTaskDetail(eventID, "c/1");
        expect(detail[0]).toContain("/manage/analytics/tasks/c%2F1");
    });
    it("builds the scores query from the period, the leaders and the chosen teams", async () => {
        expect(scoresQuery({from: null, to: null}, 10, [])).toBe("?top=10");
        expect(scoresQuery({from: "2026-09-29T10:00:00.000Z", to: null}, 5, ["a", "b"])).toBe("?from=2026-09-29T10%3A00%3A00.000Z&top=5&teams=a%2Cb");
        const calls = stubFetch({Teams: null, Series: null, Period: {From: "a", To: "b"}});
        await getAnalyticsScores(eventID, {from: null, to: null}, 10, ["a"]);
        expect(calls[0]).toContain("/manage/analytics/progress/scores?top=10&teams=a");
    });
    it("reads the idle teams by the threshold", async () => {
        const calls = stubFetch({Minutes: 45, AsOf: "2026-09-29T12:00:00Z", Running: true, Teams: [{TeamID: "a", Name: "Blue", LastActivityAt: null, IdleMinutes: 70, Points: 0}]});
        const inactive = await getAnalyticsInactive(eventID, 45);
        expect(calls[0]).toContain("/manage/analytics/progress/inactive?minutes=45");
        expect(inactive.Teams[0].LastActivityAt).toBeNull();
        expect(AnalyticsInactiveSchema.parse({Minutes: 30, AsOf: "x", Running: false, Teams: null}).Teams).toEqual([]);
        expect(inactiveExportPath(60)).toBe("analytics/progress/inactive/export.csv?minutes=60");
    });
});
