"use client";

import {useEffect, useState} from "react";
import {Radio, RefreshCw, TimerReset, Unplug} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import type {StreamMode} from "@/utils/eventStream";
import {staleStreamMs} from "@/utils/streamTiming";
import {t} from "@/i18n/t";
import "./liveStatus.css";

// How a page keeps its data fresh, shown at the top right of the page header.
// One wording system for every page:
//   «Наживо»           a live stream that confirmed itself recently;
//   «Перепідключення…» the stream is silent or reconnecting;
//   «Автооновлення»    the page polls (no stream, or the stream's fallback);
//   «Не підключено»    polling fails too;
//   manual             «Оновлено …» plus a refresh button.
export type DataFreshness =
    | {kind: "stream"; mode: StreamMode; pollSeconds: number; failing?: boolean}
    | {kind: "polling"; seconds: number; failing?: boolean}
    | {kind: "manual"; onRefresh: () => void; refreshing: boolean};

type Shown = "live" | "reconnecting" | "polling" | "offline" | "manual";

const clock = new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit", second: "2-digit"});

// What to show now. A stream whose last confirmation (updatedAt) is older
// than staleStreamMs is never shown as «Наживо».
export function shownFreshness(freshness: DataFreshness, updatedAt: number, now: number): Shown {
    if (freshness.kind === "manual") return "manual";
    if (freshness.kind === "polling") return freshness.failing ? "offline" : "polling";
    if (freshness.mode === "fallback") return freshness.failing ? "offline" : "polling";
    if (freshness.mode === "live" && updatedAt > 0 && now - updatedAt <= staleStreamMs) return "live";
    return "reconnecting";
}

const labels: Record<Exclude<Shown, "manual">, string> = {
    live: "manage.live.live", reconnecting: "manage.live.reconnecting", polling: "manage.live.polling", offline: "manage.live.disconnected",
};

function explanation(shown: Shown, freshness: DataFreshness): string {
    if (shown === "manual") return t("manage.live.hint.manual");
    if (shown === "live") return t("manage.live.hint.live");
    if (shown === "reconnecting") return t("manage.live.hint.reconnecting");
    const seconds = freshness.kind === "polling" ? freshness.seconds : freshness.kind === "stream" ? freshness.pollSeconds : 30;
    return shown === "polling" ? t("manage.live.hint.polling", {seconds}) : t("manage.live.hint.offline");
}

const icons = {live: Radio, reconnecting: Unplug, polling: TimerReset, offline: Unplug};

// updatedAt is the last time the data was confirmed fresh: a reload, a live
// event or a stream heartbeat, whichever came last. `hint` replaces the
// standard tooltip (e.g. a page that adds a freeze note).
export function LiveStatus({freshness, updatedAt, hint}: {freshness: DataFreshness; updatedAt: number; hint?: string}) {
    const [now, setNow] = useState(() => Date.now());
    // Re-check staleness while nothing else re-renders the header.
    useEffect(() => {
        if (freshness.kind !== "stream") return;
        const id = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(id);
    }, [freshness.kind]);
    const shown = shownFreshness(freshness, updatedAt, now);
    const updated = updatedAt > 0 ? t("manage.live.updated", {time: clock.format(new Date(updatedAt))}) : t("manage.live.notYet");
    const Icon = shown === "manual" ? null : icons[shown];
    return <div className={`event-live-status is-${shown}`}>
        <EventTooltip content={hint ?? explanation(shown, freshness)} placement="bottom">{id => <span className="event-live-status__body" tabIndex={0} aria-describedby={id}>
            {Icon && shown !== "manual" && <span className="event-live-status__state"><Icon size={16} aria-hidden="true" />{t(labels[shown])}</span>}
            <span className="event-live-status__updated">{updated}</span>
        </span>}</EventTooltip>
        {freshness.kind === "manual" && <EventTooltip content={t("manage.live.hint.manual")} silent>{() => <button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.live.refresh")} disabled={freshness.refreshing} onClick={freshness.onRefresh}>
            <RefreshCw size={16} aria-hidden="true" />
        </button>}</EventTooltip>}
    </div>;
}
