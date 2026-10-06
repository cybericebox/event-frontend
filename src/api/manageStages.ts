import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {EventExerciseAttachmentSchema} from "@/api/manageChallenges";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();

// A stage of the event: computed state, and which boundary of the event window it is anchored to
// (the first opens with the event, the last closes with it: those two times are the event's own).
export const StageSchema = z.object({
    ID: id, Name: z.string(), OpensAt: z.string(), ClosesAt: z.string(), Returnable: z.boolean(),
    State: z.enum(["upcoming", "open", "closed"]),
    First: z.boolean().default(false), Last: z.boolean().default(false),
    // The lead the platform computes for the labs that open with this stage (0 when unknown): their deploy starts that long before OpensAt.
    DeployLeadMinutes: z.number().int().default(0),
});
export type ManageStage = z.infer<typeof StageSchema>;
export type StageState = ManageStage["State"];
export type StageCreateInput = {Name: string; OpensAt: string; ClosesAt: string; Returnable: boolean};
export type StageUpdateInput = Partial<{Name: string; OpensAt: string; ClosesAt: string; Returnable: boolean; CloseNow: boolean}>;

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const response = await fetch(`${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export const getManageStages = (eventID: string) => request(eventID, "stages", z.array(StageSchema).nullish().transform(value => value ?? []));
export const createManageStage = (eventID: string, input: StageCreateInput) => request(eventID, "stages", StageSchema, "POST", input);
export const updateManageStage = (eventID: string, stageID: string, input: StageUpdateInput) => request(eventID, `stages/${encodeURIComponent(stageID)}`, StageSchema, "PUT", input);
export const deleteManageStage = (eventID: string, stageID: string) => request(eventID, `stages/${encodeURIComponent(stageID)}`, z.unknown(), "DELETE").then(() => undefined);
// The stage of an exercise set; null puts it back on the whole event. The answer is the set as the server now has it.
export const setExerciseStage = (eventID: string, attachmentID: string, stageID: string | null) => request(eventID, `exercises/${encodeURIComponent(attachmentID)}/stage`, EventExerciseAttachmentSchema, "PUT", {StageID: stageID});
