import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";

const optionalNumber = z.number().nullish().transform(value => value ?? 0);
const optionalTime = z.string().nullish().transform(value => value ?? null);
const optionalText = z.string().nullish().transform(value => value ?? "");

// CPU in millicores, memory in bytes (the backend's Amount).
export const AmountSchema = z.object({CPUMillicores: optionalNumber, MemoryBytes: optionalNumber});
export type Amount = z.infer<typeof AmountSchema>;

export const ChangeStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type ChangeStatus = z.infer<typeof ChangeStatusSchema>;

const changeSchema = z.object({
    ID: z.string(),
    RequestedAt: z.string(),
    Size: AmountSchema.nullish().transform(value => value ?? null),
    Dynamic: AmountSchema.nullish().transform(value => value ?? null),
    WindowStart: optionalTime,
    WindowEnd: optionalTime,
    Reason: optionalText,
    Status: ChangeStatusSchema,
    DecidedAt: optionalTime,
    DecisionNote: optionalText,
});
export type ResourceChange = z.infer<typeof changeSchema>;

// The organizer's view: never names an agent. Reserved=false means the admin has set no reservation.
export const ManageResourcesSchema = z.object({
    Reserved: z.boolean().default(false),
    From: optionalTime,
    To: optionalTime,
    Teams: optionalNumber,
    Allocated: AmountSchema.nullish().transform(value => value ?? {CPUMillicores: 0, MemoryBytes: 0}),
    InUse: AmountSchema.nullish().transform(value => value ?? {CPUMillicores: 0, MemoryBytes: 0}),
    Free: AmountSchema.nullish().transform(value => value ?? {CPUMillicores: 0, MemoryBytes: 0}),
    BufferPercent: optionalNumber,
    Dynamic: AmountSchema.nullish().transform(value => value ?? null),
    Covered: z.boolean().default(true),
    Changes: z.array(changeSchema).nullish().transform(value => value ?? []),
});
export type ManageResources = z.infer<typeof ManageResourcesSchema>;

export type ChangeRequestInput = {
    Size: Amount | null;
    Dynamic: Amount | null;
    WindowStart: string | null;
    WindowEnd: string | null;
    Reason: string;
};

// Detail codes (full code % 10000): 22507 invalid request, 32513 no reservation, 72508 not enough reserved, 72514 one is pending.
export const ResourceErrorCode = {
    ChangeRequestInvalid: 2507,
    NoReservation: 2513,
    NotEnoughReserved: 2508,
    ChangeRequestPending: 2514,
} as const;

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/resources${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export const getManageResources = (eventID: string) => request(eventID, "", ManageResourcesSchema);
export const requestResourceChange = (eventID: string, input: ChangeRequestInput) => request(eventID, "/change-requests", z.unknown(), "POST", input).then(() => undefined);
