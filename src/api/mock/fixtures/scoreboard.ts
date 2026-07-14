import {IResponse} from "@/types/api";
import {EventScoreSchema, IEventScore} from "@/types/event";

// Stable UUID helper for fixtures (valid v4 shape; deterministic strings).
const uid = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
// Challenge IDs reused as TeamSolutions keys.
const CH = [uid("c1"), uid("c2"), uid("c3")];
// Event window mirrors the event fixture (started ~1h ago).
const t0 = Date.now() - 3600_000;
const at = (mins: number) => new Date(t0 + mins * 60_000).toISOString();

// One climbing timeline per team.
const timeline = (pts: number[]): [string, number][] =>
    pts.map((v, i) => [at(i * 12), v]);

const teams = [
    {name: "frostbyte", rank: 1, score: 6850, solved: 3, tl: [400, 1100, 2000, 3100, 4200, 5200, 6850]},
    {name: "IceBreakers", rank: 2, score: 6400, solved: 3, tl: [300, 900, 1700, 2600, 3600, 4600, 6400]},
    {name: "SubZero", rank: 3, score: 5200, solved: 2, tl: [200, 700, 1400, 2200, 3100, 4100, 5200]},
    {name: "Glacier", rank: 4, score: 3900, solved: 2, tl: [150, 500, 1000, 1700, 2500, 3200, 3900]},
    {name: "Permafrost", rank: 5, score: 2600, solved: 1, tl: [100, 300, 700, 1200, 1700, 2200, 2600]},
    {name: "Blizzard", rank: 6, score: 1200, solved: 1, tl: [50, 150, 350, 600, 800, 1000, 1200]},
];

const data: IEventScore = EventScoreSchema.parse({
    Challenges: [
        {ID: CH[0], Name: "IceWall"},
        {ID: CH[1], Name: "SQL Frostbite"},
        {ID: CH[2], Name: "Glacier Cipher"},
    ],
    TeamsScores: teams.map((t, ti) => ({
        TeamID: uid(`70${ti}`),
        TeamName: t.name,
        Rank: t.rank,
        Score: t.score,
        LatestSolution: at(60 + ti),
        // First `t.solved` challenges count as solved by this team.
        TeamSolutions: Object.fromEntries(
            CH.slice(0, t.solved).map((chID, ri) => [chID, {ID: chID, Rank: ri + 1}])
        ),
        TeamScoreTimeline: timeline(t.tl),
    })),
});

export const scoreFixture: IResponse<IEventScore> = {
    Status: {Code: 200, Message: "OK"},
    Data: data,
};
