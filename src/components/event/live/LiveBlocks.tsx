"use client";

import type {CSSProperties, ReactNode} from "react";
import {EmptyState} from "@/components/ui/EmptyState";
import type {LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {clockLabel} from "@/utils/resultsFreeze";
import {t} from "@/i18n/t";
import {LiveCaption, LiveList, measureName, useElementSize, type LiveMetrics} from "./LiveParts";
import {liveCardsBox, liveCardsFit, liveFactsFit, livePodiumFit, livePodiumHeights, liveTimerFit, liveTwoLineRow} from "./liveFit";
import {liveHighlightOf, liveMarkerOf, livePlaceImages, type LiveHighlight} from "./liveColors";
import {LivePlaceMark} from "./LiveMarks";
import {liveFactItems, liveFacts} from "./liveFacts";
import {liveCurrentStage, liveNextStage, liveStageNameChars, type LiveStage} from "./liveStages";
import {liveMaxPoints, livePoints} from "./liveTable";
import {liveSampleStages} from "./liveSample";

// «Подіум»: places 2, 1, 3 side by side, the winner's tile the tallest and
// in the accent; or «Картки»: places 1, 2, 3 as equal cards. `caption` is
// null when the block hides it.
export function LivePodium({widget, event, results, metrics, caption}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; metrics: LiveMetrics; caption: string | null}) {
    const highlight = liveHighlightOf(widget);
    const tone = highlight === "medals" ? " live-podium--medals" : highlight === "none" ? " live-podium--plain" : "";
    const top = (results?.Scoreboard ?? []).slice(0, 3);
    const empty = <EmptyState compact message={t(event.Participation === 1 ? "live.podium.emptyTeams" : "live.podium.emptyParticipants")} />;
    return <div className={`live-podium${tone}`}>
        {caption !== null && <LiveCaption caption={caption} metrics={metrics} />}
        {widget.props.variant === "cards" ? <LivePodiumCards widget={widget} top={top} results={results} metrics={metrics} empty={empty} highlight={highlight} />
            : <LivePodiumSteps widget={widget} top={top} metrics={metrics} empty={empty} />}
    </div>;
}

type PodiumTeam = ManageResultsSnapshot["Scoreboard"][number];

function LivePodiumSteps({widget, top, metrics, empty}: {widget: LiveWidget; top: PodiumTeam[]; metrics: LiveMetrics; empty: ReactNode}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const marker = liveMarkerOf(widget);
    const images = livePlaceImages(widget);
    const fit = livePodiumFit({width: size.width, height: size.height, names: top.map(team => team.TeamName), body: metrics.body, caption: metrics.caption, measure: measureName});
    const points = widget.props.showPoints !== false;
    return <div className="live-podium__stage" ref={ref} style={{gap: fit.gap}}>
        {!top.length ? empty : size.width > 0 && order.map(team => {
            const place = team.Rank;
            const lead = place === 1;
            return <div key={team.TeamID} className={`live-podium__tile is-place-${Math.min(3, place)}${lead ? " is-lead" : ""}`}
                style={{height: `${livePodiumHeights[Math.min(2, place - 1)] * 100}%`, padding: fit.pad} as CSSProperties}>
                <span className="live-podium__place" style={{fontSize: marker === "numbers" ? fit.meta : fit.name}}><LivePlaceMark place={place} marker={marker} images={images} /></span>
                <strong style={{fontSize: lead ? fit.lead : fit.name}} title={team.TeamName}>{team.TeamName}</strong>
                {points && <span className="live-podium__points" style={{fontSize: fit.meta}}>{livePoints(team.Points)}</span>}
            </div>;
        })}
    </div>;
}

function LivePodiumCards({widget, top, results, metrics, empty, highlight}: {widget: LiveWidget; top: PodiumTeam[]; results?: ManageResultsSnapshot; metrics: LiveMetrics; empty: ReactNode; highlight: LiveHighlight}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const points = widget.props.showPoints !== false;
    const ring = widget.props.showRing === true;
    // «Кільце прапорців»: the solved share of the published tasks; needs the task count.
    const tasks = results?.Tasks ?? 0;
    const flagsRing = widget.props.showFlagsRing === true && tasks > 0;
    const rings = Number(ring) + Number(flagsRing);
    const marker = liveMarkerOf(widget);
    const images = livePlaceImages(widget);
    const max = liveMaxPoints(results);
    const {column, gap, ...box} = liveCardsBox(size.width, size.height);
    const fit = liveCardsFit({width: box.width, height: box.height, names: top.map(team => team.TeamName),
        pointsChars: Math.max(1, ...top.map(team => livePoints(team.Points).length)), ring: rings > 0, rings, ringLabels: flagsRing, body: metrics.body, caption: metrics.caption, measure: measureName});
    const tone = highlight === "medals" ? " live-cards--medals" : highlight === "none" ? " live-cards--plain" : "";
    return <div className={`live-cards${tone}${column ? " live-cards--column" : ""}`} ref={ref} style={{gap: column ? gap : fit.gap}}>
        {!top.length ? empty : size.width > 0 && top.map(team => {
            const share = Math.max(0, Math.min(1, team.Points / max));
            const solved = tasks ? Math.max(0, Math.min(1, team.Solved / tasks)) : 0;
            return <div key={team.TeamID} className={`live-card is-place-${Math.min(3, team.Rank)}${team.Rank === 1 ? " is-lead" : ""}`} style={{padding: `0 ${fit.pad}px ${fit.pad}px`}}>
                <div className="live-card__head">
                    <strong style={{fontSize: fit.name, paddingTop: fit.pad}} title={team.TeamName}>{team.TeamName}</strong>
                    {marker === "numbers" ? <span className="live-card__badge" style={{fontSize: fit.meta}}>{t("live.podium.place", {place: team.Rank})}</span>
                        : <span className="live-card__mark" style={{fontSize: fit.name * 1.6}}><LivePlaceMark place={team.Rank} marker={marker} images={images} /></span>}
                </div>
                <div className="live-card__body">
                    {ring && fit.ring > 0 && <LiveRing share={share} size={fit.ring} label={t("live.podium.ringAria", {percent: Math.round(share * 100)})}
                        caption={flagsRing ? t("live.podium.ringPoints") : null} captionSize={Math.min(fit.meta, fit.ring * 0.19)} />}
                    {flagsRing && fit.ring > 0 && <LiveRing share={solved} size={fit.ring} flags label={t("live.podium.flagsRingAria", {solved: Math.min(team.Solved, tasks), tasks})}
                        caption={t("live.podium.ringFlags")} captionSize={Math.min(fit.meta, fit.ring * 0.19)} />}
                    {points && <span className="live-card__points">
                        <b style={{fontSize: fit.points}}>{livePoints(team.Points)}</b>
                        <small style={{fontSize: fit.meta}}>{t("live.podium.points")}</small>
                    </span>}
                </div>
            </div>;
        })}
    </div>;
}

// The share of the maximum points (or of the solved tasks) as a ring with the
// percent inside; with a caption, the label sits below the ring.
function LiveRing({share, size, label, flags = false, caption = null, captionSize = 0}: {share: number; size: number; label: string; flags?: boolean; caption?: string | null; captionSize?: number}) {
    const stroke = Math.max(3, size * 0.09);
    const radius = (size - stroke) / 2;
    const length = 2 * Math.PI * radius;
    const ring = <svg className={`live-card__ring${flags ? " is-flags" : ""}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle className="is-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle className="is-value" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} strokeDasharray={`${length * share} ${length}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.24}>{t("live.podium.percent", {percent: Math.round(share * 100)})}</text>
    </svg>;
    if (caption === null) return ring;
    return <figure className="live-card__gauge" style={{width: size}}>
        {ring}
        <figcaption style={{fontSize: captionSize}}>{caption}</figcaption>
    </figure>;
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
