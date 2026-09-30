import {z} from "zod";
import {manageApiError} from "@/api/manage";
import type {TableFilter, TableSort} from "@/components/event/manage/tableFilterModel";
import {requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const participantSchema = z.object({
    UserID: id, Name: z.string(), Email: z.string(),
    Pseudonym: z.string().nullish().transform(value => value ?? ""),
    DisplayName: z.string().nullish().transform(value => value ?? ""),
    TeamID: id.nullable(), TeamName: z.string().nullish().transform(value => value ?? ""),
    Hidden: z.boolean(), Invited: z.boolean().default(false),
    InvitedToTeam: z.boolean().default(false), InvitedTeamID: id.nullable().default(null),
    InvitedTeamName: z.string().nullish().transform(value => value ?? ""),
    InvitationSentAt: z.string().nullable().default(null), InvitationExpired: z.boolean().default(false),
    Status: z.union([z.literal(1), z.literal(2), z.literal(3)]), CreatedAt: z.string(), DecidedAt: z.string().nullable(),
    Answers: z.record(z.string(), z.unknown()).nullish().transform(value => value ?? {}),
    // How many required registration fields are unfilled (0 = complete or not asked).
    FieldsMissing: z.number().int().default(0),
});
const countsSchema = z.object({Participants: z.number().int(), Applications: z.number().int(), Invitations: z.number().int()});
const pageSchema = z.object({Items: z.array(participantSchema), Total: z.number().int(), NextCursor: id.optional(), Counts: countsSchema.optional()});
export type ManageParticipant = z.infer<typeof participantSchema>;
export type ManageParticipantsPage = z.infer<typeof pageSchema>;
export type ManageParticipantCounts = z.infer<typeof countsSchema>;
export type ParticipantStatus = ManageParticipant["Status"];
export type ParticipantListKind = "participants" | "applications" | "invitations";

export function participantListKind(participant: Pick<ManageParticipant, "Status" | "Invited">): ParticipantListKind {
    if (participant.Status === 2) return "participants";
    return participant.Invited && participant.Status === 1 ? "invitations" : "applications";
}

export type ParticipantListFilter = {kind?: ParticipantListKind | null; status?: ParticipantStatus | null; search?: string};

export async function getManageParticipants(eventID: string, filter: ParticipantListFilter, cursor: string | null, pageSize = 20): Promise<ManageParticipantsPage> {
    const api = requireApiOrigin();
    const params = new URLSearchParams({pageSize: String(pageSize)});
    if (filter.kind) params.set("kind", filter.kind);
    if (filter.status) params.set("status", String(filter.status));
    if (filter.search?.trim()) params.set("search", filter.search.trim());
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants?${params}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: pageSchema}).parse(await response.json()).Data;
}

export async function decideManageParticipant(eventID: string, userID: string, action: "approve" | "reject"): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/${action}`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
}

export async function setIndividualParticipantHidden(eventID: string, userID: string, hidden: boolean): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/visibility`, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({Hidden: hidden}),
    });
    if (!response.ok) throw await manageApiError(response);
}

const resendSchema = z.object({UserID: id, Email: z.string(), InvitationSentAt: z.string().nullable()});
export type InvitationResendResult = z.infer<typeof resendSchema>;

export async function resendManageInvitation(eventID: string, userID: string): Promise<InvitationResendResult> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/invitation/resend`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: resendSchema}).parse(await response.json()).Data;
}

export async function revokeManageInvitation(eventID: string, userID: string): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}/invitation`, {
        method: "DELETE", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
}

const tablePageSchema = z.object({Items: z.array(participantSchema), Total: z.number().int(), Page: z.number().int(), PageSize: z.number().int(), Counts: countsSchema.optional()});
export type ManageParticipantsTablePage = z.infer<typeof tablePageSchema>;
export type ParticipantsTableQuery = {kind: ParticipantListKind; search?: string; filters?: TableFilter[]; sort?: TableSort | null};

// Offset mode of the list (the manage table): every column filters and sorts.
export async function getManageParticipantsTable(eventID: string, query: ParticipantsTableQuery, page: number, pageSize: number): Promise<ManageParticipantsTablePage> {
    const api = requireApiOrigin();
    const params = new URLSearchParams({page: String(page), pageSize: String(pageSize), kind: query.kind});
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.filters?.length) params.set("filters", JSON.stringify(query.filters));
    if (query.sort) {params.set("sortBy", query.sort.key); params.set("sortDir", query.sort.desc ? "desc" : "asc");}
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants?${params}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: tablePageSchema}).parse(await response.json()).Data;
}

const detailSchema = participantSchema.extend({
    // 0 captain, 1 member, null when the participant has no team.
    TeamRole: z.union([z.literal(0), z.literal(1)]).nullish().transform(value => value ?? null),
    JoinedVia: z.enum(["open", "approval", "invitation"]).nullish().transform(value => value ?? null),
    Attempts: z.number().int().default(0), Solves: z.number().int().default(0),
});
export type ManageParticipantDetail = z.infer<typeof detailSchema>;

// One participant by id (the modal opened from `?participant=`), wherever it sits in the lists. 404 = unknown.
export async function getManageParticipant(eventID: string, userID: string): Promise<ManageParticipantDetail> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/participants/${encodeURIComponent(userID)}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: detailSchema}).parse(await response.json()).Data;
}
