"use client";

import {useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {ArrowDown, ArrowUp, Columns3, ExternalLink, Eye, Grid3x3, ImageUp, Rows3, Save, Send, Trash2, X} from "lucide-react";
import {getManageLive, LiveDraftInvalidError, publishManageLive, saveManageLiveDraft, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import {uploadManageBannerImage} from "@/api/manage";
import {getResultsSettings, putResultsSettings, resultsSettingsInput} from "@/api/manageResults";
import {LiveCanvas, type LiveGhost} from "@/components/event/live/LiveCanvas";
import {canPlace, distributeWidgets, firstFreeWidget, layoutConflicts, liveGridLimits, liveGridValid, liveLogoURL, livePaletteTypes, livePresets, liveWidgetLabels, liveWidgetMinimums, presetLayout, recomputeGrid, widgetAt, type DistributeAxis} from "@/components/event/live/liveLayout";
import {liveTextWarnings} from "@/components/event/live/liveText";
import {useLiveResults} from "@/components/event/live/useLiveResults";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";

const aspects = {"16:9": 16 / 9, "16:10": 16 / 10, "4:3": 4 / 3, "5:3": 5 / 3};
const dragMime = "application/x-live-widget";
const maxLogos = 32;

// «Враховувати заморожування рейтингу»: a results setting, applied at once.
function LiveFreezeToggle({eventID, canManage}: {eventID: string; canManage: boolean}) {
    const queryClient = useQueryClient();
    const queryKey = ["event-management-results-settings", eventID];
    const settings = useQuery({queryKey, queryFn: () => getResultsSettings(eventID), refetchOnWindowFocus: false});
    const [busy, setBusy] = useState(false);
    async function change(value: boolean) {
        if (!settings.data) return;
        setBusy(true);
        try {
            queryClient.setQueryData(queryKey, await putResultsSettings(eventID, {...resultsSettingsInput(settings.data), LiveFreeze: value}));
            await queryClient.invalidateQueries({queryKey: ["event-live-results", eventID]});
            toast.success(t(value ? "manage.live.freeze.on" : "manage.live.freeze.off"));
        } catch {toast.error(t("manage.live.freeze.error"));}
        finally {setBusy(false);}
    }
    const hint = t(settings.isError ? "manage.live.freeze.readError" : settings.data && !settings.data.FreezeEnabled ? "manage.live.freeze.disabled" : "manage.live.freeze.immediate");
    return <EventSwitch className="event-live-editor__freeze" checked={settings.data?.LiveFreeze ?? true} disabled={!canManage || busy || !settings.data} onCheckedChange={value => void change(value)} label={<>{t("manage.live.freeze.label")}<small>{hint}</small></>} />;
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
        <span className="event-live-editor__label">{t("manage.live.logos.title")}</span>
        {logos.length ? <ul>{logos.map((logo, index) => <li key={`${logo}-${index}`}>
            {liveLogoURL(logo) ? <img src={liveLogoURL(logo)!} alt="" /> : <span className="event-live-editor__logo-broken">?</span>}
            <EventTooltip content={logo} className="event-live-editor__logo-tip">{id => <span className="event-live-editor__logo-name" aria-describedby={id}>{logo.includes("/content-images/") ? t("manage.live.logos.file", {number: index + 1}) : logo}</span>}</EventTooltip>
            <button type="button" aria-label={t("manage.live.logos.up")} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button>
            <button type="button" aria-label={t("manage.live.logos.down")} disabled={disabled || index === logos.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button>
            <button type="button" aria-label={t("manage.live.logos.remove")} disabled={disabled} onClick={() => onChange(logos.filter((_, other) => other !== index))}><X size={14} /></button>
        </li>)}</ul> : <EmptyState compact message={t("manage.live.logos.empty")} />}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden disabled={disabled || busy} onChange={event => void upload(event.target.files)} />
        <EventButton className="ib-btn" type="button" disabled={disabled || busy || logos.length >= maxLogos} onClick={() => input.current?.click()} busy={busy}><ImageUp size={16} /> {t("manage.live.logos.upload")}</EventButton>
        <small>{t("manage.live.logos.hint")}</small>
        <div className="event-live-editor__link">
            <input type="url" placeholder={t("manage.live.logos.linkPlaceholder")} value={link} disabled={disabled} onChange={event => setLink(event.target.value)} />
            <button className="ib-btn" type="button" disabled={disabled || !linkValid || logos.length >= maxLogos} onClick={() => {onChange([...logos, link.trim()]); setLink("");}}>{t("common.add")}</button>
        </div>
    </div>;
}

export default function ManageLivePage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const editor = useQuery({queryKey: ["event-live-editor", eventID], queryFn: () => getManageLive(eventID), refetchOnWindowFocus: false});
    const {results} = useLiveResults(eventID);
    const [override, setOverride] = useState<LiveLayout | null>(null);
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [preview, setPreview] = useState(false);
    const [customGrid, setCustomGrid] = useState(false);
    const [gridCols, setGridCols] = useState(12);
    const [gridRows, setGridRows] = useState(8);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [dragType, setDragType] = useState<LiveWidget["type"] | null>(null);
    const [ghost, setGhost] = useState<LiveGhost | null>(null);
    const [screen, setScreen] = useState<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(0);
    const layout = override ?? editor.data?.Draft ?? editor.data?.Published ?? null;
    const nativeWidth = layout?.screen.width ?? 1920;
    // The preview renders at the screen's own resolution and is scaled down,
    // so text sizes, floors and warnings match the real screen.
    useEffect(() => {
        if (!screen || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / nativeWidth));
        observer.observe(screen);
        return () => observer.disconnect();
    }, [screen, nativeWidth]);

    if (editor.isError) return <EventLoadError message={t("manage.live.loadError")} onRetry={() => void editor.refetch()} />;
    if (editor.isPending || !layout) return <EventLoading event={event} label={t("manage.live.loading")} />;

    const locked = !canManage || preview;
    const selected = layout.widgets.find(item => item.id === selectedID) ?? null;
    const saved = editor.data?.Draft ?? editor.data?.Published;
    const dirty = JSON.stringify(layout) !== JSON.stringify(saved);
    const conflicts = layoutConflicts(layout);
    const warnings = liveTextWarnings(layout);
    const validation = !liveGridValid(layout.grid.cols, layout.grid.rows)
        ? t("manage.live.validation.grid", liveGridLimits)
        : layout.screen.width < 320 || layout.screen.width > 7680 || layout.screen.height < 240 || layout.screen.height > 4320 || layout.screen.width <= layout.screen.height
            ? t("manage.live.validation.screen")
            : conflicts.size
                ? t("manage.live.validation.conflicts", {widgets: layout.widgets.filter(item => conflicts.has(item.id)).map(item => t("manage.live.validation.widgetName", {name: liveWidgetLabels[item.type]})).join(", ")})
                : layout.widgets.some(widget => widget.type === "logos" && Array.isArray(widget.props.logos) && widget.props.logos.some(value => typeof value !== "string" || !liveLogoURL(value)))
                    ? t("manage.live.validation.logo")
                    : layout.widgets.some(widget => widget.type === "qr" && (typeof widget.props.url !== "string" || !/^https?:\/\/[^\s]+$/.test(widget.props.url) && !/^\/(?!\/)/.test(widget.props.url)))
                        ? t("manage.live.validation.qr")
                        : "";
    const aspect = layout.aspect === "custom" ? layout.screen.width / layout.screen.height : aspects[layout.aspect];
    const screenStyle = {"--live-aspect": aspect} as CSSProperties;
    const nativeStyle = {width: layout.screen.width, height: layout.screen.height, "--live-preview-scale": scale || 1, visibility: scale ? "visible" : "hidden"} as CSSProperties;
    const finer = {cols: layout.grid.cols * 2, rows: layout.grid.rows * 2};

    function mutate(next: LiveLayout) {setOverride(next); setError("");}
    function updateWidget(next: LiveWidget) {
        if (!canPlace(layout!, next, next.id)) {setError(t("manage.live.error.overlap")); return;}
        mutate({...layout!, widgets: layout!.widgets.map(item => item.id === next.id ? next : item)});
    }
    function updateProp(key: string, value: string | number | boolean | string[]) {
        if (selected) mutate({...layout!, widgets: layout!.widgets.map(item => item.id === selected.id ? {...item, props: {...item.props, [key]: value}} : item)});
    }
    function insert(working: LiveLayout, next: LiveWidget) {
        if (next.type === "qr") next.props = {url: window.location.origin};
        mutate({...working, widgets: [...working.widgets, next]});
        setSelectedID(next.id);
    }
    function addWidget(type: LiveWidget["type"]) {
        let working = layout!;
        let next = firstFreeWidget(working, type);
        if (!next && working.grid.rows + liveWidgetMinimums[type].h <= liveGridLimits.maxRows) {
            working = {...working, grid: {...working.grid, rows: working.grid.rows + liveWidgetMinimums[type].h}};
            next = firstFreeWidget(working, type);
        }
        if (!next) {setError(t("manage.live.error.noSpace")); return;}
        insert(working, next);
    }
    // Palette drag: the ghost shows the minimum-size widget under the pointer.
    function dropCell(dragEvent: DragEvent<HTMLDivElement>) {
        const rect = dragEvent.currentTarget.getBoundingClientRect();
        return {
            x: Math.floor((dragEvent.clientX - rect.left) / rect.width * layout!.grid.cols) + 1,
            y: Math.floor((dragEvent.clientY - rect.top) / rect.height * layout!.grid.rows) + 1,
        };
    }
    function dragOver(dragEvent: DragEvent<HTMLDivElement>) {
        if (!dragType || locked) return;
        dragEvent.preventDefault();
        dragEvent.dataTransfer.dropEffect = "copy";
        const {x, y} = dropCell(dragEvent);
        const candidate = widgetAt(layout!, dragType, x, y);
        const min = liveWidgetMinimums[dragType];
        const next = candidate ? {x: candidate.x, y: candidate.y, w: min.w, h: min.h, ok: true} : {x: Math.min(x, Math.max(1, layout!.grid.cols - min.w + 1)), y: Math.min(y, Math.max(1, layout!.grid.rows - min.h + 1)), w: min.w, h: min.h, ok: false};
        setGhost(current => current && current.x === next.x && current.y === next.y && current.ok === next.ok && current.w === next.w ? current : next);
    }
    function drop(dragEvent: DragEvent<HTMLDivElement>) {
        const type = (dragEvent.dataTransfer.getData(dragMime) || dragType) as LiveWidget["type"] | null;
        setGhost(null);
        setDragType(null);
        if (!type || locked || !(type in liveWidgetMinimums)) return;
        dragEvent.preventDefault();
        const {x, y} = dropCell(dragEvent);
        const next = widgetAt(layout!, type, x, y);
        if (!next) {setError(t("manage.live.error.noSpaceHere")); return;}
        insert(layout!, next);
    }
    function pointerDown(pointerEvent: PointerEvent<HTMLButtonElement | HTMLSpanElement>, item: LiveWidget, mode: "move" | "resize") {
        if (locked || pointerEvent.button !== 0) return;
        const canvas = pointerEvent.currentTarget.closest(".live-canvas") as HTMLElement | null;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const originX = pointerEvent.clientX, originY = pointerEvent.clientY;
        const start = {...item};
        setSelectedID(item.id);
        pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
        const target = pointerEvent.currentTarget;
        const move = (rawEvent: Event) => {
            const nextEvent = rawEvent as globalThis.PointerEvent;
            const dx = Math.round((nextEvent.clientX - originX) / (rect.width / layout!.grid.cols));
            const dy = Math.round((nextEvent.clientY - originY) / (rect.height / layout!.grid.rows));
            const candidate = mode === "move" ? {...start, x: start.x + dx, y: start.y + dy} : {...start, w: start.w + dx, h: start.h + dy};
            setOverride(current => {
                const active = current ?? layout;
                return active && canPlace(active, candidate, item.id) ? {...active, widgets: active.widgets.map(widget => widget.id === item.id ? candidate : widget)} : active;
            });
        };
        const end = () => {target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", end);};
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", end);
        target.addEventListener("pointercancel", end);
    }
    // L7: never refuse a grid change; conflicts are highlighted instead.
    function changeGrid(cols: number, rows: number) {
        if (!liveGridValid(cols, rows)) return;
        const next = recomputeGrid(layout!, cols, rows);
        mutate(next);
        if (layoutConflicts(next).size) setError(t("manage.live.error.gridConflicts"));
    }
    function distribute(axis: DistributeAxis) {
        if (!selected) return;
        const next = distributeWidgets(layout!, selected.id, axis);
        if (typeof next === "string") setError(next);
        else mutate(next);
    }
    async function save() {
        if (!layout || !canManage || busy) return;
        setBusy(true);
        try {
            await saveManageLiveDraft(eventID, layout);
            await queryClient.invalidateQueries({queryKey: ["event-live-editor", eventID]});
            setOverride(current => JSON.stringify(current) === JSON.stringify(layout) ? null : current);
            toast.success(t("manage.live.draftSaved"));
        } catch {toast.error(t("manage.live.draftSaveError"));}
        finally {setBusy(false);}
    }
    async function publish() {
        if (!canManage || busy || dirty || !editor.data?.Draft) return;
        setBusy(true);
        try {
            await publishManageLive(eventID);
            await queryClient.invalidateQueries({queryKey: ["event-live-editor", eventID]});
            setOverride(current => JSON.stringify(current) === JSON.stringify(layout) ? null : current);
            toast.success(t("manage.live.published"));
        } catch (failure) {toast.error(t(failure instanceof LiveDraftInvalidError ? "manage.live.draftInvalid" : "manage.live.publishError"));}
        finally {setBusy(false);}
    }

    const warned = new Set(warnings.map(item => item.id));
    return <div className="event-live-editor">
        <header className="event-live-editor__heading">
            <div><h1>{t("manage.live.title")}</h1><p>{t("manage.live.intro")}</p></div>
            <div className="event-live-editor__actions">
                <a className="ib-btn" href="/live" target="_blank" rel="noreferrer"><ExternalLink size={16} /> {t("manage.live.open")}</a>
                <a className="ib-btn" href="/live?test=1" target="_blank" rel="noreferrer">{t("manage.live.test")}</a>
                <button className="ib-btn" type="button" onClick={() => setPreview(value => !value)}><Eye size={16} /> {t(preview ? "manage.live.edit" : "common.view")}</button>
                {canManage && <>
                    <button className="ib-btn" type="button" disabled={!dirty || !!validation || busy} onClick={() => void save()}><Save size={16} /> {t("manage.live.saveDraft")}</button>
                    <button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !editor.data?.Draft || busy} onClick={() => void publish()}><Send size={16} /> {t("manage.live.publish")}</button>
                </>}
            </div>
        </header>
        <div className="event-live-editor__toolbar">
            <label>{t("manage.live.preset")}<select disabled={locked} value="" onChange={changeEvent => {const key = changeEvent.target.value as keyof typeof livePresets; if (key in livePresets) {mutate(presetLayout(key, layout)); setSelectedID(null);}}}><option value="" disabled>{t("manage.live.presetPlaceholder")}</option>{Object.entries(livePresets).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select></label>
            <label>{t("manage.live.aspect")}<select value={layout.aspect} disabled={locked} onChange={changeEvent => {const aspect = changeEvent.target.value as LiveLayout["aspect"]; mutate({...layout, aspect, screen: {...layout.screen, width: aspect === "custom" ? layout.screen.width : Math.round(layout.screen.height * aspects[aspect as keyof typeof aspects])}});}}>{["16:9", "16:10", "4:3", "5:3", "custom"].map(value => <option key={value} value={value}>{value === "custom" ? t("manage.live.aspectCustom") : value}</option>)}</select></label>
            <label>{t("manage.live.theme")}<select value={layout.theme} disabled={locked} onChange={changeEvent => mutate({...layout, theme: changeEvent.target.value as LiveLayout["theme"]})}><option value="dark">{t("manage.live.themeDark")}</option><option value="light">{t("manage.live.themeLight")}</option></select></label>
            <label>{t("manage.live.grid")}<select value={`${layout.grid.cols}x${layout.grid.rows}`} disabled={locked} onChange={changeEvent => {const [cols, rows] = changeEvent.target.value.split("x").map(Number); changeGrid(cols, rows);}}>{["12x8", "16x9", "24x16", `${layout.grid.cols}x${layout.grid.rows}`].filter((value, index, all) => all.indexOf(value) === index).map(value => <option key={value} value={value}>{value.replace("x", "×")}</option>)}</select></label>
            <label>{t("manage.live.textScale")}<span className="event-live-editor__range"><input type="range" min="80" max="150" value={Math.round(layout.screen.textScale * 100)} disabled={locked} onChange={changeEvent => mutate({...layout, screen: {...layout.screen, textScale: Number(changeEvent.target.value) / 100}})} />{Math.round(layout.screen.textScale * 100)}%</span></label>
            <LiveFreezeToggle eventID={eventID} canManage={canManage} />
        </div>
        {layout.aspect === "custom" && <div className="event-live-editor__toolbar">
            <label>{t("manage.live.screenWidth")}<input type="number" min="320" max="7680" value={layout.screen.width} disabled={locked} onChange={changeEvent => mutate({...layout, screen: {...layout.screen, width: Number(changeEvent.target.value)}})} /></label>
            <label>{t("manage.live.screenHeight")}<input type="number" min="240" max="4320" value={layout.screen.height} disabled={locked} onChange={changeEvent => mutate({...layout, screen: {...layout.screen, height: Number(changeEvent.target.value)}})} /></label>
            <label>{t("manage.live.anchor")}<select value={layout.screen.anchor} disabled={locked} onChange={changeEvent => mutate({...layout, screen: {...layout.screen, anchor: changeEvent.target.value as "full" | "top-left"}})}><option value="full">{t("manage.live.anchorFull")}</option><option value="top-left">{t("manage.live.anchorTopLeft")}</option></select></label>
        </div>}
        <div className="event-live-editor__grid-options">
            <button className="ib-btn" type="button" disabled={locked} onClick={() => {setGridCols(layout.grid.cols); setGridRows(layout.grid.rows); setCustomGrid(value => !value);}}>{t(customGrid ? "manage.live.gridHide" : "manage.live.gridCustom")}</button>
            <EventTooltip content={t("manage.live.gridFinerTitle")}>{id => <button className="ib-btn" type="button" disabled={locked || !liveGridValid(finer.cols, finer.rows)} aria-describedby={id} onClick={() => changeGrid(finer.cols, finer.rows)}><Grid3x3 size={16} /> {t("manage.live.gridFiner")}</button>}</EventTooltip>
            {customGrid && <div className="event-live-editor__custom-grid">
                <label>{t("manage.live.cols")}<input type="number" min={liveGridLimits.minCols} max={liveGridLimits.maxCols} value={gridCols} disabled={locked} onChange={changeEvent => setGridCols(Number(changeEvent.target.value))} /></label>
                <label>{t("manage.live.rows")}<input type="number" min={liveGridLimits.minRows} max={liveGridLimits.maxRows} value={gridRows} disabled={locked} onChange={changeEvent => setGridRows(Number(changeEvent.target.value))} /></label>
                <button className="ib-btn ib-btn--primary" type="button" disabled={locked || !liveGridValid(gridCols, gridRows)} onClick={() => changeGrid(gridCols, gridRows)}>{t("manage.live.gridApply")}</button>
            </div>}
        </div>
        {(error || validation) && <div className="event-live-editor__error" role="alert">{error || validation}</div>}
        {warnings.length > 0 && <section className="event-live-editor__warnings" aria-label={t("manage.live.warnings")}>
            <h2>{t("manage.live.warningsTitle", {width: layout.screen.width, height: layout.screen.height})}</h2>
            <ul>{warnings.map((warning, index) => <li key={`${warning.id}-${index}`}><button type="button" onClick={() => setSelectedID(warning.id)}>{warning.text}</button></li>)}</ul>
        </section>}
        <div className={`event-live-editor__workspace${preview ? " is-preview" : ""}`}>
            <aside className="event-live-editor__palette">
                <h2>{t("manage.live.widgets")}</h2>
                {livePaletteTypes.map(type => <EventTooltip key={type} content={t("manage.live.paletteHint")}>{id => <button type="button" draggable={!locked} disabled={locked} aria-describedby={id}
                    onDragStart={dragEvent => {dragEvent.dataTransfer.setData(dragMime, type); dragEvent.dataTransfer.effectAllowed = "copy"; setDragType(type);}}
                    onDragEnd={() => {setDragType(null); setGhost(null);}}
                    onClick={() => addWidget(type)}>{t("manage.live.paletteAdd", {name: liveWidgetLabels[type]})}</button>}</EventTooltip>)}
            </aside>
            <div className="event-live-editor__stage">
                <div className="event-live-editor__screen" style={screenStyle} ref={setScreen}>
                    <div className="event-live-editor__native" style={nativeStyle}>
                        <LiveCanvas layout={layout} event={event} results={results.data} selectedID={selectedID} onSelect={setSelectedID} edit={!locked} showGrid={!preview} onPointerDown={pointerDown}
                            conflicts={preview ? undefined : conflicts} warned={preview ? undefined : warned} ghost={ghost}
                            onDragOver={dragOver} onDragLeave={() => setGhost(null)} onDrop={drop} />
                    </div>
                </div>
            </div>
            <aside className="event-live-editor__properties">
                <h2>{t("manage.live.properties")}</h2>
                {selected ? <>
                    <p>{liveWidgetLabels[selected.type]}</p>
                    <div className="event-live-editor__grid-fields">{(["x", "y", "w", "h"] as const).map(key => <label key={key}>{t(`manage.live.pos.${key}`)}<input type="number" min="1" value={selected[key]} disabled={locked} onChange={changeEvent => updateWidget({...selected, [key]: Number(changeEvent.target.value)})} /></label>)}</div>
                    <div className="event-live-editor__distribute">
                        <EventTooltip content={t("manage.live.distributeRowTitle")}>{id => <button className="ib-btn" type="button" disabled={locked} aria-describedby={id} onClick={() => distribute("row")}><Columns3 size={16} /> {t("manage.live.distributeRow")}</button>}</EventTooltip>
                        <EventTooltip content={t("manage.live.distributeColumnTitle")}>{id => <button className="ib-btn" type="button" disabled={locked} aria-describedby={id} onClick={() => distribute("column")}><Rows3 size={16} /> {t("manage.live.distributeColumn")}</button>}</EventTooltip>
                    </div>
                    {selected.type === "title" && <label>{t("manage.live.prop.subtitle")}<input value={String(selected.props.subtitle ?? "")} disabled={locked} onChange={changeEvent => updateProp("subtitle", changeEvent.target.value)} /></label>}
                    {selected.type === "announcement" && <label>{t("manage.live.prop.announcement")}<textarea value={String(selected.props.text ?? "")} disabled={locked} onChange={changeEvent => updateProp("text", changeEvent.target.value)} /></label>}
                    {selected.type === "qr" && <label>{t("manage.live.prop.url")}<input type="url" value={String(selected.props.url ?? "")} disabled={locked} onChange={changeEvent => updateProp("url", changeEvent.target.value)} /></label>}
                    {selected.type === "logos" && <>
                        <label>{t("manage.live.prop.title")}<input value={String(selected.props.title ?? "")} disabled={locked} onChange={changeEvent => updateProp("title", changeEvent.target.value)} /></label>
                        <label>{t("manage.live.prop.mode")}<select value={String(selected.props.mode ?? "fixed")} disabled={locked} onChange={changeEvent => updateProp("mode", changeEvent.target.value)}><option value="fixed">{t("manage.live.prop.modeFixed")}</option><option value="carousel">{t("manage.live.prop.modeCarousel")}</option></select></label>
                        {selected.props.mode === "carousel" && <>
                            <label>{t("manage.live.prop.speed")}<select value={String(selected.props.speed ?? "normal")} disabled={locked} onChange={changeEvent => updateProp("speed", changeEvent.target.value)}><option value="slow">{t("manage.live.prop.speedSlow")}</option><option value="normal">{t("manage.live.prop.speedNormal")}</option><option value="fast">{t("manage.live.prop.speedFast")}</option></select></label>
                            <EventSwitch checked={selected.props.paused === true} disabled={locked} onCheckedChange={checked => updateProp("paused", checked)} label={t("manage.live.prop.paused")} />
                        </>}
                        <LogoField eventID={eventID} logos={Array.isArray(selected.props.logos) ? selected.props.logos.filter((value): value is string => typeof value === "string") : []} disabled={locked} onChange={logos => updateProp("logos", logos)} />
                    </>}
                    {selected.type === "chart" && <label>{t("manage.live.prop.lines")}<input type="number" min="5" max="10" value={Number(selected.props.lines ?? 5)} disabled={locked} onChange={changeEvent => updateProp("lines", Number(changeEvent.target.value))} /></label>}
                    {selected.type === "table" && <>
                        <label>{t("manage.live.prop.rowsPerPage")}<input type="number" min="1" max="60" value={Number(selected.props.rowsPerPage ?? 10)} disabled={locked} onChange={changeEvent => updateProp("rowsPerPage", Number(changeEvent.target.value))} /></label>
                        <label>{t("manage.live.prop.pageSeconds")}<input type="number" min="1" max="60" value={Number(selected.props.pageSeconds ?? 10)} disabled={locked} onChange={changeEvent => updateProp("pageSeconds", Number(changeEvent.target.value))} /></label>
                    </>}
                    {selected.type === "solves" && <label>{t("manage.live.prop.rows")}<input type="number" min="1" max="60" value={Number(selected.props.rows ?? 5)} disabled={locked} onChange={changeEvent => updateProp("rows", Number(changeEvent.target.value))} /></label>}
                    {canManage && !preview && <button className="ib-btn" type="button" onClick={() => {mutate({...layout, widgets: layout.widgets.filter(item => item.id !== selected.id)}); setSelectedID(null);}}><Trash2 size={16} /> {t("manage.live.removeWidget")}</button>}
                </> : <p>{t("manage.live.selectHint")}</p>}
            </aside>
        </div>
        <p className="event-live-editor__note">{t("manage.live.note", {version: editor.data?.Published.version ?? ""})}</p>
    </div>;
}
