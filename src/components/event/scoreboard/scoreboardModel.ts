import type {ManageResultsSnapshot} from "@/api/manageResults";
import {tPlural} from "@/i18n/t";

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
