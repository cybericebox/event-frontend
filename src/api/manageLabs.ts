import {z} from "zod";
import {manageApiError, ManageApiError} from "@/api/manage";

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

const mockModeratorsID = "01900000-0000-7000-8000-0000000000f0";
let mockLabs: ManageLabs = {
    InfrastructureAllowed: true, LaboratoriesAvailable: true, DeployLeadMinutes: 30, TeardownDelayMinutes: 60,
    DeployAt: new Date(Date.now() - 30 * 60_000).toISOString(), TeardownAt: null, ChallengesOpened: false,
    Summary: {Total: 3, NotDeployed: 0, Creating: 1, Ready: 1, Failed: 1, Removed: 0},
    Items: [
        {TeamID: mockModeratorsID, TeamName: "", Moderators: true, Status: "ready", Reason: "", UpdatedAt: new Date().toISOString(), Generation: 0, Labs: [{ChallengeID: "01900000-0000-7000-8000-0000000000c1", ChallengeName: "SQL-ін’єкція", Status: "ready", Reason: ""}]},
        {TeamID: "01900000-0000-7000-8000-000000000022", TeamName: "Blue Team", Moderators: false, Status: "failed", Reason: "ImagePullBackOff: web", UpdatedAt: new Date().toISOString(), Generation: 1, Labs: [{ChallengeID: "01900000-0000-7000-8000-0000000000c1", ChallengeName: "SQL-ін’єкція", Status: "failed", Reason: "ImagePullBackOff: web"}]},
        {TeamID: "01900000-0000-7000-8000-000000000023", TeamName: "Red Team", Moderators: false, Status: "creating", Reason: "", UpdatedAt: null, Generation: 0, Labs: [{ChallengeID: "01900000-0000-7000-8000-0000000000c1", ChallengeName: "SQL-ін’єкція", Status: "pending", Reason: ""}]},
    ],
};

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown, prefix = "manage/labs"): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/${prefix}${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function getManageLabs(eventID: string): Promise<ManageLabs> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return ManageLabsSchema.parse(mockLabs);
    return request(eventID, "", ManageLabsSchema);
}

export async function putManageLabsSettings(eventID: string, settings: ManageLabsSettings): Promise<ManageLabs> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const valid = settings.DeployLeadMinutes >= DEPLOY_LEAD_RANGE.min && settings.DeployLeadMinutes <= DEPLOY_LEAD_RANGE.max
            && settings.TeardownDelayMinutes >= TEARDOWN_DELAY_RANGE.min && settings.TeardownDelayMinutes <= TEARDOWN_DELAY_RANGE.max;
        if (!valid) throw new ManageApiError(400, StandErrorCode.SettingsInvalid);
        mockLabs = {...mockLabs, ...settings};
        return ManageLabsSchema.parse(mockLabs);
    }
    return request(eventID, "/settings", ManageLabsSchema, "PUT", settings);
}

export async function recreateStand(eventID: string, teamID: string): Promise<ManageStand> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const stand = mockLabs.Items.find(item => item.TeamID === teamID);
        if (!stand) throw new ManageApiError(404, StandErrorCode.TeamNotFound);
        if (stand.Status === "not_deployed" || stand.Status === "removed") throw new ManageApiError(409, StandErrorCode.NotDeployed);
        const next: ManageStand = {...stand, Status: "creating", Reason: "", Generation: stand.Generation + 1, UpdatedAt: new Date().toISOString(), Labs: stand.Labs.map(lab => ({...lab, Status: "pending", Reason: ""}))};
        mockLabs = {...mockLabs, Items: mockLabs.Items.map(item => item.TeamID === teamID ? next : item)};
        return standSchema.parse(next);
    }
    return request(eventID, `/${encodeURIComponent(teamID)}/recreate`, standSchema, "POST");
}

export async function getModeratorChallenges(eventID: string): Promise<ModeratorChallenge[]> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return z.array(ModeratorChallengeSchema).parse([
            {ChallengeID: "01900000-0000-7000-8000-0000000000c1", Name: "SQL-ін’єкція", Readiness: "ready", Lab: {Status: "ready"}},
            {ChallengeID: "01900000-0000-7000-8000-0000000000c2", Name: "Перший крок", Readiness: "available", Lab: null},
        ]);
    }
    return request(eventID, "/moderators/challenges", z.array(ModeratorChallengeSchema).nullish().transform(value => value ?? []));
}

export async function getModeratorChallengeLab(eventID: string, challengeID: string): Promise<LabRuntime> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return LabRuntimeSchema.parse({Phase: "Ready", Ready: true, VPNCIDR: "10.20.0.0/24", InternetCIDR: "", Access: [{Device: "web", Port: 80, Protocol: "http", URL: "http://10.20.0.10/"}]});
    }
    return request(eventID, `/moderators/challenges/${encodeURIComponent(challengeID)}/lab`, LabRuntimeSchema);
}

export async function getModeratorVPNConfig(eventID: string): Promise<string> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return "[Interface]\nAddress = 10.20.0.2/32\n";
    return (await request(eventID, "/moderators/vpn", vpnSchema)).Config;
}

// Participant view of the own team's stand (no failure reason) for the VPN modal.
export async function getOwnStandStatus(eventID: string): Promise<StandStatus> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return "ready";
    return (await request(eventID, "/stand", ownStandSchema, "GET", undefined, "teams/labs")).Status;
}
