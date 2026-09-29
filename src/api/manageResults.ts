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
const snapshotSchema = z.object({
    Revision: z.number().int(), GeneratedAt: z.string(), Scoreboard: z.array(scoreboardEntrySchema), Timeline: z.array(timelineEntrySchema),
    TotalTeams: z.number().int().optional(),
    Freeze: freezeSchema.default(noFreeze),
    Display: displaySchema.default({ChartEnabled: true, ChartTeams: 10, RowsLimit: null}),
}).transform(value => ({...value, TotalTeams: value.TotalTeams ?? value.Scoreboard.length}));

export type ManageResultsSnapshot = z.output<typeof snapshotSchema>;
export type ResultsFreeze = z.infer<typeof freezeSchema>;
export type ResultsView = "page" | "live";

const deniedReasons: Record<number, ResultsAvailability> = {61213: "hidden", 61214: "participants_only", 61215: "not_started"};

// 403 on /results names why the board is closed to this viewer.
export class ResultsUnavailableError extends ManageApiError {
    constructor(readonly reason: ResultsAvailability) {
        super(403);
    }
}

const mockTeams = ["Kyiv Hackers", "Red Team", "Null Pointers", "Blue Team", "Byte Club", "Root Access"];
// Blue Team is the mock participant's own team (clientAuth mocks).
const mockTeamID = (index: number) => index === 3 ? "01900000-0000-7000-8000-000000000022" : `01900000-0000-7000-8000-0000000000${String(40 + index)}`;
export const mockOwnTeamID = mockTeamID(3);
const mockTimeline = (() => {
    const out: Array<{EventTeamID: string; EventChallengeID: string; ChallengeName: string; Points: number; minutesAgo: number}> = [];
    mockTeams.forEach((_, team) => {
        for (let solve = 0; solve < 5 - Math.floor(team / 2); solve++) out.push({EventTeamID: mockTeamID(team), EventChallengeID: `01900000-0000-7000-8000-0000000001${String(10 + solve)}`, ChallengeName: ["Криптографія", "Мережевий слід", "Веб-форма", "Реверс", "Форензика"][solve], Points: 100 + 50 * ((solve + team) % 3), minutesAgo: 55 - solve * 10 - team * 2});
    });
    return out;
})();

function mockFrozen(): boolean {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockFrozen") === "1";
}

function mockSnapshot(): unknown {
    const now = Date.now();
    const frozen = mockFrozen();
    const frozenAt = now - 15 * 60000;
    const at = (minutesAgo: number) => new Date(now - minutesAgo * 60000).toISOString();
    const timeline = mockTimeline.filter(item => !frozen || now - item.minutesAgo * 60000 < frozenAt || item.EventTeamID === mockOwnTeamID);
    const scoreboard = mockTeams.map((name, index) => {
        const solves = timeline.filter(item => item.EventTeamID === mockTeamID(index));
        return {TeamID: mockTeamID(index), TeamName: name, Points: solves.reduce((sum, item) => sum + item.Points, 0), Solved: solves.length, LastSolveAt: solves.length ? at(Math.min(...solves.map(item => item.minutesAgo))) : null};
    }).sort((a, b) => b.Points - a.Points).map((entry, index) => ({...entry, Rank: index + 1}));
    return {
        Revision: 3, GeneratedAt: at(0), Scoreboard: scoreboard, TotalTeams: scoreboard.length,
        Timeline: timeline.map(({minutesAgo, ...item}) => ({...item, SolvedAt: at(minutesAgo)})),
        Freeze: {Enabled: true, FrozenAt: frozen ? new Date(frozenAt).toISOString() : new Date(now + 5 * 3_600_000).toISOString(), FinishAt: new Date(frozenAt + 30 * 60000 + (frozen ? 0 : 6 * 3_600_000)).toISOString(), OpenedAt: null, Active: frozen, Applied: frozen},
        Display: {ChartEnabled: true, ChartTeams: 5, RowsLimit: null},
    };
}

function apiBase(): string {
    const api = requireApiOrigin();
    return `${api}/api`;
}

// The public snapshot. `view: "live"` is the projector screen (W9): nothing is
// trimmed and the freeze follows the live setting.
export async function getManageResults(eventID: string, view: ResultsView = "page"): Promise<ManageResultsSnapshot> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return snapshotSchema.parse(mockSnapshot());
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
    return z.object({Data: snapshotSchema}).parse(await response.json()).Data;
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
});
const moderatorResultsSchema = z.object({
    Revision: z.number().int(), GeneratedAt: z.string(), Freeze: freezeSchema,
    Counts: z.object({Ranked: z.number().int(), Hidden: z.number().int(), NotAdmitted: z.number().int()}),
    Teams: z.array(moderatorTeamSchema),
});
export type ModeratorResults = z.infer<typeof moderatorResultsSchema>;
export type ModeratorResultsTeam = z.infer<typeof moderatorTeamSchema>;

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

let mockSettings: ResultsSettings = {ScoreboardVisibility: 2, FreezeEnabled: true, FreezeMinutes: 30, LiveFreeze: true, ChartEnabled: true, ChartTeams: 10, RowsLimit: null, OpenedAt: null, Freeze: {...noFreeze, Enabled: true}};

function mockFreeze(settings: ResultsSettings): ResultsFreeze {
    const finish = Date.now() + 6 * 3_600_000;
    const frozenAt = finish - settings.FreezeMinutes * 60000;
    return {Enabled: settings.FreezeEnabled, FrozenAt: settings.FreezeEnabled ? new Date(frozenAt).toISOString() : null, FinishAt: new Date(finish).toISOString(), OpenedAt: settings.OpenedAt, Active: false, Applied: false};
}

function mockModeratorResults(): ModeratorResults {
    const snapshot = snapshotSchema.parse(mockSnapshot());
    const teams: ModeratorResultsTeam[] = snapshot.Scoreboard.map(entry => ({Rank: entry.Rank, TeamID: entry.TeamID, Name: entry.TeamName, RealName: entry.TeamName, Pseudonym: null, Individual: false, Hidden: false, Admitted: true, Points: entry.Points, Solved: entry.Solved, LastSolveAt: entry.LastSolveAt}));
    teams.push({Rank: null, TeamID: "01900000-0000-7000-8000-000000000050", Name: "Команда організаторів-тест", RealName: "Команда організаторів-тест", Pseudonym: null, Individual: false, Hidden: true, Admitted: true, Points: 150, Solved: 1, LastSolveAt: snapshot.GeneratedAt});
    teams.push({Rank: null, TeamID: "01900000-0000-7000-8000-000000000051", Name: "Solo Ninjas", RealName: "Solo Ninjas", Pseudonym: null, Individual: false, Hidden: false, Admitted: false, Points: 0, Solved: 0, LastSolveAt: null});
    return {Revision: snapshot.Revision, GeneratedAt: snapshot.GeneratedAt, Freeze: mockFreeze(mockSettings), Counts: {Ranked: snapshot.Scoreboard.length, Hidden: 1, NotAdmitted: 1}, Teams: teams};
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
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return mockModeratorResults();
    return manageRequest(eventID, "results", moderatorResultsSchema);
}

export async function getResultsSettings(eventID: string): Promise<ResultsSettings> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {...mockSettings, Freeze: mockFreeze(mockSettings)};
    return manageRequest(eventID, "results-settings", settingsSchema);
}

export async function putResultsSettings(eventID: string, input: ResultsSettingsInput): Promise<ResultsSettings> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockSettings = {...mockSettings, ...input};
        return {...mockSettings, Freeze: mockFreeze(mockSettings)};
    }
    return manageRequest(eventID, "results-settings", settingsSchema, "PUT", input);
}

// «Відкрити підсумки» (opened) ends the freeze early; false restores it.
export async function setResultsOpened(eventID: string, opened: boolean): Promise<ResultsSettings> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockSettings = {...mockSettings, OpenedAt: opened ? new Date().toISOString() : null};
        return {...mockSettings, Freeze: mockFreeze(mockSettings)};
    }
    return manageRequest(eventID, "results/opened", settingsSchema, "PUT", {Opened: opened});
}

export function downloadResultsCSV(eventID: string): Promise<void> {
    return downloadManageCSV(eventID, "results/export.csv", csvFileName("results"), [
        ["Місце", "Назва", "Справжнє імʼя", "Псевдонім", "Бали", "Розвʼязано", "Останнє розвʼязання (UTC)", "Прихована", "Допущена"],
        ...mockModeratorResults().Teams.map(team => [team.Rank === null ? "" : String(team.Rank), team.Name, team.RealName, team.Pseudonym ?? "", String(team.Points), String(team.Solved), team.LastSolveAt ?? "", team.Hidden ? "так" : "ні", team.Admitted ? "так" : "ні"]),
    ]);
}
