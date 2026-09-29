import type {ManageResultsSnapshot} from "@/api/manageResults";
import {tPlural} from "@/i18n/t";
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
