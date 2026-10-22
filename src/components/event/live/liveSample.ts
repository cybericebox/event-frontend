import type {ManageResultsSnapshot} from "@/api/manageResults";
import {t} from "@/i18n/t";
import type {LiveStage} from "./liveStages";

// Sample results for the live editor: the palette previews and the canvas
// show widgets filled with plausible data until the event has real results.
export const liveSampleSpan = 3 * 60 * 60 * 1000;
// Enough teams and solves to fill any row count the editor offers.
const teamCount = 40;
const namedTeams = 10;
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

// SampleEnd anchors the editor's sample chart; it is local sample data, never an API field.
export function liveSampleResults(now: number): ManageResultsSnapshot & {SampleEnd: number} {
    const random = sequence(7);
    const start = now - liveSampleSpan;
    const timeline: ManageResultsSnapshot["Timeline"] = [];
    const totals = Array.from({length: teamCount}, () => 0);
    for (let team = 0; team < teamCount; team++) {
        const solves = Math.max(1, 9 - Math.floor(team * 0.2));
        for (let solve = 0; solve < solves; solve++) {
            const challenge = (team + solve) % challengeCount;
            const points = 100 + Math.round(random() * 4) * 50;
            const at = start + liveSampleSpan * ((solve + 0.3 + random() * 0.6) / (solves + 0.5));
            totals[team] += points;
            timeline.push({EventTeamID: teamID(team), EventChallengeID: teamID(100 + challenge), ChallengeName: t(`live.sample.challenge.${challenge + 1}`), Points: points, SolvedAt: new Date(at).toISOString()});
        }
    }
    const scoreboard = totals.map((points, team) => ({team, points}))
        .sort((a, b) => b.points - a.points || a.team - b.team)
        .map((item, index) => ({Rank: index + 1, TeamID: teamID(item.team), TeamName: item.team < namedTeams ? t(`live.sample.team.${item.team + 1}`) : t("live.sample.teamNumbered", {number: item.team + 1}), Points: item.points, Solved: timeline.filter(solve => solve.EventTeamID === teamID(item.team)).length}));
    return {
        // The sample maximum puts the leader at about four fifths of it.
        Revision: 0, SampleEnd: now, Scoreboard: scoreboard, Timeline: timeline, TotalTeams: teamCount, Tasks: 24, MaxPoints: Math.round((scoreboard[0]?.Points ?? 0) / 0.8 / 50) * 50,
        Freeze: {BannerText: "", BannerLevel: "warning", Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false},
        Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
    };
}

// Sample stages for the «Етапи» block of an event without stages: three
// two-hour stages from the start with short breaks.
export function liveSampleStages(start: string): LiveStage[] {
    const at = Date.parse(start);
    const hour = 60 * 60 * 1000;
    return [0, 1, 2].map(index => ({
        Name: t(`live.sample.stage.${index + 1}`),
        OpensAt: new Date(at + index * 2.25 * hour).toISOString(),
        ClosesAt: new Date(at + (index * 2.25 + 2) * hour).toISOString(),
    }));
}
