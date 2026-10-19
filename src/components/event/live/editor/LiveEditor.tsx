"use client";

import {useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {toastFailure} from "@/components/ui/toastApiError";
import {CircleHelp, ExternalLink, LayoutTemplate, MonitorUp, Redo2, RotateCcw, Send, TriangleAlert, Undo2} from "lucide-react";
import {LiveDraftInvalidError, publishManageLive, type LiveEditor as LiveEditorData, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas, type LiveGhost} from "@/components/event/live/LiveCanvas";
import {canPlace, distributeWidgets, firstFreeWidget, layoutConflicts, liveGridLimits, liveGridPresets, liveGridValid, liveLogoURL, livePaletteItems, liveWidgetMinimums, liveWidgetName, recomputeGrid, widgetAt, type DistributeAxis, type LivePaletteItem} from "@/components/event/live/liveLayout";
import {liveSampleResults} from "@/components/event/live/liveSample";
import {liveFormatLayout, liveFormatMode, liveFormatTabs, pruneLiveFormats, withLiveFormatMode, withLiveFormatView} from "@/components/event/live/liveFormats";
import type {LiveLogoItem} from "@/components/event/live/LiveCanvas";
import {liveSafeArea, liveSafeInsets, liveTextProfile, liveTextWarnings} from "@/components/event/live/liveText";
import {liveSceneKeys, liveSceneLayout, liveScenePreviewNow, liveScenePreviewResults, liveSceneState, liveSceneViews, liveWidgetLimit, liveWidgetLimits, mapLiveScenes, withLiveScene, withLiveSceneReset, type LiveSceneKey} from "@/components/event/live/liveScenes";
import {applyLiveTemplate, liveTemplates, type LiveTemplateKey} from "@/components/event/live/liveTemplates";
import {livePreviewKeys, livePreviewLayout, livePreviewScale, type LivePreviewKey} from "@/components/event/live/livePreview";
import {getManageStages} from "@/api/manageStages";
import {getResultsSettings} from "@/api/manageResults";
import {useLiveResults} from "@/components/event/live/useLiveResults";
import {LiveMiniature, usePaletteLayouts} from "./LiveMiniature";
import {LiveTemplateDialog} from "./LiveTemplateDialog";
import {LiveField, LiveNumberInput} from "./LiveFields";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {LiveScreenLinksDialog} from "./LiveScreenLinksDialog";
import {LiveScreenSettings} from "./LiveScreenSettings";
import {LiveWidgetSettings, qrProblem} from "./LiveWidgetSettings";
import {useLiveAutosave, type LiveSaveState} from "./useLiveAutosave";
import "./liveEditor.css";
import {t, tPlural} from "@/i18n/t";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";

const dragMime = "application/x-live-widget";
const paletteBox = {width: 180, height: 59};
const historyLimit = 50;
// Edits closer than this (typing, a slider drag) undo as one step.
const historyMergeMs = 700;

// Edit time for merging undo steps; only called from event handlers.
const editClock = () => Date.now();

// Keys typed into a field belong to the field, not to the canvas.
function typingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.getAttribute("role") === "slider");
}

// The version changes on every publish; it is not a change of the layout.
const layoutKey = (layout: LiveLayout) => JSON.stringify({...layout, version: 0});

type HistoryStep = {doc: LiveLayout; scene: LiveSceneKey};

const sceneName = (key: LiveSceneKey) => t(`manage.live.scene.${key}`);

// The first problem of one scene's canvas, or "".
function canvasProblem(view: LiveLayout): string {
    if (!liveGridValid(view.grid.cols, view.grid.rows)) return t("manage.live.validation.grid", liveGridLimits);
    const conflicts = layoutConflicts(view);
    if (conflicts.size) return t("manage.live.validation.conflicts", {widgets: view.widgets.filter(item => conflicts.has(item.id)).map(item => t("manage.live.validation.widgetName", {name: liveWidgetName(item)})).join(", ")});
    if (view.widgets.some(widget => widget.type === "logos" && Array.isArray(widget.props.logos) && widget.props.logos.some(value => typeof value !== "string" || !liveLogoURL(value)))) return t("manage.live.validation.logo");
    if (view.widgets.some(widget => widget.type === "qr" && qrProblem(typeof widget.props.value === "string" ? widget.props.value : typeof widget.props.url === "string" ? widget.props.url : ""))) return t("manage.live.validation.qr");
    if (view.widgets.some(widget => widget.type === "timer" && widget.props.source === "custom" && typeof widget.props.target !== "string")) return t("manage.live.validation.timerTarget");
    // A custom shape must be valid too: every placement inside its grid and without overlaps.
    for (const key of liveFormatTabs(view)) {
        if (liveFormatMode(view, key) !== "custom") continue;
        const shape = liveFormatLayout(view, key);
        if (!liveGridValid(shape.grid.cols, shape.grid.rows)) return t("manage.live.validation.formatGrid", {name: key});
        if (layoutConflicts(shape).size) return t("manage.live.validation.formatConflicts", {name: key});
    }
    return "";
}

// What blocks a save: the screen size, or the first problem of a scene
// (named when it is not the running one).
function validationMessage(layout: LiveLayout): string {
    if (layout.screen.width < 320 || layout.screen.width > 7680 || layout.screen.height < 240 || layout.screen.height > 4320 || layout.screen.width <= layout.screen.height) return t("manage.live.validation.screen");
    for (const {key, view} of liveSceneViews(layout)) {
        const problem = canvasProblem(view);
        if (problem) return key === "running" ? problem : t("manage.live.validation.scene", {scene: sceneName(key), problem});
    }
    return "";
}

function saveLabel(status: LiveSaveState, unpublished: boolean, version: number): string {
    if (status === "pending" || status === "saving") return t("manage.live.status.saving");
    if (status === "error") return t("manage.live.status.error");
    if (status === "invalid") return t("manage.live.status.invalid");
    return unpublished ? t("manage.live.status.unpublished") : t("manage.live.status.published", {version});
}

export function LiveEditor({event, canManage, data}: {event: PublicEventInfo; canManage: boolean; data: LiveEditorData}) {
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const {results} = useLiveResults(eventID);
    // The whole layout (every scene); the canvas edits one scene of it.
    const [doc, setDoc] = useState<LiveLayout>(data.Draft ?? data.Published);
    const [published, setPublished] = useState<LiveLayout>(data.Published);
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [dragItem, setDragItem] = useState<LivePaletteItem | null>(null);
    const [ghost, setGhost] = useState<LiveGhost | null>(null);
    const [screen, setScreen] = useState<HTMLDivElement | null>(null);
    const [boxWidth, setBoxWidth] = useState(0);
    const [customGrid, setCustomGrid] = useState<{cols: number; rows: number} | null>(null);
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [linksOpen, setLinksOpen] = useState(false);
    const [warningsOpen, setWarningsOpen] = useState(false);
    // The last applied template and the layout it produced: the quiet
    // «Шаблон: …» line says «змінено» once the layout moves away from it.
    const [applied, setApplied] = useState<{key: LiveTemplateKey; layout: string} | null>(null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [openedAt] = useState(() => Date.now());
    const [sampleResults] = useState(() => liveSampleResults(openedAt));
    const [origin, setOrigin] = useState("");
    // Each step keeps the whole layout and the scene the change was made in,
    // so undo and redo can show that scene.
    const [history, setHistory] = useState<{past: HistoryStep[]; future: HistoryStep[]}>({past: [], future: []});
    // The scene (event state) being edited, the screen shape and the preview resolution.
    const [scene, setScene] = useState<LiveSceneKey>("running");
    const [format, setFormat] = useState<string>(() => (data.Draft ?? data.Published).aspect);
    const [preview, setPreview] = useState<LivePreviewKey>("layout");
    const lastEdit = useRef(0);
    useEffect(() => {queueMicrotask(() => setOrigin(window.location.origin));}, []);
    // A scene «Як «Триває»» shows the running canvas, read-only.
    const layout = useMemo(() => liveSceneLayout(doc, scene), [doc, scene]);
    const paletteLayouts = usePaletteLayouts(livePaletteItems, layout.theme, origin);
    const shape = liveFormatTabs(layout).includes(format) ? format : layout.aspect;
    const view = useMemo(() => liveFormatLayout(layout, shape), [layout, shape]);
    const mode = liveFormatMode(layout, shape);
    // The preview renders at the target screen's own resolution and is scaled
    // down, so text sizes, floors and warnings match that screen.
    const shown = useMemo(() => livePreviewLayout(view, preview), [view, preview]);
    useEffect(() => {
        if (!screen || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
        observer.observe(screen);
        return () => observer.disconnect();
    }, [screen]);
    const scale = livePreviewScale(boxWidth, shown.screen);

    const conflicts = useMemo(() => layoutConflicts(view), [view]);
    // The timer and the stage subtitle of the preview follow the real stages.
    const stages = useQuery({queryKey: ["event-management-stages", eventID], queryFn: () => getManageStages(eventID), refetchOnWindowFocus: false});
    // «Враховувати заморожування» off: the hall sees live results, so «Заморожено» never shows.
    const resultsSettings = useQuery({queryKey: ["event-management-results-settings", eventID], queryFn: () => getResultsSettings(eventID), refetchOnWindowFocus: false});
    const stagesList = stages.data;
    const warnings = useMemo(() => liveTextWarnings(shown, event.Name, stagesList), [shown, event.Name, stagesList]);
    const validation = validationMessage(doc);
    const autosave = useLiveAutosave({
        eventID, layout: doc, savedJSON: JSON.stringify(data.Draft ?? data.Published), valid: !validation, enabled: canManage,
        onSaved: saved => queryClient.setQueryData<LiveEditorData>(["event-live-editor", eventID], current => current && {...current, Draft: saved}),
    });
    const unpublished = layoutKey(doc) !== layoutKey(published);
    // Until the event has results, the editor fills widgets with sample data.
    const sample = !results.data?.Scoreboard.length;
    const shownResults = sample ? sampleResults : results.data;
    // The preview shows a moment of the scene's state: its timer, stage and freeze.
    const previewNow = liveScenePreviewNow(scene, event, openedAt);
    const previewResults = liveScenePreviewResults(scene, shownResults, previewNow);
    // The «зараз» mark follows the clock, checked every 15 s.
    const [clock, setClock] = useState(openedAt);
    useEffect(() => {const timer = setInterval(() => setClock(Date.now()), 15_000); return () => clearInterval(timer);}, []);
    const current = liveSceneState(event, results.data?.Freeze, clock);
    const locked = !canManage;
    const selected = view.widgets.find(item => item.id === selectedID) ?? null;
    const editable = !locked && mode !== "auto";

    // Undo keeps the whole layout before each edit; bursts of edits merge into one.
    function remember() {
        const now = editClock();
        const merge = now - lastEdit.current < historyMergeMs;
        lastEdit.current = now;
        setHistory(past => ({past: merge && past.past.length ? past.past : [...past.past.slice(1 - historyLimit), {doc, scene}], future: []}));
    }
    // Undo and redo open the scene of the step, so the change is in view.
    function undo() {
        const previous = history.past.at(-1);
        if (!previous || locked) return;
        setHistory({past: history.past.slice(0, -1), future: [{doc, scene: previous.scene}, ...history.future]});
        setDoc(previous.doc);
        if (previous.scene !== scene) switchScene(previous.scene);
        lastEdit.current = 0;
        setError("");
    }
    function redo() {
        const next = history.future[0];
        if (!next || locked) return;
        setHistory({past: [...history.past, {doc, scene: next.scene}], future: history.future.slice(1)});
        setDoc(next.doc);
        if (next.scene !== scene) switchScene(next.scene);
        lastEdit.current = 0;
        setError("");
    }
    // A change of the whole layout; every scene drops shapes and placements that no longer apply.
    function mutateDoc(changed: LiveLayout) {
        if (changed === doc) return;
        const next = mapLiveScenes(changed, item => pruneLiveFormats(item));
        remember();
        setDoc(next);
        setError("");
    }
    // A change of the scene shown (its canvas or the shared screen settings);
    // a scene «Як «Триває»» shows, and so changes, the running one.
    function mutate(changed: LiveLayout) {
        mutateDoc(withLiveScene(doc, scene, changed));
        // The open «Власна…» inputs follow a grid that grew or changed elsewhere.
        if (customGrid && (changed.grid.cols !== layout.grid.cols || changed.grid.rows !== layout.grid.rows)) setCustomGrid({...changed.grid});
    }
    // An edited view of the current shape: the base itself, or the
    // placements of a custom format.
    function commitView(next: LiveLayout) {
        mutate(mode === "base" ? next : withLiveFormatView(layout, shape, next));
    }
    function updateWidget(next: LiveWidget) {
        if (!canPlace(view, next, next.id)) {setError(t("manage.live.error.overlap")); return;}
        commitView({...view, widgets: view.widgets.map(item => item.id === next.id ? next : item)});
    }
    function updateProp(key: string, value: string | number | boolean | string[] | LiveLogoItem[] | null) {
        if (!selected) return;
        mutate({...layout, widgets: layout.widgets.map(item => {
            if (item.id !== selected.id) return item;
            const props = {...item.props};
            // null drops a setting back to its default.
            if (value === null) delete props[key]; else props[key] = value;
            return {...item, props};
        })});
    }
    function insert(working: LiveLayout, next: LiveWidget, item: LivePaletteItem) {
        // The daemon refuses more than 48 widgets on a scene and 96 in all: say so before the save fails.
        const limit = liveWidgetLimit(doc, scene);
        if (limit) {setError(t(`manage.live.error.limit.${limit}`, liveWidgetLimits)); return;}
        next.props = item.type === "qr" ? {value: `${window.location.origin}/`, caption: t("live.qr.defaultCaption")} : {...item.props};
        mutate({...working, widgets: [...working.widgets, next]});
        setSelectedID(next.id);
    }
    // The grid never grows by itself: with no free cells the editor says so.
    function addWidget(item: LivePaletteItem) {
        if (!editable || mode !== "base") return;
        const next = firstFreeWidget(layout, item.type);
        if (!next) {setError(t("manage.live.error.noSpace")); return;}
        insert(layout, next, item);
    }
    // Palette drag: the ghost shows the minimum-size widget under the pointer.
    function dropCell(dragEvent: DragEvent<HTMLDivElement>) {
        const rect = dragEvent.currentTarget.getBoundingClientRect();
        return {
            x: Math.floor((dragEvent.clientX - rect.left) / rect.width * layout.grid.cols) + 1,
            y: Math.floor((dragEvent.clientY - rect.top) / rect.height * layout.grid.rows) + 1,
        };
    }
    function dragOver(dragEvent: DragEvent<HTMLDivElement>) {
        if (!dragItem || !editable) return;
        dragEvent.preventDefault();
        dragEvent.dataTransfer.dropEffect = "copy";
        const {x, y} = dropCell(dragEvent);
        const candidate = widgetAt(layout, dragItem.type, x, y);
        const min = liveWidgetMinimums[dragItem.type];
        const next = candidate ? {x: candidate.x, y: candidate.y, w: min.w, h: min.h, ok: true} : {x: Math.min(x, Math.max(1, layout.grid.cols - min.w + 1)), y: Math.min(y, Math.max(1, layout.grid.rows - min.h + 1)), w: min.w, h: min.h, ok: false};
        setGhost(past => past && past.x === next.x && past.y === next.y && past.ok === next.ok && past.w === next.w ? past : next);
    }
    function drop(dragEvent: DragEvent<HTMLDivElement>) {
        const key = dragEvent.dataTransfer.getData(dragMime);
        const item = livePaletteItems.find(entry => entry.key === key) ?? dragItem;
        setGhost(null);
        setDragItem(null);
        if (!item || !editable) return;
        dragEvent.preventDefault();
        const {x, y} = dropCell(dragEvent);
        const next = widgetAt(layout, item.type, x, y);
        if (!next) {setError(t("manage.live.error.noSpaceHere")); return;}
        insert(layout, next, item);
    }
    function pointerDown(pointerEvent: PointerEvent<HTMLButtonElement | HTMLSpanElement>, item: LiveWidget, action: "move" | "resize") {
        if (!editable || pointerEvent.button !== 0) return;
        const canvas = pointerEvent.currentTarget.closest(".live-canvas") as HTMLElement | null;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const originX = pointerEvent.clientX, originY = pointerEvent.clientY;
        const start = {...item};
        const grid = view.grid;
        const editing = scene, editingShape = shape, editingMode = mode;
        let moved = false;
        setSelectedID(item.id);
        pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
        const target = pointerEvent.currentTarget;
        const move = (rawEvent: Event) => {
            const nextEvent = rawEvent as globalThis.PointerEvent;
            const dx = Math.round((nextEvent.clientX - originX) / (rect.width / grid.cols));
            const dy = Math.round((nextEvent.clientY - originY) / (rect.height / grid.rows));
            const candidate = action === "move" ? {...start, x: start.x + dx, y: start.y + dy} : {...start, w: start.w + dx, h: start.h + dy};
            if (!moved && (dx || dy)) {
                moved = true;
                lastEdit.current = 0;
                remember();
            }
            setDoc(active => {
                const sceneView = liveSceneLayout(active, editing);
                const shaped = liveFormatLayout(sceneView, editingShape);
                if (!canPlace(shaped, candidate, item.id)) return active;
                const next = {...shaped, widgets: shaped.widgets.map(widget => widget.id === item.id ? candidate : widget)};
                return withLiveScene(active, editing, editingMode === "base" ? next : withLiveFormatView(sceneView, editingShape, next));
            });
        };
        const end = () => {target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", end);};
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", end);
        target.addEventListener("pointercancel", end);
    }
    // L7: never refuse a grid change; conflicts are highlighted instead.
    function changeGrid(cols: number, rows: number) {
        if (!liveGridValid(cols, rows) || cols === view.grid.cols && rows === view.grid.rows) return;
        const next = recomputeGrid(view, cols, rows);
        commitView(next);
        if (layoutConflicts(next).size) setError(t("manage.live.error.gridConflicts"));
    }
    function distribute(axis: DistributeAxis) {
        if (!selected) return;
        const next = distributeWidgets(view, selected.id, axis);
        if (typeof next === "string") setError(next);
        else commitView(next);
    }
    function applyTemplate(key: LiveTemplateKey) {
        const next = applyLiveTemplate(doc, key, scene);
        mutateDoc(next);
        setApplied({key, layout: layoutKey(next)});
        setSelectedID(null);
        setTemplatesOpen(false);
        setCustomGrid(null);
        setFormat(doc.aspect);
        // «Повний показ» fills every scene: the running one is the one to look at first.
        if (liveTemplates[key].scene === "all") setScene("running");
    }
    function switchScene(key: LiveSceneKey) {
        // Edits in another scene never merge into one undo step.
        lastEdit.current = 0;
        setScene(key);
        setSelectedID(null);
        setCustomGrid(null);
        setGhost(null);
    }

    async function publish() {
        if (!canManage || publishing) return;
        setPublishing(true);
        try {
            if (!await autosave.flush()) {toast.error(t("manage.live.draftSaveError")); return;}
            const next = await publishManageLive(eventID);
            setPublished(next);
            queryClient.setQueryData<LiveEditorData>(["event-live-editor", eventID], {Published: next, Draft: null});
            toast.success(t("manage.live.published"));
        } catch (failure) {toastFailure(failure, t(failure instanceof LiveDraftInvalidError ? "manage.live.draftInvalid" : "manage.live.publishError"));}
        finally {setPublishing(false);}
    }
    // Canvas keys: ⌘/Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo; with a widget selected
    // the arrows move it by a cell, Shift+arrows resize it, Delete removes it
    // (after the confirmation) and Escape clears the selection.
    function onKey(keyEvent: KeyboardEvent) {
        const mod = keyEvent.metaKey || keyEvent.ctrlKey;
        const key = keyEvent.key.toLowerCase();
        if (mod && (key === "z" || key === "y")) {
            if (typingTarget(keyEvent.target)) return;
            keyEvent.preventDefault();
            if (key === "y" || keyEvent.shiftKey) redo(); else undo();
            return;
        }
        if (!selected || !editable || mod || keyEvent.altKey || typingTarget(keyEvent.target) || document.querySelector("dialog[open], [role=dialog]:not(dialog), [role=menu]")) return;
        const step = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[keyEvent.key];
        if (step) {
            keyEvent.preventDefault();
            const next = keyEvent.shiftKey ? {...selected, w: selected.w + step[0], h: selected.h + step[1]} : {...selected, x: selected.x + step[0], y: selected.y + step[1]};
            if (canPlace(view, next, next.id)) commitView({...view, widgets: view.widgets.map(item => item.id === next.id ? next : item)});
        } else if (keyEvent.key === "Delete" || keyEvent.key === "Backspace") {
            keyEvent.preventDefault();
            setConfirmRemove(true);
        } else if (keyEvent.key === "Escape") setSelectedID(null);
    }
    const keyHandler = useRef(onKey);
    useEffect(() => {keyHandler.current = onKey;});
    useEffect(() => {
        const listener = (keyEvent: KeyboardEvent) => keyHandler.current(keyEvent);
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    }, []);
    const applyCustomGrid = () => {if (customGrid) changeGrid(customGrid.cols, customGrid.rows);};

    // Only real fit problems mark a block; the floor notes stay in the list.
    const fits = warnings.filter(item => item.kind === "fit");
    const warned = new Set(fits.map(item => item.id));
    const gridPreset = liveGridPresets.find(item => item.cols === view.grid.cols && item.rows === view.grid.rows);
    const gridValue = customGrid || !gridPreset ? "custom" : `${gridPreset.cols}x${gridPreset.rows}`;
    const screenStyle = {"--live-aspect": shown.screen.width / shown.screen.height} as CSSProperties;
    const safe = liveSafeInsets(shown.screen.width, shown.screen.height, liveSafeArea(shown.screen));
    const nativeStyle = {width: shown.screen.width, height: shown.screen.height, padding: `${safe.y}px ${safe.x}px`, "--live-preview-scale": scale || 1, visibility: scale ? "visible" : "hidden"} as CSSProperties;
    const tabLabel = (key: string) => key === layout.aspect
        ? t("manage.live.format.base", {name: key === "custom" ? t("manage.live.format.customSize", layout.screen) : key})
        : liveFormatMode(layout, key) === "custom" ? t("manage.live.format.custom", {name: key}) : key;
    const status = autosave.status;
    const problem = error || canvasProblem(layout);
    const profile = t(liveTextProfile(shown.screen) === "led" ? "manage.live.preview.led" : "manage.live.preview.projector");
    return <div className="event-live-editor">
        <header className="event-live-editor__heading">
            <div><h1>{t("manage.live.title")}</h1><p>{t(canManage ? "manage.live.intro" : "manage.live.introViewer")}</p></div>
            <div className="event-live-editor__actions">
                {canManage && <span className={`event-live-editor__status${status === "error" || status === "invalid" ? " is-problem" : ""}`} role="status">
                    {saveLabel(status, unpublished, published.version)}
                    {status === "error" && <button type="button" onClick={autosave.retry}>{t("manage.live.status.retry")}</button>}
                </span>}
                {canManage && <EventTooltip content={t("manage.live.links.hint")}>{id => <button className="ib-btn" type="button" aria-describedby={id} onClick={() => setLinksOpen(true)}><MonitorUp size={16} /> {t("manage.live.links.open")}</button>}</EventTooltip>}
                <EventTooltip content={t("manage.live.openHint")}>{id => <a className="ib-btn" href="/live" target="_blank" rel="noreferrer" aria-describedby={id}><ExternalLink size={16} /> {t("manage.live.open")}</a>}</EventTooltip>
                {canManage && <EventTooltip content={t("manage.live.publishHint")}>{id => <EventButton className="ib-btn ib-btn--primary" type="button" aria-describedby={id} busy={publishing}
                    disabled={!!validation || (!unpublished && status === "saved")} onClick={() => void publish()}>{publishing ? t("manage.live.publishing") : <><Send size={16} /> {t("manage.live.publish")}</>}</EventButton>}</EventTooltip>}
            </div>
        </header>
        <nav className="event-live-scenes" aria-label={t("manage.live.scene.tabs")}>
            <div className="event-live-scenes__tabs" role="tablist" aria-label={t("manage.live.scene.tabs")}>
                {liveSceneKeys.map(key => <button key={key} type="button" role="tab" aria-selected={scene === key} className="event-live-scene" onClick={() => switchScene(key)}>
                    <strong>{sceneName(key)}</strong>
                    {key === current && <span>{t("manage.live.scene.now")}</span>}
                </button>)}
            </div>
            <ManageFieldLabel title={t("manage.live.scene.label")} help={t("manage.live.scene.help")} />
        </nav>
        <div className="event-live-editor__toolbar">
            <div className="event-live-editor__tool">
                <ManageFieldLabel title={t("manage.live.templates.label")} help={t("manage.live.templates.help")} />
                <button className="ib-btn event-live-editor__template" type="button" disabled={locked} onClick={() => setTemplatesOpen(true)}><LayoutTemplate size={16} /> {t("manage.live.templates.open")}</button>
                {applied && <small className="event-live-editor__applied">{t(layoutKey(doc) === applied.layout ? "manage.live.templates.applied" : "manage.live.templates.appliedChanged", {name: liveTemplates[applied.key].label})}</small>}
            </div>
            <div className="event-live-editor__tool">
                <ManageFieldLabel title={t("manage.live.scene.reset")} help={t("manage.live.scene.resetHelp", {scene: sceneName(scene)})} />
                <button className="ib-btn" type="button" disabled={locked} onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> {t("manage.live.scene.resetAction")}</button>
            </div>
            <div className="event-live-editor__tool">
                <ManageFieldLabel title={t("manage.live.grid")} help={t("manage.live.gridHelp")} required />
                <EventSelect ariaLabel={t("manage.live.grid")} value={gridValue} disabled={!editable}
                    options={[...liveGridPresets.map(item => ({value: `${item.cols}x${item.rows}`, label: t("manage.live.gridSize", item)})), {value: "custom", label: gridPreset ? t("manage.live.gridCustom") : t("manage.live.gridCustomValue", view.grid)}]}
                    onValueChange={value => {
                        if (value === "custom") {setCustomGrid({...view.grid}); return;}
                        const [cols, rows] = value.split("x").map(Number);
                        setCustomGrid(null);
                        changeGrid(cols, rows);
                    }} />
            </div>
            {canManage && <div className="event-live-editor__history">
                <EventTooltip content={t("manage.live.undo")}>{id => <button className="ib-btn ib-btn--ghost event-live-editor__icon" type="button" aria-label={t("manage.live.undo")} aria-describedby={id} disabled={!history.past.length} onClick={undo}><Undo2 size={16} /></button>}</EventTooltip>
                <EventTooltip content={t("manage.live.redo")}>{id => <button className="ib-btn ib-btn--ghost event-live-editor__icon" type="button" aria-label={t("manage.live.redo")} aria-describedby={id} disabled={!history.future.length} onClick={redo}><Redo2 size={16} /></button>}</EventTooltip>
            </div>}
            {customGrid && <div className="event-live-editor__tool event-live-editor__custom-grid">
                <ManageFieldLabel title={t("manage.live.gridCells")} help={t("manage.live.gridCellsHelp", liveGridLimits)} required />
                <div>
                    <input className="event-manage-input" type="number" inputMode="numeric" aria-label={t("manage.live.cols")} aria-invalid={!liveGridValid(customGrid.cols, customGrid.rows) || undefined} aria-describedby={!liveGridValid(customGrid.cols, customGrid.rows) ? "live-custom-grid-error" : undefined} min={liveGridLimits.minCols} max={liveGridLimits.maxCols} value={customGrid.cols || ""} disabled={!editable}
                        onChange={changeEvent => setCustomGrid({...customGrid, cols: changeEvent.target.valueAsNumber || 0})} onBlur={applyCustomGrid} onKeyDown={keyEvent => {if (keyEvent.key === "Enter") applyCustomGrid();}} />
                    <span aria-hidden="true">×</span>
                    <input className="event-manage-input" type="number" inputMode="numeric" aria-label={t("manage.live.rows")} aria-invalid={!liveGridValid(customGrid.cols, customGrid.rows) || undefined} aria-describedby={!liveGridValid(customGrid.cols, customGrid.rows) ? "live-custom-grid-error" : undefined} min={liveGridLimits.minRows} max={liveGridLimits.maxRows} value={customGrid.rows || ""} disabled={!editable}
                        onChange={changeEvent => setCustomGrid({...customGrid, rows: changeEvent.target.valueAsNumber || 0})} onBlur={applyCustomGrid} onKeyDown={keyEvent => {if (keyEvent.key === "Enter") applyCustomGrid();}} />
                </div>
                {!liveGridValid(customGrid.cols, customGrid.rows) && <small id="live-custom-grid-error" className="event-manage-validation" role="alert">{t("manage.live.validation.grid", liveGridLimits)}</small>}
            </div>}
        </div>
        {problem && <div className="event-live-editor__error" role="alert">{problem}</div>}
        {!problem && validation && <div className="event-live-editor__error" role="alert">{validation}</div>}
        <div className="event-live-editor__workspace">
            <aside className="event-live-editor__palette">
                <h2>{t("manage.live.widgets")}</h2>
                <p>{t(mode === "base" ? "manage.live.paletteHint" : "manage.live.paletteBaseOnly", {name: tabLabel(layout.aspect)})}</p>
                {livePaletteItems.map(item => <button key={item.key} type="button" className="event-live-palette-item" draggable={editable && mode === "base"} disabled={!editable || mode !== "base"} aria-label={t("manage.live.paletteAdd", {name: item.label})}
                    onDragStart={dragEvent => {dragEvent.dataTransfer.setData(dragMime, item.key); dragEvent.dataTransfer.effectAllowed = "copy"; setDragItem(item);}}
                    onDragEnd={() => {setDragItem(null); setGhost(null);}}
                    onClick={() => addWidget(item)}>
                    <LiveMiniature layout={paletteLayouts.get(item.key)!} event={event} results={shownResults} sample={sample} box={paletteBox} crop={item.preview} />
                    <span>{item.label}</span>
                </button>)}
            </aside>
            <div className="event-live-editor__stage">
                <div className="event-live-editor__stage-head">
                    <div className="event-live-editor__formats">
                        <div className="ib-seg ib-seg--sm" role="tablist" aria-label={t("manage.live.format.tabs")}>
                            {liveFormatTabs(layout).map(key => <button key={key} type="button" role="tab" aria-selected={shape === key} onClick={() => {setFormat(key); setCustomGrid(null);}}>{tabLabel(key)}</button>)}
                        </div>
                        {mode !== "base" && <div className="event-live-editor__format-mode">
                            <div className="ib-seg ib-seg--sm" role="group" aria-label={t("manage.live.format.mode")}>
                                {(["auto", "custom"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} disabled={locked} onClick={() => {if (mode !== value) mutate(withLiveFormatMode(layout, shape, value));}}>{t(`manage.live.format.mode.${value}`)}</button>)}
                            </div>
                            <EventTooltip content={<span className="event-brand-tooltip-copy">{t("manage.live.format.modeHelp", {name: tabLabel(layout.aspect)})}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: t("manage.live.format.mode")})} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
                        </div>}
                    </div>
                    <div className="event-live-editor__preview">
                        <span id="live-preview-label">{t("manage.live.preview.label")}</span>
                        <div className="ib-seg ib-seg--sm" role="group" aria-labelledby="live-preview-label">
                            {livePreviewKeys.map(key => <button key={key} type="button" aria-pressed={preview === key} onClick={() => setPreview(key)}>{t(`manage.live.preview.${key}`)}</button>)}
                        </div>
                    </div>
                </div>
                <div className="event-live-editor__stage-meta">
                    <span className="event-live-editor__stage-note">{t("manage.live.preview.size", {width: shown.screen.width, height: shown.screen.height, profile})}{sample ? ` ${t("manage.live.sampleShort")}` : ""}</span>
                    {warnings.length > 0 && <button type="button" className={`event-live-editor__warnings-toggle${fits.length ? "" : " is-quiet"}`} aria-expanded={warningsOpen} aria-controls="live-warnings" onClick={() => setWarningsOpen(value => !value)}>
                        {fits.length > 0 && <TriangleAlert size={14} aria-hidden="true" />}{fits.length ? tPlural("manage.live.warningsCount", fits.length) : tPlural("manage.live.floorsCount", warnings.length)}
                    </button>}
                    {warnings.length > 0 && warningsOpen && <ul id="live-warnings" className={`event-live-editor__warnings${fits.length ? "" : " is-quiet"}`} aria-label={t("manage.live.warningsTitle", {width: shown.screen.width, height: shown.screen.height})}>
                        {[...fits, ...warnings.filter(item => item.kind === "floor")].map((warning, index) => <li key={`${warning.id}-${index}`} className={warning.kind === "floor" ? "is-floor" : undefined}><button type="button" onClick={() => setSelectedID(warning.id)}>{warning.text}</button></li>)}
                    </ul>}
                </div>
                {mode === "auto" && <p className="event-live-editor__format-note">{t("manage.live.format.autoNote", {name: tabLabel(layout.aspect)})}</p>}
                {scene === "frozen" && resultsSettings.data && !resultsSettings.data.LiveFreeze && <p className="event-live-editor__format-note">{t("manage.live.scene.frozenOff")}</p>}
                {scene === "finished" && !event.FinishTime && <p className="event-live-editor__format-note">{t("manage.live.scene.noFinish")}</p>}
                {mode === "base" && layout.aspect === "custom" && <div className="event-live-editor__custom-size">
                    <LiveField label={t("manage.live.screenWidth")} help={t("manage.live.screenWidthHelp")} required>
                        {id => <LiveNumberInput id={id} value={layout.screen.width} min={320} max={7680} disabled={locked} onChange={width => mutate({...layout, screen: {...layout.screen, width}})} />}
                    </LiveField>
                    <LiveField label={t("manage.live.screenHeight")} help={t("manage.live.screenHeightHelp")} required>
                        {id => <LiveNumberInput id={id} value={layout.screen.height} min={240} max={4320} disabled={locked} onChange={height => mutate({...layout, screen: {...layout.screen, height}})} />}
                    </LiveField>
                </div>}
                <div className="event-live-editor__screen" style={screenStyle} ref={setScreen}>
                    <div className={`event-live-editor__native${shown.theme === "light" ? " is-light" : ""}`} style={nativeStyle}>
                        <LiveCanvas layout={shown} event={event} stages={stages.data} results={previewResults} sample={sample} nowOffset={previewNow - openedAt} selectedID={selectedID} onSelect={setSelectedID} edit={editable} showGrid onPointerDown={pointerDown}
                            conflicts={conflicts} warned={warned} ghost={ghost} onDragOver={dragOver} onDragLeave={() => setGhost(null)} onDrop={drop} />
                    </div>
                </div>
                <p className="event-live-editor__note">{t(canManage ? "manage.live.note" : "manage.live.noteViewer")}</p>
            </div>
            <aside className="event-live-editor__properties">
                {selected ? <>
                    <button className="event-live-editor__back" type="button" onClick={() => setSelectedID(null)}>{t("manage.live.backToScreen")}</button>
                    <LiveWidgetSettings event={event} layout={shown} widget={selected} disabled={!editable} placeDisabled={!editable} onPlace={updateWidget} onProp={updateProp} onDistribute={distribute} onRemove={() => setConfirmRemove(true)} />
                </> : <LiveScreenSettings eventID={eventID} event={event} layout={layout} results={previewResults} sample={sample} nowOffset={previewNow - openedAt} canManage={canManage} disabled={locked}
                    onChange={next => {mutate(next); if (next.aspect !== layout.aspect && shape === layout.aspect) setFormat(next.aspect);}} />}
            </aside>
        </div>
        {canManage && <LiveScreenLinksDialog open={linksOpen} event={event} onClose={() => setLinksOpen(false)} />}
        <LiveTemplateDialog open={templatesOpen} layout={doc} scene={scene} event={event} stages={stages.data} results={shownResults} sample={sample} onClose={() => setTemplatesOpen(false)} onApply={applyTemplate} />
        <ConfirmDialog open={confirmReset && !locked} onCancel={() => setConfirmReset(false)} tone="danger" title={t("manage.live.scene.resetConfirm.title")}
            description={t("manage.live.scene.resetConfirm.body", {scene: sceneName(scene)})} confirmLabel={t("manage.live.scene.resetConfirm.action")}
            onConfirm={() => {mutateDoc(withLiveSceneReset(doc, scene)); setSelectedID(null); setConfirmReset(false);}} />
        <ConfirmDialog open={confirmRemove && !!selected && editable} onCancel={() => setConfirmRemove(false)} tone="danger" title={t("manage.live.removeConfirm.title")} subject={selected ? liveWidgetName(selected) : undefined}
            description={t(selected?.type === "logos" ? "manage.live.removeConfirm.bodyLogos" : "manage.live.removeConfirm.body")} confirmLabel={t("manage.live.removeWidget")}
            onConfirm={() => {if (selected) mutate({...layout, widgets: layout.widgets.filter(item => item.id !== selected.id)}); setSelectedID(null); setConfirmRemove(false);}} />
    </div>;
}
