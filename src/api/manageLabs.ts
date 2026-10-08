import {z} from "zod";
import {LabLifecycleSchema} from "@/api/labLifecycle";
import {manageApiError, ManageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";

const id = z.string().uuid();
const optionalText = z.string().nullish().transform(value => value ?? "");
const optionalTime = z.string().nullish().transform(value => value ?? null);

export const StandStatusSchema = z.enum(["not_deployed", "creating", "ready", "failed", "removed"]);
export type StandStatus = z.infer<typeof StandStatusSchema>;
export const LabStatusSchema = z.enum(["pending", "ready", "failed", "removed"]);
export type LabStatus = z.infer<typeof LabStatusSchema>;

const optionalNumber = z.number().int().nullish().transform(value => value ?? 0);

// The launch queue of a lab; Position 0 means every pod is already dispatched.
export const LabQueueSchema = z.object({
    Position: optionalNumber, Length: optionalNumber, Reason: optionalText, Message: optionalText, Pods: optionalNumber, Pending: optionalNumber,
});
export type LabQueue = z.infer<typeof LabQueueSchema>;

const failureSchema = z.object({Reason: optionalText, Message: optionalText, RestartCount: optionalNumber, At: optionalTime});
const schedulingSchema = z.object({
    State: optionalText, QueuedAt: optionalTime, DispatchedAt: optionalTime, StartedAt: optionalTime,
    Failure: failureSchema.nullish().transform(value => value ?? null),
});
const snapshotSchema = z.object({
    LastSnapshotAt: optionalTime, RestoredAt: optionalTime, SizeBytes: optionalNumber, Warning: optionalText,
    Rescue: z.boolean().nullish().transform(value => value ?? false),
});
export const LiveDeviceSchema = z.object({
    Name: z.string(), Ready: z.boolean().default(false), Reason: optionalText,
    Scheduling: schedulingSchema.nullish().transform(value => value ?? null),
    Snapshot: snapshotSchema.nullish().transform(value => value ?? null),
});
export type LiveDevice = z.infer<typeof LiveDeviceSchema>;
const liveSchema = z.object({
    Phase: optionalText, Ready: z.boolean().default(false),
    Queue: LabQueueSchema.nullish().transform(value => value ?? null),
    ImageWarning: optionalText, GroupImageWarning: optionalText,
    Devices: z.array(LiveDeviceSchema).nullish().transform(value => value ?? []),
});
export type LabLive = z.infer<typeof liveSchema>;

const standLabSchema = z.object({ChallengeID: id, ChallengeName: optionalText, Status: LabStatusSchema, Reason: optionalText});
// A stand's place in the launch queue (the stands list); Position 0 = everything is dispatched.
const standQueueSchema = z.object({QueuedLabs: optionalNumber, Position: optionalNumber, Length: optionalNumber, Reason: optionalText});
const standSchema = z.object({
    TeamID: id, TeamName: optionalText, Moderators: z.boolean().default(false), Status: StandStatusSchema,
    Reason: optionalText, UpdatedAt: optionalTime, Generation: z.number().int().default(0),
    Labs: z.array(standLabSchema).nullish().transform(value => value ?? []),
    Queue: standQueueSchema.nullish().transform(value => value ?? null),
    // Some images of the stand are pulled by tag, not by digest.
    ImageWarning: z.boolean().nullish().transform(value => value ?? false),
});
const prewarmSchema = z.object({
    Total: optionalNumber, Done: optionalNumber, Warming: optionalNumber, Queued: optionalNumber, Failed: optionalNumber, Skipped: optionalNumber, UpdatedAt: optionalTime,
});
export type Prewarm = z.infer<typeof prewarmSchema>;

const summarySchema = z.object({
    Total: z.number().int(), NotDeployed: z.number().int(), Creating: z.number().int(),
    Ready: z.number().int(), Failed: z.number().int(), Removed: z.number().int(),
});
export const ManageLabsSchema = z.object({
    InfrastructureAllowed: z.boolean(), LaboratoriesAvailable: z.boolean(),
    TeardownDelayMinutes: z.number().int(),
    // When the first labs start deploying: the start minus the lead the platform computes from the workload.
    DeployAt: optionalTime, TeardownAt: optionalTime, ChallengesOpened: z.boolean(),
    Summary: summarySchema,
    Prewarm: prewarmSchema.nullish().transform(value => value ?? null),
    Items: z.array(standSchema).nullish().transform(value => value ?? []),
});
const detailLabSchema = standLabSchema.extend({
    Live: liveSchema.nullish().transform(value => value ?? null),
    LiveUnavailable: z.boolean().nullish().transform(value => value ?? false),
});
export const StandDetailSchema = z.object({
    TeamID: id, TeamName: optionalText, Moderators: z.boolean().default(false), Status: StandStatusSchema, Reason: optionalText,
    Generation: z.number().int().default(0), LaboratoriesAvailable: z.boolean().default(false),
    Labs: z.array(detailLabSchema).nullish().transform(value => value ?? []),
});
export type StandDetail = z.infer<typeof StandDetailSchema>;
export type StandDetailLab = z.infer<typeof detailLabSchema>;
export type ManageStand = z.infer<typeof standSchema>;
export type ManageLabs = z.infer<typeof ManageLabsSchema>;
export type ManageLabsSettings = Pick<ManageLabs, "TeardownDelayMinutes">;

export const ModeratorChallengeSchema = z.object({
    ChallengeID: id, Name: optionalText, Readiness: z.enum(["preparing", "ready", "available"]),
    Lab: z.object({Status: LabStatusSchema}).nullable().default(null),
});
export type ModeratorChallenge = z.infer<typeof ModeratorChallengeSchema>;

const labAccessSchema = z.object({Device: optionalText, Port: z.number().int(), Protocol: optionalText, URL: optionalText});
export const LabRuntimeSchema = z.object({
    Lab: LabLifecycleSchema.nullish().transform(value => value ?? null),
    Phase: optionalText, Ready: z.boolean(), Queue: LabQueueSchema.nullish().transform(value => value ?? null), VPNCIDR: optionalText, InternetCIDR: optionalText,
    Access: z.array(labAccessSchema).nullish().transform(value => value ?? []),
});
export type LabRuntime = z.infer<typeof LabRuntimeSchema>;

const vpnSchema = z.object({Config: z.string().min(1)});
const ownStandSchema = z.object({Status: StandStatusSchema});

export const TEARDOWN_DELAY_RANGE = {min: 0, max: 10080} as const;

// Object code 20 (eventStand); detail codes follow the spec's error order.
export const StandErrorCode = {
    InfrastructureNotAllowed: 2001,
    SettingsInvalid: 2002,
    TeamNotFound: 2003,
    NotDeployed: 2004,
    EventFinished: 2005,
    ModeratorsTeamUnavailable: 2006,
    InfrastructureUnavailable: 1401,
    // Device actions of a running lab (object code 14, shared with the exercise lab).
    NoPersistence: 1405,
    DeviceNotFound: 1406,
    DeviceRestarting: 1407,
} as const;

// Stand codes have their own messages: manage.labs.error.<code>.
const standErrorCodes = new Set<number>(Object.values(StandErrorCode));

function standMessage(code: number): string {
    return t(`manage.labs.error.${code}`);
}

export function standErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof ManageApiError)) return fallback;
    if (error.code !== undefined && standErrorCodes.has(error.code)) return standMessage(error.code);
    if (error.status === 503) return standMessage(StandErrorCode.InfrastructureUnavailable);
    return fallback;
}

export function isInfrastructureNotAllowed(error: unknown): boolean {
    return error instanceof ManageApiError && error.code === StandErrorCode.InfrastructureNotAllowed;
}

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown, prefix = "manage/labs"): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/${prefix}${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageLabs(eventID: string): Promise<ManageLabs> {
    return request(eventID, "", ManageLabsSchema);
}

export async function putManageLabsSettings(eventID: string, settings: ManageLabsSettings): Promise<ManageLabs> {
    return request(eventID, "/settings", ManageLabsSchema, "PUT", settings);
}

export async function getStandDetail(eventID: string, teamID: string): Promise<StandDetail> {
    return request(eventID, `/${encodeURIComponent(teamID)}/detail`, StandDetailSchema);
}

function devicePath(teamID: string, challengeID: string, device: string): string {
    return `/${encodeURIComponent(teamID)}/challenges/${encodeURIComponent(challengeID)}/devices/${encodeURIComponent(device)}`;
}

// Throws the lab device back to its original image; whatever was changed on it is lost.
export async function resetStandDevice(eventID: string, teamID: string, challengeID: string, device: string): Promise<void> {
    await request(eventID, `${devicePath(teamID, challengeID, device)}/reset`, z.unknown(), "POST");
}

// Rescue mode: the device starts a shell from its latest snapshot instead of its service.
export async function setStandDeviceRescue(eventID: string, teamID: string, challengeID: string, device: string, enable: boolean): Promise<void> {
    await request(eventID, `${devicePath(teamID, challengeID, device)}/rescue`, z.unknown(), "POST", {Enable: enable});
}

export async function recreateStand(eventID: string, teamID: string): Promise<ManageStand> {
    return request(eventID, `/${encodeURIComponent(teamID)}/recreate`, standSchema, "POST");
}

export async function getModeratorChallenges(eventID: string): Promise<ModeratorChallenge[]> {
    return request(eventID, "/moderators/challenges", z.array(ModeratorChallengeSchema).nullish().transform(value => value ?? []));
}

export async function getModeratorChallengeLab(eventID: string, challengeID: string): Promise<LabRuntime> {
    return request(eventID, `/moderators/challenges/${encodeURIComponent(challengeID)}/lab`, LabRuntimeSchema);
}

export async function getModeratorVPNConfig(eventID: string): Promise<string> {
    return (await request(eventID, "/moderators/vpn", vpnSchema)).Config;
}

// Participant view of the own team's stand (no failure reason) for the VPN modal.
export async function getOwnStandStatus(eventID: string): Promise<StandStatus> {
    return (await request(eventID, "/stand", ownStandSchema, "GET", undefined, "teams/labs")).Status;
}
