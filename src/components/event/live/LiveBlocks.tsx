"use client";

import type {CSSProperties} from "react";
import {EmptyState} from "@/components/ui/EmptyState";
import type {LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {clockLabel} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";
import {LiveCaption, LiveList, measureName, useElementSize, type LiveMetrics} from "./LiveParts";
import {liveFactsFit, livePodiumFit, livePodiumHeights, liveTimerFit, liveTwoLineRow} from "./liveFit";
import {liveFactItems, liveFacts} from "./liveFacts";
import {liveCurrentStage, liveNextStage, liveStageNameChars, type LiveStage} from "./liveStages";
import {livePoints} from "./liveTable";
import {liveSampleStages} from "./liveSample";

// «Подіум»: places 2, 1, 3 side by side, the winner's tile the tallest and
// in the accent. `caption` is null when the block hides it.
export function LivePodium({widget, event, results, metrics, caption}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; metrics: LiveMetrics; caption: string | null}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const top = (results?.Scoreboard ?? []).slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const fit = livePodiumFit({width: size.width, height: size.height, names: top.map(team => team.TeamName), body: metrics.body, caption: metrics.caption, measure: measureName});
    const points = widget.props.showPoints !== false;
    return <div className="live-podium">
        {caption !== null && <LiveCaption caption={caption} metrics={metrics} />}
        <div className="live-podium__stage" ref={ref} style={{gap: fit.gap}}>
            {!top.length ? <EmptyState compact message={t(event.Participation === 1 ? "live.podium.emptyTeams" : "live.podium.emptyParticipants")} />
                : size.width > 0 && order.map(team => {
                    const place = team.Rank;
                    const lead = place === 1;
                    return <div key={team.TeamID} className={`live-podium__tile${lead ? " is-lead" : ""}`}
                        style={{height: `${livePodiumHeights[Math.min(2, place - 1)] * 100}%`, padding: fit.pad} as CSSProperties}>
                        <span className="live-podium__place" style={{fontSize: fit.meta}}>{place}</span>
                        <strong style={{fontSize: lead ? fit.lead : fit.name}} title={team.TeamName}>{team.TeamName}</strong>
                        {points && <span className="live-podium__points" style={{fontSize: fit.meta}}>{livePoints(team.Points)}</span>}
                    </div>;
                })}
        </div>
    </div>;
}

// «Факти»: large numbers over their labels, side by side.
export function LiveFactsBlock({widget, event, results, metrics, caption}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; metrics: LiveMetrics; caption: string | null}) {
    const [ref, size] = useElementSize<HTMLDListElement>();
    const facts = liveFacts(liveFactItems(widget), event, results);
    const fit = liveFactsFit({width: size.width, height: size.height, items: facts.map(fact => ({value: fact.value.length, label: fact.label.length, text: fact.text})), display: metrics.display, caption: metrics.caption});
    return <div className="live-facts-block">
        {caption !== null && <LiveCaption caption={caption} metrics={metrics} />}
        <dl className="live-facts" ref={ref} style={{gap: fit.gap}}>
            {size.width > 0 && facts.map(fact => <div key={fact.key} className={fact.text ? "is-text" : undefined}>
                <dt style={{fontSize: fit.label}}>{fact.label}</dt>
                <dd style={{fontSize: fit.value}} title={fact.value}>{fact.value}</dd>
            </div>)}
        </dl>
    </div>;
}

type StageRow = {stage: LiveStage; status: "done" | "now" | "next" | "later"};

// «Етапи»: every stage with its time and status — done, running, next.
export function LiveStagesBlock({widget, event, stages, now, metrics, caption, sample}: {
    widget: LiveWidget; event: PublicEventInfo; stages: LiveStage[]; now: number; metrics: LiveMetrics; caption: string | null; sample: boolean;
}) {
    const shown = stages.length || !sample ? stages : liveSampleStages(event.StartTime);
    const current = liveCurrentStage(shown, now);
    const next = liveNextStage(shown, now);
    const rows: StageRow[] = [...shown].sort((a, b) => a.OpensAt.localeCompare(b.OpensAt)).map(stage => ({
        stage, status: stage === current ? "now" : Date.parse(stage.ClosesAt) <= now ? "done" : stage === next ? "next" : "later",
    }));
    const visible = widget.props.showDone === false ? rows.filter(row => row.status !== "done") : rows;
    return <LiveList caption={caption} rows={Math.max(1, visible.length)} header={false} metrics={metrics} empty={visible.length ? null : t(shown.length ? "live.stages.allDone" : "live.stages.empty")}>
        {(geometry, width) => {
            const fit = liveTwoLineRow({rowHeight: geometry.rowHeight, width, chars: liveStageNameChars(visible.map(row => row.stage)), body: metrics.body, caption: metrics.caption});
            return <ol className="live-stages" style={{fontSize: fit.name}}>{visible.map(row => <li key={`${row.stage.Name}-${row.stage.OpensAt}`} className={`is-${row.status}`} style={{height: geometry.rowHeight}}>
                <span>{row.stage.Name}</span>
                <small style={{fontSize: fit.meta}}><time>{t("live.stages.time", {from: clockLabel(row.stage.OpensAt), to: clockLabel(row.stage.ClosesAt)})}</time><b>{t(`live.stages.status.${row.status}`)}</b></small>
            </li>)}</ol>;
        }}
    </LiveList>;
}

// «Годинник»: the local time of the screen, with an optional label.
export function LiveClock({widget, now, metrics}: {widget: LiveWidget; now: number; metrics: LiveMetrics}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const seconds = widget.props.showSeconds === true;
    const digits = now ? new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit", ...(seconds ? {second: "2-digit"} : {})}).format(now) : "";
    const label = typeof widget.props.label === "string" && widget.props.label.trim() ? widget.props.label.trim() : null;
    const fit = liveTimerFit({width: size.width, height: size.height, digits: seconds ? 8 : 5, label, labelSize: "m", labelMin: metrics.caption, digitsMin: metrics.timer});
    return <div className="live-timer live-clock" ref={ref} data-align={liveAlign(widget, "right")}>
        {label && <small style={{fontSize: fit.label}}>{label}</small>}
        <strong style={{fontSize: fit.digits}}>{digits}</strong>
    </div>;
}

export type LiveAlign = "left" | "center" | "right";

export function liveAlign(widget: LiveWidget, fallback: LiveAlign): LiveAlign {
    const value = widget.props.align;
    return value === "left" || value === "center" || value === "right" ? value : fallback;
}
