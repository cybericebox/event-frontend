import type {ParticipationSolve, ParticipationStats, TimelineEntry} from "@/api/participationStats";
import {t} from "@/i18n/t";

export type PointsPoint = [number, number];

// The running total after each entry, in time order. Entries may be negative (a hint paid from the balance).
export function cumulativePoints(entries: readonly {at: string; points: number}[]): PointsPoint[] {
    let total = 0;
    return [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map(entry => [Date.parse(entry.at), total += entry.points]);
}

export const timelineEntries = (timeline: readonly TimelineEntry[]) => timeline.map(item => ({at: item.SolvedAt, points: item.Points}));
export const solveEntries = (solves: readonly ParticipationSolve[]) => solves.map(item => ({at: item.SolvedAt, points: item.Points}));

// The caller's own solves inside the team's list.
export const ownSolves = (solves: readonly ParticipationSolve[], userID: string) => solves.filter(item => item.SolvedByUserID === userID);

export type CategoryShare = {category: string; solves: number; points: number};

// Solves and points per category, the most solved first.
export function categoryBreakdown(solves: readonly ParticipationSolve[]): CategoryShare[] {
    const byCategory = new Map<string, CategoryShare>();
    for (const solve of solves) {
        const share = byCategory.get(solve.Category) ?? {category: solve.Category, solves: 0, points: 0};
        share.solves += 1;
        share.points += solve.Points;
        byCategory.set(solve.Category, share);
    }
    return [...byCategory.values()].sort((a, b) => b.solves - a.solves || b.points - a.points || a.category.localeCompare(b.category, "uk"));
}

// Whole percent of correct attempts; null without attempts (never a made-up zero).
export function successRate(correct: number, attempts: number): number | null {
    return attempts > 0 ? Math.round((correct / attempts) * 100) : null;
}

export const wrongAttempts = (correct: number, attempts: number) => Math.max(0, attempts - correct);

// The chart shows the earliest solve the participant may have seen and now (or the finish) at the end.
export function chartWindow(startTime: string, finishTime: string | null, now: number, lastAt: number | null): {from: number; to: number} {
    const from = Date.parse(startTime);
    const finish = finishTime ? Date.parse(finishTime) : NaN;
    const end = Number.isFinite(finish) ? Math.min(finish, Math.max(now, lastAt ?? 0)) : Math.max(now, lastAt ?? 0);
    return {from: Number.isFinite(from) ? from : (lastAt ?? now), to: Math.max(end, (Number.isFinite(from) ? from : 0) + 1)};
}

const fullDate = new Intl.DateTimeFormat("uk-UA", {dateStyle: "long", timeStyle: "short"});
const shortDate = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});
const relative = new Intl.RelativeTimeFormat("uk-UA", {numeric: "auto"});

export const exactTime = (iso: string) => fullDate.format(Date.parse(iso));
export const shortTime = (iso: string) => shortDate.format(Date.parse(iso));

// «5 хвилин тому», «вчора»; a moment in the future reads as «щойно».
export function relativeTime(iso: string, now: number): string {
    const seconds = Math.round((Date.parse(iso) - now) / 1000);
    if (seconds > -45) return t("participation.time.justNow");
    const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit);
    }
    return t("participation.time.justNow");
}

export type StatsView = "loading" | "error" | "ready";

// The place line: «3 місце» or a dash when the results are not shown.
export function placeText(rank: number): string {
    return rank > 0 ? t("participation.stats.place", {rank}) : "—";
}

export function isEmptyStats(stats: ParticipationStats): boolean {
    return stats.Team.Solves.length === 0 && stats.Timeline.length === 0;
}
