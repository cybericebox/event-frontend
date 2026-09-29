import {z} from "zod";
import {manageApiError} from "@/api/manage";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {TableFilter, TableSort} from "@/components/event/manage/tableFilterModel";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const optionalText = z.string().nullish().transform(value => value ?? "");
const memberSchema = z.object({UserID: id, Name: optionalText, Email: optionalText, Pseudonym: optionalText, Role: z.number().int().default(0)});
const pendingInvitationSchema = z.object({UserID: id, Email: optionalText, Name: optionalText, CreatedAt: z.string(), InvitationSentAt: z.string().nullable().default(null)});
const teamSchema = z.object({
    ID: id, Name: z.string(), CaptainID: id, Hidden: z.boolean(), MemberCount: z.number().int(),
    ExtraFields: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {}), CreatedAt: z.string(),
    Members: z.array(memberSchema).nullish().transform(value => value ?? []),
    PendingInvitations: z.array(pendingInvitationSchema).nullish().transform(value => value ?? []),
    Admitted: z.boolean().default(true), AdmittedManually: z.boolean().default(false),
    MinTeamSize: z.number().int().nullish().transform(value => value ?? null),
    // The captain is an invitee who has not accepted yet.
    CaptainPending: z.boolean().default(false),
});
export type ManageTeamMember = z.infer<typeof memberSchema>;
export type ManageTeamPendingInvitation = z.infer<typeof pendingInvitationSchema>;
export type ManageTeamInput = {Name: string; Hidden: boolean; Fields?: ParticipantAnswers};
const pageSchema = z.object({Items: z.array(teamSchema), Total: z.number().int(), NextCursor: id.optional()});
export type ManageTeam = z.infer<typeof teamSchema>;
export type ManageTeamsPage = z.infer<typeof pageSchema>;

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    if (method === "DELETE" || path.includes("/members/") || path.includes("/captain/")) return schema.parse(null);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export type TeamAdmissionFilter = "admitted" | "notAdmitted";
export type ManageTeamsFilter = {search?: string; admission?: TeamAdmissionFilter | null};

export async function getManageTeams(eventID: string, cursor: string | null, filter: ManageTeamsFilter = {}, pageSize = 20): Promise<ManageTeamsPage> {
    const params = new URLSearchParams({pageSize: String(pageSize)});
    if (filter.search?.trim()) params.set("search", filter.search.trim());
    if (filter.admission) params.set("admission", filter.admission);
    if (cursor) params.set("cursor", cursor);
    return request(eventID, `teams?${params}`, pageSchema);
}

export async function updateManageTeam(eventID: string, teamID: string, input: ManageTeamInput): Promise<ManageTeam> {
    return request(eventID, `teams/${encodeURIComponent(teamID)}`, teamSchema, "PUT", input);
}

export async function setManageTeamAdmission(eventID: string, teamID: string, admittedManually: boolean): Promise<ManageTeam> {
    return request(eventID, `teams/${encodeURIComponent(teamID)}/admission`, teamSchema, "PUT", {AdmittedManually: admittedManually});
}

export async function deleteManageTeam(eventID: string, teamID: string): Promise<void> {
    await request(eventID, `teams/${encodeURIComponent(teamID)}`, z.null(), "DELETE");
}

export async function changeManageTeamMember(eventID: string, teamID: string, userID: string, action: "add" | "remove"): Promise<void> {
    await request(eventID, `teams/${encodeURIComponent(teamID)}/members/${encodeURIComponent(userID)}`, z.null(), action === "add" ? "POST" : "DELETE");
}

export async function transferManageTeamCaptain(eventID: string, teamID: string, userID: string): Promise<void> {
    await request(eventID, `teams/${encodeURIComponent(teamID)}/captain/${encodeURIComponent(userID)}`, z.null(), "PUT");
}

const tablePageSchema = z.object({Items: z.array(teamSchema), Total: z.number().int(), Page: z.number().int(), PageSize: z.number().int()});
export type ManageTeamsTablePage = z.infer<typeof tablePageSchema>;
export type TeamsTableQuery = {search?: string; filters?: TableFilter[]; sort?: TableSort | null};

// Offset mode of the list (the manage table): every column filters and sorts.
export async function getManageTeamsTable(eventID: string, query: TeamsTableQuery, page: number, pageSize: number): Promise<ManageTeamsTablePage> {
    const params = new URLSearchParams({page: String(page), pageSize: String(pageSize)});
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.filters?.length) params.set("filters", JSON.stringify(query.filters));
    if (query.sort) {params.set("sortBy", query.sort.key); params.set("sortDir", query.sort.desc ? "desc" : "asc");}
    return request(eventID, `teams?${params}`, tablePageSchema);
}
