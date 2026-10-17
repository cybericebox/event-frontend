import {z} from "zod";
import {readApiErrorCode, readRetryAfter} from "@/api/apiErrors";
import {LabRuntimeSchema} from "@/api/manageLabs";
import {hintSchema, ownBoardSchema, ParticipantChallengeError, solvesPageSchema, submissionSchema, type OwnChallenge} from "@/api/participantChallenges";
import {requireApiOrigin} from "@/utils/origins";

type PreviewTask = Pick<OwnChallenge, "EventChallengeID" | "PreviewSelectionID" | "PreviewTaskID">;
export const previewBoardKey = (eventID: string | undefined) => ["event-participant-preview-board", eventID] as const;
export function previewBase(eventID: string) {
    return `${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/participant-preview`;
}
function selectionPath(selectionID: string) {
    if (!selectionID) throw new Error("Preview selection identity is required");
    return `/selections/${encodeURIComponent(selectionID)}`;
}
function taskPath(task: PreviewTask) {
    if (!task.PreviewSelectionID) throw new Error("Preview task has no selection identity");
    return `${selectionPath(task.PreviewSelectionID)}/tasks/${encodeURIComponent(task.PreviewTaskID ?? task.EventChallengeID)}`;
}
async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`${previewBase(eventID)}${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        throw new ParticipantChallengeError(response.status, await readApiErrorCode(response), readRetryAfter(response));
    }
    if (response.status === 204) return schema.parse(undefined);
    return z.object({Data: schema}).parse(await response.json()).Data;
}
export async function getPreviewBoard(eventID: string) {
    const board = await request(eventID, "/board", ownBoardSchema);
    return {...board, Challenges: board.Challenges.map(task => {
        if (!task.PreviewSelectionID) throw new Error("Preview task has no selection identity");
        return {...task, PreviewTaskID: task.EventChallengeID, ID: `${task.PreviewSelectionID}:${task.ID}`, EventChallengeID: `${task.PreviewSelectionID}:${task.EventChallengeID}`};
    })};
}
export const submitPreviewFlag = (eventID: string, task: PreviewTask, Flag: string) => request(eventID, `${taskPath(task)}/submit`, submissionSchema, "POST", {Flag});
export const unlockPreviewHint = (eventID: string, task: PreviewTask, hintID: string) => request(eventID, `${taskPath(task)}/hints/${encodeURIComponent(hintID)}/unlock`, hintSchema, "POST");
export const getPreviewSolves = (eventID: string, task: PreviewTask) => request(eventID, `${taskPath(task)}/solves`, solvesPageSchema);
export const previewFileUrl = (eventID: string, task: PreviewTask, fileID: string) => `${previewBase(eventID)}${taskPath(task)}/files/${encodeURIComponent(fileID)}`;
const runSchema = z.object({ID: z.string(), SelectionID: z.string(), Dynamic: z.boolean(), ExpiresAt: z.string().nullable()});
export const startPreviewRun = (eventID: string, selectionID: string) => request(eventID, `${selectionPath(selectionID)}/start`, runSchema, "POST");
export const stopPreviewRun = (eventID: string, selectionID: string) => request(eventID, `${selectionPath(selectionID)}/run`, z.undefined(), "DELETE");
export const resetPreviewRuns = (eventID: string) => request(eventID, "/runs", z.undefined(), "DELETE");
export const previewLabSchema = LabRuntimeSchema.extend({
    ExpiresAt: z.string().nullish(), Expired: z.boolean().default(false), Removing: z.boolean().default(false),
    VPNConnected: z.boolean().nullable().optional(), VPNProbeURL: z.string().default(""),
});
export type PreviewLab = z.infer<typeof previewLabSchema>;
export async function getPreviewLab(eventID: string, selectionID: string) {
    const lab = await request(eventID, `${selectionPath(selectionID)}/lab`, previewLabSchema);
    return lab.Expired || lab.Removing || !lab.Ready ? {...lab, Ready: false, Access: []} : lab;
}
export const getPreviewVPNConfig = async (eventID: string, selectionID: string) => (await request(eventID, `${selectionPath(selectionID)}/vpn`, z.object({Config: z.string()}))).Config;
export async function openPreviewLabLink(eventID: string, selectionID: string, Device: string, Port: number) {
    const result = await request(eventID, `${selectionPath(selectionID)}/proxy`, z.object({URL: z.string(), ExpiresAt: z.string()}), "POST", {Device, Port});
    return {url: result.URL, expiresAt: Date.parse(result.ExpiresAt), labID: null, revision: null};
}
