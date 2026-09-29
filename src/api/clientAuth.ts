import {z} from "zod";
import {apiOrigin, requireApiOrigin} from "@/utils/origins";
import {catalogAllowed} from "@/utils/accountMenu";

const meSchema = z.object({
    ID: z.string().uuid(),
    FirstName: z.string().default(""),
    LastName: z.string().default(""),
    Email: z.string().default(""),
    Picture: z.string().default(""),
    Role: z.string().default("user"),
});
export type CurrentUser = z.infer<typeof meSchema>;
// One participation action: allowed, or the reason code the server gives (see participationRules).
const capabilitySchema = z.object({Allowed: z.boolean().default(false), Reason: z.string().default("")}).default({Allowed: false, Reason: ""});
// What the caller can do right now, computed by the server from the event's
// schedule, its settings and the caller's own state. The site renders it and
// never derives these rules from dates.
export const participationSchema = z.object({
    Phase: z.enum(["not_published", "published", "started", "finished", "withdrawn"]).default("not_published"),
    RegistrationClosesAt: z.string().nullish().transform(value => value ?? null),
    Staff: z.boolean().default(false),
    RegistrationWindowOpen: z.boolean().default(false), RosterOpen: z.boolean().default(false),
    RegistrationReason: z.string().default(""), RosterReason: z.string().default(""),
    Register: capabilitySchema, CreateTeam: capabilitySchema, JoinTeam: capabilitySchema, LeaveTeam: capabilitySchema, ManageTeam: capabilitySchema,
    EditAnswers: capabilitySchema, SeeTasks: capabilitySchema, Submit: capabilitySchema,
});
export type Participation = z.infer<typeof participationSchema>;
export const joinInfoSchema = z.object({
    Status: z.number().int(), Invited: z.boolean().default(false),
    InvitedTeamName: z.string().nullish().transform(value => value ?? ""),
    InvitedTeamID: z.string().uuid().nullish().transform(value => value ?? null),
    TeamUnavailable: z.boolean().default(false), InvitationExpired: z.boolean().default(false),
    Participation: participationSchema.nullish().transform(value => value ?? null),
});
const joinSchema = joinInfoSchema;
export type JoinInfo = z.infer<typeof joinInfoSchema>;
const ownTeamSchema = z.object({
    ID: z.string().uuid(), Name: z.string(), MemberCount: z.number().int(),
    // The join code and its expiry are sent to the captain only.
    JoinCode: z.string().nullish().transform(value => value ?? ""), JoinCodeExpiresAt: z.string().nullish().transform(value => value ?? null),
    CaptainID: z.string().uuid().optional(),
    // TeamRole: 0 = captain, 1 = member.
    Role: z.number().int().default(1),
    ExtraFields: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {}),
    Admitted: z.boolean().optional(), MinTeamSize: z.number().int().nullish(), MaxTeamSize: z.number().int().nullish(),
    // Required team fields the organizer asked every team for and this team has not filled.
    MissingFields: z.array(z.string()).nullish(), BlockingFields: z.boolean().optional(),
});
export type OwnTeam = z.infer<typeof ownTeamSchema>;

export class ClientAuthError extends Error {
    constructor(readonly status: number) {
        super(`Event authentication request failed: ${status}`);
    }
}

function apiUrl(path: string): string {
    const api = requireApiOrigin();
    return `${api}/api${path}`;
}

async function readData<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    if (!response.ok) throw new ClientAuthError(response.status);
    const body: unknown = await response.json();
    return z.object({Data: schema}).parse(body).Data;
}

// Browser requests are the only place the host-only api.<domain> cookie exists.
export async function getCurrentUser(): Promise<CurrentUser | null> {
    const response = await fetch(apiUrl("/auth/me"), {credentials: "include", cache: "no-store"});
    if (response.status === 401) return null;
    return readData(response, meSchema);
}

const exerciseAccessSchema = z.object({
    IsAdmin: z.boolean().default(false),
    Events: z.array(z.unknown()).nullish(),
});

// GET /exercises/access: whether the exercise catalog opens for this user.
export async function getCatalogAccess(): Promise<boolean> {
    const response = await fetch(apiUrl("/exercises/access"), {credentials: "include", cache: "no-store"});
    return catalogAllowed(await readData(response, exerciseAccessSchema));
}

export function profilePictureUrl(picture: string): string | undefined {
    if (!picture) return undefined;
    if (picture.startsWith("/")) {
        return apiOrigin ? `${apiOrigin}${picture}` : undefined;
    }
    return /^https:\/\//.test(picture) ? picture : undefined;
}

export async function getJoinStatus(): Promise<number> {
    const response = await fetch(apiUrl("/events/self/join/info"), {credentials: "include", cache: "no-store"});
    return (await readData(response, joinSchema)).Status;
}

export async function getInvitationInfo(): Promise<JoinInfo> {
    const response = await fetch(apiUrl("/events/self/join/info"), {credentials: "include", cache: "no-store"});
    return readData(response, joinSchema);
}

// Superseded by getParticipation (server-computed); kept until the team tab stops using it.
// rosterOpen: teams may still change (locked-at-start events freeze at the start, rolling ones stay open until they finish).
export type RegistrationWindow = {registrationOpen: boolean; joinPolicy: string; startAt: string; finishAt: string; rosterOpen: boolean};

// The same public content values the join CTA reads, so /join agrees with it.
export async function getRegistrationWindow(eventID: string): Promise<RegistrationWindow> {
    const response = await fetch(`/api/content/values?${new URLSearchParams({eventId: eventID})}`, {cache: "no-store"});
    if (!response.ok) throw new ClientAuthError(response.status);
    const variables = z.object({Variables: z.record(z.string(), z.unknown())}).parse(await response.json()).Variables;
    return {
        registrationOpen: variables["event.registrationOpen"] === true,
        joinPolicy: String(variables["event.joinPolicy"] ?? ""),
        startAt: String(variables["event.startAt"] ?? ""),
        finishAt: String(variables["event.effectiveFinishAt"] ?? ""),
        rosterOpen: variables["event.rosterOpen"] === true,
    };
}

// The caller's participation block (null when the server did not send one).
export async function getParticipation(): Promise<Participation | null> {
    const response = await fetch(apiUrl("/events/self/join/info"), {credentials: "include", cache: "no-store"});
    return (await readData(response, joinSchema)).Participation;
}

export async function getOwnTeam(eventID: string): Promise<OwnTeam | null> {
    const response = await fetch(apiUrl(`/events/${encodeURIComponent(eventID)}/teams/mine`), {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    return readData(response, ownTeamSchema);
}
