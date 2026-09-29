import {z} from "zod";
import {manageApiError, ManageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const optionalText = z.string().nullish().transform(value => value ?? "");
const optionalTime = z.string().nullish().transform(value => value ?? null);

export const StandStatusSchema = z.enum(["not_deployed", "creating", "ready", "failed", "removed"]);
export type StandStatus = z.infer<typeof StandStatusSchema>;
export const LabStatusSchema = z.enum(["pending", "ready", "failed", "removed"]);
export type LabStatus = z.infer<typeof LabStatusSchema>;

const standLabSchema = z.object({ChallengeID: id, ChallengeName: optionalText, Status: LabStatusSchema, Reason: optionalText});
const standSchema = z.object({
    TeamID: id, TeamName: optionalText, Moderators: z.boolean().default(false), Status: StandStatusSchema,
    Reason: optionalText, UpdatedAt: optionalTime, Generation: z.number().int().default(0),
    Labs: z.array(standLabSchema).nullish().transform(value => value ?? []),
});
const summarySchema = z.object({
    Total: z.number().int(), NotDeployed: z.number().int(), Creating: z.number().int(),
    Ready: z.number().int(), Failed: z.number().int(), Removed: z.number().int(),
});
export const ManageLabsSchema = z.object({
    InfrastructureAllowed: z.boolean(), LaboratoriesAvailable: z.boolean(),
    DeployLeadMinutes: z.number().int(), TeardownDelayMinutes: z.number().int(),
    DeployAt: optionalTime, TeardownAt: optionalTime, ChallengesOpened: z.boolean(),
    Summary: summarySchema,
    Items: z.array(standSchema).nullish().transform(value => value ?? []),
});
export type ManageStand = z.infer<typeof standSchema>;
export type ManageLabs = z.infer<typeof ManageLabsSchema>;
export type ManageLabsSettings = Pick<ManageLabs, "DeployLeadMinutes" | "TeardownDelayMinutes">;

export const ModeratorChallengeSchema = z.object({
    ChallengeID: id, Name: optionalText, Readiness: z.enum(["preparing", "ready", "available"]),
    Lab: z.object({Status: LabStatusSchema}).nullable().default(null),
});
export type ModeratorChallenge = z.infer<typeof ModeratorChallengeSchema>;

const labAccessSchema = z.object({Device: optionalText, Port: z.number().int(), Protocol: optionalText, URL: optionalText});
export const LabRuntimeSchema = z.object({
    Phase: optionalText, Ready: z.boolean(), VPNCIDR: optionalText, InternetCIDR: optionalText,
    Access: z.array(labAccessSchema).nullish().transform(value => value ?? []),
});
export type LabRuntime = z.infer<typeof LabRuntimeSchema>;

const vpnSchema = z.object({Config: z.string().min(1)});
const ownStandSchema = z.object({Status: StandStatusSchema});

export const DEPLOY_LEAD_RANGE = {min: 5, max: 1440} as const;
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
} as const;

const standMessages: Partial<Record<number, string>> = {
    [StandErrorCode.InfrastructureNotAllowed]: "Для цієї події завдання з інфраструктурою не дозволені.",
    [StandErrorCode.SettingsInvalid]: "Перевірте час розгортання та видалення.",
    [StandErrorCode.TeamNotFound]: "Команду не знайдено.",
    [StandErrorCode.NotDeployed]: "Стенд ще не розгорнуто або вже видалено.",
    [StandErrorCode.EventFinished]: "Подія завершилася — стенд не можна перестворити.",
    [StandErrorCode.ModeratorsTeamUnavailable]: "Команда модераторів ще не створена.",
    [StandErrorCode.InfrastructureUnavailable]: "Інфраструктура зараз недоступна. Спробуйте пізніше.",
};

export function standErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof ManageApiError)) return fallback;
    if (error.code !== undefined && standMessages[error.code]) return standMessages[error.code]!;
    if (error.status === 503) return standMessages[StandErrorCode.InfrastructureUnavailable]!;
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
