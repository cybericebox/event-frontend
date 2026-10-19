"use client";

import {useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode} from "react";
import {Snowflake} from "lucide-react";
import {EmptyState} from "@/components/ui/EmptyState";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {liveLogoURL, liveWidgetLabels} from "./liveLayout";
import {liveTextFloors, liveTextProfile, liveTextSize, liveTextVars} from "./liveText";
import {liveCaptionBlock, liveEstimateWidth, liveHeaderRow, liveListGeometry, liveTableFit, liveTimerFit, liveTitleFit, type LiveListGeometry} from "./liveFit";
import {liveStageSubtitle, liveTimerDigits, liveTimerState, type LiveStage} from "./liveStages";
import {livePinTop, livePoints, liveTablePage, liveTablePageAt} from "./liveTable";
import {chartSeries, spreadLabels} from "./liveChart";
import {liveSampleSpan} from "./liveSample";
import {LiveQR} from "./LiveQR";
import {whiteTextContrast} from "@/components/event/manage/deriveTheme";
import {resolveEventLogoURL} from "@/utils/eventLogoURL";
import {clockLabel} from "@/utils/resultsFreeze";
import crest from "@/styles/assets/crest-128.png";
import "./live.css";
import {t} from "@/i18n/t";

const noStages: LiveStage[] = [];

// Series colours of the «Класика» boards: DS series tokens, which `data-live` on the chart sets for the board theme.
const seriesColors = Array.from({length: 10}, (_, index) => `var(--ib-s${index + 1})`);

function useElementSize<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [size, setSize] = useState({width: 0, height: 0});
    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) => setSize({width: entry.contentRect.width, height: entry.contentRect.height}));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, size] as const;
}

function frozenSuffix(results?: ManageResultsSnapshot): string {
    return results?.Freeze.Applied && results.Freeze.FrozenAt ? t("live.frozenSuffix", {time: clockLabel(results.Freeze.FrozenAt)}) : "";
}

// The moment the shown results are frozen at, null for live results.
function frozenAt(results?: ManageResultsSnapshot): string | null {
    return results?.Freeze.Applied && results.Freeze.FrozenAt ? results.Freeze.FrozenAt : null;
}

// «Результати заморожено о 10:59»: under the timer, or in the title when the
// screen has no timer.
function FreezeBadge({at, size}: {at: string; size?: number}) {
    return <span className="live-freeze" style={size ? {fontSize: size} : undefined}><Snowflake aria-hidden="true" />{t("live.freeze.badge", {time: clockLabel(at)})}</span>;
}

function LiveChart({widget, event, results, now, theme, sample, metrics, suffix}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; theme: LiveLayout["theme"]; sample: boolean; metrics: LiveMetrics; suffix: string}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const [labelRef, labelSize] = useElementSize<HTMLSpanElement>();
    const lines = Math.min(10, Math.max(1, Number(widget.props.lines) || 5));
    // Sample results cover their own three hours before GeneratedAt.
    const sampleEnd = sample && results ? Date.parse(results.GeneratedAt) : 0;
    const start = sample ? sampleEnd - liveSampleSpan : Date.parse(event.StartTime);
    const end = sample ? sampleEnd : Math.max(start + 60000, Math.min(event.FinishTime ? Date.parse(event.FinishTime) : Number.POSITIVE_INFINITY, now || start + 60000));
    const frozen = frozenAt(results);
    // One caption line is the unit of the chart margins; the line names are body text.
    const line = labelSize.height || 18;
    const nameLine = line * metrics.body / Math.max(1, metrics.caption);
    const axis = line * 2.6, labels = Math.min(size.width * 0.32, nameLine * 8);
    const box = {left: axis, top: line * 0.6, width: Math.max(10, size.width - axis - labels - line * 0.6), height: Math.max(10, size.height - line * 2.2)};
    const {series, max, cutX} = chartSeries(results, lines, box, start, end, frozen ? Date.parse(frozen) : null);
    const labelYs = spreadLabels(series.map(item => item.endY), nameLine * 1.15, box.top, box.top + box.height);
    const colors = seriesColors;
    const hasData = !!results?.Scoreboard.length;
    return <div className="live-chart" data-live={theme}>
        <h2>{t("live.chart.title", {suffix})}</h2>
        <div className="live-chart__plot" ref={ref}>
            <span className="live-chart__probe" ref={labelRef} aria-hidden="true">0</span>
            {!hasData ? <EmptyState compact message={t("live.chart.empty")} /> : size.width > 0 && <>
                <svg width={size.width} height={size.height} role="img" aria-label={event.Participation === 1 ? t("live.chart.teamsAria") : t("live.chart.participantsAria")}>
                    {[0, 0.25, 0.5, 0.75, 1].map(step => <line key={step} className="live-chart__grid" x1={box.left} x2={box.left + box.width} y1={box.top + box.height * (1 - step)} y2={box.top + box.height * (1 - step)} />)}
                    {cutX !== null && <line className="live-chart__freeze" x1={cutX} x2={cutX} y1={box.top} y2={box.top + box.height} />}
                    {series.map((item, index) => <path key={item.teamID} d={item.path} fill="none" stroke={colors[index % colors.length]} strokeWidth={Math.max(3, line * 0.16)} strokeLinecap="round" strokeLinejoin="round" />)}
                </svg>
                {cutX !== null && <span className="live-chart__freeze-label" style={{left: cutX, top: box.top}}><Snowflake aria-hidden="true" />{t("live.chart.frozen")}</span>}
                {[0, 0.5, 1].map(step => <span key={step} className="live-chart__axis" style={{top: box.top + box.height * (1 - step) - line / 2, width: axis - line * 0.5}}>{livePoints(max * step)}</span>)}
                {[0, 0.25, 0.5, 0.75, 1].map(step => <span key={step} className="live-chart__time" style={{left: box.left + box.width * step, top: box.top + box.height + line * 0.3, transform: `translateX(-${step * 100}%)`}}>{clockLabel(start + (end - start) * step)}</span>)}
                {series.map((item, index) => <span key={item.teamID} className="live-chart__label" style={{top: labelYs[index] - nameLine / 2, left: box.left + box.width + line * 0.5, maxWidth: labels - line * 0.5}}><i style={{background: colors[index % colors.length]}} aria-hidden="true" /><span>{item.name}</span></span>)}
            </>}
        </div>
    </div>;
}

export type LiveLogoItem = {src: string; dark?: string};

// Logos of a widget: `items` ({src, dark?}); older layouts keep `logos`.
export function liveLogoItems(props: LiveWidget["props"]): LiveLogoItem[] {
    if (Array.isArray(props.items)) {
        return props.items.flatMap(item => item && typeof item === "object" && typeof (item as LiveLogoItem).src === "string"
            ? [{src: (item as LiveLogoItem).src, ...(typeof (item as LiveLogoItem).dark === "string" ? {dark: (item as LiveLogoItem).dark} : {})}] : []);
    }
    return Array.isArray(props.logos) ? props.logos.filter((value): value is string => typeof value === "string").map(src => ({src})) : [];
}

// Every logo sits in an equal-height box (contain-fit, at most 4:1). In
// «Одноколірні» the logo is a CSS mask filled with the theme ink; the dark
// theme uses a logo's own dark file when it has one.
function LiveLogos({widget, fallback, edit, sample, theme}: {widget: LiveWidget; fallback: string | null; edit: boolean; sample: boolean; theme: LiveLayout["theme"]}) {
    const items = liveLogoItems(widget.props);
    const urls = items.map(item => liveLogoURL(theme === "dark" && item.dark ? item.dark : item.src)).filter((value): value is string => !!value);
    // With sample data and no logo at all, the platform crest stands in.
    const images = urls.length ? urls : fallback ? [fallback] : sample ? [crest.src, crest.src, crest.src] : [];
    // No logo at all: the screen shows nothing rather than a lonely caption.
    if (!images.length && !edit) return null;
    const carousel = widget.props.mode === "carousel" && images.length > 1;
    const mono = widget.props.color !== "original";
    const duration = widget.props.speed === "slow" ? "80s" : widget.props.speed === "fast" ? "30s" : "50s";
    const title = typeof widget.props.title === "string" && widget.props.title ? widget.props.title : t("live.logos.title");
    return <div className={`live-logos${carousel ? " live-logos--carousel" : ""}${mono ? " live-logos--mono" : ""}`} style={{"--live-logo-count": images.length} as CSSProperties}>
        <h2>{title}</h2>
        <div className="live-logos__track">
            <div style={carousel ? {animationDuration: duration, animationPlayState: widget.props.paused === true || edit ? "paused" : "running"} : undefined}>
                {(carousel ? [...images, ...images] : images).map((url, index) => <span key={`${url}-${index}`} className="live-logo" style={mono ? {maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")`} as CSSProperties : undefined}>
                    <img src={url} alt={index < images.length ? t("live.logos.alt") : ""} aria-hidden={index >= images.length || undefined} />
                </span>)}
            </div>
        </div>
    </div>;
}

type LiveMetrics = {caption: number; body: number; timer: number};

function LiveTimer({widget, event, stages, now, results, badge, metrics, named}: {widget: LiveWidget; event: PublicEventInfo; stages: LiveStage[]; now: number; results?: ManageResultsSnapshot; badge: boolean; metrics: LiveMetrics; named: boolean}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const state = liveTimerState(widget.props, event, stages, now, results?.Freeze.FrozenAt ?? null, named);
    const digits = liveTimerDigits(state, now, widget.props.showSeconds !== false);
    const shown = digits ?? (state.mode === "word" ? state.word : "");
    const custom = typeof widget.props.label === "string" ? widget.props.label.trim() : "";
    const label = widget.props.showLabel === false ? null : custom || state.label || null;
    const labelSize = (["s", "m", "l"] as const).find(value => value === widget.props.labelSize) ?? "m";
    const frozen = badge ? frozenAt(results) : null;
    const badgeText = frozen ? t("live.freeze.badge", {time: clockLabel(frozen)}) : null;
    const fit = liveTimerFit({width: size.width, height: size.height, digits: shown.length, label, labelSize, badge: badgeText, labelMin: metrics.caption, digitsMin: metrics.timer});
    return <div className="live-timer" ref={ref}>
        {label && fit.labelShown && <small style={{fontSize: fit.label}}>{label}</small>}
        {frozen && !fit.labelShown && <FreezeBadge at={frozen} size={fit.badge} />}
        <strong className={digits ? undefined : "live-timer__word"} style={{fontSize: fit.digits}}>{shown}</strong>
        {frozen && fit.labelShown && <FreezeBadge at={frozen} size={fit.badge} />}
    </div>;
}

function LiveTitle({widget, event, logo, stages, now, results, badge, metrics}: {widget: LiveWidget; event: PublicEventInfo; logo: string | null; stages: LiveStage[]; now: number; results?: ManageResultsSnapshot; badge: boolean; metrics: LiveMetrics}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const text = typeof widget.props.subtitle === "string" ? widget.props.subtitle.trim() : "";
    // «Поточний етап»: the running stage (or the next one); the own text otherwise.
    const subtitle = widget.props.subtitleStage === true ? liveStageSubtitle(stages, now) || text : text;
    const frozen = badge ? frozenAt(results) : null;
    const fit = liveTitleFit({width: size.width, height: size.height, name: event.Name, subtitle: !!subtitle || !!frozen, logo: !!logo, subtitleMin: metrics.caption});
    return <div className="live-title" ref={ref}>
        {logo && <span className="live-title__logo" style={{height: fit.logo}}><img src={logo} alt="" /></span>}
        <div>
            <strong style={{fontSize: fit.name}}>{event.Name}</strong>
            {(subtitle || frozen) && <span style={{fontSize: fit.subtitle}}>{frozen ? <FreezeBadge at={frozen} /> : subtitle}</span>}
        </div>
    </div>;
}

// Table and recent solves: exactly N rows split the height under the
// caption (liveListGeometry, the same rule as the editor warnings).
function LiveList({caption, rows, header, metrics, empty, progress, children}: {
    caption: ReactNode; rows: number; header: boolean; metrics: LiveMetrics; empty: string | null;
    // The page bar of a paged table: restarts with each page.
    progress?: {page: number; seconds: number; elapsed: number} | null;
    children: (geometry: LiveListGeometry, width: number) => ReactNode;
}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const geometry = liveListGeometry({height: size.height, caption: metrics.caption, body: metrics.body, rows, header});
    return <div className="live-list" ref={ref}>
        <h2 style={{height: metrics.caption * liveCaptionBlock}}>
            {caption}
            {progress && <i key={progress.page} className="live-list__progress" aria-hidden="true" style={{animationDuration: `${progress.seconds}s`, animationDelay: `-${progress.elapsed}s`}} />}
        </h2>
        {empty !== null ? <EmptyState compact message={empty} /> : children(geometry, size.width)}
    </div>;
}

// Text width on the screen: the canvas measures the real font; without a
// canvas (tests, old browsers) the estimate stands in.
let measureContext: CanvasRenderingContext2D | null | undefined;
function measureName(text: string, font: number): number {
    if (measureContext === undefined) {
        try {measureContext = document.createElement("canvas").getContext("2d");} catch {measureContext = null;}
    }
    if (!measureContext) return liveEstimateWidth(text, font);
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() || "Arial, sans-serif";
    measureContext.font = `500 ${font}px ${family}`;
    return measureContext.measureText(text).width;
}

function LiveTable({widget, event, results, now, metrics, edit, suffix}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; metrics: LiveMetrics; edit: boolean; suffix: string}) {
    const teams = results?.Scoreboard ?? [];
    const pageSize = Math.max(1, Number(widget.props.rowsPerPage) || 10);
    const pageSeconds = Math.max(1, Number(widget.props.pageSeconds) || 10);
    const {page, elapsed} = liveTablePageAt(now, pageSeconds, edit);
    const view = liveTablePage(teams, {pageSize, pinTop: livePinTop(widget.props.pinTop), page});
    const paged = view.pageCount > 1;
    const caption = <>
        <span>{t("live.table.title", {suffix})}</span>
        {paged && <span className="live-list__range">{t("live.table.range", {from: view.from, to: view.to, total: view.total})}</span>}
    </>;
    const rankChars = String(teams.at(-1)?.Rank ?? 1).length;
    const pointsChars = Math.max(...teams.map(team => livePoints(team.Points).length), 1);
    return <LiveList caption={caption} rows={pageSize} header metrics={metrics} empty={teams.length ? null : t("live.table.empty")} progress={paged && !edit ? {page, seconds: pageSeconds, elapsed} : null}>
        {(geometry, width) => {
            const fit = liveTableFit({width, rowHeight: geometry.rowHeight, body: metrics.body, rankChars, pointsChars, names: view.rows.map(team => team.TeamName), measure: measureName});
            return <table className="live-table" style={{"--live-row-font": `${fit.font}px`} as CSSProperties}>
                <colgroup><col style={{width: fit.rankWidth}} /><col /><col style={{width: fit.pointsWidth}} /></colgroup>
                <thead><tr style={{height: metrics.caption * liveHeaderRow}}><th>{t("live.table.rank")}</th><th>{event.Participation === 1 ? t("live.table.team") : t("live.table.participant")}</th><th>{t("live.table.points")}</th></tr></thead>
                <tbody style={{fontSize: fit.font}}>{view.rows.map((team, index) => <tr key={team.TeamID} style={{height: geometry.rowHeight}}
                    className={[team.Rank === 1 ? "is-lead" : "", team.Rank <= 3 ? "is-top" : "", index === view.pinned - 1 ? "is-pinned-last" : ""].filter(Boolean).join(" ") || undefined}>
                    <td>{team.Rank}</td>
                    <td className={fit.names[index].lines === 2 ? "live-table__name is-wrap" : "live-table__name"} style={{fontSize: fit.names[index].font}} title={team.TeamName}>{team.TeamName}</td>
                    <td>{livePoints(team.Points)}</td>
                </tr>)}</tbody>
            </table>;
        }}
    </LiveList>;
}

function LiveSolves({widget, results, metrics, suffix, participation}: {widget: LiveWidget; results?: ManageResultsSnapshot; metrics: LiveMetrics; suffix: string; participation: PublicEventInfo["Participation"]}) {
    const names = new Map((results?.Scoreboard ?? []).map(team => [team.TeamID, team.TeamName]));
    const rows = Math.max(1, Number(widget.props.rows) || 5);
    const items = [...(results?.Timeline ?? [])].sort((a, b) => b.SolvedAt.localeCompare(a.SolvedAt)).slice(0, rows);
    return <LiveList caption={t("live.solves.title", {suffix})} rows={rows} header={false} metrics={metrics} empty={items.length ? null : t("live.solves.empty")}>
        {geometry => <ol className="live-solves" style={{fontSize: geometry.rowFont}}>{items.map((item, index) => <li key={`${item.EventTeamID}-${item.EventChallengeID}-${index}`} style={{height: geometry.rowHeight}}>
            <span>{t("live.solves.row", {team: names.get(item.EventTeamID) ?? (participation === 1 ? t("live.table.team") : t("live.table.participant")), task: item.ChallengeName})}</span><b>{t("live.solves.points", {points: livePoints(item.Points)})}</b><time>{clockLabel(item.SolvedAt)}</time>
        </li>)}</ol>}
    </LiveList>;
}

function WidgetContent({widget, event, stages, results, now, theme, edit, sample, metrics, badge, suffix, named}: {
    widget: LiveWidget; event: PublicEventInfo; stages: LiveStage[]; results?: ManageResultsSnapshot; now: number; theme: LiveLayout["theme"]; edit: boolean; sample: boolean; metrics: LiveMetrics;
    // Whether this widget carries the freeze badge (the timer, else the title).
    badge: boolean;
    // The freeze note of the captions (none while a badge shows it) and whether the timer names the stage.
    suffix: string; named: boolean;
}) {
    const logo = resolveEventLogoURL(event.LogoURL);
    if (widget.type === "title") return <LiveTitle widget={widget} event={event} logo={logo} stages={stages} now={now} results={results} badge={badge} metrics={metrics} />;
    if (widget.type === "timer") return <LiveTimer widget={widget} event={event} stages={stages} now={now} results={results} badge={badge} metrics={metrics} named={named} />;
    if (widget.type === "chart") return <LiveChart widget={widget} event={event} results={results} now={now} theme={theme} sample={sample} metrics={metrics} suffix={suffix} />;
    // Until Attack-Defense exists the A/D table renders nothing on the screen.
    if (widget.type === "ad_table") return edit ? <div className="live-retired"><strong>{liveWidgetLabels.ad_table}</strong><span>{t("live.retired")}</span></div> : null;
    if (widget.type === "table") return <LiveTable widget={widget} event={event} results={results} now={now} metrics={metrics} edit={edit} suffix={suffix} />;
    if (widget.type === "solves") return <LiveSolves widget={widget} results={results} metrics={metrics} suffix={suffix} participation={event.Participation} />;
    if (widget.type === "announcement") return <div className="live-announcement">{typeof widget.props.text === "string" && widget.props.text.trim() || t("live.announcement.placeholder")}</div>;
    if (widget.type === "logos") return <LiveLogos widget={widget} fallback={logo} edit={edit} sample={sample} theme={theme} />;
    if (widget.type === "qr") return <LiveQR value={typeof widget.props.value === "string" ? widget.props.value : typeof widget.props.url === "string" ? widget.props.url : ""}
        caption={typeof widget.props.caption === "string" ? widget.props.caption : ""} />;
    return null;
}

export type LiveGhost = {x: number; y: number; w: number; h: number; ok: boolean};

export function LiveCanvas({layout, event, stages = noStages, results, sample = false, selectedID, onSelect, edit = false, showGrid = false, onPointerDown, conflicts, warned, ghost, onDragOver, onDragLeave, onDrop}: {
    layout: LiveLayout; event: PublicEventInfo; stages?: LiveStage[]; results?: ManageResultsSnapshot; sample?: boolean; selectedID?: string | null;
    onSelect?: (id: string) => void; edit?: boolean; showGrid?: boolean;
    onPointerDown?: (event: PointerEvent<HTMLButtonElement | HTMLSpanElement>, widget: LiveWidget, mode: "move" | "resize") => void;
    conflicts?: Set<string>; warned?: Set<string>; ghost?: LiveGhost | null;
    onDragOver?: (event: DragEvent<HTMLDivElement>) => void; onDragLeave?: () => void; onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
    const [canvasRef, canvasSize] = useElementSize<HTMLDivElement>();
    // Effective text sizes of this canvas: the same numbers as liveText.
    const profile = liveTextProfile(layout.screen);
    const metrics = useMemo(() => ({
        caption: liveTextSize("caption", canvasSize.height, layout.screen.textScale, canvasSize.width || undefined, profile).effective,
        body: liveTextSize("body", canvasSize.height, layout.screen.textScale, canvasSize.width || undefined, profile).effective,
        timer: liveTextFloors[profile].timer,
    }), [canvasSize.height, canvasSize.width, layout.screen.textScale, profile]);
    const badgeHost = layout.widgets.some(widget => widget.type === "timer") ? "timer" : "title";
    // One freeze mark is enough: with a badge on screen the captions skip the note.
    const suffix = layout.widgets.some(widget => widget.type === badgeHost) ? "" : frozenSuffix(results);
    // The timer names the stage unless the title already shows it.
    const named = !layout.widgets.some(widget => widget.type === "title" && widget.props.subtitleStage === true);
    const [now, setNow] = useState(0);
    useEffect(() => {const frame = requestAnimationFrame(() => setNow(Date.now())); const timer = setInterval(() => setNow(Date.now()), 1000); return () => {cancelAnimationFrame(frame); clearInterval(timer);};}, []);
    const style = useMemo(() => ({
        "--live-cols": layout.grid.cols, "--live-rows": layout.grid.rows, ...liveTextVars(layout.screen.textScale, profile),
        ...(layout.theme === "dark" && (whiteTextContrast(event.Theme.Brand) ?? 21) < 4.5 ? {"--live-ink": "#16152B", "--live-dim": "#4D4B61", "--live-faint": "#4D4B61", "--live-line": "rgba(33,26,82,.2)"} : {}),
    } as CSSProperties), [layout.grid.cols, layout.grid.rows, layout.screen.textScale, layout.theme, event.Theme.Brand, profile]);
    // Light theme: row 1 is the brand band; one-row widgets there sit on it,
    // taller ones cover it with the page colour.
    const place = (widget: LiveWidget) => `live-widget live-widget--${widget.type}${layout.theme === "light" && widget.y === 1 ? widget.h === 1 ? " live-widget--band" : " live-widget--masked" : ""}${selectedID === widget.id ? " is-selected" : ""}${conflicts?.has(widget.id) ? " is-conflict" : warned?.has(widget.id) ? " is-warned" : ""}`;
    const area = (widget: {x: number; y: number; w: number; h: number}) => ({gridColumn: `${widget.x} / span ${widget.w}`, gridRow: `${widget.y} / span ${widget.h}`});
    return <div className={`live-canvas live-canvas--${layout.theme}${showGrid ? " live-canvas--grid" : ""}${edit ? " live-canvas--edit" : ""}`} style={style} ref={canvasRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        {layout.widgets.map(widget => edit ? <button key={widget.id} type="button" className={place(widget)} style={area(widget)} onClick={() => onSelect?.(widget.id)} onPointerDown={event => onPointerDown?.(event, widget, "move")}>
            <WidgetContent widget={widget} event={event} stages={stages} results={results} now={now} theme={layout.theme} edit sample={sample} metrics={metrics} badge={widget.type === badgeHost} suffix={suffix} named={named} />
            <span className="live-widget__resize" role="presentation" onPointerDown={event => {event.stopPropagation(); onPointerDown?.(event, widget, "resize");}} />
        </button> : <div key={widget.id} className={place(widget)} style={area(widget)}><WidgetContent widget={widget} event={event} stages={stages} results={results} now={now} theme={layout.theme} edit={false} sample={sample} metrics={metrics} badge={widget.type === badgeHost} suffix={suffix} named={named} /></div>)}
        {ghost && <div className={`live-drop-ghost${ghost.ok ? "" : " is-blocked"}`} style={area(ghost)} aria-hidden="true" />}
    </div>;
}
