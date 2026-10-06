import type {AnalyticsPeriod, AnalyticsSeriesPoint} from "@/api/manageAnalytics";
import {localToISO} from "@/components/ui/dateTimePicker";

export type PeriodDraft = {from: string; to: string};
export const emptyPeriodDraft: PeriodDraft = {from: "", to: ""};

// The picker values are wall-clock strings in the viewer's zone; the API takes
// UTC. A blank or unparsable bound is left to the server (the event's window).
export function periodOf(draft: PeriodDraft): AnalyticsPeriod {
    return {from: draft.from ? localToISO(draft.from) : null, to: draft.to ? localToISO(draft.to) : null};
}

// The period is unusable only when both bounds are set and do not run forward.
export function periodInvalid(period: AnalyticsPeriod): boolean {
    return !!period.from && !!period.to && Date.parse(period.from) >= Date.parse(period.to);
}

export const periodSet = (draft: PeriodDraft) => draft.from !== "" || draft.to !== "";

export function seriesHasActivity(points: AnalyticsSeriesPoint[]): boolean {
    return points.some(point => point.Attempts + point.Correct + point.Solves + point.Opens > 0);
}

export type ChartState = "loading" | "error" | "empty" | "ready";

export type ChartMarker = {at: string | null; label: string};

// Lifecycle markers that fall inside the chart's window, in time order.
export function visibleMarkers(markers: ChartMarker[], from: string, to: string): {at: number; label: string}[] {
    const start = Date.parse(from);
    const end = Date.parse(to);
    return markers
        .flatMap(marker => marker.at ? [{at: Date.parse(marker.at), label: marker.label}] : [])
        .filter(marker => Number.isFinite(marker.at) && marker.at >= start && marker.at <= end)
        .sort((a, b) => a.at - b.at);
}

export function percent(part: number, whole: number): string {
    return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

export type EventPhase = "before" | "running" | "finished";

// Where the event is on the clock. A final report is finished whatever the
// clock says; an event without a finish time runs once it has started.
export function eventPhase(markers: {StartAt: string; FinishAt: string | null}, final: boolean, now: number): EventPhase {
    if (final) return "finished";
    if (now < Date.parse(markers.StartAt)) return "before";
    if (markers.FinishAt && now >= Date.parse(markers.FinishAt)) return "finished";
    return "running";
}

// How far a running event is, 0..1; null without a finish time.
export function eventProgress(markers: {StartAt: string; FinishAt: string | null}, now: number): number | null {
    if (!markers.FinishAt) return null;
    const start = Date.parse(markers.StartAt);
    const total = Date.parse(markers.FinishAt) - start;
    return total > 0 ? Math.min(1, Math.max(0, (now - start) / total)) : null;
}

// Merges 5-minute points into wider buckets so a long event stays readable:
// at most `max` points, the bucket a whole number of 5-minute steps. Counts
// add up. Returns the bucket length in minutes.
export function bucketSeries(points: AnalyticsSeriesPoint[], max = 288): {points: AnalyticsSeriesPoint[]; minutes: number} {
    const step = Math.max(1, Math.ceil(points.length / max));
    if (step === 1) return {points, minutes: 5};
    const out: AnalyticsSeriesPoint[] = [];
    for (let i = 0; i < points.length; i += step) {
        const group = points.slice(i, i + step);
        out.push(group.reduce((sum, point) => ({...sum, Attempts: sum.Attempts + point.Attempts, Correct: sum.Correct + point.Correct, Solves: sum.Solves + point.Solves, Opens: sum.Opens + point.Opens}), {...group[0], Attempts: 0, Correct: 0, Solves: 0, Opens: 0}));
    }
    return {points: out, minutes: step * 5};
}
