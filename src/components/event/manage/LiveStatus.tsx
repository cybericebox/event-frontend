"use client";

import {Radio, RefreshCw, TimerReset, Unplug} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import type {StreamMode} from "@/utils/eventStream";
import {t} from "@/i18n/t";

// How a manage table keeps its data fresh, shown at the top right of the page
// header: a live stream, polling, or manual refresh.
export type DataFreshness =
    | {kind: "stream"; mode: StreamMode; pollSeconds: number}
    | {kind: "polling"; seconds: number}
    | {kind: "manual"; onRefresh: () => void; refreshing: boolean};

const clock = new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit", second: "2-digit"});

function label(freshness: DataFreshness): string | null {
    if (freshness.kind === "polling") return t("manage.live.polling");
    if (freshness.kind !== "stream") return null;
    if (freshness.mode === "live") return t("manage.live.live");
    return freshness.mode === "fallback" ? t("manage.live.disconnected") : t("manage.live.reconnecting");
}

function explanation(freshness: DataFreshness): string {
    if (freshness.kind === "manual") return t("manage.live.hint.manual");
    if (freshness.kind === "polling") return t("manage.live.hint.polling", {seconds: freshness.seconds});
    if (freshness.mode === "live") return t("manage.live.hint.live");
    return freshness.mode === "fallback" ? t("manage.live.hint.fallback", {seconds: freshness.pollSeconds}) : t("manage.live.hint.reconnecting");
}

export function LiveStatus({freshness, updatedAt}: {freshness: DataFreshness; updatedAt: number}) {
    const state = label(freshness);
    const Icon = freshness.kind === "polling" ? TimerReset : freshness.kind === "stream" && freshness.mode !== "live" ? Unplug : Radio;
    const updated = updatedAt > 0 ? t("manage.live.updated", {time: clock.format(new Date(updatedAt))}) : t("manage.live.notYet");
    const tone = freshness.kind === "stream" ? freshness.mode : freshness.kind;
    return <div className={`event-live-status is-${tone}`}>
        <EventTooltip content={explanation(freshness)} placement="bottom">{id => <span className="event-live-status__body" tabIndex={0} aria-describedby={id}>
            {state && <span className="event-live-status__state"><Icon size={16} aria-hidden="true" />{state}</span>}
            <span className="event-live-status__updated">{updated}</span>
        </span>}</EventTooltip>
        {freshness.kind === "manual" && <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.live.refresh")} disabled={freshness.refreshing} onClick={freshness.onRefresh}>
            <RefreshCw size={16} aria-hidden="true" />
        </button>}
    </div>;
}
