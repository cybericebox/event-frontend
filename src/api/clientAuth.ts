import {z} from "zod";

const meSchema = z.object({
    ID: z.string().uuid(),
    FirstName: z.string().default(""),
    LastName: z.string().default(""),
    Email: z.string().default(""),
    Picture: z.string().default(""),
});
export type CurrentUser = z.infer<typeof meSchema>;
const joinSchema = z.object({Status: z.number().int(), Invited: z.boolean().default(false), InvitedTeamName: z.string().default(""), TeamUnavailable: z.boolean().default(false)});
const ownTeamSchema = z.object({ID: z.string().uuid(), Name: z.string(), JoinCode: z.string(), MemberCount: z.number().int(), ExtraFields: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {})});
export type OwnTeam = z.infer<typeof ownTeamSchema>;

export class ClientAuthError extends Error {
    constructor(readonly status: number) {
        super(`Event authentication request failed: ${status}`);
    }
}

function apiUrl(path: string): string {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    return `https://api.${domain}/api${path}`;
}

async function readData<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    if (!response.ok) throw new ClientAuthError(response.status);
    const body: unknown = await response.json();
    return z.object({Data: schema}).parse(body).Data;
}

// Browser requests are the only place the host-only api.<domain> cookie exists.
export async function getCurrentUser(): Promise<CurrentUser | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return process.env.NEXT_PUBLIC_MOCK_PARTICIPANT === "1"
        ? meSchema.parse({ID: "01900000-0000-7000-8000-000000000031", FirstName: "Олена", LastName: "Коваль", Email: "participant@example.test"})
        : null;
    const response = await fetch(apiUrl("/auth/me"), {credentials: "include", cache: "no-store"});
    if (response.status === 401) return null;
    return readData(response, meSchema);
}

export function profilePictureUrl(picture: string): string | undefined {
    if (!picture) return undefined;
    if (picture.startsWith("/")) {
        const domain = process.env.NEXT_PUBLIC_DOMAIN;
        return domain ? `https://api.${domain}${picture}` : undefined;
    }
    return /^https:\/\//.test(picture) ? picture : undefined;
}

export async function getJoinStatus(): Promise<number> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return process.env.NEXT_PUBLIC_MOCK_PARTICIPANT === "1" ? 2 : 0;
    const response = await fetch(apiUrl("/events/self/join/info"), {credentials: "include", cache: "no-store"});
    return (await readData(response, joinSchema)).Status;
}

export async function getInvitationInfo(): Promise<z.infer<typeof joinSchema>> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return joinSchema.parse({Status: 0, Invited: false});
    const response = await fetch(apiUrl("/events/self/join/info"), {credentials: "include", cache: "no-store"});
    return readData(response, joinSchema);
}

export async function getOwnTeam(eventID: string): Promise<OwnTeam | null> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return process.env.NEXT_PUBLIC_MOCK_PARTICIPANT === "1"
        ? ownTeamSchema.parse({ID: "01900000-0000-7000-8000-000000000022", Name: "Blue Team", JoinCode: "MOCK-TEAM", MemberCount: 3})
        : null;
    const response = await fetch(apiUrl(`/events/${encodeURIComponent(eventID)}/teams/mine`), {credentials: "include", cache: "no-store"});
    if (response.status === 404) return null;
    return readData(response, ownTeamSchema);
}
