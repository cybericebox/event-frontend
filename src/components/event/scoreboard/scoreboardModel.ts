import type {ManageResultsSnapshot} from "@/api/manageResults";
import {tPlural} from "@/i18n/t";
import {jitter} from "@/utils/jitter";
import {resultsLinkVisible, viewerResultsAvailability, type ResultsAvailability} from "@/types/resultsAvailability";

// «6 команд» / «1 учасник» — the scoreboard counts in the event's wording.
export function unitCount(count: number, teamMode: boolean): string {
    return tPlural(teamMode ? "scoreboard.teams" : "scoreboard.participants", count);
}

// Chart teams: the top `limit` by place plus the viewer's own team.
export function chartTeamIDs(snapshot: ManageResultsSnapshot, ownTeamID?: string): string[] {
    const ids = snapshot.Scoreboard.slice(0, Math.max(1, snapshot.Display.ChartTeams)).map(entry => entry.TeamID);
    if (ownTeamID && !ids.includes(ownTeamID) && snapshot.Scoreboard.some(entry => entry.TeamID === ownTeamID)) ids.push(ownTeamID);
    return ids;
}

// Search by name; places stay those of the full ranking.
export function searchScoreboard(snapshot: ManageResultsSnapshot, search: string): ManageResultsSnapshot["Scoreboard"] {
    const query = search.trim().toLocaleLowerCase("uk-UA");
    return query ? snapshot.Scoreboard.filter(entry => entry.TeamName.toLocaleLowerCase("uk-UA").includes(query)) : snapshot.Scoreboard;
}

export type ScoreboardAccess = {
    // The «Результати» item in the navbar and the footer.
    nav: boolean;
    // The results are read now (the API serves them to this viewer).
    fetch: boolean;
    // The table block message instead of rows, or null for the rows.
    message: "scoreboard.hidden" | "scoreboard.participantsOnly" | null;
};

// What the results page shows to one viewer: `base` is the availability of
// the public or participant info (the guest or participant view), `staff`
// the viewer's manage access. Before the start the audience reads the table
// too: the admitted teams with no points yet. Live is a staff screen opened
// from /manage, so this page has no Live action.
export function scoreboardAccess(base: ResultsAvailability, staff: boolean): ScoreboardAccess {
    const availability = viewerResultsAvailability(base, staff);
    const nav = resultsLinkVisible(availability);
    if (availability === "hidden") return {nav, fetch: false, message: "scoreboard.hidden"};
    if (availability === "participants_only") return {nav, fetch: false, message: "scoreboard.participantsOnly"};
    return {nav, fetch: true, message: null};
}

export const RESULTS_POLL_SECONDS = 30;
const MAX_POLL_MS = 5 * 60_000;

// The results page polls (no stream): 30 s ±20 % so viewers do not reach the
// server in step; after failures the delay doubles up to 5 minutes.
export function resultsPollDelay(failures: number, random: () => number = Math.random): number {
    const base = Math.min(MAX_POLL_MS, RESULTS_POLL_SECONDS * 1000 * 2 ** Math.max(0, failures));
    return jitter(base, random);
}

// The poll cursor: the revision after which changes are asked for, and the
// viewer's freeze state from the previous poll (null before the first one).
export type PollCursor = {since: number; freezeKey: string | null};

// What a poll answer means: new visible changes or a required snapshot reload
// the snapshot (the server ranks, the page never recomputes scores); otherwise
// the cursor moves on, past changes a frozen viewer does not get.
export function applyResultsPoll(cursor: PollCursor, answer: {Revision: number; Changes: unknown[]; SnapshotRequired: boolean; FreezeKey: string}): {cursor: PollCursor; reload: boolean} {
    if (answer.SnapshotRequired || answer.Changes.length > 0) return {cursor: {since: cursor.since, freezeKey: answer.FreezeKey}, reload: true};
    return {cursor: {since: Math.max(cursor.since, answer.Revision), freezeKey: answer.FreezeKey}, reload: false};
}
