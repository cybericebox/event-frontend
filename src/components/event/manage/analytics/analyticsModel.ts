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
