import {z} from "zod";
import {manageApiError} from "@/api/manage";
import type {ParticipantAnswers} from "@/api/participantForm";
import {requireApiOrigin} from "@/utils/origins";

const nilUUID = "00000000-0000-0000-0000-000000000000";

// Fields prefill the person's participant form answers (CSV import).
export type InvitationEntry = {Email: string; FirstName?: string; LastName?: string; Fields?: ParticipantAnswers};
export type InvitationCode = "email_invalid" | "already_participant" | "account_unavailable" | "fields_invalid" | "failed";
export type InvitationResult = {Email: string; UserID: string | null; Code: InvitationCode | null};

const invitationResultSchema = z.object({Email: z.string(), UserID: z.string(), Error: z.string(), Code: z.string().optional()});

function invitationCode(result: z.infer<typeof invitationResultSchema>): InvitationCode | null {
    if (!result.Error && !result.Code) return null;
    const code = result.Code as InvitationCode | undefined;
    return code && ["email_invalid", "already_participant", "account_unavailable", "fields_invalid", "failed"].includes(code) ? code : "failed";
}

async function post(eventID: string, path: string, payload: unknown): Promise<unknown> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return response.json();
}

// Invites people to the event (or to a team): names are optional and prefill
// the pending account the invitation creates for an unknown address.
export async function sendInvitations(eventID: string, entries: InvitationEntry[], teamID?: string): Promise<InvitationResult[]> {
    const path = teamID ? `teams/${encodeURIComponent(teamID)}/invitations` : "participants/invitations";
    const data = z.object({Data: z.array(invitationResultSchema)}).parse(await post(eventID, path, {Entries: entries})).Data;
    return data.map(result => ({Email: result.Email, UserID: result.UserID === nilUUID ? null : result.UserID, Code: invitationCode(result)}));
}

export type BatchTeamMember = {Email: string; FirstName?: string; LastName?: string; Fields?: ParticipantAnswers};
export type BatchTeam = {Name: string; CaptainEmail: string; Members: BatchTeamMember[]; Fields?: ParticipantAnswers};

const batchResultSchema = z.object({
    Issues: z.array(z.object({Team: z.number().int(), Email: z.string().optional().default(""), Code: z.string()})),
    Teams: z.array(z.object({ID: z.string().uuid(), Name: z.string(), Created: z.boolean()})),
    Assigned: z.number().int(), Invited: z.number().int(), Unchanged: z.number().int(),
    NotSent: z.array(z.string()).nullish().transform(value => value ?? []),
});
export type BatchTeamsResult = z.infer<typeof batchResultSchema>;
export type BatchTeamIssue = BatchTeamsResult["Issues"][number];

// Creates teams with their members in one transaction. With any issue nothing
// is written and Issues says what to fix; dryRun only validates and counts.
// csvImport checks form fields by type only: required ones may stay blank.
export async function createManageTeams(eventID: string, teams: BatchTeam[], dryRun = false, csvImport = false): Promise<BatchTeamsResult> {
    return z.object({Data: batchResultSchema}).parse(await post(eventID, "teams/batch", {Teams: teams, DryRun: dryRun, Import: csvImport})).Data;
}
