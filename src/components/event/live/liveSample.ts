import type {ManageResultsSnapshot} from "@/api/manageResults";
import {t} from "@/i18n/t";

// Sample results for the live editor: the palette previews and the canvas
// show widgets filled with plausible data until the event has real results.
export const liveSampleSpan = 3 * 60 * 60 * 1000;
const teamCount = 10;
const challengeCount = 6;

// A fixed pseudo-random sequence, so the sample looks the same on every render.
function sequence(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
}

function teamID(index: number): string {
    return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

export function liveSampleResults(now: number): ManageResultsSnapshot {
    const random = sequence(7);
    const start = now - liveSampleSpan;
    const timeline: ManageResultsSnapshot["Timeline"] = [];
    const totals = Array.from({length: teamCount}, () => 0);
    const last = Array.from({length: teamCount}, () => start);
    for (let team = 0; team < teamCount; team++) {
        const solves = 9 - Math.floor(team * 0.7);
        for (let solve = 0; solve < solves; solve++) {
            const challenge = (team + solve) % challengeCount;
            const points = 100 + Math.round(random() * 4) * 50;
            const at = start + liveSampleSpan * ((solve + 0.3 + random() * 0.6) / (solves + 0.5));
            totals[team] += points;
            last[team] = Math.max(last[team], at);
            timeline.push({EventTeamID: teamID(team), EventChallengeID: teamID(100 + challenge), ChallengeName: t(`live.sample.challenge.${challenge + 1}`), Points: points, SolvedAt: new Date(at).toISOString()});
        }
    }
    const scoreboard = totals.map((points, team) => ({team, points}))
        .sort((a, b) => b.points - a.points || a.team - b.team)
        .map((item, index) => ({Rank: index + 1, TeamID: teamID(item.team), TeamName: t(`live.sample.team.${item.team + 1}`), Points: item.points, Solved: timeline.filter(solve => solve.EventTeamID === teamID(item.team)).length, LastSolveAt: new Date(last[item.team]).toISOString()}));
    return {
        Revision: 0, GeneratedAt: new Date(now).toISOString(), Scoreboard: scoreboard, Timeline: timeline, TotalTeams: teamCount,
        Freeze: {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
        Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
    };
}
