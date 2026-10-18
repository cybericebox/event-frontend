import {z} from "zod";
import {manageApiError} from "./manage";
import {requireApiOrigin} from "@/utils/origins";

const selection = z.object({ID: z.string().uuid().optional(), ExerciseVersionID: z.string().uuid(), VariantID: z.string().uuid(), Name: z.string().optional(), VariantIndex: z.number().optional(), VariantPosition: z.number().optional()});
const selections = z.array(selection).nullish().transform(value => value ?? []);
const settings = z.object({DefaultSelections: selections, DefaultGroupName: z.string(), DynamicAllocated: z.boolean(), GroupName: z.string(), GroupNameOverride: z.string().nullable(), Inherit: z.boolean(), Selections: selections, EffectiveSelections: selections});
const catalog = z.array(z.object({ID: z.string().uuid(), ExerciseVersionID: z.string().uuid(), Name: z.string(), Infrastructure: z.boolean(), Eligible: z.boolean().default(true), Reason: z.string().nullish().transform(value => value ?? ""), Variants: z.array(z.object({ID: z.string().uuid(), Index: z.number().int(), Position: z.number().int(), Infrastructure: z.boolean().default(false)}))}));
export type PreviewSelection = z.infer<typeof selection>;
export type PreviewSettings = z.infer<typeof settings>;
export type PreviewSettingsDraft = Pick<PreviewSettings, "Inherit" | "Selections" | "GroupNameOverride">;
export const previewSettingsKey = (eventID: string) => ["event-preview-settings", eventID] as const;
export const previewSettingsIdentity = (input: PreviewSettingsDraft) => JSON.stringify([input.GroupNameOverride, input.Inherit, input.Inherit ? [] : input.Selections.map(item => [item.ExerciseVersionID, item.VariantID])]);
async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, input?: unknown): Promise<T> {
    const response = await fetch(`${requireApiOrigin()}/api/events/${encodeURIComponent(eventID)}/manage/participant-preview/${path}`, {method: input ? "PUT" : "GET", credentials: "include", cache: "no-store", headers: {Accept: "application/json", ...(input ? {"Content-Type": "application/json"} : {})}, ...(input ? {body: JSON.stringify(input)} : {})});
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}
export const getPreviewSettings = (eventID: string) => request(eventID, "settings", settings);
export const getPreviewCatalog = (eventID: string, search: string) => request(eventID, `catalog?search=${encodeURIComponent(search)}`, catalog);
export const savePreviewSettings = (eventID: string, input: PreviewSettingsDraft) => request(eventID, "settings", settings, {GroupName: input.GroupNameOverride, Inherit: input.Inherit, Selections: input.Selections.map(({ExerciseVersionID, VariantID}) => ({ExerciseVersionID, VariantID}))});
