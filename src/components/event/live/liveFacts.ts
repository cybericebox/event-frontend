import type {LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {clockLabel} from "@/utils/resultsFreeze";
import {t, tPlural} from "@/i18n/t";
import {livePoints} from "./liveTable";

// «Факти»: numbers from the live results, the event and its time. All are
// public on the board already: the team count, the published tasks, the
// solves shown (frozen ones stay hidden), the first solve, start and finish.
export const liveFactKeys = ["teams", "tasks", "solves", "solvedTasks", "firstBlood", "start", "finish"] as const;
export type LiveFactKey = typeof liveFactKeys[number];
export const liveFactDefault: LiveFactKey[] = ["teams", "tasks", "start"];
export const liveFactLimit = 6;

export function liveFactItems(widget: LiveWidget): LiveFactKey[] {
    const value = widget.props.items;
    if (!Array.isArray(value)) return liveFactDefault;
    const keys = [...new Set(value.filter((item): item is LiveFactKey => (liveFactKeys as readonly unknown[]).includes(item)))].slice(0, liveFactLimit);
    return keys.length ? keys : liveFactDefault;
}

// One fact on the screen: a value over its label; `text` marks a value of
// words (a team name), not digits.
export type LiveFact = {key: LiveFactKey; value: string; label: string; text: boolean};

export function liveFacts(keys: LiveFactKey[], event: PublicEventInfo, results: ManageResultsSnapshot | undefined): LiveFact[] {
    const timeline = results?.Timeline ?? [];
    const out: LiveFact[] = [];
    for (const key of keys) {
        if (key === "teams") {
            const count = results?.TotalTeams ?? 0;
            out.push({key, value: livePoints(count), label: tPlural(event.Participation === 1 ? "live.facts.teams" : "live.facts.participants", count), text: false});
        } else if (key === "tasks") {
            // Only the live view carries the task count; without it the fact is left out.
            if (results?.Tasks === undefined) continue;
            out.push({key, value: livePoints(results.Tasks), label: tPlural("live.facts.tasks", results.Tasks), text: false});
        } else if (key === "solves") {
            out.push({key, value: livePoints(timeline.length), label: tPlural("live.facts.solves", timeline.length), text: false});
        } else if (key === "solvedTasks") {
            const solved = new Set(timeline.map(item => item.EventChallengeID)).size;
            out.push({key, value: livePoints(solved), label: tPlural("live.facts.solvedTasks", solved), text: false});
        } else if (key === "firstBlood") {
            const first = timeline.reduce<typeof timeline[number] | null>((best, item) => !best || item.SolvedAt < best.SolvedAt ? item : best, null);
            const team = first ? results?.Scoreboard.find(row => row.TeamID === first.EventTeamID)?.TeamName : undefined;
            out.push(first
                ? {key, value: team ?? t(event.Participation === 1 ? "live.table.team" : "live.table.participant"), label: t("live.facts.firstBlood", {task: first.ChallengeName, time: clockLabel(first.SolvedAt)}), text: true}
                : {key, value: t("live.facts.none"), label: t("live.facts.firstBloodLabel"), text: true});
        } else if (key === "start") {
            out.push({key, value: liveFactMoment(event.StartTime, multiDay(event)), label: t("live.facts.start"), text: false});
        } else if (key === "finish" && event.FinishTime) {
            out.push({key, value: liveFactMoment(event.FinishTime, multiDay(event)), label: t("live.facts.finish"), text: false});
        }
    }
    return out;
}

// An event over more than one (local) day names the date of its start and
// finish too: «21.10 10:00».
function multiDay(event: Pick<PublicEventInfo, "StartTime" | "FinishTime">): boolean {
    if (!event.FinishTime) return false;
    const day = (value: string) => new Date(value).toDateString();
    return day(event.StartTime) !== day(event.FinishTime);
}

export function liveFactMoment(value: string, withDate: boolean): string {
    if (!withDate) return clockLabel(value);
    const date = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit"}).format(new Date(value));
    return t("live.facts.dateTime", {date, time: clockLabel(value)});
}
