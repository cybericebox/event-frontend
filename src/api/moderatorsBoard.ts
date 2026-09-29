import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {getOwnChallenges, challengeSchema, type OwnChallenge} from "@/api/participantChallenges";

// The hidden moderators team: managers check tasks, flags and files without
// touching results. The backend records nothing for these submissions.
function url(eventID: string, path: string): string {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    return `https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/labs/moderators${path}`;
}

export async function getModeratorsBoard(eventID: string): Promise<OwnChallenge[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return (await getOwnChallenges(eventID)).map((item, index) => ({...item, SolvedAt: null, SolveCount: null, Locked: false, BoardPublished: index % 5 !== 4}));
    }
    const response = await fetch(url(eventID, "/board"), {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: challengeSchema.array().nullish().transform(value => value ?? [])}).parse(await response.json()).Data;
}

export async function checkModeratorFlag(eventID: string, challengeID: string, answer: string): Promise<boolean> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return answer === "ICE{demo}";
    const response = await fetch(url(eventID, `/challenges/${encodeURIComponent(challengeID)}/submit`), {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Answer: answer}),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: z.object({Correct: z.boolean()})}).parse(await response.json()).Data.Correct;
}

export function moderatorFileUrl(eventID: string, challengeID: string, fileID: string): string {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return "data:text/plain;charset=utf-8,Demo%20attachment";
    return url(eventID, `/challenges/${encodeURIComponent(challengeID)}/files/${encodeURIComponent(fileID)}`);
}
