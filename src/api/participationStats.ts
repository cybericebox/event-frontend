import {z} from "zod";
import {readApiErrorCode} from "@/api/apiErrors";
import {requireApiOrigin} from "@/utils/origins";

export class ParticipationStatsError extends Error {
    constructor(readonly status: number, readonly code?: number) {
        super(`Participation stats request failed: ${status}`);
    }
}

const solveSchema = z.object({
    EventChallengeID: z.string(), ChallengeName: z.string(), Category: z.string(),
    Points: z.number().int(), SolvedAt: z.string(),
    SolvedByUserID: z.string().nullish().transform(value => value ?? null),
    SolvedByName: z.string().default(""), FirstBlood: z.boolean().default(false),
});
const memberSchema = z.object({
    UserID: z.string(), Name: z.string(), Role: z.number().int(), JoinedAt: z.string(),
    Points: z.number().int(), Solves: z.number().int(), FirstBloods: z.number().int(),
    Attempts: z.number().int(), CorrectAttempts: z.number().int(), Hints: z.number().int(),
});
const timelineSchema = z.object({EventChallengeID: z.string().optional(), Points: z.number().int(), SolvedAt: z.string()});
const list = <T extends z.ZodType>(schema: T) => z.array(schema).nullish().transform(value => value ?? []);

export const participationStatsSchema = z.object({
    // 0: the results are not shown to the caller or the team is not ranked.
    Rank: z.number().int(), Points: z.number().int(), Solved: z.number().int(), Frozen: z.boolean().default(false),
    Team: z.object({
        TeamID: z.string(), TeamName: z.string(), Attempts: z.number().int(), CorrectAttempts: z.number().int(),
        Hints: z.number().int(), FirstBloods: z.number().int(), Solves: list(solveSchema), Members: list(memberSchema),
    }),
    Me: memberSchema,
    Timeline: list(timelineSchema),
});
export type ParticipationStats = z.infer<typeof participationStatsSchema>;
export type ParticipationSolve = z.infer<typeof solveSchema>;
export type ParticipationMember = z.infer<typeof memberSchema>;
export type TimelineEntry = z.infer<typeof timelineSchema>;

// The caller's own team only; counters and solved tasks, never answers. The
// browser revalidates with the ETag, so a poll of an unchanged page is a 304.
// `as: "moderators"` is the organizers' preview: the real moderators team, where
// Me is the viewing organizer. 409 means the event has no owner to lead that team.
export async function getParticipationStats(eventID: string, as?: "moderators"): Promise<ParticipationStats> {
    const api = requireApiOrigin();
    const query = as ? `?as=${as}` : "";
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/results/participation${query}`, {credentials: "include", cache: "no-cache", headers: {Accept: "application/json"}});
    if (!response.ok) throw new ParticipationStatsError(response.status, await readApiErrorCode(response));
    return z.object({Data: participationStatsSchema}).parse(await response.json()).Data;
}
