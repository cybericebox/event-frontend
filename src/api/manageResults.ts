import {z} from "zod";
import {ManageApiError} from "@/api/manage";

const id = z.string().uuid();
const scoreboardEntrySchema = z.object({
    Rank: z.number().int(), TeamID: id, TeamName: z.string(), Points: z.number().int(), LastSolveAt: z.string().nullable(),
});
const timelineEntrySchema = z.object({EventTeamID: id, EventChallengeID: id, Points: z.number().int(), SolvedAt: z.string()});
const snapshotSchema = z.object({Revision: z.number().int(), GeneratedAt: z.string(), Scoreboard: z.array(scoreboardEntrySchema), Timeline: z.array(timelineEntrySchema)});

export type ManageResultsSnapshot = z.infer<typeof snapshotSchema>;

export async function getManageResults(eventID: string): Promise<ManageResultsSnapshot> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return snapshotSchema.parse({
        Revision: 3, GeneratedAt: "2026-09-26T14:12:00Z",
        Scoreboard: [
            {Rank: 1, TeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue Team", Points: 350, LastSolveAt: "2026-09-26T14:10:00Z"},
            {Rank: 2, TeamID: "01900000-0000-7000-8000-000000000026", TeamName: "Red Team", Points: 150, LastSolveAt: "2026-09-26T13:48:00Z"},
        ],
        Timeline: [
            {EventTeamID: "01900000-0000-7000-8000-000000000022", EventChallengeID: "01900000-0000-7000-8000-000000000011", Points: 150, SolvedAt: "2026-09-26T13:50:00Z"},
            {EventTeamID: "01900000-0000-7000-8000-000000000026", EventChallengeID: "01900000-0000-7000-8000-000000000012", Points: 150, SolvedAt: "2026-09-26T13:48:00Z"},
            {EventTeamID: "01900000-0000-7000-8000-000000000022", EventChallengeID: "01900000-0000-7000-8000-000000000012", Points: 200, SolvedAt: "2026-09-26T14:10:00Z"},
        ],
    });
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/results`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: snapshotSchema}).parse(await response.json()).Data;
}
