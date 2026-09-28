"use client";

import {useEffect, useMemo, useState, type CSSProperties} from "react";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {liveLogoURL, liveWidgetLabels} from "./liveLayout";
import {LiveQR} from "./LiveQR";
import {whiteTextContrast} from "@/components/event/manage/deriveTheme";
import {resolveEventLogoURL} from "@/components/event/EventBrandLogo";
import "./live.css";

const palette = ["#9B9BFF", "#5CE0D8", "#FFCE77", "#FD929D", "#92D874", "#70B6FF"];

// The time axis runs from the event start to now (or the finish), like the public chart.
function chartPath(results: ManageResultsSnapshot | undefined, teamID: string, start: number, end: number): string {
    const timeline = (results?.Timeline ?? []).filter(point => point.EventTeamID === teamID).sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
    if (!timeline.length) return "M0 90H100";
    const max = Math.max(1, ...(results?.Scoreboard ?? []).map(item => item.Points));
    let sum = 0;
    const points = [[0, 90], ...timeline.map(item => {
        sum += item.Points;
        return [Math.round(Math.min(1, Math.max(0, (Date.parse(item.SolvedAt) - start) / (end - start))) * 94 + 3), Math.round(90 - sum / max * 78)];
    }), [100, Math.round(90 - sum / max * 78)]];
    return points.slice(1).reduce((path, point, index) => {
        const previous = points[index];
        const middle = (previous[0] + point[0]) / 2;
        return `${path} C${middle} ${previous[1]},${middle} ${point[1]},${point[0]} ${point[1]}`;
    }, `M${points[0][0]} ${points[0][1]}`);
}

function WidgetContent({widget, event, results, now}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number}) {
    const teams = results?.Scoreboard ?? [];
    const logo = resolveEventLogoURL(event.LogoURL);
    if (widget.type === "title") return <div className="live-title">{logo && <img src={logo} alt="" />}<div><strong>{event.Name}</strong>{typeof widget.props.subtitle === "string" && <span>{widget.props.subtitle}</span>}</div></div>;
    if (widget.type === "timer") {
        const target = Date.parse(event.StartTime) > now ? event.StartTime : event.FinishTime;
        const seconds = target ? Math.max(0, Math.floor((Date.parse(target) - now) / 1000)) : 0;
        const label = Date.parse(event.StartTime) > now ? "До початку" : !target ? "Без часу завершення" : seconds > 0 ? "До завершення" : "Подію завершено";
        return <div className="live-timer"><small>{label}</small><strong>{String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong></div>;
    }
    if (widget.type === "chart") {
        const chartStart = Date.parse(event.StartTime);
        const chartEnd = Math.max(chartStart + 60000, Math.min(event.FinishTime ? Date.parse(event.FinishTime) : Number.POSITIVE_INFINITY, now));
        return <div className="live-chart"><h2>Динаміка балів</h2>{teams.length ? <><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Графік балів команд"><path d="M0 90H100 M0 50H100 M0 10H100" className="live-chart__grid" />{teams.slice(0, Number(widget.props.lines) || 5).map((team, index) => <path key={team.TeamID} d={chartPath(results, team.TeamID, chartStart, chartEnd)} fill="none" stroke={palette[index % palette.length]} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}</svg><div className="live-chart__legend">{teams.slice(0, Number(widget.props.lines) || 5).map((team, index) => <span key={team.TeamID}><i style={{background: palette[index % palette.length]}} />{team.TeamName}</span>)}</div></> : <p>Результати з’являться після першого розв’язання.</p>}</div>;
    }
    if (widget.type === "ad_table") return <div className="live-table"><h2>Таблиця A/D</h2><p>Дані A/D наразі недоступні.</p></div>;
    if (widget.type === "table") {
        const pageSize = Math.max(1, Number(widget.props.rowsPerPage) || 10);
        const pageCount = Math.max(1, Math.ceil(teams.length / pageSize));
        const page = Math.floor(now / 1000 / Math.max(1, Number(widget.props.pageSeconds) || 10)) % pageCount;
        return <div className="live-table"><h2>Таблиця результатів</h2>{teams.length ? <table><thead><tr><th>№</th><th>Команда</th><th>Бали</th></tr></thead><tbody>{teams.slice(page * pageSize, (page + 1) * pageSize).map(team => <tr key={team.TeamID}><td>{team.Rank}</td><td>{team.TeamName}</td><td>{team.Points.toLocaleString("uk-UA")}</td></tr>)}</tbody></table> : <p>Результатів поки немає.</p>}</div>;
    }
    if (widget.type === "solves") {
        const names = new Map(teams.map(team => [team.TeamID, team.TeamName]));
        return <div className="live-solves"><h2>Останні розв’язання</h2>{results?.Timeline.length ? <ol>{[...results.Timeline].sort((a, b) => b.SolvedAt.localeCompare(a.SolvedAt)).slice(0, Number(widget.props.rows) || 5).map((item, index) => <li key={`${item.EventTeamID}-${item.EventChallengeID}-${index}`}><span>{names.get(item.EventTeamID) ?? "Команда"} → {item.ChallengeName}</span><b>+{item.Points}</b><time>{new Date(item.SolvedAt).toLocaleTimeString("uk-UA", {hour: "2-digit", minute: "2-digit"})}</time></li>)}</ol> : <p>Нових розв’язань немає.</p>}</div>;
    }
    if (widget.type === "announcement") return <div className="live-announcement">{typeof widget.props.text === "string" && widget.props.text.trim() || "Оголошення організатора"}</div>;
    if (widget.type === "logos") {
        const urls = Array.isArray(widget.props.logos) ? widget.props.logos.filter((value): value is string => typeof value === "string").map(liveLogoURL).filter((value): value is string => !!value) : [];
        const duration = widget.props.speed === "slow" ? "40s" : widget.props.speed === "fast" ? "15s" : "25s";
        return <div className={`live-logos${widget.props.mode === "carousel" && urls.length > 1 ? " live-logos--carousel" : ""}`}><small>{typeof widget.props.title === "string" ? widget.props.title : "Логотипи"}</small><div style={{animationDuration: duration, animationPlayState: widget.props.paused === true ? "paused" : "running"}}>{urls.length ? urls.map((url, index) => <img key={`${url}-${index}`} src={url} alt="Логотип партнера" />) : logo && <img src={logo} alt="Логотип події" />}</div></div>;
    }
    if (widget.type === "qr") return <LiveQR url={typeof widget.props.url === "string" ? widget.props.url : ""} />;
    return <span>{liveWidgetLabels[widget.type]}</span>;
}

export function LiveCanvas({layout, event, results, selectedID, onSelect, edit = false, showGrid = false, onPointerDown}: {
    layout: LiveLayout; event: PublicEventInfo; results?: ManageResultsSnapshot; selectedID?: string | null;
    onSelect?: (id: string) => void; edit?: boolean; showGrid?: boolean;
    onPointerDown?: (event: React.PointerEvent<HTMLButtonElement | HTMLSpanElement>, widget: LiveWidget, mode: "move" | "resize") => void;
}) {
    const [now, setNow] = useState(0);
    useEffect(() => {const frame = requestAnimationFrame(() => setNow(Date.now())); const timer = setInterval(() => setNow(Date.now()), 1000); return () => {cancelAnimationFrame(frame); clearInterval(timer);};}, []);
    const style = useMemo(() => ({
        "--live-cols": layout.grid.cols, "--live-rows": layout.grid.rows, "--live-text-scale": layout.screen.textScale,
        ...(layout.theme === "dark" && (whiteTextContrast(event.Theme.Brand) ?? 21) < 4.5 ? {"--live-ink": "#16152B", "--live-muted": "#4D4B61", "--live-line": "rgba(33,26,82,.2)"} : {}),
    } as CSSProperties), [layout.grid.cols, layout.grid.rows, layout.screen.textScale, layout.theme, event.Theme.Brand]);
    return <div className={`live-canvas live-canvas--${layout.theme}${showGrid ? " live-canvas--grid" : ""}${edit ? " live-canvas--edit" : ""}`} style={style}>
        {layout.widgets.map(widget => edit ? <button key={widget.id} type="button" className={`live-widget live-widget--${widget.type}${selectedID === widget.id ? " is-selected" : ""}`} style={{gridColumn: `${widget.x} / span ${widget.w}`, gridRow: `${widget.y} / span ${widget.h}`}} onClick={() => onSelect?.(widget.id)} onPointerDown={event => onPointerDown?.(event, widget, "move")}>
            <WidgetContent widget={widget} event={event} results={results} now={now} />
            <span className="live-widget__resize" role="presentation" onPointerDown={event => {event.stopPropagation(); onPointerDown?.(event, widget, "resize");}} />
        </button> : <div key={widget.id} className={`live-widget live-widget--${widget.type}`} style={{gridColumn: `${widget.x} / span ${widget.w}`, gridRow: `${widget.y} / span ${widget.h}`}}><WidgetContent widget={widget} event={event} results={results} now={now} /></div>)}
    </div>;
}
