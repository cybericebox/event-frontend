import {z} from "zod";
import {ManageApiError} from "@/api/manage";
import type {ResultsAvailability} from "@/types/resultsAvailability";

const id = z.string().uuid();
const scoreboardEntrySchema = z.object({
    Rank: z.number().int(), TeamID: id, TeamName: z.string(), Points: z.number().int(), LastSolveAt: z.string().nullable(),
});
const timelineEntrySchema = z.object({EventTeamID: id, EventChallengeID: id, ChallengeName: z.string(), Points: z.number().int(), SolvedAt: z.string()});
const snapshotSchema = z.object({Revision: z.number().int(), GeneratedAt: z.string(), Scoreboard: z.array(scoreboardEntrySchema), Timeline: z.array(timelineEntrySchema)});

export type ManageResultsSnapshot = z.infer<typeof snapshotSchema>;

const deniedReasons: Record<number, ResultsAvailability> = {61213: "hidden", 61214: "participants_only", 61215: "not_started"};

// 403 on /results names why the board is closed to this viewer.
export class ResultsUnavailableError extends ManageApiError {
    constructor(readonly reason: ResultsAvailability) {
        super(403);
    }
}

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
    if (response.status === 403) {
        const body = z.object({Status: z.object({Code: z.number()})}).safeParse(await response.json().catch(() => null));
        const reason = body.success ? deniedReasons[body.data.Status.Code] : undefined;
        throw reason ? new ResultsUnavailableError(reason) : new ManageApiError(403);
    }
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: snapshotSchema}).parse(await response.json()).Data;
}
