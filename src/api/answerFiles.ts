import {z} from "zod";
import {readApiErrorCode} from "@/api/apiErrors";
import {requireApiOrigin} from "@/utils/origins";

// A «Файл» answer as the backend stores it: the uploaded file's reference and
// the metadata shown in tables. Only `id` is trusted on save; the server
// rewrites the rest from its own record.
export const answerFileSchema = z.object({id: z.string(), name: z.string(), size: z.number(), contentType: z.string()});
export type AnswerFile = z.infer<typeof answerFileSchema>;
export type AnswerScope = "participant" | "team";

export function isFileAnswer(value: unknown): value is AnswerFile {
    return answerFileSchema.safeParse(value).success;
}

export class AnswerFileError extends Error {
    constructor(readonly status: number, readonly code?: number) { super(`Answer file request failed: ${status}`); }
}

async function upload(url: string, scope: AnswerScope, field: string, file: File): Promise<AnswerFile> {
    const body = new FormData();
    body.set("scope", scope);
    body.set("field", field);
    body.set("file", file);
    const response = await fetch(url, {method: "POST", credentials: "include", cache: "no-store", body});
    if (!response.ok) throw new AnswerFileError(response.status, await readApiErrorCode(response));
    return z.object({Data: answerFileSchema}).parse(await response.json()).Data;
}

// Participant or captain upload on the event site (the event comes from the origin).
export function uploadSelfAnswerFile(scope: AnswerScope, field: string, file: File): Promise<AnswerFile> {
    return upload(`${requireApiOrigin()}/api/events/self/answer-files`, scope, field, file);
}

// Staff upload from /manage (e.g. filling team fields for a team).
export function uploadManageAnswerFile(eventID: string, scope: AnswerScope, field: string, file: File): Promise<AnswerFile> {
    return upload(`${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/answer-files`, scope, field, file);
}

export function selfAnswerFileUrl(id: string): string {
    return `${requireApiOrigin()}/api/events/self/answer-files/${encodeURIComponent(id)}`;
}

export function manageAnswerFileUrl(eventID: string, id: string): string {
    return `${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/answer-files/${encodeURIComponent(id)}`;
}
