"use client";

import {useState, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {Columns3, Rows3, Trash2} from "lucide-react";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import {getResultsSettings} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {t} from "@/i18n/t";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {localFromISO, localToISO} from "@/components/ui/dateTimePicker";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {liveWidgetMinimums, liveWidgetName, type DistributeAxis} from "../liveLayout";
import {liveListFit} from "../liveText";
import {livePageSecondsHint} from "../liveFit";
import {liveLogoItems, liveTimerState, type LiveLogoItem, type LiveTimerSource} from "../LiveCanvas";
import {LiveField, LiveNumberInput, LiveSegmented, LiveSwitch} from "./LiveFields";
import {LiveLogosEditor} from "./LiveLogosEditor";

type PropValue = string | number | boolean | string[] | LiveLogoItem[];

const pageSecondsOptions = [5, 8, 10, 12, 15, 20, 30, 45, 60];

function numberProp(widget: LiveWidget, key: string, fallback: number): number {
    const value = Number(widget.props[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function textProp(widget: LiveWidget, key: string): string {
    return typeof widget.props[key] === "string" ? widget.props[key] as string : "";
}

function Section({title, children}: {title: string; children: ReactNode}) {
    return <section className="event-live-settings__section"><h4>{title}</h4>{children}</section>;
}

// Rows of a table or recent-solves widget: N rows that fill the widget, a
// warning when they would be too small to read, and the page time hint.
function RowsFields({layout, widget, disabled, onProp}: {layout: LiveLayout; widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const table = widget.type === "table";
    const key = table ? "rowsPerPage" : "rows";
    const fit = liveListFit(layout, widget);
    const warning = fit.readable ? null : t("manage.live.prop.rowsTooMany", {max: fit.maxRows});
    return <>
        <LiveField label={t(table ? "manage.live.prop.rowsPerPage" : "manage.live.prop.solvesRows")} help={t(table ? "manage.live.prop.rowsPerPageHelp" : "manage.live.prop.solvesRowsHelp")} required warning={warning}
            note={t("manage.live.prop.rowsReadable", {max: fit.maxRows})}>
            {id => <LiveNumberInput id={id} value={fit.rows} min={1} max={60} disabled={disabled} onChange={value => onProp(key, value)} />}
        </LiveField>
        {table && <PageSecondsField widget={widget} rows={fit.rows} disabled={disabled} onProp={onProp} />}
    </>;
}

function PageSecondsField({widget, rows, disabled, onProp}: {widget: LiveWidget; rows: number; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const seconds = numberProp(widget, "pageSeconds", 10);
    const hint = livePageSecondsHint(rows);
    const options = [...new Set([...pageSecondsOptions, seconds])].sort((a, b) => a - b);
    return <LiveField label={t("manage.live.prop.pageSeconds")} help={t("manage.live.prop.pageSecondsHelp")} required
        note={t("manage.live.prop.pageSecondsHint", {seconds: hint, rows})} warning={seconds < hint ? t("manage.live.prop.pageSecondsShort", {seconds: hint}) : null}>
        {() => <EventSelect ariaLabel={t("manage.live.prop.pageSeconds")} value={String(seconds)} disabled={disabled} onValueChange={value => onProp("pageSeconds", Number(value))}
            options={options.map(value => ({value: String(value), label: t("manage.live.seconds", {count: value})}))} />}
    </LiveField>;
}

function TimerFields({widget, event, disabled, onProp}: {widget: LiveWidget; event: PublicEventInfo; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const settings = useQuery({queryKey: ["event-management-results-settings", event.EventID], queryFn: () => getResultsSettings(event.EventID), refetchOnWindowFocus: false});
    const source = (textProp(widget, "source") || "auto") as LiveTimerSource;
    const freezeAvailable = !!settings.data?.FreezeEnabled;
    const sources: LiveTimerSource[] = ["auto", "start", "finish", "freeze", "custom"];
    const [openedAt] = useState(() => Date.now());
    const auto = liveTimerState({...widget.props, label: ""}, event, openedAt, settings.data?.Freeze.FrozenAt ?? null).label;
    const showLabel = widget.props.showLabel !== false;
    const target = textProp(widget, "target");
    return <>
        <LiveField label={t("manage.live.prop.timerSource")} help={t("manage.live.prop.timerSourceHelp")} required>
            {() => <EventSelect ariaLabel={t("manage.live.prop.timerSource")} value={source} disabled={disabled}
                onValueChange={value => onProp("source", value)}
                options={sources.map(value => ({value, label: t(`manage.live.prop.timerSource.${value}`),
                    disabled: value === "freeze" && !freezeAvailable, disabledReason: value === "freeze" && !freezeAvailable ? t("manage.live.prop.timerFreezeOff") : undefined}))} />}
        </LiveField>
        {source === "custom" && <LiveField label={t("manage.live.prop.timerTarget")} help={t("manage.live.prop.timerTargetHelp")} required
            warning={target ? null : t("manage.live.prop.timerTargetMissing")}>
            {id => <EventDateTimePicker id={id} ariaLabel={t("manage.live.prop.timerTarget")} value={localFromISO(target)} disabled={disabled}
                onChange={value => {const iso = localToISO(value); if (iso) onProp("target", iso);}} />}
        </LiveField>}
        <LiveSwitch label={t("manage.live.prop.timerLabel")} help={t("manage.live.prop.timerLabelHelp")} checked={showLabel} disabled={disabled} onChange={value => onProp("showLabel", value)} />
        {showLabel && <>
            <LiveField label={t("manage.live.prop.timerLabelText")} help={t("manage.live.prop.timerLabelTextHelp")}>
                {id => <input id={id} className="event-manage-input" maxLength={60} placeholder={auto} value={textProp(widget, "label")} disabled={disabled} onChange={event => onProp("label", event.target.value)} />}
            </LiveField>
            <LiveSegmented label={t("manage.live.prop.timerLabelSize")} help={t("manage.live.prop.timerLabelSizeHelp")} value={(textProp(widget, "labelSize") || "m") as "s" | "m" | "l"} disabled={disabled}
                options={[{value: "s", label: t("manage.live.prop.size.s")}, {value: "m", label: t("manage.live.prop.size.m")}, {value: "l", label: t("manage.live.prop.size.l")}]} onChange={value => onProp("labelSize", value)} />
        </>}
        <LiveSwitch label={t("manage.live.prop.timerSeconds")} help={t("manage.live.prop.timerSecondsHelp")} checked={widget.props.showSeconds !== false} disabled={disabled} onChange={value => onProp("showSeconds", value)} />
    </>;
}

function LogosFields({eventID, widget, disabled, onProp}: {eventID: string; widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const carousel = widget.props.mode === "carousel";
    return <>
        <LiveField label={t("manage.live.prop.title")} help={t("manage.live.prop.titleHelp")}>
            {id => <input id={id} className="event-manage-input" maxLength={60} value={textProp(widget, "title")} disabled={disabled} onChange={event => onProp("title", event.target.value)} />}
        </LiveField>
        <LiveSegmented label={t("manage.live.prop.mode")} help={t("manage.live.prop.modeHelp")} value={carousel ? "carousel" : "fixed"} disabled={disabled}
            options={[{value: "fixed", label: t("manage.live.prop.modeFixed")}, {value: "carousel", label: t("manage.live.prop.modeCarousel")}]} onChange={value => onProp("mode", value)} />
        {carousel && <>
            <LiveField label={t("manage.live.prop.speed")} help={t("manage.live.prop.speedHelp")}>
                {() => <EventSelect ariaLabel={t("manage.live.prop.speed")} value={textProp(widget, "speed") || "normal"} disabled={disabled} onValueChange={value => onProp("speed", value)}
                    options={[{value: "slow", label: t("manage.live.prop.speedSlow")}, {value: "normal", label: t("manage.live.prop.speedNormal")}, {value: "fast", label: t("manage.live.prop.speedFast")}]} />}
            </LiveField>
            <LiveSwitch label={t("manage.live.prop.paused")} help={t("manage.live.prop.pausedHelp")} checked={widget.props.paused === true} disabled={disabled} onChange={value => onProp("paused", value)} />
        </>}
        <LiveSegmented label={t("manage.live.prop.logoColor")} help={t("manage.live.prop.logoColorHelp")} value={widget.props.color === "original" ? "original" : "mono"} disabled={disabled}
            options={[{value: "original", label: t("manage.live.prop.logoColor.original")}, {value: "mono", label: t("manage.live.prop.logoColor.mono")}]} onChange={value => onProp("color", value)} />
        <LiveLogosEditor eventID={eventID} items={liveLogoItems(widget.props)} disabled={disabled} onChange={items => onProp("items", items)} />
    </>;
}

// Settings of the selected widget: the header with its name and removal,
// «Відображення» (its own content) and «Розташування й розмір».
export function LiveWidgetSettings({event, layout, widget, disabled, placeDisabled = disabled, onPlace, onProp, onDistribute, onRemove}: {
    event: PublicEventInfo; layout: LiveLayout; widget: LiveWidget; disabled: boolean;
    // An «auto» screen shape takes its placement from the base.
    placeDisabled?: boolean;
    onPlace: (next: LiveWidget) => void; onProp: (key: string, value: PropValue) => void;
    onDistribute: (axis: DistributeAxis) => void; onRemove: () => void;
}) {
    const eventID = event.EventID;
    const minimum = liveWidgetMinimums[widget.type];
    return <div className="event-live-settings">
        <header className="event-live-settings__head">
            <h3>{liveWidgetName(widget)}</h3>
            {!disabled && <EventTooltip content={t("manage.live.removeWidget")}>{id => <button className="ib-icon-btn ib-icon-btn--sm event-live-settings__remove" type="button" aria-label={t("manage.live.removeWidget")} aria-describedby={id} onClick={onRemove}><Trash2 size={16} /></button>}</EventTooltip>}
        </header>
        <Section title={t("manage.live.section.display")}>
            {widget.type === "title" && <LiveField label={t("manage.live.prop.subtitle")} help={t("manage.live.prop.subtitleHelp")}>
                {id => <input id={id} className="event-manage-input" maxLength={120} value={textProp(widget, "subtitle")} disabled={disabled} onChange={change => onProp("subtitle", change.target.value)} />}
            </LiveField>}
            {widget.type === "timer" && <TimerFields widget={widget} event={event} disabled={disabled} onProp={onProp} />}
            {widget.type === "chart" && <LiveField label={t("manage.live.prop.lines")} help={t("manage.live.prop.linesHelp")} required>
                {() => <EventSelect ariaLabel={t("manage.live.prop.lines")} value={String(Math.min(10, Math.max(5, numberProp(widget, "lines", 5))))} disabled={disabled} onValueChange={value => onProp("lines", Number(value))}
                    options={[5, 6, 7, 8, 9, 10].map(value => ({value: String(value), label: String(value)}))} />}
            </LiveField>}
            {(widget.type === "table" || widget.type === "solves") && <RowsFields layout={layout} widget={widget} disabled={disabled} onProp={onProp} />}
            {widget.type === "announcement" && <LiveField label={t("manage.live.prop.announcement")} help={t("manage.live.prop.announcementHelp")}>
                {id => <textarea id={id} className="event-manage-input" maxLength={500} value={textProp(widget, "text")} disabled={disabled} onChange={change => onProp("text", change.target.value)} />}
            </LiveField>}
            {widget.type === "qr" && <>
                <LiveField label={t("manage.live.prop.qrValue")} help={t("manage.live.prop.qrValueHelp")} required
                    warning={qrProblem(textProp(widget, "value") || textProp(widget, "url"))}>
                    {id => <input id={id} className="event-manage-input" maxLength={500} placeholder={t("manage.live.prop.qrValuePlaceholder")} value={textProp(widget, "value") || textProp(widget, "url")} disabled={disabled} onChange={change => onProp("value", change.target.value)} />}
                </LiveField>
                <LiveField label={t("manage.live.prop.qrCaption")} help={t("manage.live.prop.qrCaptionHelp")}>
                    {id => <input id={id} className="event-manage-input" maxLength={60} value={textProp(widget, "caption")} disabled={disabled} onChange={change => onProp("caption", change.target.value)} />}
                </LiveField>
            </>}
            {widget.type === "logos" && <LogosFields eventID={eventID} widget={widget} disabled={disabled} onProp={onProp} />}
        </Section>
        <Section title={t("manage.live.section.place")}>
            <div className="event-live-settings__cells">{(["x", "y", "w", "h"] as const).map(key => <LiveField key={key} label={t(`manage.live.pos.${key}`)}
                help={t(`manage.live.pos.${key}Help`, {min: key === "w" ? minimum.w : minimum.h, cols: layout.grid.cols, rows: layout.grid.rows})} required>
                {id => <LiveNumberInput id={id} value={widget[key]} min={key === "w" ? minimum.w : key === "h" ? minimum.h : 1} max={48} disabled={placeDisabled} onChange={value => onPlace({...widget, [key]: value})} />}
            </LiveField>)}</div>
            <div className="event-live-settings__distribute">
                <EventTooltip content={t("manage.live.distributeRowTitle")}>{id => <button className="ib-btn ib-btn--sm" type="button" disabled={placeDisabled} aria-describedby={id} onClick={() => onDistribute("row")}><Columns3 size={16} /> {t("manage.live.distributeRow")}</button>}</EventTooltip>
                <EventTooltip content={t("manage.live.distributeColumnTitle")}>{id => <button className="ib-btn ib-btn--sm" type="button" disabled={placeDisabled} aria-describedby={id} onClick={() => onDistribute("column")}><Rows3 size={16} /> {t("manage.live.distributeColumn")}</button>}</EventTooltip>
            </div>
        </Section>
    </div>;
}

// QR content: required; text that starts like a web address must be one.
export function qrProblem(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return t("manage.live.prop.qrValueMissing");
    if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
        try {
            const url = new URL(trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed);
            if (!url.hostname.includes(".")) return t("manage.live.prop.qrValueURL");
        } catch {return t("manage.live.prop.qrValueURL");}
        if (trimmed.startsWith("www.")) return t("manage.live.prop.qrValueScheme");
    }
    return null;
}
