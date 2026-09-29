"use client";

import {useRef, useState, type ReactNode} from "react";
import {toast} from "react-hot-toast";
import {ArrowDown, ArrowUp, Columns3, ImageUp, Rows3, Trash2, X} from "lucide-react";
import type {LiveWidget} from "@/api/manageLive";
import {uploadManageBannerImage} from "@/api/manage";
import {liveLogoURL, liveWidgetName, type DistributeAxis} from "../liveLayout";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";

const maxLogos = 32;

export function LiveField({label, hint, children}: {label: string; hint?: ReactNode; children: ReactNode}) {
    return <div className="event-live-field"><span className="event-live-field__label">{label}</span>{children}{hint && <small>{hint}</small>}</div>;
}

function NumberInput({value, min, max, disabled, label, onChange}: {value: number; min: number; max: number; disabled: boolean; label: string; onChange: (value: number) => void}) {
    return <input className="event-manage-input" type="number" inputMode="numeric" min={min} max={max} step={1} value={Number.isFinite(value) ? value : ""} disabled={disabled} aria-label={label}
        onChange={event => {const next = event.target.valueAsNumber; if (Number.isInteger(next)) onChange(next);}} />;
}

function NumberField({label, value, min, max, disabled, hint, onChange}: {label: string; value: number; min: number; max: number; disabled: boolean; hint?: ReactNode; onChange: (value: number) => void}) {
    return <LiveField label={label} hint={hint}><NumberInput value={value} min={min} max={max} disabled={disabled} label={label} onChange={value => onChange(Math.min(max, Math.max(min, value)))} /></LiveField>;
}

function numberOptions(values: number[], unit?: string) {
    return values.map(value => ({value: String(value), label: unit ? t(unit, {count: value}) : String(value)}));
}

function LogoField({eventID, logos, disabled, onChange}: {eventID: string; logos: string[]; disabled: boolean; onChange: (logos: string[]) => void}) {
    const [busy, setBusy] = useState(false);
    const [link, setLink] = useState("");
    const input = useRef<HTMLInputElement>(null);
    async function upload(files: FileList | null) {
        if (!files?.length) return;
        setBusy(true);
        const added: string[] = [];
        try {
            for (const file of Array.from(files).slice(0, maxLogos - logos.length)) added.push(await uploadManageBannerImage(eventID, file));
        } catch {toast.error(t("manage.live.logos.uploadError"));}
        finally {
            setBusy(false);
            if (input.current) input.current.value = "";
            if (added.length) onChange([...logos, ...added]);
        }
    }
    const move = (index: number, delta: number) => {
        const next = [...logos];
        [next[index], next[index + delta]] = [next[index + delta], next[index]];
        onChange(next);
    };
    const linkValid = !!liveLogoURL(link.trim());
    return <div className="event-live-editor__logos">
        <span className="event-live-field__label">{t("manage.live.logos.title")}</span>
        {logos.length ? <ul>{logos.map((logo, index) => <li key={`${logo}-${index}`}>
            {liveLogoURL(logo) ? <img src={liveLogoURL(logo)!} alt="" /> : <span className="event-live-editor__logo-broken">?</span>}
            <EventTooltip content={logo} truncated className="event-live-editor__logo-tip">{id => <span className="event-live-editor__logo-name" aria-describedby={id}>{logo.includes("/content-images/") ? t("manage.live.logos.file", {number: index + 1}) : logo}</span>}</EventTooltip>
            <EventTooltip content={t("manage.live.logos.up")} silent>{() => <button type="button" aria-label={t("manage.live.logos.up")} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button>}</EventTooltip>
            <EventTooltip content={t("manage.live.logos.down")} silent>{() => <button type="button" aria-label={t("manage.live.logos.down")} disabled={disabled || index === logos.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button>}</EventTooltip>
            <EventTooltip content={t("manage.live.logos.remove")} silent>{() => <button type="button" aria-label={t("manage.live.logos.remove")} disabled={disabled} onClick={() => onChange(logos.filter((_, other) => other !== index))}><X size={14} /></button>}</EventTooltip>
        </li>)}</ul> : <EmptyState compact message={t("manage.live.logos.empty")} />}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden disabled={disabled || busy} onChange={event => void upload(event.target.files)} />
        <EventButton className="ib-btn" type="button" disabled={disabled || busy || logos.length >= maxLogos} onClick={() => input.current?.click()} busy={busy}><ImageUp size={16} /> {t("manage.live.logos.upload")}</EventButton>
        <small>{t("manage.live.logos.hint")}</small>
        <div className="event-live-editor__link">
            <input className="event-manage-input" type="url" aria-label={t("manage.live.logos.link")} placeholder={t("manage.live.logos.linkPlaceholder")} value={link} disabled={disabled} onChange={event => setLink(event.target.value)} />
            <button className="ib-btn" type="button" disabled={disabled || !linkValid || logos.length >= maxLogos} onClick={() => {onChange([...logos, link.trim()]); setLink("");}}>{t("common.add")}</button>
        </div>
    </div>;
}

// Settings of the selected widget: its cells, type settings and removal.
export function LiveWidgetSettings({eventID, widget, disabled, onPlace, onProp, onDistribute, onRemove}: {
    eventID: string; widget: LiveWidget; disabled: boolean;
    onPlace: (next: LiveWidget) => void; onProp: (key: string, value: string | number | boolean | string[]) => void;
    onDistribute: (axis: DistributeAxis) => void; onRemove: () => void;
}) {
    const props = widget.props;
    const text = (key: string) => typeof props[key] === "string" ? props[key] as string : "";
    const number = (key: string, fallback: number) => Number.isFinite(Number(props[key])) && Number(props[key]) > 0 ? Number(props[key]) : fallback;
    return <div className="event-live-settings">
        <h3>{liveWidgetName(widget)}</h3>
        {widget.type === "title" && <LiveField label={t("manage.live.prop.subtitle")} hint={t("manage.live.prop.subtitleHint")}><input className="event-manage-input" value={text("subtitle")} disabled={disabled} onChange={event => onProp("subtitle", event.target.value)} /></LiveField>}
        {widget.type === "timer" && <>
            <p className="event-live-settings__note">{t("manage.live.prop.timerHint")}</p>
            <EventSwitch checked={props.showLabel !== false} disabled={disabled} onCheckedChange={value => onProp("showLabel", value)} label={t("manage.live.prop.timerLabel")} />
            <EventSwitch checked={props.showSeconds !== false} disabled={disabled} onCheckedChange={value => onProp("showSeconds", value)} label={t("manage.live.prop.timerSeconds")} />
        </>}
        {widget.type === "chart" && <LiveField label={t("manage.live.prop.lines")} hint={t("manage.live.prop.linesHint")}>
            <EventSelect ariaLabel={t("manage.live.prop.lines")} value={String(Math.min(10, Math.max(5, number("lines", 5))))} options={numberOptions([5, 6, 7, 8, 9, 10])} disabled={disabled} onValueChange={value => onProp("lines", Number(value))} />
        </LiveField>}
        {widget.type === "table" && <>
            <NumberField label={t("manage.live.prop.rowsPerPage")} value={number("rowsPerPage", 10)} min={1} max={60} disabled={disabled} hint={t("manage.live.prop.rowsPerPageHint")} onChange={value => onProp("rowsPerPage", value)} />
            <LiveField label={t("manage.live.prop.pageSeconds")}>
                <EventSelect ariaLabel={t("manage.live.prop.pageSeconds")} value={String(number("pageSeconds", 10))} options={numberOptions([...new Set([5, 10, 15, 20, 30, 60, number("pageSeconds", 10)])].sort((a, b) => a - b), "manage.live.seconds")} disabled={disabled} onValueChange={value => onProp("pageSeconds", Number(value))} />
            </LiveField>
        </>}
        {widget.type === "solves" && <NumberField label={t("manage.live.prop.rows")} value={number("rows", 5)} min={1} max={30} disabled={disabled} onChange={value => onProp("rows", value)} />}
        {widget.type === "announcement" && <LiveField label={t("manage.live.prop.announcement")}><textarea className="event-manage-input" value={text("text")} disabled={disabled} onChange={event => onProp("text", event.target.value)} /></LiveField>}
        {widget.type === "qr" && <LiveField label={t("manage.live.prop.url")} hint={t("manage.live.prop.urlHint")}><input className="event-manage-input" type="url" value={text("url")} disabled={disabled} onChange={event => onProp("url", event.target.value)} /></LiveField>}
        {widget.type === "logos" && <>
            <LiveField label={t("manage.live.prop.title")}><input className="event-manage-input" value={text("title")} disabled={disabled} onChange={event => onProp("title", event.target.value)} /></LiveField>
            <LiveField label={t("manage.live.prop.mode")} hint={t(props.mode === "carousel" ? "manage.live.prop.modeCarouselHint" : "manage.live.prop.modeFixedHint")}>
                <div className="ib-seg ib-seg--block" role="group" aria-label={t("manage.live.prop.mode")}>{(["fixed", "carousel"] as const).map(mode => <button key={mode} type="button" disabled={disabled} aria-pressed={(props.mode ?? "fixed") === mode} onClick={() => onProp("mode", mode)}>{t(mode === "fixed" ? "manage.live.prop.modeFixed" : "manage.live.prop.modeCarousel")}</button>)}</div>
            </LiveField>
            {props.mode === "carousel" && <>
                <LiveField label={t("manage.live.prop.speed")}>
                    <EventSelect ariaLabel={t("manage.live.prop.speed")} value={text("speed") || "normal"} disabled={disabled} onValueChange={value => onProp("speed", value)}
                        options={[{value: "slow", label: t("manage.live.prop.speedSlow")}, {value: "normal", label: t("manage.live.prop.speedNormal")}, {value: "fast", label: t("manage.live.prop.speedFast")}]} />
                </LiveField>
                <EventSwitch checked={props.paused === true} disabled={disabled} onCheckedChange={checked => onProp("paused", checked)} label={t("manage.live.prop.paused")} />
            </>}
            <LogoField eventID={eventID} logos={Array.isArray(props.logos) ? props.logos.filter((value): value is string => typeof value === "string") : []} disabled={disabled} onChange={logos => onProp("logos", logos)} />
        </>}
        <div className="event-live-settings__place">
            <span className="event-live-field__label">{t("manage.live.place")}</span>
            <div className="event-live-settings__cells">{(["x", "y", "w", "h"] as const).map(key => <label key={key}><span>{t(`manage.live.pos.${key}`)}</span>
                <NumberInput value={widget[key]} min={1} max={48} disabled={disabled} label={t(`manage.live.pos.${key}`)} onChange={value => onPlace({...widget, [key]: value})} /></label>)}</div>
            <div className="event-live-settings__distribute">
                <EventTooltip content={t("manage.live.distributeRowTitle")}>{id => <button className="ib-btn ib-btn--sm" type="button" disabled={disabled} aria-describedby={id} onClick={() => onDistribute("row")}><Columns3 size={16} /> {t("manage.live.distributeRow")}</button>}</EventTooltip>
                <EventTooltip content={t("manage.live.distributeColumnTitle")}>{id => <button className="ib-btn ib-btn--sm" type="button" disabled={disabled} aria-describedby={id} onClick={() => onDistribute("column")}><Rows3 size={16} /> {t("manage.live.distributeColumn")}</button>}</EventTooltip>
            </div>
        </div>
        {!disabled && <button className="ib-btn event-live-settings__remove" type="button" onClick={onRemove}><Trash2 size={16} /> {t("manage.live.removeWidget")}</button>}
    </div>;
}
