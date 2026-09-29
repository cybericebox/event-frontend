"use client";

import {useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent} from "react";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {liveLogoURL, liveWidgetLabels} from "./liveLayout";
import {liveTextVars} from "./liveText";
import {chartSeries, spreadLabels} from "./liveChart";
import {LiveQR} from "./LiveQR";
import {whiteTextContrast} from "@/components/event/manage/deriveTheme";
import {resolveEventLogoURL} from "@/components/event/EventBrandLogo";
import {clockLabel} from "@/utils/resultsFreeze";
import "./live.css";

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
    return results?.Freeze.Applied && results.Freeze.FrozenAt ? ` · заморожено о ${clockLabel(results.Freeze.FrozenAt)}` : "";
}

function LiveChart({widget, event, results, now, theme}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; theme: LiveLayout["theme"]}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const [labelRef, labelSize] = useElementSize<HTMLSpanElement>();
    const lines = Math.min(10, Math.max(1, Number(widget.props.lines) || 5));
    const start = Date.parse(event.StartTime);
    const end = Math.max(start + 60000, Math.min(event.FinishTime ? Date.parse(event.FinishTime) : Number.POSITIVE_INFINITY, now || start + 60000));
    // One caption line is the unit of the chart margins.
    const line = labelSize.height || 18;
    const axis = line * 2.6, labels = Math.min(size.width * 0.3, line * 9);
    const box = {left: axis, top: line * 0.6, width: Math.max(10, size.width - axis - labels - line * 0.6), height: Math.max(10, size.height - line * 2.2)};
    const {series, max} = chartSeries(results, lines, box, start, end);
    const labelYs = spreadLabels(series.map(item => item.endY), line * 1.2, box.top, box.top + box.height);
    const colors = seriesColors[theme];
    const hasData = !!results?.Scoreboard.length;
    return <div className="live-chart">
        <h2>Динаміка балів{frozenSuffix(results)}</h2>
        <div className="live-chart__plot" ref={ref}>
            <span className="live-chart__probe" ref={labelRef} aria-hidden="true">0</span>
            {!hasData ? <p>Результати з’являться після першого розв’язання.</p> : size.width > 0 && <>
                <svg width={size.width} height={size.height} role="img" aria-label={event.Participation === 1 ? "Графік балів команд" : "Графік балів учасників"}>
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

function LiveLogos({widget, fallback, edit}: {widget: LiveWidget; fallback: string | null; edit: boolean}) {
    const urls = Array.isArray(widget.props.logos) ? widget.props.logos.filter((value): value is string => typeof value === "string").map(liveLogoURL).filter((value): value is string => !!value) : [];
    const carousel = widget.props.mode === "carousel" && urls.length > 1;
    const duration = widget.props.speed === "slow" ? "80s" : widget.props.speed === "fast" ? "30s" : "50s";
    const images = urls.length ? urls : fallback ? [fallback] : [];
    return <div className={`live-logos${carousel ? " live-logos--carousel" : ""}`}>
        <small>{typeof widget.props.title === "string" && widget.props.title ? widget.props.title : "Логотипи"}</small>
        <div className="live-logos__track">
            <div style={carousel ? {animationDuration: duration, animationPlayState: widget.props.paused === true || edit ? "paused" : "running"} : undefined}>
                {(carousel ? [...images, ...images] : images).map((url, index) => <img key={`${url}-${index}`} src={url} alt={index < images.length ? "Логотип" : ""} aria-hidden={index >= images.length || undefined} />)}
            </div>
        </div>
    </div>;
}

function WidgetContent({widget, event, results, now, theme, edit}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; theme: LiveLayout["theme"]; edit: boolean}) {
    const teams = results?.Scoreboard ?? [];
    const logo = resolveEventLogoURL(event.LogoURL);
    if (widget.type === "title") return <div className="live-title">{logo && <span className="live-title__logo"><img src={logo} alt="" /></span>}<div><strong>{event.Name}</strong>{typeof widget.props.subtitle === "string" && widget.props.subtitle && <span>{widget.props.subtitle}</span>}</div></div>;
    if (widget.type === "timer") {
        // The Jeopardy countdown; the A/D `format` prop of older layouts is ignored.
        const before = Date.parse(event.StartTime) > now;
        const target = before ? event.StartTime : event.FinishTime;
        const seconds = target ? Math.max(0, Math.floor((Date.parse(target) - now) / 1000)) : 0;
        const label = before ? "До початку" : !target ? "Без часу завершення" : seconds > 0 ? "До завершення" : "Подію завершено";
        return <div className="live-timer"><small>{label}</small><strong>{String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong></div>;
    }
    if (widget.type === "chart") return <LiveChart widget={widget} event={event} results={results} now={now} theme={theme} />;
    // Until Attack-Defense exists the A/D table renders nothing on the screen.
    if (widget.type === "ad_table") return edit ? <div className="live-retired"><strong>{liveWidgetLabels.ad_table}</strong><span>Не показується на екрані. Приберіть віджет.</span></div> : null;
    if (widget.type === "table") {
        const pageSize = Math.max(1, Number(widget.props.rowsPerPage) || 10);
        const pageCount = Math.max(1, Math.ceil(teams.length / pageSize));
        const page = Math.floor(now / 1000 / Math.max(1, Number(widget.props.pageSeconds) || 10)) % pageCount;
        return <div className="live-table"><h2>Таблиця результатів{frozenSuffix(results)}</h2>{teams.length ? <table><thead><tr><th>№</th><th>{event.Participation === 1 ? "Команда" : "Учасник"}</th><th>Бали</th></tr></thead><tbody>{teams.slice(page * pageSize, (page + 1) * pageSize).map(team => <tr key={team.TeamID} className={team.Rank === 1 ? "is-lead" : undefined}><td>{team.Rank}</td><td>{team.TeamName}</td><td>{team.Points.toLocaleString("uk-UA")}</td></tr>)}</tbody></table> : <p>Результатів поки немає.</p>}</div>;
    }
    if (widget.type === "solves") {
        const names = new Map(teams.map(team => [team.TeamID, team.TeamName]));
        return <div className="live-solves"><h2>Останні розв’язання</h2>{results?.Timeline.length ? <ol>{[...results.Timeline].sort((a, b) => b.SolvedAt.localeCompare(a.SolvedAt)).slice(0, Number(widget.props.rows) || 5).map((item, index) => <li key={`${item.EventTeamID}-${item.EventChallengeID}-${index}`}><span>{names.get(item.EventTeamID) ?? "Команда"} → {item.ChallengeName}</span><b>+{item.Points}</b><time>{clockLabel(item.SolvedAt)}</time></li>)}</ol> : <p>Нових розв’язань немає.</p>}</div>;
    }
    if (widget.type === "announcement") return <div className="live-announcement">{typeof widget.props.text === "string" && widget.props.text.trim() || "Оголошення організатора"}</div>;
    if (widget.type === "logos") return <LiveLogos widget={widget} fallback={logo} edit={edit} />;
    if (widget.type === "qr") return <LiveQR url={typeof widget.props.url === "string" ? widget.props.url : ""} />;
    return null;
}

export type LiveGhost = {x: number; y: number; w: number; h: number; ok: boolean};

export function LiveCanvas({layout, event, results, selectedID, onSelect, edit = false, showGrid = false, onPointerDown, conflicts, warned, ghost, onDragOver, onDragLeave, onDrop}: {
    layout: LiveLayout; event: PublicEventInfo; results?: ManageResultsSnapshot; selectedID?: string | null;
    onSelect?: (id: string) => void; edit?: boolean; showGrid?: boolean;
    onPointerDown?: (event: PointerEvent<HTMLButtonElement | HTMLSpanElement>, widget: LiveWidget, mode: "move" | "resize") => void;
    conflicts?: Set<string>; warned?: Set<string>; ghost?: LiveGhost | null;
    onDragOver?: (event: DragEvent<HTMLDivElement>) => void; onDragLeave?: () => void; onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
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
    return <div className={`live-canvas live-canvas--${layout.theme}${showGrid ? " live-canvas--grid" : ""}${edit ? " live-canvas--edit" : ""}`} style={style} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        {layout.widgets.map(widget => edit ? <button key={widget.id} type="button" className={place(widget)} style={area(widget)} onClick={() => onSelect?.(widget.id)} onPointerDown={event => onPointerDown?.(event, widget, "move")}>
            <WidgetContent widget={widget} event={event} results={results} now={now} theme={layout.theme} edit />
            <span className="live-widget__resize" role="presentation" onPointerDown={event => {event.stopPropagation(); onPointerDown?.(event, widget, "resize");}} />
        </button> : <div key={widget.id} className={place(widget)} style={area(widget)}><WidgetContent widget={widget} event={event} results={results} now={now} theme={layout.theme} edit={false} /></div>)}
        {ghost && <div className={`live-drop-ghost${ghost.ok ? "" : " is-blocked"}`} style={area(ghost)} aria-hidden="true" />}
    </div>;
}
