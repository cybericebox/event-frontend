import {z} from "zod";
import {ManageApiError, manageApiError} from "@/api/manage";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";
import type {ResultsAvailability} from "@/types/resultsAvailability";
import {apiOrigin, requireApiOrigin} from "@/utils/origins";

const id = z.string().uuid();
const scoreboardEntrySchema = z.object({
    Rank: z.number().int(), TeamID: id, TeamName: z.string(), Points: z.number().int(), Solved: z.number().int().default(0), LastSolveAt: z.string().nullable(),
});
const timelineEntrySchema = z.object({EventTeamID: id, EventChallengeID: id, ChallengeName: z.string(), Points: z.number().int(), SolvedAt: z.string()});
export const freezeSchema = z.object({
    Enabled: z.boolean(), FrozenAt: z.string().nullable(), FinishAt: z.string().nullable(), OpenedAt: z.string().nullable(),
    Active: z.boolean(), Applied: z.boolean().default(false),
});
const displaySchema = z.object({ChartEnabled: z.boolean(), ChartTeams: z.number().int(), RowsLimit: z.number().int().nullable()});
const noFreeze = {Enabled: false, FrozenAt: null, FinishAt: null, OpenedAt: null, Active: false, Applied: false};
export const resultsSnapshotSchema = z.object({
    Revision: z.number().int(), GeneratedAt: z.string(), Scoreboard: z.array(scoreboardEntrySchema), Timeline: z.array(timelineEntrySchema),
    TotalTeams: z.number().int().optional(),
    Freeze: freezeSchema.default(noFreeze),
    Display: displaySchema.default({ChartEnabled: true, ChartTeams: 10, RowsLimit: null}),
}).transform(value => ({...value, TotalTeams: value.TotalTeams ?? value.Scoreboard.length}));

export type ManageResultsSnapshot = z.output<typeof resultsSnapshotSchema>;
export type ResultsFreeze = z.infer<typeof freezeSchema>;
export type ResultsView = "page" | "live";

const deniedReasons: Record<number, ResultsAvailability> = {61213: "hidden", 61214: "participants_only", 61215: "not_started"};

// 403 on /results names why the board is closed to this viewer.
export class ResultsUnavailableError extends ManageApiError {
    constructor(readonly reason: ResultsAvailability) {
        super(403);
    }
}

function apiBase(): string {
    const api = requireApiOrigin();
    return `${api}/api`;
}

// The public snapshot. `view: "live"` is the projector screen (W9): nothing is
// trimmed and the freeze follows the live setting.
export async function getManageResults(eventID: string, view: ResultsView = "page"): Promise<ManageResultsSnapshot> {
    const query = view === "live" ? "?view=live" : "";
    const response = await fetch(`${apiBase()}/events/${encodeURIComponent(eventID)}/results${query}`, {
        credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (response.status === 403) {
        const body = z.object({Status: z.object({Code: z.number()})}).safeParse(await response.json().catch(() => null));
        const reason = body.success ? deniedReasons[body.data.Status.Code] : undefined;
        throw reason ? new ResultsUnavailableError(reason) : new ManageApiError(403);
    }
    if (!response.ok) throw new ManageApiError(response.status);
    return z.object({Data: resultsSnapshotSchema}).parse(await response.json()).Data;
}

// SSE of result changes after the given snapshot revision. EventSource cannot
// send Last-Event-ID on the first connect, so the cursor goes in the query.
export function resultsLiveURL(eventID: string, revision: number, view: ResultsView = "page"): string | null {
    if (!apiOrigin) return null;
    const params = new URLSearchParams({lastEventId: String(revision)});
    if (view === "live") params.set("view", "live");
    return `${apiOrigin}/api/events/${encodeURIComponent(eventID)}/results/live?${params}`;
}

const moderatorTeamSchema = z.object({
    Rank: z.number().int().nullable(), TeamID: id, Name: z.string(), RealName: z.string(), Pseudonym: z.string().nullable(),
    Individual: z.boolean(), Hidden: z.boolean(), Admitted: z.boolean(), Points: z.number().int(), Solved: z.number().int(), LastSolveAt: z.string().nullable(),
    Hints: z.number().int().default(0), HintPoints: z.number().int().default(0),
    Solves: z.array(z.object({ChallengeID: id, ChallengeName: z.string(), Points: z.number().int(), SolvedAt: z.string(), FirstBlood: z.boolean()})).default([]),
});
const moderatorResultsSchema = z.object({
    Revision: z.number().int(), GeneratedAt: z.string(), Freeze: freezeSchema,
    Counts: z.object({Ranked: z.number().int(), Hidden: z.number().int(), NotAdmitted: z.number().int()}),
    Teams: z.array(moderatorTeamSchema),
});
export type ModeratorResults = z.infer<typeof moderatorResultsSchema>;
export type ModeratorResultsTeam = z.infer<typeof moderatorTeamSchema>;
export type ModeratorResultsSolve = ModeratorResultsTeam["Solves"][number];

const settingsSchema = z.object({
    ScoreboardVisibility: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    FreezeEnabled: z.boolean(), FreezeMinutes: z.number().int(), LiveFreeze: z.boolean(),
    ChartEnabled: z.boolean(), ChartTeams: z.number().int(), RowsLimit: z.number().int().nullable(),
    OpenedAt: z.string().nullable(), Freeze: freezeSchema,
});
export type ResultsSettings = z.infer<typeof settingsSchema>;
export type ResultsSettingsInput = Omit<ResultsSettings, "OpenedAt" | "Freeze">;

export function resultsSettingsInput(settings: ResultsSettings): ResultsSettingsInput {
    const {ScoreboardVisibility, FreezeEnabled, FreezeMinutes, LiveFreeze, ChartEnabled, ChartTeams, RowsLimit} = settings;
    return {ScoreboardVisibility, FreezeEnabled, FreezeMinutes, LiveFreeze, ChartEnabled, ChartTeams, RowsLimit};
}

async function manageRequest<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", payload?: unknown): Promise<T> {
    const response = await fetch(`${apiBase()}/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(payload === undefined ? {} : {"Content-Type": "application/json"})},
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

// Moderator results: all teams (hidden and not admitted marked), always live.
export async function getModeratorResults(eventID: string): Promise<ModeratorResults> {
    return manageRequest(eventID, "results", moderatorResultsSchema);
}

export async function getResultsSettings(eventID: string): Promise<ResultsSettings> {
    return manageRequest(eventID, "results-settings", settingsSchema);
}

export async function putResultsSettings(eventID: string, input: ResultsSettingsInput): Promise<ResultsSettings> {
    return manageRequest(eventID, "results-settings", settingsSchema, "PUT", input);
}

// «Відкрити підсумки» (opened) ends the freeze early; false restores it.
export async function setResultsOpened(eventID: string, opened: boolean): Promise<ResultsSettings> {
    return manageRequest(eventID, "results/opened", settingsSchema, "PUT", {Opened: opened});
}

export function downloadResultsCSV(eventID: string): Promise<void> {
    return downloadManageCSV(eventID, "results/export.csv", csvFileName("results"));
}
