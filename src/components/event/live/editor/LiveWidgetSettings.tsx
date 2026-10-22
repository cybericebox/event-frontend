"use client";

import {useId, useState, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {Columns3, ImagePlus, RotateCcw, Rows3, Trash2} from "lucide-react";
import {imageUploadMessage} from "@/api/apiErrors";
import {liveLogoAccept, uploadLiveLogo} from "@/api/manageLive";
import {fitImage} from "@/utils/fitImage";
import {EventLoading} from "@/components/event/EventLoading";
import {liveLogoURL} from "../liveLayout";
import type {LiveLayout, LiveWidget} from "@/api/manageLive";
import {getResultsSettings} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {t} from "@/i18n/t";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {localFromISO, localToISO} from "@/components/ui/dateTimePicker";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {liveWidgetMinimums, liveWidgetName, type DistributeAxis} from "../liveLayout";
import {liveCaptionShown, liveHasCaption, liveListFit, liveTextSized, liveTextSizes, liveWidgetTextSize, type LiveTextSizeKey} from "../liveText";
import {livePageSecondsHint} from "../liveFit";
import {liveLogoItems, type LiveLogoItem} from "../LiveCanvas";
import {liveLastMinutesOptions, liveTimerDigitMode, liveTimerDigitModes, liveTimerSources, liveTimerState, liveTimerZeroModes, type LiveTimerSource} from "../liveStages";
import {livePinOptions, livePinTop} from "../liveTable";
import {liveFactItems, liveFactKeys, liveFactLimit, type LiveFactKey} from "../liveFacts";
import {liveAlign, type LiveAlign} from "../LiveBlocks";
import {getManageStages} from "@/api/manageStages";
import {LiveColorField, LiveField, LiveNumberInput, LiveSegmented, LiveSwitch} from "./LiveFields";
import {liveAccentContrastMin, liveBlockColors, liveFillColor, liveFillOf, liveFills, liveHex, liveHighlightOf, liveHighlights, liveMarkerOf, liveMarkers, livePlaceColors, livePlaceImages, liveTextContrastMin} from "../liveColors";
import {LiveLogosEditor} from "./LiveLogosEditor";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";

type SettingsTab = "display" | "top" | "colors" | "place";

// null drops a setting back to its default.
type PropValue = string | number | boolean | string[] | LiveLogoItem[] | null;
export type LivePropValue = PropValue;

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
        {table && <TableFields widget={widget} disabled={disabled} onProp={onProp} />}
        {!table && <LiveSegmented label={t("manage.live.prop.solvesMode")} help={t("manage.live.prop.solvesModeHelp")} value={widget.props.mode === "first" ? "first" : "recent"} disabled={disabled}
            options={[{value: "recent", label: t("manage.live.prop.solvesMode.recent")}, {value: "first", label: t("manage.live.prop.solvesMode.first")}]}
            onChange={value => onProp("mode", value === "first" ? value : null)} />}
    </>;
}

const limitOptions = [0, 3, 5, 8, 10, 15, 20];

// Table: two columns, «Лише перші N», «Почати з місця 4» and pinned rows.
function TableFields({widget, disabled, onProp}: {widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const offset = Number(widget.props.offset) === 3;
    const limit = Math.max(0, Number(widget.props.limit) || 0);
    return <>
        <LiveSegmented label={t("manage.live.prop.columns")} help={t("manage.live.prop.columnsHelp")} value={Number(widget.props.columns) === 2 ? "2" : "1"} disabled={disabled}
            options={[{value: "1", label: t("manage.live.prop.columnsOne")}, {value: "2", label: t("manage.live.prop.columnsTwo")}]} onChange={value => onProp("columns", value === "2" ? 2 : null)} />
        <LiveField label={t("manage.live.prop.limit")} help={t("manage.live.prop.limitHelp")}>
            {() => <EventSelect ariaLabel={t("manage.live.prop.limit")} value={String(limit)} disabled={disabled} onValueChange={value => onProp("limit", Number(value) || null)}
                options={[...new Set([...limitOptions, limit])].sort((a, b) => a - b).map(value => ({value: String(value), label: value ? t("manage.live.prop.limitTop", {count: value}) : t("manage.live.prop.limitAll")}))} />}
        </LiveField>
        <LiveSegmented label={t("manage.live.prop.offset")} help={t("manage.live.prop.offsetHelp")} value={offset ? "3" : "0"} disabled={disabled}
            options={[{value: "0", label: t("manage.live.prop.offsetFirst")}, {value: "3", label: t("manage.live.prop.offsetPodium")}]} onChange={value => onProp("offset", value === "3" ? 3 : null)} />
        {!offset && <LiveSegmented label={t("manage.live.prop.pinTop")} help={t("manage.live.prop.pinTopHelp")} value={String(livePinTop(widget.props.pinTop))} disabled={disabled}
            options={livePinOptions.map(value => ({value: String(value), label: value ? t("manage.live.prop.pinTopRows", {count: value}) : t("manage.live.prop.pinTopNone")}))}
            onChange={value => onProp("pinTop", Number(value))} />}
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
    const stages = useQuery({queryKey: ["event-management-stages", event.EventID], queryFn: () => getManageStages(event.EventID), refetchOnWindowFocus: false});
    const source = (textProp(widget, "source") || "auto") as LiveTimerSource;
    const freezeAvailable = !!settings.data?.FreezeEnabled;
    // Stage sources need stages; until the list loads they stay offered.
    const stagesAvailable = !stages.data || stages.data.length > 0;
    const [openedAt] = useState(() => Date.now());
    const auto = liveTimerState({...widget.props, label: ""}, event, stages.data ?? [], openedAt, settings.data?.Freeze.FrozenAt ?? null).label;
    const unavailable = (value: LiveTimerSource) => value === "freeze" && !freezeAvailable ? t("manage.live.prop.timerFreezeOff")
        : (value === "stage-end" || value === "stage-next") && !stagesAvailable ? t("manage.live.prop.timerNoStages") : undefined;
    const showLabel = widget.props.showLabel !== false;
    const target = textProp(widget, "target");
    const zeroMode = liveTimerZeroModes.find(value => value === widget.props.atZero) ?? "word";
    return <>
        <LiveField label={t("manage.live.prop.timerSource")} help={t("manage.live.prop.timerSourceHelp")} required>
            {() => <EventSelect ariaLabel={t("manage.live.prop.timerSource")} value={source} disabled={disabled}
                onValueChange={value => onProp("source", value)}
                options={liveTimerSources.map(value => ({value, label: t(`manage.live.prop.timerSource.${value}`), disabled: !!unavailable(value), disabledReason: unavailable(value)}))} />}
        </LiveField>
        {source === "custom" && <LiveField label={t("manage.live.prop.timerTarget")} help={t("manage.live.prop.timerTargetHelp")} required
            error={target ? null : t("manage.live.prop.timerTargetMissing")}>
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
        <LiveSegmented label={t("manage.live.prop.timerDigits")} help={t("manage.live.prop.timerDigitsHelp")} value={liveTimerDigitMode(widget.props.digits)} disabled={disabled}
            options={liveTimerDigitModes.map(value => ({value, label: t(`manage.live.prop.timerDigits.${value}`)}))} onChange={value => onProp("digits", value === "full" ? null : value)} />
        <LiveSwitch label={t("manage.live.prop.timerSeconds")} help={t("manage.live.prop.timerSecondsHelp")} checked={widget.props.showSeconds !== false} disabled={disabled} onChange={value => onProp("showSeconds", value)} />
        <LiveField label={t("manage.live.prop.lastMinutes")} help={t("manage.live.prop.lastMinutesHelp")}>
            {() => <EventSelect ariaLabel={t("manage.live.prop.lastMinutes")} value={String(liveLastMinutesOptions.find(value => value === Number(widget.props.lastMinutes)) ?? 0)} disabled={disabled}
                onValueChange={value => onProp("lastMinutes", Number(value) || null)}
                options={liveLastMinutesOptions.map(value => ({value: String(value), label: value ? t("manage.live.prop.lastMinutesValue", {count: value}) : t("manage.live.prop.lastMinutesOff")}))} />}
        </LiveField>
        <LiveSegmented label={t("manage.live.prop.atZero")} help={t("manage.live.prop.atZeroHelp")} value={zeroMode} disabled={disabled}
            options={liveTimerZeroModes.map(value => ({value, label: t(`manage.live.prop.atZero.${value}`)}))} onChange={value => onProp("atZero", value === "word" ? null : value)} />
        {zeroMode === "text" && <LiveField label={t("manage.live.prop.zeroText")} help={t("manage.live.prop.zeroTextHelp")} required error={textProp(widget, "zeroText").trim() ? null : t("manage.live.prop.zeroTextMissing")}>
            {id => <input id={id} className="event-manage-input" maxLength={60} placeholder={t("manage.live.prop.zeroTextPlaceholder")} value={textProp(widget, "zeroText")} disabled={disabled} onChange={change => onProp("zeroText", change.target.value)} />}
        </LiveField>}
        <AlignField widget={widget} fallback="right" disabled={disabled} onProp={onProp} />
    </>;
}

// «Вирівнювання» of the title, timer, clock and announcement.
function AlignField({widget, fallback, disabled, onProp}: {widget: LiveWidget; fallback: LiveAlign; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    return <LiveSegmented label={t("manage.live.prop.align")} help={t("manage.live.prop.alignHelp")} value={liveAlign(widget, fallback)} disabled={disabled}
        options={(["left", "center", "right"] as const).map(value => ({value, label: t(`manage.live.prop.align.${value}`)}))} onChange={value => onProp("align", value === fallback ? null : value)} />;
}

// «Факти»: which numbers the block shows, in a fixed order, up to six.
function FactsFields({widget, disabled, onProp}: {widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const items = liveFactItems(widget);
    const toggle = (key: LiveFactKey) => {
        const next = items.includes(key) ? items.filter(item => item !== key) : liveFactKeys.filter(item => item === key || items.includes(item));
        if (next.length && next.length <= liveFactLimit) onProp("items", next);
    };
    return <div className="event-live-field">
        <ManageFieldLabel title={t("manage.live.prop.facts")} help={t("manage.live.prop.factsHelp", {count: liveFactLimit})} />
        <div className="event-live-chips" role="group" aria-label={t("manage.live.prop.facts")}>
            {liveFactKeys.map(key => <button key={key} type="button" aria-pressed={items.includes(key)} disabled={disabled || items.includes(key) && items.length === 1 || !items.includes(key) && items.length >= liveFactLimit}
                onClick={() => toggle(key)}>{t(`manage.live.prop.fact.${key}`)}</button>)}
        </div>
    </div>;
}

// The settings every block shares: its text size (K3) and its caption (K4).
function CommonFields({widget, disabled, onProp}: {widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const sized = liveTextSized(widget.type);
    const captioned = liveHasCaption(widget.type);
    if (!sized && !captioned) return null;
    const shown = liveCaptionShown(widget);
    const captionKey = widget.type === "logos" ? "title" : "caption";
    return <Section title={t("manage.live.section.text")}>
        {sized && <LiveSegmented label={t("manage.live.prop.textSize")} help={t("manage.live.prop.textSizeHelp")} value={liveWidgetTextSize(widget)} disabled={disabled}
            options={(Object.keys(liveTextSizes) as LiveTextSizeKey[]).map(value => ({value, label: t(`manage.live.prop.textSize.${value}`)}))} onChange={value => onProp("textSize", value === "m" ? null : value)} />}
        {captioned && <>
            <LiveSwitch label={t("manage.live.prop.showCaption")} help={t("manage.live.prop.showCaptionHelp")} checked={shown} disabled={disabled} onChange={value => onProp("showCaption", value)} />
            {shown && <LiveField label={t("manage.live.prop.caption")} help={t("manage.live.prop.captionHelp")}>
                {id => <input id={id} className="event-manage-input" maxLength={60} placeholder={liveWidgetName({...widget, props: {...widget.props, caption: "", title: ""}})} value={textProp(widget, captionKey)} disabled={disabled}
                    onChange={change => onProp(captionKey, change.target.value)} />}
            </LiveField>}
        </>}
    </Section>;
}

// «Виділення топ-3» of a table or podium: the mark of places 1–3, the row
// tint and the medal colours (marks other than numbers use them too).
function HighlightFields({eventID, widget, disabled, onProp}: {eventID: string; widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const highlight = liveHighlightOf(widget);
    const marker = liveMarkerOf(widget);
    const places = livePlaceColors(widget);
    const custom = Array.isArray(widget.props.placeColors);
    return <>
        <LiveField label={t("manage.live.prop.marker")} help={t("manage.live.prop.markerHelp")}>
            {() => <EventSelect ariaLabel={t("manage.live.prop.marker")} value={marker} disabled={disabled} onValueChange={value => onProp("marker", value)}
                options={liveMarkers.map(value => ({value, label: t(`manage.live.prop.marker.${value}`)}))} />}
        </LiveField>
        {marker === "images" && <PlaceImagesField eventID={eventID} widget={widget} disabled={disabled} onProp={onProp} />}
        <LiveSegmented label={t("manage.live.prop.highlightTop")} help={t("manage.live.prop.highlightTopHelp")} value={highlight} disabled={disabled}
            options={liveHighlights.map(value => ({value, label: t(`manage.live.prop.highlightTop.${value}`)}))} onChange={value => onProp("highlightTop", value === "accent" ? null : value)} />
        {(highlight === "medals" || marker !== "numbers") && <>
            {places.map((color, index) => <LiveColorField key={index} label={t("manage.live.prop.placeColor", {place: index + 1})} help={t("manage.live.prop.placeColorHelp")} value={color} disabled={disabled}
                onChange={value => onProp("placeColors", places.map((item, at) => at === index ? value : item))} />)}
            {custom && !disabled && <button className="ib-btn ib-btn--sm ib-btn--ghost event-live-settings__reset" type="button" onClick={() => onProp("placeColors", null)}><RotateCcw size={14} /> {t("manage.live.prop.placeColorsReset")}</button>}
        </>}
    </>;
}

// «Свої зображення»: one picture per place 1–3, uploaded like the logos. The
// screen needs all three, so the pictures are kept here until the third one
// arrives and then saved together; until then the block shows cups.
function PlaceImagesField({eventID, widget, disabled, onProp}: {eventID: string; widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const saved = livePlaceImages(widget);
    const [pending, setPending] = useState<string[]>(() => saved ?? ["", "", ""]);
    const images = saved && pending.every(item => !item) ? saved : pending;
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState<{place: number; text: string} | null>(null);
    const groupID = useId();
    async function upload(index: number, file: File | undefined) {
        if (!file) return;
        setBusy(index); setError(null);
        try {
            const src = await uploadLiveLogo(eventID, await fitImage(file));
            const next = images.map((item, at) => at === index ? src : item);
            setPending(next);
            if (next.every(Boolean)) onProp("placeImages", next);
        } catch (failure) {setError({place: index, text: imageUploadMessage(failure, t("manage.live.logos.uploadError"))});}
        finally {setBusy(null);}
    }
    const missing = images.some(item => !item);
    return <div className="event-live-field" role="group" aria-label={t("manage.live.prop.placeImages")}>
        <ManageFieldLabel title={t("manage.live.prop.placeImages")} help={t("manage.live.prop.placeImagesHelp")} />
        <div className="event-live-place-images">
            {images.map((src, index) => {
                const url = src ? liveLogoURL(src) : null;
                const invalid = error?.place === index;
                return <label key={index} className="event-live-place-image">
                    <span>{t("manage.live.prop.placeImage", {place: index + 1})}</span>
                    <span className="event-live-place-image__box">
                        {busy === index ? <EventLoading compact label={t("manage.live.prop.placeImageUploading")} />
                            // eslint-disable-next-line @next/next/no-img-element
                            : url ? <img src={url} alt="" /> : <ImagePlus size={18} aria-hidden="true" />}
                    </span>
                    <input type="file" accept={liveLogoAccept} disabled={disabled || busy !== null} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${groupID}-error` : undefined}
                        onChange={change => {void upload(index, change.target.files?.[0]); change.target.value = "";}} />
                </label>;
            })}
        </div>
        {error && <small id={`${groupID}-error`} className="event-manage-validation" role="alert">{error.text}</small>}
        {!error && missing && <small>{t("manage.live.prop.placeImagesMissing")}</small>}
    </div>;
}

// «Кольори»: the block's own fill, text and accent over the screen theme.
function ColorFields({event, layout, widget, disabled, onProp, onProps}: {
    event: PublicEventInfo; layout: LiveLayout; widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void; onProps: (changes: Record<string, PropValue>) => void;
}) {
    const fill = liveFillOf(widget);
    const colors = liveBlockColors(widget, event.Theme, layout.theme);
    const fillColor = liveFillColor(widget, event.Theme, layout.theme);
    const ownText = liveHex(widget.props.textColor);
    const ownAccent = liveHex(widget.props.accentColor);
    // A custom colour starts from what the block shows now.
    const startColor = fillColor ?? liveHex(event.Theme.Brand) ?? "#211A52";
    const textWarning = colors.textContrast !== null && colors.textContrast < liveTextContrastMin ? t("manage.live.color.lowContrast", {ratio: colors.textContrast.toFixed(1), min: liveTextContrastMin}) : null;
    const accentWarning = colors.accentContrast !== null && colors.accentContrast < liveAccentContrastMin ? t("manage.live.color.lowContrast", {ratio: colors.accentContrast.toFixed(1), min: liveAccentContrastMin}) : null;
    const any = fill !== "none" || ownText || ownAccent;
    return <Section title={t("manage.live.section.colors")}>
        <LiveField label={t("manage.live.prop.fill")} help={t("manage.live.prop.fillHelp")}>
            {() => <EventSelect ariaLabel={t("manage.live.prop.fill")} value={fill} disabled={disabled}
                onValueChange={value => onProp("background", value === "none" ? null : value === "custom" ? startColor : value)}
                options={liveFills.map(value => ({value, label: t(`manage.live.prop.fill.${value}`)}))} />}
        </LiveField>
        {fill === "custom" && fillColor && <LiveColorField label={t("manage.live.prop.fillColor")} help={t("manage.live.prop.fillColorHelp")} value={fillColor} disabled={disabled} onChange={value => onProp("background", value)} />}
        <LiveSegmented label={t("manage.live.prop.textColor")} help={t("manage.live.prop.textColorHelp")} value={ownText ? "custom" : "auto"} disabled={disabled}
            options={[{value: "auto", label: t("manage.live.prop.textColor.auto")}, {value: "custom", label: t("manage.live.prop.textColor.custom")}]}
            onChange={value => onProp("textColor", value === "auto" ? null : colors.ink ?? (layout.theme === "light" ? "#16152B" : "#FFFFFF"))} />
        {ownText && <LiveColorField label={t("manage.live.prop.textColorValue")} help={t("manage.live.prop.textColorHelp")} value={ownText} disabled={disabled} warning={textWarning} onChange={value => onProp("textColor", value)} />}
        {!ownText && textWarning && <small className="event-live-field__warning" role="status">{textWarning}</small>}
        <LiveSegmented label={t("manage.live.prop.accentColor")} help={t("manage.live.prop.accentColorHelp")} value={ownAccent ? "custom" : "theme"} disabled={disabled}
            options={[{value: "theme", label: t("manage.live.prop.accentColor.theme")}, {value: "custom", label: t("manage.live.prop.accentColor.custom")}]}
            onChange={value => onProp("accentColor", value === "theme" ? null : colors.accent ?? liveHex(layout.theme === "light" ? event.Theme.AccentLight : event.Theme.AccentLive) ?? "#FFFFFF")} />
        {ownAccent && <LiveColorField label={t("manage.live.prop.accentColorValue")} help={t("manage.live.prop.accentColorHelp")} value={ownAccent} disabled={disabled} warning={accentWarning} onChange={value => onProp("accentColor", value)} />}
        {any && !disabled && <button className="ib-btn ib-btn--sm ib-btn--ghost event-live-settings__reset" type="button"
            onClick={() => onProps({background: null, textColor: null, accentColor: null})}><RotateCcw size={14} /> {t("manage.live.color.reset")}</button>}
    </Section>;
}

function LogosFields({eventID, widget, disabled, onProp}: {eventID: string; widget: LiveWidget; disabled: boolean; onProp: (key: string, value: PropValue) => void}) {
    const carousel = widget.props.mode === "carousel";
    const rows = [2, 3].includes(Number(widget.props.rows)) ? Number(widget.props.rows) : 1;
    return <>
        <LiveSegmented label={t("manage.live.prop.mode")} help={t("manage.live.prop.modeHelp")} value={carousel ? "carousel" : "fixed"} disabled={disabled}
            options={[{value: "fixed", label: t("manage.live.prop.modeFixed")}, {value: "carousel", label: t("manage.live.prop.modeCarousel")}]} onChange={value => onProp("mode", value)} />
        {!carousel && <LiveSegmented label={t("manage.live.prop.logoRows")} help={t("manage.live.prop.logoRowsHelp")} value={String(rows)} disabled={disabled}
            options={[1, 2, 3].map(value => ({value: String(value), label: String(value)}))} onChange={value => onProp("rows", value === "1" ? null : Number(value))} />}
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
export function LiveWidgetSettings({event, layout, widget, disabled, placeDisabled = disabled, onPlace, onProp, onProps, onDistribute, onRemove}: {
    event: PublicEventInfo; layout: LiveLayout; widget: LiveWidget; disabled: boolean;
    // An «auto» screen shape takes its placement from the base.
    placeDisabled?: boolean;
    onPlace: (next: LiveWidget) => void; onProp: (key: string, value: PropValue) => void; onProps: (changes: Record<string, PropValue>) => void;
    onDistribute: (axis: DistributeAxis) => void; onRemove: () => void;
}) {
    const eventID = event.EventID;
    const minimum = liveWidgetMinimums[widget.type];
    // The settings sit on tabs, so each one fits without scrolling: «Вигляд»
    // (content and text), «Топ-3» (tables and podiums), «Кольори», «Місце».
    const ranked = widget.type === "table" || widget.type === "podium";
    const tabs: SettingsTab[] = ranked ? ["display", "top", "colors", "place"] : ["display", "colors", "place"];
    const [chosenTab, setTab] = useState<SettingsTab>("display");
    const tab: SettingsTab = tabs.includes(chosenTab) ? chosenTab : "display";
    const tabsID = useId();
    return <div className="event-live-settings">
        <header className="event-live-settings__head">
            <h3>{liveWidgetName(widget)}</h3>
            {!disabled && <EventTooltip content={t("manage.live.removeWidget")}>{id => <button className="ib-icon-btn ib-icon-btn--sm event-live-settings__remove" type="button" aria-label={t("manage.live.removeWidget")} aria-describedby={id} onClick={onRemove}><Trash2 size={16} /></button>}</EventTooltip>}
        </header>
        <div className="ib-seg ib-seg--block event-live-settings__tabs" role="tablist" aria-label={t("manage.live.settingsTabs")}>
            {tabs.map(key => <button key={key} type="button" role="tab" id={`${tabsID}-${key}`} aria-selected={tab === key} aria-controls={`${tabsID}-panel`} onClick={() => setTab(key)}>{t(`manage.live.settingsTab.${key}`)}</button>)}
        </div>
        <div className="event-live-settings__panel" role="tabpanel" id={`${tabsID}-panel`} aria-labelledby={`${tabsID}-${tab}`}>
        {tab === "display" && <><Section title={t("manage.live.section.display")}>
            {widget.type === "title" && <>
                <LiveSwitch label={t("manage.live.prop.subtitleStage")} help={t("manage.live.prop.subtitleStageHelp")} checked={widget.props.subtitleStage === true} disabled={disabled} onChange={value => onProp("subtitleStage", value)} />
                <LiveField label={t("manage.live.prop.subtitle")} help={t(widget.props.subtitleStage === true ? "manage.live.prop.subtitleStageFallback" : "manage.live.prop.subtitleHelp")}>
                    {id => <input id={id} className="event-manage-input" maxLength={120} value={textProp(widget, "subtitle")} disabled={disabled} onChange={change => onProp("subtitle", change.target.value)} />}
                </LiveField>
                <LiveSwitch label={t("manage.live.prop.showLogo")} help={t("manage.live.prop.showLogoHelp")} checked={widget.props.showLogo !== false} disabled={disabled} onChange={value => onProp("showLogo", value ? null : false)} />
                <AlignField widget={widget} fallback="left" disabled={disabled} onProp={onProp} />
            </>}
            {widget.type === "clock" && <>
                <LiveField label={t("manage.live.prop.clockLabel")} help={t("manage.live.prop.clockLabelHelp")}>
                    {id => <input id={id} className="event-manage-input" maxLength={60} placeholder={t("manage.live.prop.clockLabelPlaceholder")} value={textProp(widget, "label")} disabled={disabled} onChange={change => onProp("label", change.target.value)} />}
                </LiveField>
                <LiveSwitch label={t("manage.live.prop.timerSeconds")} help={t("manage.live.prop.clockSecondsHelp")} checked={widget.props.showSeconds === true} disabled={disabled} onChange={value => onProp("showSeconds", value)} />
                <AlignField widget={widget} fallback="right" disabled={disabled} onProp={onProp} />
            </>}
            {widget.type === "podium" && <>
                <LiveSegmented label={t("manage.live.prop.podiumVariant")} help={t("manage.live.prop.podiumVariantHelp")} value={widget.props.variant === "cards" ? "cards" : "steps"} disabled={disabled}
                    options={[{value: "steps", label: t("manage.live.prop.podiumVariant.steps")}, {value: "cards", label: t("manage.live.prop.podiumVariant.cards")}]}
                    onChange={value => onProp("variant", value === "cards" ? value : null)} />
                <LiveSwitch label={t("manage.live.prop.showPoints")} help={t("manage.live.prop.showPointsHelp")} checked={widget.props.showPoints !== false} disabled={disabled} onChange={value => onProp("showPoints", value ? null : false)} />
                {widget.props.variant === "cards" && <LiveSwitch label={t("manage.live.prop.showRing")} help={t("manage.live.prop.showRingHelp")} checked={widget.props.showRing === true} disabled={disabled} onChange={value => onProp("showRing", value ? true : null)} />}
            </>}
            {widget.type === "facts" && <FactsFields widget={widget} disabled={disabled} onProp={onProp} />}
            {widget.type === "stages" && <LiveSwitch label={t("manage.live.prop.showDone")} help={t("manage.live.prop.showDoneHelp")} checked={widget.props.showDone !== false} disabled={disabled} onChange={value => onProp("showDone", value ? null : false)} />}
            {widget.type === "timer" && <TimerFields widget={widget} event={event} disabled={disabled} onProp={onProp} />}
            {widget.type === "chart" && <LiveSegmented label={t("manage.live.prop.chartLabels")} help={t("manage.live.prop.chartLabelsHelp")} value={widget.props.labels === "none" ? "none" : "chart"} disabled={disabled}
                options={[{value: "chart", label: t("manage.live.prop.chartLabels.chart")}, {value: "none", label: t("manage.live.prop.chartLabels.none")}]} onChange={value => onProp("labels", value === "none" ? value : null)} />}
            {widget.type === "chart" && <LiveField label={t("manage.live.prop.lines")} help={t("manage.live.prop.linesHelp")} required>
                {() => <EventSelect ariaLabel={t("manage.live.prop.lines")} value={String(Math.min(10, Math.max(5, numberProp(widget, "lines", 5))))} disabled={disabled} onValueChange={value => onProp("lines", Number(value))}
                    options={[5, 6, 7, 8, 9, 10].map(value => ({value: String(value), label: String(value)}))} />}
            </LiveField>}
            {(widget.type === "table" || widget.type === "solves") && <RowsFields layout={layout} widget={widget} disabled={disabled} onProp={onProp} />}
            {widget.type === "announcement" && <>
                <LiveField label={t("manage.live.prop.announcement")} help={t("manage.live.prop.announcementHelp")}>
                    {id => <textarea id={id} className="event-manage-input" maxLength={500} value={textProp(widget, "text")} disabled={disabled} onChange={change => onProp("text", change.target.value)} />}
                </LiveField>
                <AlignField widget={widget} fallback="center" disabled={disabled} onProp={onProp} />
            </>}
            {widget.type === "qr" && <>
                <LiveField label={t("manage.live.prop.qrValue")} help={t("manage.live.prop.qrValueHelp")} required
                    error={qrProblem(textProp(widget, "value") || textProp(widget, "url"))}>
                    {id => <input id={id} className="event-manage-input" maxLength={500} placeholder={t("manage.live.prop.qrValuePlaceholder")} value={textProp(widget, "value") || textProp(widget, "url")} disabled={disabled} onChange={change => onProp("value", change.target.value)} />}
                </LiveField>
                <LiveField label={t("manage.live.prop.qrCaption")} help={t("manage.live.prop.qrCaptionHelp")}>
                    {id => <input id={id} className="event-manage-input" maxLength={60} value={textProp(widget, "caption")} disabled={disabled} onChange={change => onProp("caption", change.target.value)} />}
                </LiveField>
            </>}
            {widget.type === "logos" && <LogosFields eventID={eventID} widget={widget} disabled={disabled} onProp={onProp} />}
        </Section>
        <CommonFields widget={widget} disabled={disabled} onProp={onProp} /></>}
        {tab === "top" && ranked && <Section title={t("manage.live.section.top")}>
            <HighlightFields eventID={eventID} widget={widget} disabled={disabled} onProp={onProp} />
            {widget.type === "table" && <>
                <LiveSwitch label={t("manage.live.prop.showBars")} help={t("manage.live.prop.showBarsHelp")} checked={widget.props.showBars === true} disabled={disabled} onChange={value => onProp("showBars", value ? true : null)} />
                <LiveSwitch label={t("manage.live.prop.showLegend")} help={t("manage.live.prop.showLegendHelp")} checked={widget.props.showLegend === true} disabled={disabled} onChange={value => onProp("showLegend", value ? true : null)} />
            </>}
        </Section>}
        {tab === "colors" && <ColorFields event={event} layout={layout} widget={widget} disabled={disabled} onProp={onProp} onProps={onProps} />}
        {tab === "place" && <Section title={t("manage.live.section.place")}>
            <div className="event-live-settings__cells">{(["x", "y", "w", "h"] as const).map(key => <LiveField key={key} label={t(`manage.live.pos.${key}`)}
                help={t(`manage.live.pos.${key}Help`, {min: key === "w" ? minimum.w : minimum.h, cols: layout.grid.cols, rows: layout.grid.rows})} required>
                {id => <LiveNumberInput id={id} value={widget[key]} min={key === "w" ? minimum.w : key === "h" ? minimum.h : 1} max={48} disabled={placeDisabled} onChange={value => onPlace({...widget, [key]: value})} />}
            </LiveField>)}</div>
            <div className="event-live-settings__distribute">
                <EventTooltip content={t("manage.live.distributeRowTitle")}>{id => <button className="ib-btn ib-btn--sm" type="button" disabled={placeDisabled} aria-describedby={id} onClick={() => onDistribute("row")}><Columns3 size={16} /> {t("manage.live.distributeRow")}</button>}</EventTooltip>
                <EventTooltip content={t("manage.live.distributeColumnTitle")}>{id => <button className="ib-btn ib-btn--sm" type="button" disabled={placeDisabled} aria-describedby={id} onClick={() => onDistribute("column")}><Rows3 size={16} /> {t("manage.live.distributeColumn")}</button>}</EventTooltip>
            </div>
        </Section>}
        </div>
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
