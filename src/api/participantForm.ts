import {z} from "zod";
import {getManageParticipantForm, participantFormSchema, type ParticipantForm} from "@/api/manageParticipantForm";
import {readApiErrorCode} from "@/api/apiErrors";
import {joinInfoSchema, type JoinInfo} from "@/api/clientAuth";
import {requireApiOrigin} from "@/utils/origins";

export type ParticipantAnswer = string | number | boolean | string[];
export type ParticipantAnswers = Record<string, ParticipantAnswer>;

export class ParticipantJoinError extends Error {
    constructor(readonly status: number, readonly code?: number) { super(`Participant join request failed: ${status}`); }
}

function url(path: string): string {
    const api = requireApiOrigin();
    return `${api}/api/events/self/${path}`;
}

async function data<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    if (!response.ok) throw new ParticipantJoinError(response.status, await readApiErrorCode(response));
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

export async function acceptSelfInvitation(): Promise<JoinInfo> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return joinInfoSchema.parse({Status: 2});
    const response = await fetch(url("invitation/accept"), {method: "POST", credentials: "include", cache: "no-store"});
    return data(response, joinInfoSchema);
}

export async function declineSelfInvitation(): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    const response = await fetch(url("invitation/decline"), {method: "POST", credentials: "include", cache: "no-store"});
    if (!response.ok) throw new ParticipantJoinError(response.status, await readApiErrorCode(response));
}

const pseudonymSchema = z.object({Pseudonym: z.string().nullable(), DisplayName: z.string()});
export type PseudonymResult = z.infer<typeof pseudonymSchema>;

// W3 builds the UI; `null` or an empty string clears the pseudonym.
export async function putSelfPseudonym(pseudonym: string | null): Promise<PseudonymResult> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {Pseudonym: pseudonym || null, DisplayName: pseudonym || "Олена Коваль"};
    const response = await fetch(url("pseudonym"), {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({Pseudonym: pseudonym || null}),
    });
    return data(response, pseudonymSchema);
}

const ownAnswersSchema = z.object({
    Form: participantFormSchema,
    Answers: z.record(z.string(), z.unknown()).nullish().transform(value => (value ?? {}) as ParticipantAnswers),
    Editable: z.boolean(),
});
export type OwnParticipantAnswers = z.infer<typeof ownAnswersSchema>;
let mockOwnAnswers: ParticipantAnswers = {};

// The caller's registration answers; only `editable` fields change after approval.
export async function getOwnParticipantAnswers(eventID: string): Promise<OwnParticipantAnswers | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const form = await getManageParticipantForm(eventID);
        return form && {Form: form, Answers: mockOwnAnswers, Editable: true};
    }
    const response = await fetch(url("participant-answers"), {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    return data(response, ownAnswersSchema);
}

export async function putOwnParticipantAnswers(eventID: string, answers: ParticipantAnswers): Promise<OwnParticipantAnswers> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockOwnAnswers = {...mockOwnAnswers, ...answers};
        const form = await getManageParticipantForm(eventID);
        if (!form) throw new ParticipantJoinError(404);
        return {Form: form, Answers: mockOwnAnswers, Editable: true};
    }
    const response = await fetch(url("participant-answers"), {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({Answers: answers}),
    });
    return data(response, ownAnswersSchema);
}
