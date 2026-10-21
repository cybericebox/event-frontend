import {expect, it} from "vitest";
import {fixtureChallenge} from "../challenges/fixtures/challengeFixture";

it("builds statistics and results exclusively from the caller's preview board", async () => {
    const {previewProgress, previewResults} = await import("./previewProgress");
    const challenges = [{...fixtureChallenge, SolvedAt: "2026-10-16T10:00:00Z", AwardedPoints: 10, Points: 10, PreviewAttempts: 3, PreviewCorrectAttempts: 1,
        Hints: [{ID: "h", Cost: 0, Unlocked: true, Content: "hint"}]}];
    const stats = previewProgress(challenges as never, {userID: "u", name: "Caller", teamID: "browser-team", teamName: "Browser team"});
    expect(stats.Points).toBe(10);
    expect(stats.Me).toMatchObject({UserID: "u", Attempts: 3, CorrectAttempts: 1, Hints: 1, Solves: 1});
    expect(stats.Team.Solves[0]).toMatchObject({SolvedByUserID: "u", Points: 10});
    const results = previewResults(stats);
    expect(results).not.toHaveProperty("GeneratedAt");
    expect(results.Scoreboard[0]).not.toHaveProperty("LastSolveAt");
    expect(results.Scoreboard).toHaveLength(1);
    expect(results.Scoreboard[0]).toMatchObject({TeamID: "browser-team", TeamName: "Browser team", Points: 10});
    expect(results.Timeline[0].EventTeamID).toBe("browser-team");
});
