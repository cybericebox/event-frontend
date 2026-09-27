import {z} from "zod";
import {getManageParticipantForm, participantFormSchema, type ParticipantForm} from "@/api/manageParticipantForm";

export type ParticipantAnswer = string | number | boolean | string[];
export type ParticipantAnswers = Record<string, ParticipantAnswer>;

export class ParticipantJoinError extends Error {
    constructor(readonly status: number) { super(`Participant join request failed: ${status}`); }
}

function url(path: string): string {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    return `https://api.${domain}/api/events/self/${path}`;
}

async function data<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    if (!response.ok) throw new ParticipantJoinError(response.status);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getSelfParticipantForm(eventID: string): Promise<ParticipantForm | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return getManageParticipantForm(eventID);
    const response = await fetch(url("participant-form"), {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    return data(response, participantFormSchema);
}

export async function submitSelfParticipantForm(eventID: string, answers: ParticipantAnswers): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    const response = await fetch(url("participant-form"), {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({Answers: answers}),
    });
    await data(response, z.unknown());
}

export async function joinSelfEvent(): Promise<number> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return 2;
    const response = await fetch(url("join"), {method: "POST", credentials: "include", cache: "no-store"});
    return (await data(response, z.object({Status: z.number().int()}))).Status;
}
