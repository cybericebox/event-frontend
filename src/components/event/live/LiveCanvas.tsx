"use client";

import {useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode} from "react";
import {EmptyState} from "@/components/ui/EmptyState";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {liveLogoURL, liveWidgetLabels} from "./liveLayout";
import {liveTextSize, liveTextVars} from "./liveText";
import {liveCaptionBlock, liveHeaderRow, liveListGeometry, liveTimerFit, liveTitleFit, type LiveListGeometry} from "./liveFit";
import {chartSeries, spreadLabels} from "./liveChart";
import {liveSampleSpan} from "./liveSample";
import {LiveQR} from "./LiveQR";
import {whiteTextContrast} from "@/components/event/manage/deriveTheme";
import {resolveEventLogoURL} from "@/components/event/EventBrandLogo";
import {clockLabel} from "@/utils/resultsFreeze";
import crest from "@/styles/assets/crest-128.png";
import "./live.css";
import {t} from "@/i18n/t";

// Series colours of the «Класика» boards (EVENT-THEME §3.4), per theme.
const seriesColors = {
    dark: ["#3987e5", "#d95926", "#199e70", "#b55fd6", "#c98500", "#1a94ad", "#d55181", "#2f9a2f", "#e66767", "#a0671f"],
    light: ["#2a78d6", "#ea6833", "#069f6d", "#d86c96", "#048203", "#c28301", "#de4444", "#099db6", "#b0651a", "#b04ad0"],
};

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

function LiveChart({widget, event, results, now, theme, sample}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; theme: LiveLayout["theme"]; sample: boolean}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const [labelRef, labelSize] = useElementSize<HTMLSpanElement>();
    const lines = Math.min(10, Math.max(1, Number(widget.props.lines) || 5));
    // Sample results cover their own three hours before GeneratedAt.
    const sampleEnd = sample && results ? Date.parse(results.GeneratedAt) : 0;
    const start = sample ? sampleEnd - liveSampleSpan : Date.parse(event.StartTime);
    const end = sample ? sampleEnd : Math.max(start + 60000, Math.min(event.FinishTime ? Date.parse(event.FinishTime) : Number.POSITIVE_INFINITY, now || start + 60000));
    // One caption line is the unit of the chart margins.
    const line = labelSize.height || 18;
    const axis = line * 2.6, labels = Math.min(size.width * 0.3, line * 9);
    const box = {left: axis, top: line * 0.6, width: Math.max(10, size.width - axis - labels - line * 0.6), height: Math.max(10, size.height - line * 2.2)};
    const {series, max} = chartSeries(results, lines, box, start, end);
    const labelYs = spreadLabels(series.map(item => item.endY), line * 1.2, box.top, box.top + box.height);
    const colors = seriesColors[theme];
    const hasData = !!results?.Scoreboard.length;
    return <div className="live-chart">
        <h2>{t("live.chart.title", {suffix: frozenSuffix(results)})}</h2>
        <div className="live-chart__plot" ref={ref}>
            <span className="live-chart__probe" ref={labelRef} aria-hidden="true">0</span>
            {!hasData ? <EmptyState compact message={t("live.chart.empty")} /> : size.width > 0 && <>
                <svg width={size.width} height={size.height} role="img" aria-label={event.Participation === 1 ? t("live.chart.teamsAria") : t("live.chart.participantsAria")}>
                    {[0, 0.25, 0.5, 0.75, 1].map(step => <line key={step} className="live-chart__grid" x1={box.left} x2={box.left + box.width} y1={box.top + box.height * (1 - step)} y2={box.top + box.height * (1 - step)} />)}
                    {series.map((item, index) => <path key={item.teamID} d={item.path} fill="none" stroke={colors[index % colors.length]} strokeWidth={Math.max(3, line * 0.16)} strokeLinecap="round" strokeLinejoin="round" />)}
                </svg>
                {[0, 0.5, 1].map(step => <span key={step} className="live-chart__axis" style={{top: box.top + box.height * (1 - step) - line / 2, width: axis - line * 0.5}}>{Math.round(max * step).toLocaleString("uk-UA")}</span>)}
                {[0, 0.25, 0.5, 0.75, 1].map(step => <span key={step} className="live-chart__time" style={{left: box.left + box.width * step, top: box.top + box.height + line * 0.3, transform: `translateX(-${step * 100}%)`}}>{clockLabel(start + (end - start) * step)}</span>)}
                {series.map((item, index) => <span key={item.teamID} className="live-chart__label" style={{top: labelYs[index] - line / 2, left: box.left + box.width + line * 0.5, maxWidth: labels - line * 0.5, color: colors[index % colors.length]}}>{item.name}</span>)}
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

type LiveMetrics = {caption: number; body: number};

export type LiveTimerSource = "auto" | "start" | "finish" | "freeze" | "custom";

// What the timer counts down to and its automatic label, per source. At
// zero it shows 00:00:00.
export function liveTimerState(props: LiveWidget["props"], event: PublicEventInfo, now: number, frozenAt: string | null): {target: number | null; label: string} {
    const source = (typeof props.source === "string" ? props.source : "auto") as LiveTimerSource;
    const start = Date.parse(event.StartTime);
    const finish = event.FinishTime ? Date.parse(event.FinishTime) : null;
    if (source === "start") return {target: start, label: t("live.timer.beforeStart")};
    if (source === "finish") return {target: finish, label: finish === null ? t("live.timer.noFinish") : t("live.timer.untilFinish")};
    if (source === "freeze") return {target: frozenAt ? Date.parse(frozenAt) : null, label: t("live.timer.untilFreeze")};
    if (source === "custom") return {target: typeof props.target === "string" ? Date.parse(props.target) || null : null, label: t("live.timer.untilCustom")};
    if (start > now) return {target: start, label: t("live.timer.beforeStart")};
    return {target: finish, label: finish === null ? t("live.timer.noFinish") : finish > now ? t("live.timer.untilFinish") : t("live.timer.finished")};
}

function LiveTimer({widget, event, now, frozenAt}: {widget: LiveWidget; event: PublicEventInfo; now: number; frozenAt: string | null}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const {target, label: autoLabel} = liveTimerState(widget.props, event, now, frozenAt);
    const seconds = target === null ? 0 : Math.max(0, Math.floor((target - now) / 1000));
    const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, ...(widget.props.showSeconds === false ? [] : [seconds % 60])];
    const digits = parts.map(part => String(part).padStart(2, "0")).join(":");
    const custom = typeof widget.props.label === "string" ? widget.props.label.trim() : "";
    const label = widget.props.showLabel === false ? null : custom || autoLabel;
    const labelSize = (["s", "m", "l"] as const).find(value => value === widget.props.labelSize) ?? "m";
    const fit = liveTimerFit({width: size.width, height: size.height, digits: digits.length, label, labelSize});
    return <div className="live-timer" ref={ref}>
        {label && <small style={{fontSize: fit.label}}>{label}</small>}
        <strong style={{fontSize: fit.digits}}>{digits}</strong>
    </div>;
}

function LiveTitle({widget, event, logo}: {widget: LiveWidget; event: PublicEventInfo; logo: string | null}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const subtitle = typeof widget.props.subtitle === "string" ? widget.props.subtitle.trim() : "";
    const fit = liveTitleFit({width: size.width, height: size.height, name: event.Name, subtitle: !!subtitle, logo: !!logo});
    return <div className="live-title" ref={ref}>
        {logo && <span className="live-title__logo" style={{height: fit.logo}}><img src={logo} alt="" /></span>}
        <div><strong style={{fontSize: fit.name}}>{event.Name}</strong>{subtitle && <span style={{fontSize: fit.subtitle}}>{subtitle}</span>}</div>
    </div>;
}

// Table and recent solves: exactly N rows split the height under the
// caption (liveListGeometry, the same rule as the editor warnings).
function LiveList({caption, rows, header, metrics, empty, children}: {
    caption: string; rows: number; header: boolean; metrics: LiveMetrics; empty: string | null;
    children: (geometry: LiveListGeometry) => ReactNode;
}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const geometry = liveListGeometry({height: size.height, caption: metrics.caption, body: metrics.body, rows, header});
    return <div className="live-list" ref={ref}>
        <h2 style={{height: metrics.caption * liveCaptionBlock}}>{caption}</h2>
        {empty !== null ? <EmptyState compact message={empty} /> : children(geometry)}
    </div>;
}

function LiveTable({widget, event, results, now, metrics}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; metrics: LiveMetrics}) {
    const teams = results?.Scoreboard ?? [];
    const pageSize = Math.max(1, Number(widget.props.rowsPerPage) || 10);
    const pageCount = Math.max(1, Math.ceil(teams.length / pageSize));
    const page = Math.floor(now / 1000 / Math.max(1, Number(widget.props.pageSeconds) || 10)) % pageCount;
    return <LiveList caption={t("live.table.title", {suffix: frozenSuffix(results)})} rows={pageSize} header metrics={metrics} empty={teams.length ? null : t("live.table.empty")}>
        {geometry => <table className="live-table" style={{"--live-row-font": `${geometry.rowFont}px`} as CSSProperties}>
            <thead><tr style={{height: metrics.caption * liveHeaderRow}}><th>{t("live.table.rank")}</th><th>{event.Participation === 1 ? t("live.table.team") : t("live.table.participant")}</th><th>{t("live.table.points")}</th></tr></thead>
            <tbody style={{fontSize: geometry.rowFont}}>{teams.slice(page * pageSize, (page + 1) * pageSize).map(team => <tr key={team.TeamID} style={{height: geometry.rowHeight}} className={team.Rank === 1 ? "is-lead" : undefined}>
                <td>{team.Rank}</td><td>{team.TeamName}</td><td>{team.Points.toLocaleString("uk-UA")}</td>
            </tr>)}</tbody>
        </table>}
    </LiveList>;
}

function LiveSolves({widget, results, metrics}: {widget: LiveWidget; results?: ManageResultsSnapshot; metrics: LiveMetrics}) {
    const names = new Map((results?.Scoreboard ?? []).map(team => [team.TeamID, team.TeamName]));
    const rows = Math.max(1, Number(widget.props.rows) || 5);
    const items = [...(results?.Timeline ?? [])].sort((a, b) => b.SolvedAt.localeCompare(a.SolvedAt)).slice(0, rows);
    return <LiveList caption={t("live.solves.title")} rows={rows} header={false} metrics={metrics} empty={items.length ? null : t("live.solves.empty")}>
        {geometry => <ol className="live-solves" style={{fontSize: geometry.rowFont}}>{items.map((item, index) => <li key={`${item.EventTeamID}-${item.EventChallengeID}-${index}`} style={{height: geometry.rowHeight}}>
            <span>{names.get(item.EventTeamID) ?? t("live.table.team")} → {item.ChallengeName}</span><b>+{item.Points}</b><time>{clockLabel(item.SolvedAt)}</time>
        </li>)}</ol>}
    </LiveList>;
}

function WidgetContent({widget, event, results, now, theme, edit, sample, metrics}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; theme: LiveLayout["theme"]; edit: boolean; sample: boolean; metrics: LiveMetrics}) {
    const logo = resolveEventLogoURL(event.LogoURL);
    if (widget.type === "title") return <LiveTitle widget={widget} event={event} logo={logo} />;
    if (widget.type === "timer") return <LiveTimer widget={widget} event={event} now={now} frozenAt={results?.Freeze.FrozenAt ?? null} />;
    if (widget.type === "chart") return <LiveChart widget={widget} event={event} results={results} now={now} theme={theme} sample={sample} />;
    // Until Attack-Defense exists the A/D table renders nothing on the screen.
    if (widget.type === "ad_table") return edit ? <div className="live-retired"><strong>{liveWidgetLabels.ad_table}</strong><span>{t("live.retired")}</span></div> : null;
    if (widget.type === "table") return <LiveTable widget={widget} event={event} results={results} now={now} metrics={metrics} />;
    if (widget.type === "solves") return <LiveSolves widget={widget} results={results} metrics={metrics} />;
    if (widget.type === "announcement") return <div className="live-announcement">{typeof widget.props.text === "string" && widget.props.text.trim() || t("live.announcement.placeholder")}</div>;
    if (widget.type === "logos") return <LiveLogos widget={widget} fallback={logo} edit={edit} sample={sample} theme={theme} />;
    if (widget.type === "qr") return <LiveQR value={typeof widget.props.value === "string" ? widget.props.value : typeof widget.props.url === "string" ? widget.props.url : ""}
        caption={typeof widget.props.caption === "string" ? widget.props.caption : ""} />;
    return null;
}

export type LiveGhost = {x: number; y: number; w: number; h: number; ok: boolean};

export function LiveCanvas({layout, event, results, sample = false, selectedID, onSelect, edit = false, showGrid = false, onPointerDown, conflicts, warned, ghost, onDragOver, onDragLeave, onDrop}: {
    layout: LiveLayout; event: PublicEventInfo; results?: ManageResultsSnapshot; sample?: boolean; selectedID?: string | null;
    onSelect?: (id: string) => void; edit?: boolean; showGrid?: boolean;
    onPointerDown?: (event: PointerEvent<HTMLButtonElement | HTMLSpanElement>, widget: LiveWidget, mode: "move" | "resize") => void;
    conflicts?: Set<string>; warned?: Set<string>; ghost?: LiveGhost | null;
    onDragOver?: (event: DragEvent<HTMLDivElement>) => void; onDragLeave?: () => void; onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
    const [canvasRef, canvasSize] = useElementSize<HTMLDivElement>();
    // Effective text sizes of this canvas: the same numbers as liveText.
    const metrics = useMemo(() => ({
        caption: liveTextSize("caption", canvasSize.height, layout.screen.textScale).effective,
        body: liveTextSize("body", canvasSize.height, layout.screen.textScale).effective,
    }), [canvasSize.height, layout.screen.textScale]);
    const [now, setNow] = useState(0);
    useEffect(() => {const frame = requestAnimationFrame(() => setNow(Date.now())); const timer = setInterval(() => setNow(Date.now()), 1000); return () => {cancelAnimationFrame(frame); clearInterval(timer);};}, []);
    const style = useMemo(() => ({
        "--live-cols": layout.grid.cols, "--live-rows": layout.grid.rows, ...liveTextVars(layout.screen.textScale),
        ...(layout.theme === "dark" && (whiteTextContrast(event.Theme.Brand) ?? 21) < 4.5 ? {"--live-ink": "#16152B", "--live-dim": "#4D4B61", "--live-faint": "#4D4B61", "--live-line": "rgba(33,26,82,.2)"} : {}),
    } as CSSProperties), [layout.grid.cols, layout.grid.rows, layout.screen.textScale, layout.theme, event.Theme.Brand]);
    // Light theme: row 1 is the brand band; one-row widgets there sit on it,
    // taller ones cover it with the page colour.
    const place = (widget: LiveWidget) => `live-widget live-widget--${widget.type}${layout.theme === "light" && widget.y === 1 ? widget.h === 1 ? " live-widget--band" : " live-widget--masked" : ""}${selectedID === widget.id ? " is-selected" : ""}${conflicts?.has(widget.id) ? " is-conflict" : warned?.has(widget.id) ? " is-warned" : ""}`;
    const area = (widget: {x: number; y: number; w: number; h: number}) => ({gridColumn: `${widget.x} / span ${widget.w}`, gridRow: `${widget.y} / span ${widget.h}`});
    return <div className={`live-canvas live-canvas--${layout.theme}${showGrid ? " live-canvas--grid" : ""}${edit ? " live-canvas--edit" : ""}`} style={style} ref={canvasRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        {layout.widgets.map(widget => edit ? <button key={widget.id} type="button" className={place(widget)} style={area(widget)} onClick={() => onSelect?.(widget.id)} onPointerDown={event => onPointerDown?.(event, widget, "move")}>
            <WidgetContent widget={widget} event={event} results={results} now={now} theme={layout.theme} edit sample={sample} metrics={metrics} />
            <span className="live-widget__resize" role="presentation" onPointerDown={event => {event.stopPropagation(); onPointerDown?.(event, widget, "resize");}} />
        </button> : <div key={widget.id} className={place(widget)} style={area(widget)}><WidgetContent widget={widget} event={event} results={results} now={now} theme={layout.theme} edit={false} sample={sample} metrics={metrics} /></div>)}
        {ghost && <div className={`live-drop-ghost${ghost.ok ? "" : " is-blocked"}`} style={area(ghost)} aria-hidden="true" />}
    </div>;
}
