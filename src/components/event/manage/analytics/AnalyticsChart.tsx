"use client";

import ReactECharts from "echarts-for-react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {EmptyState} from "@/components/ui/EmptyState";
import type {ChartState} from "./analyticsModel";
import "./analytics.css";

// The chart block every analytics section uses. It has a constant height, and
// its loading, error and empty states are centred inside that same block, so
// nothing jumps between them. `option` is an ECharts option (see
// activityChart.ts for the shared style).
export function AnalyticsChart({event, state, option, height = 340, ariaLabel, loadingLabel, errorMessage, emptyMessage, onRetry, error}: {
    event: PublicEventInfo;
    state: ChartState;
    option?: object;
    height?: number;
    ariaLabel: string;
    loadingLabel: string;
    errorMessage: string;
    emptyMessage: string;
    onRetry?: () => void;
    error?: unknown;
}) {
    return <div className="event-analytics-chart" style={{height, "--event-block-state-h": `${height}px`} as React.CSSProperties} role="img" aria-label={ariaLabel} aria-busy={state === "loading"}>
        {state === "loading" && <EventLoading event={event} label={loadingLabel} />}
        {state === "error" && <EventLoadError message={errorMessage} onRetry={onRetry} error={error} />}
        {state === "empty" && <EmptyState message={emptyMessage} />}
        {state === "ready" && option && <ReactECharts style={{height: "100%", width: "100%"}} option={option} notMerge />}
    </div>;
}
