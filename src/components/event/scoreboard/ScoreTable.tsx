import type {ReactNode} from "react";
import {Search} from "lucide-react";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventLoading} from "@/components/event/EventLoading";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";

const time = new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit"});
const number = new Intl.NumberFormat("uk-UA");

type Rows = ManageResultsSnapshot["Scoreboard"];

// What the table block shows: rows, or one centered state in the same block.
export type ScoreTableState = {kind: "rows"; rows: Rows} | {kind: "loading"} | {kind: "empty"; message: string} | {kind: "custom"; content: ReactNode};

// The ranking block: the search above, the column header always visible, and
// loading or empty states centered in the body, so the block keeps its size.
export function ScoreTable({event, state, ownTeamID, teamMode, search, onSearch}: {
    event: PublicEventInfo;
    state: ScoreTableState;
    ownTeamID?: string;
    teamMode: boolean;
    search?: string;
    onSearch?: (value: string) => void;
}) {
    const searchLabel = teamMode ? t("scoreboard.searchTeams") : t("scoreboard.searchParticipants");
    return <section className="event-scoreboard" aria-label={t("scoreboard.tableLabel")}>
        {onSearch && <div className="event-scoreboard__toolbar">
            <label className="ib-input-wrap ib-input-wrap--search event-scoreboard__search">
                <Search aria-hidden="true" />
                <input className="ib-input" type="search" placeholder={searchLabel} aria-label={searchLabel} autoComplete="off" maxLength={100} value={search ?? ""}
                    disabled={state.kind !== "rows" && !search} onChange={changeEvent => onSearch(changeEvent.target.value)}
                    onKeyDown={keyEvent => {if (keyEvent.key === "Escape" && search) {keyEvent.stopPropagation(); onSearch("");}}} />
            </label>
        </div>}
        <div className="event-scoreboard__scroll">
            <table className={state.kind === "rows" ? undefined : "is-state"}>
                <thead><tr>
                    <th scope="col" className="event-scoreboard__place">{t("scoreboard.col.place")}</th>
                    <th scope="col">{teamMode ? t("scoreboard.col.team") : t("scoreboard.col.participant")}</th>
                    <th scope="col" className="ib-num">{t("scoreboard.col.points")}</th>
                    <th scope="col" className="ib-num">{t("scoreboard.col.solved")}</th>
                    <th scope="col" className="ib-num event-scoreboard__last">{t("scoreboard.col.last")}</th>
                </tr></thead>
                {state.kind === "rows" ? <tbody>{state.rows.map(team => <tr key={team.TeamID} className={ownTeamID === team.TeamID ? "is-own" : undefined} aria-current={ownTeamID === team.TeamID ? "true" : undefined}>
                    <td className="event-scoreboard__place">{team.Rank}</td>
                    <td className="event-scoreboard__name">{team.TeamName}</td>
                    <td className="ib-num event-scoreboard__points">{number.format(team.Points)}</td>
                    <td className="ib-num">{number.format(team.Solved)}</td>
                    <td className="ib-num event-scoreboard__last">{team.LastSolveAt ? <time dateTime={team.LastSolveAt}>{time.format(new Date(team.LastSolveAt))}</time> : "—"}</td>
                </tr>)}</tbody> : <tbody><tr><td className="event-scoreboard__state" colSpan={5}>
                    {state.kind === "loading" ? <EventLoading event={event} label={t("scoreboard.loadingResults")} />
                        : state.kind === "empty" ? <EmptyState message={state.message} /> : state.content}
                </td></tr></tbody>}
            </table>
        </div>
    </section>;
}
