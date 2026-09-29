import type {ManageResultsSnapshot} from "@/api/manageResults";

// «6 команд» / «1 учасник» — the scoreboard counts in the event's wording.
export function unitCount(count: number, teamMode: boolean): string {
    const forms = teamMode ? ["команда", "команди", "команд"] : ["учасник", "учасники", "учасників"];
    const a = count % 10, b = count % 100;
    const form = a === 1 && b !== 11 ? forms[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? forms[1] : forms[2];
    return `${count} ${form}`;
}

// Chart teams: the top `limit` by place plus the viewer's own team.
export function chartTeamIDs(snapshot: ManageResultsSnapshot, ownTeamID?: string): string[] {
    const ids = snapshot.Scoreboard.slice(0, Math.max(1, snapshot.Display.ChartTeams)).map(entry => entry.TeamID);
    if (ownTeamID && !ids.includes(ownTeamID) && snapshot.Scoreboard.some(entry => entry.TeamID === ownTeamID)) ids.push(ownTeamID);
    return ids;
}
