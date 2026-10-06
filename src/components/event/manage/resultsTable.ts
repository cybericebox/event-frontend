import type {ModeratorResultsTeam} from "@/api/manageResults";
import {t} from "@/i18n/t";
import type {TableFilter, TableSort} from "./tableFilterModel";

// «Таблиця результатів» holds every team at once, so search, column filters,
// sort and paging run in the browser over the moderator snapshot.

export type ResultsStatus = "ranked" | "hidden" | "notAdmitted";

export function resultsStatus(team: ModeratorResultsTeam): ResultsStatus {
    if (team.Hidden) return "hidden";
    return team.Admitted ? "ranked" : "notAdmitted";
}

// The moderators team arrives without a name.
export function teamLabel(team: ModeratorResultsTeam): string {
    return team.Moderators ? t("manage.teams.moderatorsName") : team.Name;
}

function searchText(team: ModeratorResultsTeam): string {
    return [teamLabel(team), team.RealName, team.Pseudonym ?? ""].join(" ").toLocaleLowerCase("uk-UA");
}

function inRange(value: number, filter: Extract<TableFilter, {Op: "range"}>): boolean {
    const from = filter.From === undefined ? undefined : typeof filter.From === "number" ? filter.From : Date.parse(filter.From);
    const to = filter.To === undefined ? undefined : typeof filter.To === "number" ? filter.To : Date.parse(filter.To);
    if (from !== undefined && (filter.FromExclusive ? value <= from : value < from)) return false;
    return to === undefined || (filter.ToExclusive ? value < to : value <= to);
}

function numberOf(team: ModeratorResultsTeam, key: string): number | null {
    switch (key) {
    case "@rank": return team.Rank;
    case "@points": return team.Points;
    case "@solved": return team.Solved;
    case "@hints": return team.HintPoints;
    case "@last": return team.LastSolveAt ? Date.parse(team.LastSolveAt) : null;
    default: return null;
    }
}

export function matchesResultsFilter(team: ModeratorResultsTeam, filter: TableFilter): boolean {
    if (filter.Op === "contains") return searchText(team).includes(filter.Value.toLocaleLowerCase("uk-UA"));
    if (filter.Op === "any") return filter.Key === "@status" ? filter.Values.includes(resultsStatus(team)) : true;
    if (filter.Op === "bool" || filter.Op === "present") {
        if (filter.Key === "@firstBlood") return team.Solves.some(solve => solve.FirstBlood) === filter.Value;
        return filter.Key === "@last" ? !!team.LastSolveAt === filter.Value : true;
    }
    if (filter.Op !== "range") return true;
    const value = numberOf(team, filter.Key);
    return value !== null && inRange(value, filter);
}

// Rows in server order (by points) keep that order for «@rank»: unranked
// teams stay where their points put them.
export function selectResults(teams: ModeratorResultsTeam[], search: string, filters: TableFilter[], sort: TableSort): ModeratorResultsTeam[] {
    const query = search.trim().toLocaleLowerCase("uk-UA");
    const order = new Map(teams.map((team, index) => [team.TeamID, index]));
    const rows = teams.filter(team => (!query || searchText(team).includes(query)) && filters.every(filter => matchesResultsFilter(team, filter)));
    const direction = sort.desc ? -1 : 1;
    const compare = (a: ModeratorResultsTeam, b: ModeratorResultsTeam): number => {
        if (sort.key === "@name") return teamLabel(a).localeCompare(teamLabel(b), "uk-UA");
        if (sort.key === "@rank") return order.get(a.TeamID)! - order.get(b.TeamID)!;
        const left = numberOf(a, sort.key), right = numberOf(b, sort.key);
        // Empty values («—») always go last, whatever the direction.
        if (left === null || right === null) return left === right ? 0 : left === null ? direction : -direction;
        return left - right;
    };
    return rows.sort((a, b) => direction * compare(a, b) || order.get(a.TeamID)! - order.get(b.TeamID)!);
}

export function pageOf<T>(rows: T[], page: number, pageSize: number): T[] {
    return rows.slice((page - 1) * pageSize, page * pageSize);
}
