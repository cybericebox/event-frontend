import type {OwnChallenge} from "@/api/participantChallenges";
import type {ParticipationStats} from "@/api/participationStats";
import type {ManageResultsSnapshot} from "@/api/manageResults";

export function previewProgress(tasks: OwnChallenge[], identity: {userID: string; name: string; teamID?: string; teamName?: string}): ParticipationStats {
    const Solves = tasks.filter(task => !!task.SolvedAt).map(task => ({
        EventChallengeID: task.EventChallengeID, ChallengeName: task.Snapshot.name, Category: task.GroupName,
        Points: task.AwardedPoints ?? task.Points, SolvedAt: task.SolvedAt!, SolvedByUserID: identity.userID, SolvedByName: identity.name, FirstBlood: false,
    })).sort((a, b) => Date.parse(a.SolvedAt) - Date.parse(b.SolvedAt));
    const Points = Solves.reduce((sum, solve) => sum + solve.Points, 0);
    const Attempts = tasks.reduce((sum, task) => sum + (task.PreviewAttempts ?? 0), 0);
    const CorrectAttempts = tasks.reduce((sum, task) => sum + (task.PreviewCorrectAttempts ?? (task.SolvedAt ? 1 : 0)), 0);
    const Hints = tasks.reduce((sum, task) => sum + task.Hints.filter(hint => hint.Unlocked).length, 0);
    const Me = {UserID: identity.userID, Name: identity.name, Role: 2, JoinedAt: Solves[0]?.SolvedAt ?? new Date().toISOString(), Points, Solves: Solves.length, FirstBloods: 0, Attempts, CorrectAttempts, Hints};
    return {Rank: 0, Points, Solved: Solves.length, Frozen: false, Me,
        Team: {TeamID: identity.teamID ?? identity.userID, TeamName: identity.teamName ?? identity.name, Attempts, CorrectAttempts, Hints, FirstBloods: 0, Solves, Members: [Me]},
        Timeline: Solves.map(solve => ({EventChallengeID: solve.EventChallengeID, Points: solve.Points, SolvedAt: solve.SolvedAt})),
    };
}

export function previewResults(stats: ParticipationStats): ManageResultsSnapshot {
    return {Revision: stats.Team.Attempts + stats.Team.Hints, TotalTeams: 1,
        Scoreboard: [{Rank: 1, TeamID: stats.Team.TeamID, TeamName: stats.Team.TeamName, Points: stats.Points, Solved: stats.Solved}],
        Timeline: stats.Team.Solves.map(solve => ({EventTeamID: stats.Team.TeamID, EventChallengeID: solve.EventChallengeID, ChallengeName: solve.ChallengeName, Points: solve.Points, SolvedAt: solve.SolvedAt})),
        Freeze: {BannerText: "", BannerLevel: "warning", Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
        Display: {ChartEnabled: true, ChartTeams: 1, RowsLimit: null},
    };
}
