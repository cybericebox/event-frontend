"use client";

import {useEffect, useMemo, useState, type CSSProperties, type DragEvent, type PointerEvent} from "react";
import {Snowflake, WifiOff} from "lucide-react";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventLoading} from "@/components/event/EventLoading";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {liveCorners, liveLogoURL, liveWidgetLabels, type LiveCorner} from "./liveLayout";
import {liveCaptionShown, liveCaptionText, liveTextFloors, liveTextProfile, liveTextSize, liveTextSizes, liveTextVars, liveWidgetTextScale, type LiveTextProfile} from "./liveText";
import {liveAnnouncementFit, liveHeaderRow, liveTableFit, liveTimerFit, liveTitleFit} from "./liveFit";
import {liveStageSubtitle, liveTimerDigitMode, liveTimerDigits, liveTimerState, liveTimerUrgency, liveTimerZero, type LiveStage} from "./liveStages";
import {livePinTop, livePoints, liveTablePage, liveTablePageAt} from "./liveTable";
import {chartSeries, spreadLabels} from "./liveChart";
import {liveSampleSpan} from "./liveSample";
import {LiveQR} from "./LiveQR";
import {LiveList, measureName, useElementSize, type LiveMetrics} from "./LiveParts";
import {liveAlign, LiveClock, LiveFactsBlock, LivePodium, LiveStagesBlock} from "./LiveBlocks";
import {whiteTextContrast} from "@/components/event/manage/deriveTheme";
import {resolveEventLogoURL} from "@/utils/eventLogoURL";
import {clockLabel} from "@/utils/resultsFreeze";
import crest from "@/styles/assets/crest-128.png";
import "./live.css";
import {t, tRich} from "@/i18n/t";

const noStages: LiveStage[] = [];

// Series colours of the «Класика» boards: DS series tokens, which `data-live` on the chart sets for the board theme.
const seriesColors = Array.from({length: 10}, (_, index) => `var(--ib-s${index + 1})`);

function frozenSuffix(results?: ManageResultsSnapshot): string {
    return results?.Freeze.Applied && results.Freeze.FrozenAt ? t("live.frozenSuffix", {time: clockLabel(results.Freeze.FrozenAt)}) : "";
}

// The moment the shown results are frozen at, null for live results.
function frozenAt(results?: ManageResultsSnapshot): string | null {
    return results?.Freeze.Applied && results.Freeze.FrozenAt ? results.Freeze.FrozenAt : null;
}

// A note under the timer, or in the title when the screen has no timer:
// «Немає звʼязку · дані на 12:03» while the data is not live, else
// «Заморожено о 10:59» while the results are frozen.
export type LiveNote = {kind: "offline" | "freeze"; text: string};

function liveNote(results: ManageResultsSnapshot | undefined, offlineSince: number | null): LiveNote | null {
    if (offlineSince !== null) return {kind: "offline", text: t("live.offline", {time: clockLabel(offlineSince)})};
    const frozen = frozenAt(results);
    return frozen ? {kind: "freeze", text: t("live.freeze.badge", {time: clockLabel(frozen)})} : null;
}

function NoteBadge({note, size}: {note: LiveNote; size?: number}) {
    const Icon = note.kind === "offline" ? WifiOff : Snowflake;
    return <span className={`live-freeze${note.kind === "offline" ? " live-freeze--offline" : ""}`} role={note.kind === "offline" ? "status" : undefined} style={size ? {fontSize: size} : undefined}>
        <Icon aria-hidden="true" />{note.text}
    </span>;
}

// The caption of a block: its own text or the default, null when hidden.
function captionOf(widget: LiveWidget, fallback: string): string | null {
    return liveCaptionShown(widget) ? liveCaptionText(widget, fallback) : null;
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
    const caption = captionOf(widget, t("live.chart.title", {suffix}));
    return <div className="live-chart" data-live={theme}>
        {caption !== null && <h2>{caption}</h2>}
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
// theme uses a logo's own dark file when it has one. A fixed block may wrap
// into 2–3 rows (a sponsors' wall).
function LiveLogos({widget, edit, sample, theme}: {widget: LiveWidget; edit: boolean; sample: boolean; theme: LiveLayout["theme"]}) {
    // A logo that does not load leaves no empty slot behind.
    const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
    const items = liveLogoItems(widget.props);
    const urls = items.map(item => liveLogoURL(theme === "dark" && item.dark ? item.dark : item.src)).filter((value): value is string => !!value && !broken.has(value));
    // With sample data and no logo at all, the platform crest stands in. The
    // event logo never does: an organizers block without logos is no block.
    const images = urls.length ? urls : sample ? [crest.src, crest.src, crest.src] : [];
    // No logo at all: the screen shows nothing rather than a lonely caption.
    if (!images.length && !edit) return null;
    const carousel = widget.props.mode === "carousel" && images.length > 1;
    const rows = !carousel && [2, 3].includes(Number(widget.props.rows)) ? Math.min(Number(widget.props.rows), images.length) : 1;
    const mono = widget.props.color !== "original";
    const duration = widget.props.speed === "slow" ? "80s" : widget.props.speed === "fast" ? "30s" : "50s";
    const caption = captionOf(widget, t("live.logos.title"));
    return <div className={`live-logos${carousel ? " live-logos--carousel" : ""}${mono ? " live-logos--mono" : ""}${rows > 1 ? " live-logos--rows" : ""}`}
        style={{"--live-logo-count": images.length, "--live-logo-rows": rows, "--live-logo-cols": Math.ceil(images.length / rows)} as CSSProperties}>
        {caption !== null && <h2>{caption}</h2>}
        <div className="live-logos__track">
            <div style={carousel ? {animationDuration: duration, animationPlayState: widget.props.paused === true || edit ? "paused" : "running"} : undefined}>
                {(carousel ? [...images, ...images] : images).map((url, index) => <span key={`${url}-${index}`} className="live-logo">
                    <img src={url} alt={index < images.length ? t("live.logos.alt") : ""} aria-hidden={index >= images.length || undefined}
                        onError={() => setBroken(current => new Set(current).add(url))} />
                </span>)}
            </div>
        </div>
    </div>;
}

function LiveTimer({widget, event, stages, now, results, note, metrics, named, edit}: {widget: LiveWidget; event: PublicEventInfo; stages: LiveStage[]; now: number; results?: ManageResultsSnapshot; note: LiveNote | null; metrics: LiveMetrics; named: boolean; edit: boolean}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const state = liveTimerState(widget.props, event, stages, now, results?.Freeze.FrozenAt ?? null, named);
    const digits = liveTimerDigits(state, now, widget.props.showSeconds !== false, liveTimerDigitMode(widget.props.digits));
    const zero = liveTimerZero(state, widget.props.atZero, widget.props.zeroText);
    // «На нулі → Сховати»: the block stays empty on the screen; the editor keeps a quiet hint.
    const hidden = digits === null && zero === null;
    const shown = digits ?? zero ?? (edit ? t("live.timer.hiddenAtZero") : "");
    const urgency = liveTimerUrgency(state, now, Number(widget.props.lastMinutes) || 0);
    const custom = typeof widget.props.label === "string" ? widget.props.label.trim() : "";
    // In the last minute the label gives its room to the digits.
    const label = widget.props.showLabel === false || urgency === "final" || hidden ? null : custom || state.label || null;
    const labelSize = (["s", "m", "l"] as const).find(value => value === widget.props.labelSize) ?? "m";
    const words = digits !== null && liveTimerDigitMode(widget.props.digits) === "words";
    const fit = liveTimerFit({width: size.width, height: size.height, digits: shown.length, label, labelSize, badge: note?.text ?? null, labelMin: metrics.caption, digitsMin: metrics.timer, labelMax: metrics.display * 1.25});
    const className = ["live-timer", urgency !== "calm" ? `live-timer--${urgency}` : "", hidden ? "live-timer--hidden" : ""].filter(Boolean).join(" ");
    if (hidden && !edit) return <div className={className} ref={ref} />;
    return <div className={className} ref={ref} data-align={liveAlign(widget, "right")}>
        {label && fit.labelShown && <small style={{fontSize: fit.label}}>{label}</small>}
        {note && !fit.labelShown && <NoteBadge note={note} size={fit.badge} />}
        <strong className={digits && !words ? undefined : "live-timer__word"} style={{fontSize: fit.digits}}>{shown}</strong>
        {note && fit.labelShown && <NoteBadge note={note} size={fit.badge} />}
    </div>;
}

function LiveTitle({widget, event, logo, stages, now, note, metrics}: {widget: LiveWidget; event: PublicEventInfo; logo: string | null; stages: LiveStage[]; now: number; note: LiveNote | null; metrics: LiveMetrics}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const text = typeof widget.props.subtitle === "string" ? widget.props.subtitle.trim() : "";
    // «Поточний етап»: the running stage (or the next one); the own text otherwise.
    const subtitle = widget.props.subtitleStage === true ? liveStageSubtitle(stages, now) || text : text;
    // A logo that does not load (an unpublished event's logo on a screen with no session) leaves no empty tile.
    const [logoBroken, setLogoBroken] = useState(false);
    const shownLogo = widget.props.showLogo === false || logoBroken ? null : logo;
    const fit = liveTitleFit({width: size.width, height: size.height, name: event.Name, subtitle: !!subtitle || !!note, logo: !!shownLogo, subtitleMin: metrics.caption});
    return <div className="live-title" ref={ref} data-align={liveAlign(widget, "left")}>
        {shownLogo && <span className="live-title__logo" style={{height: fit.logo}}><img src={shownLogo} alt="" onError={() => setLogoBroken(true)} /></span>}
        <div>
            <strong style={{fontSize: fit.name}}>{event.Name}</strong>
            {(subtitle || note) && <span style={{fontSize: fit.subtitle}}>{note ? <NoteBadge note={note} /> : subtitle}</span>}
        </div>
    </div>;
}

type LiveTeamRow = NonNullable<ManageResultsSnapshot["Scoreboard"]>[number];

// «Колонки»: a wide table splits its page into two columns side by side.
function TableColumn({rows, pinned, width, rowHeight, metrics, rankChars, pointsChars, event}: {
    rows: LiveTeamRow[]; pinned: number; width: number; rowHeight: number; metrics: LiveMetrics; rankChars: number; pointsChars: number; event: PublicEventInfo;
}) {
    const fit = liveTableFit({width, rowHeight, body: metrics.body, rankChars, pointsChars, names: rows.map(team => team.TeamName), measure: measureName});
    return <table className="live-table" style={{"--live-row-font": `${fit.font}px`} as CSSProperties}>
        <colgroup><col style={{width: fit.rankWidth}} /><col /><col style={{width: fit.pointsWidth}} /></colgroup>
        <thead><tr style={{height: metrics.caption * liveHeaderRow}}><th>{t("live.table.rank")}</th><th>{event.Participation === 1 ? t("live.table.team") : t("live.table.participant")}</th><th>{t("live.table.points")}</th></tr></thead>
        <tbody style={{fontSize: fit.font}}>{rows.map((team, index) => <tr key={team.TeamID} style={{height: rowHeight}}
            className={[team.Rank === 1 ? "is-lead" : "", team.Rank <= 3 ? "is-top" : "", index === pinned - 1 ? "is-pinned-last" : ""].filter(Boolean).join(" ") || undefined}>
            <td>{team.Rank}</td>
            <td className={fit.names[index].lines === 2 ? "live-table__name is-wrap" : "live-table__name"} style={{fontSize: fit.names[index].font}} title={team.TeamName}>{team.TeamName}</td>
            <td>{livePoints(team.Points)}</td>
        </tr>)}</tbody>
    </table>;
}

// The places a table shows: «Почати з місця 4» skips the podium, «Лише
// перші N» stops after N places (no paging past them).
export function liveTableSource<T>(teams: T[], props: LiveWidget["props"]): {rows: T[]; offset: number} {
    const offset = Number(props.offset) === 3 ? 3 : 0;
    const limit = Math.max(0, Math.floor(Number(props.limit) || 0));
    return {rows: teams.slice(offset, limit ? offset + limit : undefined), offset};
}

function LiveTable({widget, event, results, now, metrics, edit, suffix}: {widget: LiveWidget; event: PublicEventInfo; results?: ManageResultsSnapshot; now: number; metrics: LiveMetrics; edit: boolean; suffix: string}) {
    const teams = results?.Scoreboard ?? [];
    const {rows: source, offset} = liveTableSource(teams, widget.props);
    const columns = Number(widget.props.columns) === 2 ? 2 : 1;
    const pageSize = Math.max(1, Number(widget.props.rowsPerPage) || 10);
    const pageSeconds = Math.max(1, Number(widget.props.pageSeconds) || 10);
    const {page, elapsed} = liveTablePageAt(now, pageSeconds, edit);
    // Pinning keeps places 1–N; a table that starts after the podium has none.
    const view = liveTablePage(source, {pageSize: pageSize * columns, pinTop: offset ? 0 : livePinTop(widget.props.pinTop), page});
    const paged = view.pageCount > 1;
    const title = captionOf(widget, t("live.table.title", {suffix}));
    const caption = title === null ? null : <>
        <span>{title}</span>
        {paged && <span className="live-list__range">{t("live.table.range", {from: view.from + offset, to: view.to + offset, total: offset + source.length})}</span>}
    </>;
    const rankChars = String(teams.at(-1)?.Rank ?? 1).length;
    const pointsChars = Math.max(...teams.map(team => livePoints(team.Points).length), 1);
    const split = Array.from({length: columns}, (_, index) => view.rows.slice(index * pageSize, (index + 1) * pageSize));
    return <LiveList caption={caption} rows={pageSize} header metrics={metrics} empty={source.length ? null : t("live.table.empty")} progress={paged && !edit ? {page, seconds: pageSeconds, elapsed} : null}>
        {(geometry, width) => {
            const gap = columns > 1 ? metrics.body * 1.2 : 0;
            const columnWidth = (width - gap * (columns - 1)) / columns;
            return <div className="live-table-columns" style={{gap}}>
                {split.map((rows, index) => <TableColumn key={index} rows={rows} pinned={index === 0 ? view.pinned : 0} width={columnWidth} rowHeight={geometry.rowHeight}
                    metrics={metrics} rankChars={rankChars} pointsChars={pointsChars} event={event} />)}
            </div>;
        }}
    </LiveList>;
}

// «Останні розв'язання», or in «Перші розв'язання» only the first solve of
// each task (first blood), newest first.
export function liveSolveItems(timeline: ManageResultsSnapshot["Timeline"], mode: unknown, rows: number): ManageResultsSnapshot["Timeline"] {
    const sorted = [...timeline].sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt));
    const firsts = new Map<string, typeof sorted[number]>();
    for (const item of sorted) if (!firsts.has(item.EventChallengeID)) firsts.set(item.EventChallengeID, item);
    const items = mode === "first" ? [...firsts.values()] : sorted;
    return items.sort((a, b) => b.SolvedAt.localeCompare(a.SolvedAt)).slice(0, rows);
}

// A solve row reads «team · task  +points  time» on one line: the text grows
// with the row height, but no further than about 34 characters fit the width.
export function liveSolvesFont(rowFont: number, width: number, body: number): number {
    return Math.max(Math.min(rowFont, body), Math.min(rowFont, width / (34 * 0.56)));
}

function LiveSolves({widget, results, metrics, suffix, participation}: {widget: LiveWidget; results?: ManageResultsSnapshot; metrics: LiveMetrics; suffix: string; participation: PublicEventInfo["Participation"]}) {
    const names = new Map((results?.Scoreboard ?? []).map(team => [team.TeamID, team.TeamName]));
    const rows = Math.max(1, Number(widget.props.rows) || 5);
    const first = widget.props.mode === "first";
    const items = liveSolveItems(results?.Timeline ?? [], widget.props.mode, rows);
    const caption = captionOf(widget, t(first ? "live.solves.firstTitle" : "live.solves.title", {suffix}));
    return <LiveList caption={caption} rows={rows} header={false} metrics={metrics} empty={items.length ? null : t("live.solves.empty")}>
        {(geometry, width) => <ol className="live-solves" style={{fontSize: liveSolvesFont(geometry.rowFont, width, metrics.body)}}>{items.map((item, index) => <li key={`${item.EventTeamID}-${item.EventChallengeID}-${index}`} style={{height: geometry.rowHeight}}>
            <span>{tRich("live.solves.row", {team: <strong>{names.get(item.EventTeamID) ?? (participation === 1 ? t("live.table.team") : t("live.table.participant"))}</strong>, task: <em>{item.ChallengeName}</em>})}</span>
            {/* First solves are about the task: no points, the room goes to its name. */}
            {!first && <b>{t("live.solves.points", {points: livePoints(item.Points)})}</b>}<time>{clockLabel(item.SolvedAt)}</time>
        </li>)}</ol>}
    </LiveList>;
}

const liveResultsBlocks = new Set<LiveWidget["type"]>(["chart", "table", "solves", "podium", "facts"]);

function WidgetContent({widget, event, stages, results, now, theme, edit, sample, metrics, note, suffix, named}: {
    widget: LiveWidget; event: PublicEventInfo; stages: LiveStage[]; results?: ManageResultsSnapshot; now: number; theme: LiveLayout["theme"]; edit: boolean; sample: boolean; metrics: LiveMetrics;
    // The note this widget carries (the timer, else the title): no connection or the freeze.
    note: LiveNote | null;
    // The freeze note of the captions (none while a badge shows it) and whether the timer names the stage.
    suffix: string; named: boolean;
}) {
    const logo = resolveEventLogoURL(event.LogoURL);
    if (widget.type === "title") return <LiveTitle widget={widget} event={event} logo={logo} stages={stages} now={now} note={note} metrics={metrics} />;
    if (widget.type === "timer") return <LiveTimer widget={widget} event={event} stages={stages} now={now} results={results} note={note} metrics={metrics} named={named} edit={edit} />;
    // Until the first results arrive, a data block shows the event logo, not «no results yet».
    if (!edit && !sample && !results && liveResultsBlocks.has(widget.type)) return <EventLoading event={event} compact label={t("live.loading")} />;
    if (widget.type === "chart") return <LiveChart widget={widget} event={event} results={results} now={now} theme={theme} sample={sample} metrics={metrics} suffix={suffix} />;
    // Until Attack-Defense exists the A/D table renders nothing on the screen.
    if (widget.type === "ad_table") return edit ? <div className="live-retired"><strong>{liveWidgetLabels.ad_table}</strong><span>{t("live.retired")}</span></div> : null;
    if (widget.type === "table") return <LiveTable widget={widget} event={event} results={results} now={now} metrics={metrics} edit={edit} suffix={suffix} />;
    if (widget.type === "solves") return <LiveSolves widget={widget} results={results} metrics={metrics} suffix={suffix} participation={event.Participation} />;
    if (widget.type === "announcement") return <LiveAnnouncement widget={widget} metrics={metrics} />;
    if (widget.type === "logos") return <LiveLogos widget={widget} edit={edit} sample={sample} theme={theme} />;
    if (widget.type === "qr") return <LiveQR value={typeof widget.props.value === "string" ? widget.props.value : typeof widget.props.url === "string" ? widget.props.url : ""}
        caption={typeof widget.props.caption === "string" ? widget.props.caption : ""} />;
    if (widget.type === "podium") return <LivePodium widget={widget} event={event} results={results} metrics={metrics} caption={captionOf(widget, t("live.podium.title"))} />;
    if (widget.type === "facts") return <LiveFactsBlock widget={widget} event={event} results={results} metrics={metrics} caption={captionOf(widget, t("live.facts.title"))} />;
    if (widget.type === "stages") return <LiveStagesBlock widget={widget} event={event} stages={stages} now={now} metrics={metrics} caption={captionOf(widget, t("live.stages.title"))} sample={sample} />;
    if (widget.type === "clock") return <LiveClock widget={widget} now={now} metrics={metrics} />;
    return null;
}

// «Оголошення»: the text fills its block, on one line or two.
function LiveAnnouncement({widget, metrics}: {widget: LiveWidget; metrics: LiveMetrics}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const text = typeof widget.props.text === "string" && widget.props.text.trim() || t("live.announcement.placeholder");
    const fit = liveAnnouncementFit({width: size.width, height: size.height, chars: text.length, display: metrics.display});
    return <div className="live-announcement" ref={ref} data-align={liveAlign(widget, "center")}>
        <span className={fit.lines === 2 ? "is-wrap" : undefined} style={size.width ? {fontSize: fit.font} : undefined}>{text}</span>
    </div>;
}

export type LiveGhost = {x: number; y: number; w: number; h: number; ok: boolean};

// Text sizes of one block: the canvas size, the screen text scale and the
// block's own «Розмір тексту».
function blockMetrics(height: number, width: number, textScale: number, profile: LiveTextProfile): LiveMetrics {
    const size = (role: "caption" | "body" | "display") => liveTextSize(role, height, textScale, width || undefined, profile).effective;
    return {caption: size("caption"), body: size("body"), display: size("display"), timer: liveTextFloors[profile].timer};
}

export function LiveCanvas({layout, event, stages = noStages, results, offlineSince = null, sample = false, nowOffset = 0, startClock = 0, selectedID, onSelect, edit = false, showGrid = false, onPointerDown, conflicts, warned, ghost, onDragOver, onDragLeave, onDrop}: {
    layout: LiveLayout; event: PublicEventInfo; stages?: LiveStage[]; results?: ManageResultsSnapshot; sample?: boolean; selectedID?: string | null;
    // Since when the data is not live (the screen lost the connection), else null.
    offlineSince?: number | null;
    // The editor previews a scene at a moment of its state: the clock runs this far from now.
    nowOffset?: number;
    // The clock of a server-rendered first paint (0: the browser's clock fills it in).
    startClock?: number;
    onSelect?: (id: string) => void; edit?: boolean; showGrid?: boolean;
    onPointerDown?: (event: PointerEvent<HTMLButtonElement | HTMLSpanElement>, widget: LiveWidget, mode: "move" | LiveCorner) => void;
    conflicts?: Set<string>; warned?: Set<string>; ghost?: LiveGhost | null;
    onDragOver?: (event: DragEvent<HTMLDivElement>) => void; onDragLeave?: () => void; onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
    const [canvasRef, canvasSize] = useElementSize<HTMLDivElement>();
    // Effective text sizes of this canvas: the same numbers as liveText.
    const profile = liveTextProfile(layout.screen);
    // One set of sizes per text size (S/M/L/XL), shared by the blocks that use it.
    const metricsBySize = useMemo(() => new Map(Object.values(liveTextSizes).map(size => {
        const scale = layout.screen.textScale * size;
        return [scale, blockMetrics(canvasSize.height, canvasSize.width, scale, profile)] as const;
    })), [canvasSize.height, canvasSize.width, layout.screen.textScale, profile]);
    const metricsFor = (widget: LiveWidget) => metricsBySize.get(liveWidgetTextScale(layout.screen.textScale, widget)) ?? blockMetrics(canvasSize.height, canvasSize.width, layout.screen.textScale, profile);
    const badgeHost = layout.widgets.some(widget => widget.type === "timer") ? "timer" : "title";
    // One freeze mark is enough: with a badge on screen the captions skip the note.
    const suffix = layout.widgets.some(widget => widget.type === badgeHost) ? "" : frozenSuffix(results);
    const note = liveNote(results, offlineSince);
    // The timer names the stage unless the title already shows it.
    const named = !layout.widgets.some(widget => widget.type === "title" && widget.props.subtitleStage === true);
    const [clock, setClock] = useState(startClock);
    useEffect(() => {const frame = requestAnimationFrame(() => setClock(Date.now())); const timer = setInterval(() => setClock(Date.now()), 1000); return () => {cancelAnimationFrame(frame); clearInterval(timer);};}, []);
    const now = clock && clock + nowOffset;
    const style = useMemo(() => ({
        "--live-cols": layout.grid.cols, "--live-rows": layout.grid.rows, ...liveTextVars(layout.screen.textScale, profile),
        ...(layout.theme === "dark" && (whiteTextContrast(event.Theme.Brand) ?? 21) < 4.5 ? {"--live-ink": "#16152B", "--live-dim": "#4D4B61", "--live-faint": "#4D4B61", "--live-line": "rgba(33,26,82,.2)", "--live-logo-filter": "brightness(0)"} : {}),
    } as CSSProperties), [layout.grid.cols, layout.grid.rows, layout.screen.textScale, layout.theme, event.Theme.Brand, profile]);
    // Light theme: row 1 is the brand band; one-row widgets there sit on it,
    // taller ones cover it with the page colour.
    const place = (widget: LiveWidget) => `live-widget live-widget--${widget.type}${layout.theme === "light" && widget.y === 1 ? widget.h === 1 ? " live-widget--band" : " live-widget--masked" : ""}${selectedID === widget.id ? " is-selected" : ""}${conflicts?.has(widget.id) ? " is-conflict" : warned?.has(widget.id) ? " is-warned" : ""}`;
    // A block with its own text size scales the screen unit inside it.
    const blockStyle = (widget: LiveWidget): CSSProperties => {
        const scale = liveWidgetTextScale(layout.screen.textScale, widget);
        return {gridColumn: `${widget.x} / span ${widget.w}`, gridRow: `${widget.y} / span ${widget.h}`, ...(scale !== layout.screen.textScale ? liveTextVars(scale, profile) : {})};
    };
    const content = (widget: LiveWidget, editing: boolean) => <WidgetContent widget={widget} event={event} stages={stages} results={results} now={now} theme={layout.theme} edit={editing} sample={sample}
        metrics={metricsFor(widget)} note={widget.type === badgeHost ? note : null} suffix={suffix} named={named} />;
    return <div className={`live-canvas live-canvas--${layout.theme}${showGrid ? " live-canvas--grid" : ""}${edit ? " live-canvas--edit" : ""}`} style={style} ref={canvasRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        {layout.widgets.map(widget => edit ? <button key={widget.id} type="button" className={place(widget)} style={blockStyle(widget)} onClick={() => onSelect?.(widget.id)} onPointerDown={event => onPointerDown?.(event, widget, "move")}>
            {content(widget, true)}
            {liveCorners.map(corner => <span key={corner} className={`live-widget__corner live-widget__corner--${corner}`} role="presentation" data-corner={corner}
                onPointerDown={event => {event.stopPropagation(); onPointerDown?.(event, widget, corner);}} />)}
        </button> : <div key={widget.id} className={place(widget)} style={blockStyle(widget)}>{content(widget, false)}</div>)}
        {ghost && <div className={`live-drop-ghost${ghost.ok ? "" : " is-blocked"}`} style={{gridColumn: `${ghost.x} / span ${ghost.w}`, gridRow: `${ghost.y} / span ${ghost.h}`}} aria-hidden="true" />}
    </div>;
}
