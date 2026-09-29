import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {challengeSchema, type OwnChallenge} from "@/api/participantChallenges";
import {requireApiOrigin} from "@/utils/origins";

// The hidden moderators team: managers check tasks, flags and files without
// touching results. The backend records nothing for these submissions.
function url(eventID: string, path: string): string {
    const api = requireApiOrigin();
    return `${api}/api/events/${encodeURIComponent(eventID)}/manage/labs/moderators${path}`;
}

export async function getModeratorsBoard(eventID: string): Promise<OwnChallenge[]> {
    const response = await fetch(url(eventID, "/board"), {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: challengeSchema.array().nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}

export async function checkModeratorFlag(eventID: string, challengeID: string, answer: string): Promise<boolean> {
    const response = await fetch(url(eventID, `/challenges/${encodeURIComponent(challengeID)}/submit`), {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Answer: answer}),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: z.object({Correct: z.boolean()})}).parse(await response.json()).Data.Correct;
}

export function moderatorFileUrl(eventID: string, challengeID: string, fileID: string): string {
    return url(eventID, `/challenges/${encodeURIComponent(challengeID)}/files/${encodeURIComponent(fileID)}`);
}

// The hidden team itself: its members are the event's managers.
const moderatorsTeamSchema = z.object({
    TeamID: z.string().uuid(),
    Members: z.array(z.object({UserID: z.string().uuid(), Name: z.string(), Role: z.number().int()})).nullish().transform(value => value ?? []),
});
export type ModeratorsTeam = z.infer<typeof moderatorsTeamSchema>;

export async function getModeratorsTeam(eventID: string): Promise<ModeratorsTeam> {
    const response = await fetch(url(eventID, "/team"), {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: moderatorsTeamSchema}).parse(await response.json()).Data;
}
