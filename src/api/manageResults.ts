import {z} from "zod";
import {ManageApiError} from "@/api/manage";

const id = z.string().uuid();
const scoreboardEntrySchema = z.object({
    Rank: z.number().int(), TeamID: id, TeamName: z.string(), Points: z.number().int(), LastSolveAt: z.string().nullable(),
});
const timelineEntrySchema = z.object({EventTeamID: id, EventChallengeID: id, ChallengeName: z.string(), Points: z.number().int(), SolvedAt: z.string()});
const snapshotSchema = z.object({Revision: z.number().int(), GeneratedAt: z.string(), Scoreboard: z.array(scoreboardEntrySchema), Timeline: z.array(timelineEntrySchema)});

export type ManageResultsSnapshot = z.infer<typeof snapshotSchema>;

export async function getManageResults(eventID: string): Promise<ManageResultsSnapshot> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();
        return snapshotSchema.parse({
        Revision: 3, GeneratedAt: at(0),
        Scoreboard: [
            {Rank: 1, TeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue Team", Points: 350, LastSolveAt: at(5)},
            {Rank: 2, TeamID: "01900000-0000-7000-8000-000000000026", TeamName: "Red Team", Points: 150, LastSolveAt: at(28)},
        ],
        Timeline: [
            {EventTeamID: "01900000-0000-7000-8000-000000000022", EventChallengeID: "01900000-0000-7000-8000-000000000011", ChallengeName: "Криптографія", Points: 150, SolvedAt: at(40)},
            {EventTeamID: "01900000-0000-7000-8000-000000000026", EventChallengeID: "01900000-0000-7000-8000-000000000012", ChallengeName: "Мережевий слід", Points: 150, SolvedAt: at(28)},
            {EventTeamID: "01900000-0000-7000-8000-000000000022", EventChallengeID: "01900000-0000-7000-8000-000000000012", ChallengeName: "Мережевий слід", Points: 200, SolvedAt: at(5)},
        ],
    });
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/results`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: snapshotSchema}).parse(await response.json()).Data;
}
