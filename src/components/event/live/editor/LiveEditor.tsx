"use client";

import {useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {toastFailure} from "@/components/ui/toastApiError";
import {CircleHelp, ExternalLink, Eye, Info, LayoutTemplate, MonitorUp, Redo2, Send, TriangleAlert, Undo2, X} from "lucide-react";
import {LiveDraftInvalidError, publishLiveScreen, type LiveEditor as LiveEditorData, type LiveScreens, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas, type LiveGhost} from "@/components/event/live/LiveCanvas";
import {canPlace, distributeWidgets, liveResizeFromCorner, type LiveCorner, firstFreeWidget, layoutConflicts, liveGridLimits, liveGridPresets, liveGridValid, liveLogoURL, livePaletteGroups, livePaletteItems, liveWidgetMinimums, liveWidgetName, recomputeGrid, widgetAt, type DistributeAxis, type LivePaletteItem} from "@/components/event/live/liveLayout";
import {liveSampleResults} from "@/components/event/live/liveSample";
import {liveFormatLayout, liveFormatMode, liveFormatTabs, pruneLiveFormats, withLiveFormatMode, withLiveFormatView} from "@/components/event/live/liveFormats";
import {liveSafeArea, liveSafeInsets, liveTextProfile, liveTextWarnings} from "@/components/event/live/liveText";
import {liveSceneKeys, liveSceneLayout, liveScenePreviewNow, liveScenePreviewResults, liveSceneState, liveSceneMode, liveScenesEqual, liveSceneViews, liveWidgetLimit, liveWidgetLimits, liveWidgetsTotal, mapLiveScenes, withLiveScene, withLiveSceneCopy, withLiveSceneMode, type LiveSceneKey} from "@/components/event/live/liveScenes";
import {applyLiveTemplate, liveTemplates, type LiveTemplateKey} from "@/components/event/live/liveTemplates";
import {livePreviewKeys, livePreviewLayout, livePreviewScale, type LivePreviewKey} from "@/components/event/live/livePreview";
import {getManageStages} from "@/api/manageStages";
import {getResultsSettings} from "@/api/manageResults";
import {useLiveResults} from "@/components/event/live/useLiveResults";
import {LiveMiniature, usePaletteLayouts} from "./LiveMiniature";
import {LiveTemplateDialog} from "./LiveTemplateDialog";
import {LivePaletteDialog} from "./LivePaletteDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {LiveField, LiveNumberInput} from "./LiveFields";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {LiveScreenLinksDialog} from "./LiveScreenLinksDialog";
import {LiveScreenPicker} from "./LiveScreenPicker";
import {LiveScreenSettings} from "./LiveScreenSettings";
import {LiveShowPreview, type LivePreviewData} from "./LiveShowPreview";
import {LiveWidgetSettings, qrProblem, type LivePropValue} from "./LiveWidgetSettings";
import {useLiveAutosave, type LiveSaveState} from "./useLiveAutosave";
import "./liveEditor.css";
import {t, tPlural} from "@/i18n/t";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip, FloatingTooltips} from "@/components/ui/EventTooltip";

const dragMime = "application/x-live-widget";
const paletteBox = {width: 72, height: 40};
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

// The editor of one screen; `screens` switches between the event's screens
// (the same editor for each), the open one first saved.
export function LiveEditor({event, canManage, data, screenID, screens, onScreenSwitch, onScreensChanged}: {
    event: PublicEventInfo; canManage: boolean; data: LiveEditorData; screenID: string; screens: LiveScreens;
    onScreenSwitch: (screenID: string) => void; onScreensChanged: (select?: string) => void;
}) {
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
    // «Скопіювати з…» waiting for a confirmation (the source state), and the
    // state whose screen stays when going back to one screen.
    const [copyFrom, setCopyFrom] = useState<LiveSceneKey | null>(null);
    const [keepScene, setKeepScene] = useState<LiveSceneKey | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [openedAt] = useState(() => Date.now());
    const [sampleResults] = useState(() => liveSampleResults(openedAt));
    const [origin, setOrigin] = useState("");
    // Each step keeps the whole layout and the scene the change was made in,
    // so undo and redo can show that scene.
    const [history, setHistory] = useState<{past: HistoryStep[]; future: HistoryStep[]}>({past: [], future: []});
    // The scene (event state) being edited, the screen shape and the preview resolution.
    const [chosenScene, setScene] = useState<LiveSceneKey>("running");
    const [format, setFormat] = useState<string>(() => (data.Draft ?? data.Published).aspect);
    const [preview, setPreview] = useState<LivePreviewKey>("layout");
    // The palette: its search, and the block opened large before adding.
    const [paletteQuery, setPaletteQuery] = useState("");
    const [previewItem, setPreviewItem] = useState<LivePaletteItem | null>(null);
    // «Перегляд» over the window, and the data it shows: sample or the event's own.
    const [showing, setShowing] = useState(false);
    const [showData, setShowData] = useState<LivePreviewData | null>(null);
    const lastEdit = useRef(0);
    useEffect(() => {queueMicrotask(() => setOrigin(window.location.origin));}, []);
    // One screen for all states edits that screen; separate screens edit the chosen state's.
    const sceneMode = liveSceneMode(doc);
    const scene: LiveSceneKey = sceneMode === "single" ? "running" : chosenScene;
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
        eventID, screenID, layout: doc, savedJSON: JSON.stringify(data.Draft ?? data.Published), valid: !validation, enabled: canManage,
        onSaved: saved => queryClient.setQueryData<LiveEditorData>(["event-live-editor", eventID, screenID], current => current && {...current, Draft: saved}),
    });
    const unpublished = layoutKey(doc) !== layoutKey(published);
    // Until the event has results, the editor fills widgets with sample data.
    const sample = !results.data?.Scoreboard.length;
    const shownResults = sample ? sampleResults : results.data;
    // The preview shows a moment of the scene's state: its timer, stage and freeze.
    const previewNow = liveScenePreviewNow(scene, event, openedAt);
    const previewResults = liveScenePreviewResults(scene, shownResults, previewNow);
    // «Перегляд» starts on real results when there are any; sample data on request.
    const showSample = sample || showData === "sample";
    const showResults = liveScenePreviewResults(scene, showSample ? sampleResults : results.data, previewNow);
    // The «зараз» mark follows the clock, checked every 15 s.
    const [clock, setClock] = useState(openedAt);
    useEffect(() => {const timer = setInterval(() => setClock(Date.now()), 15_000); return () => clearInterval(timer);}, []);
    const current = liveSceneState(event, results.data?.Freeze, clock);
    const locked = !canManage;
    const selected = view.widgets.find(item => item.id === selectedID) ?? null;
    const editable = !locked && mode !== "auto";
    const paletteGroups = useMemo(() => {
        const query = paletteQuery.trim().toLowerCase();
        const shown = livePaletteItems.filter(item => !query || `${item.label} ${item.description}`.toLowerCase().includes(query));
        return livePaletteGroups.map(group => ({group, items: shown.filter(item => item.group === group)})).filter(entry => entry.items.length);
    }, [paletteQuery]);

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
    function updateProp(key: string, value: LivePropValue) {
        updateProps({[key]: value});
    }
    // Several settings in one edit (one undo step), e.g. «Скинути кольори».
    function updateProps(changes: Record<string, LivePropValue>) {
        if (!selected) return;
        mutate({...layout, widgets: layout.widgets.map(item => {
            if (item.id !== selected.id) return item;
            const props = {...item.props};
            // null drops a setting back to its default.
            for (const [key, value] of Object.entries(changes)) if (value === null) delete props[key]; else props[key] = value;
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
    // Dragging a block moves it; dragging one of its corners resizes it toward
    // that corner while the opposite corner stays where it is.
    function pointerDown(pointerEvent: PointerEvent<HTMLButtonElement | HTMLSpanElement>, item: LiveWidget, action: "move" | LiveCorner) {
        if (!editable || pointerEvent.button !== 0) return;
        const canvas = pointerEvent.currentTarget.closest(".live-canvas") as HTMLElement | null;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        // The pointer is measured against the canvas as it is now: if the page
        // moves under the drag (a message appears), the block stays under it.
        const originX = pointerEvent.clientX - rect.left, originY = pointerEvent.clientY - rect.top;
        const start = {...item};
        const grid = view.grid;
        const editing = scene, editingShape = shape, editingMode = mode;
        let moved = false;
        setSelectedID(item.id);
        setError("");
        pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
        const target = pointerEvent.currentTarget;
        const move = (rawEvent: Event) => {
            const nextEvent = rawEvent as globalThis.PointerEvent;
            const now = canvas.getBoundingClientRect();
            const dx = Math.round((nextEvent.clientX - now.left - originX) / (now.width / grid.cols));
            const dy = Math.round((nextEvent.clientY - now.top - originY) / (now.height / grid.rows));
            const candidate = action === "move" ? {...start, x: start.x + dx, y: start.y + dy} : liveResizeFromCorner(start, action, dx, dy);
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

    // Another screen opens only after this one's draft is saved.
    async function switchScreen(next: string) {
        if (canManage && autosave.status !== "saved") {
            // Unsaved edits that can't be saved yet stay here until fixed.
            if (validation) {toast.error(t("manage.live.screens.fixFirst")); return;}
            if (!await autosave.flush()) {toast.error(t("manage.live.draftSaveError")); return;}
        }
        onScreenSwitch(next);
    }
    async function publish() {
        if (!canManage || publishing) return;
        setPublishing(true);
        try {
            if (!await autosave.flush()) {toast.error(t("manage.live.draftSaveError")); return;}
            const next = await publishLiveScreen(eventID, screenID);
            setPublished(next);
            queryClient.setQueryData<LiveEditorData>(["event-live-editor", eventID, screenID], current => current ? {...current, Published: next, Draft: null} : current);
            toast.success(t("manage.live.published"));
        } catch (failure) {toastFailure(failure, t(failure instanceof LiveDraftInvalidError ? "manage.live.draftInvalid" : "manage.live.publishError"));}
        finally {setPublishing(false);}
    }
    // Canvas keys: ⌘/Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo; with a widget selected
    // the arrows move it by a cell, Shift+arrows resize it, Delete removes it
    // (after the confirmation) and Escape clears the selection.
    function onKey(keyEvent: KeyboardEvent) {
        if (showing) return;
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
    // Undo and redo sit in the header, next to the save status.
    const historyButtons = <div className="event-live-editor__history">
        <EventTooltip content={t("manage.live.undo")}>{id => <button className="ib-btn ib-btn--ghost event-live-editor__icon" type="button" aria-label={t("manage.live.undo")} aria-describedby={id} disabled={!history.past.length} onClick={undo}><Undo2 size={16} /></button>}</EventTooltip>
        <EventTooltip content={t("manage.live.redo")}>{id => <button className="ib-btn ib-btn--ghost event-live-editor__icon" type="button" aria-label={t("manage.live.redo")} aria-describedby={id} disabled={!history.future.length} onClick={redo}><Redo2 size={16} /></button>}</EventTooltip>
    </div>;
    // The palette and the settings scroll on their own: their tooltips float above them.
    return <FloatingTooltips.Provider value><div className="event-live-editor">
        <header className="event-live-editor__heading">
            {/* The introduction lives behind (?), so the screen keeps the height. */}
            <div className="event-live-editor__title"><h1>{t("manage.live.title")}</h1>
                <EventTooltip help content={<span className="event-brand-tooltip-copy">{t(canManage ? "manage.live.intro" : "manage.live.introViewer")}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: t("manage.live.title")})} aria-describedby={id}><CircleHelp size={16} /></button>}</EventTooltip>
            </div>
            <LiveScreenPicker eventID={eventID} screens={screens.Screens} max={screens.Max} currentID={screenID} disabled={locked}
                onSwitch={next => void switchScreen(next)} onChanged={onScreensChanged} />
            <div className="event-live-editor__actions">
                {canManage && <span className={`event-live-editor__status${status === "error" || status === "invalid" ? " is-problem" : ""}`} role="status">
                    {saveLabel(status, unpublished, published.version)}
                    {status === "error" && <button type="button" onClick={autosave.retry}>{t("manage.live.status.retry")}</button>}
                </span>}
                {canManage && historyButtons}
                {canManage && <EventTooltip content={t("manage.live.links.hint")}>{id => <button className="ib-btn event-live-editor__icon" type="button" aria-label={t("manage.live.links.open")} aria-describedby={id} onClick={() => setLinksOpen(true)}><MonitorUp size={16} /></button>}</EventTooltip>}
                <EventTooltip content={t("manage.live.show.hint")}>{id => <button className="ib-btn event-live-editor__icon" type="button" aria-label={t("manage.live.show.open")} aria-describedby={id} onClick={() => setShowing(true)}><Eye size={16} /></button>}</EventTooltip>
                <EventTooltip content={t("manage.live.openHint")}>{id => <a className="ib-btn event-live-editor__icon" href={`/live?screen=${encodeURIComponent(screenID)}`} target="_blank" rel="noreferrer" aria-label={t("manage.live.open")} aria-describedby={id}><ExternalLink size={16} /></a>}</EventTooltip>
                {canManage && <EventTooltip content={t("manage.live.publishHint")}>{id => <EventButton className="ib-btn ib-btn--primary" type="button" aria-describedby={id} busy={publishing} busyLabel={t("manage.live.publishing")}
                    disabled={!!validation || (!unpublished && status === "saved")} onClick={() => void publish()}><Send size={16} /> {t("manage.live.publish")}</EventButton>}</EventTooltip>}
            </div>
        </header>
        <div className="event-live-editor__toolbar">
            {/* «Екран за станом заходу»: one screen for all states, or one per state (then the state tabs). */}
            <div className="event-live-editor__tool event-live-editor__tool--mode">
                <ManageFieldLabel title={t("manage.live.scene.label")} help={t("manage.live.scene.help")} />
                <EventSelect ariaLabel={t("manage.live.scene.label")} value={sceneMode} disabled={locked}
                    options={(["single", "separate"] as const).map(value => ({value, label: t(`manage.live.scene.mode.${value}`)}))}
                    onValueChange={value => {
                        if (value === sceneMode) return;
                        // Back to one screen: ask which state's screen stays.
                        if (value === "single") {setKeepScene(scene); return;}
                        if (liveWidgetsTotal(doc) * liveSceneKeys.length > liveWidgetLimits.total) {setError(t("manage.live.error.limit.total", liveWidgetLimits)); return;}
                        mutateDoc(withLiveSceneMode(doc, "separate")); setSelectedID(null);
                    }} />
            </div>
            {sceneMode === "separate" && <div className="event-live-scenes__tabs" role="tablist" aria-label={t("manage.live.scene.tabs")}>
                {liveSceneKeys.map(key => {
                    const tab = (described?: string) => <button type="button" role="tab" aria-selected={scene === key} aria-describedby={described} className="event-live-scene" onClick={() => switchScene(key)}>{sceneName(key)}</button>;
                    // The live state: a dot by its name; «зараз» on hover, focus or a tap on the dot.
                    return key === current
                        ? <EventTooltip key={key} content={t("manage.live.scene.now")}>{id => <span className="event-live-scene-cell is-now">{tab(id)}<span className="event-live-scene__now" aria-hidden="true" /></span>}</EventTooltip>
                        : <span key={key} className="event-live-scene-cell">{tab()}</span>;
                })}
            </div>}
            <div className="event-live-editor__tool">
                <ManageFieldLabel title={t("manage.live.templates.label")} help={t("manage.live.templates.help")} />
                <button className="ib-btn event-live-editor__template" type="button" disabled={locked} onClick={() => setTemplatesOpen(true)}><LayoutTemplate size={16} /> {t("manage.live.templates.open")}</button>
                {applied && <small className="event-live-editor__applied">{t(layoutKey(doc) === applied.layout ? "manage.live.templates.applied" : "manage.live.templates.appliedChanged", {name: liveTemplates[applied.key].label})}</small>}
            </div>
            {sceneMode === "separate" && <div className="event-live-editor__tool">
                <ManageFieldLabel title={t("manage.live.scene.copy")} help={t("manage.live.scene.copyHelp", {scene: sceneName(scene)})} />
                <EventSelect ariaLabel={t("manage.live.scene.copy")} value="" placeholder={t("manage.live.scene.copyPlaceholder")} disabled={locked}
                    options={liveSceneKeys.filter(key => key !== scene).map(key => ({value: key, label: sceneName(key)}))}
                    onValueChange={value => {
                        const source = value as LiveSceneKey;
                        if (liveScenesEqual(doc, scene, source)) return;
                        // A screen with blocks of its own is replaced only after a confirmation.
                        if (layout.widgets.length) {setCopyFrom(source); return;}
                        mutateDoc(withLiveSceneCopy(doc, scene, source)); setSelectedID(null);
                    }} />
            </div>}
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
        <div className="event-live-editor__workspace">
            <aside className="event-live-editor__palette" aria-label={t("manage.live.widgets")}>
                <h2>{t("manage.live.widgets")}</h2>
                <p>{t(mode === "base" ? "manage.live.paletteHint" : "manage.live.paletteBaseOnly", {name: tabLabel(layout.aspect)})}</p>
                <input className="event-manage-input event-live-palette-search" type="search" value={paletteQuery} onChange={change => setPaletteQuery(change.target.value)}
                    placeholder={t("manage.live.paletteSearch")} aria-label={t("manage.live.paletteSearch")} />
                {paletteGroups.map(({group, items}) => <section key={group} className="event-live-palette-group" aria-labelledby={`live-palette-group-${group}`}>
                    <h3 id={`live-palette-group-${group}`}>{t(`manage.live.paletteGroup.${group}`)}</h3>
                    {items.map(item => <button key={item.key} type="button" className="event-live-palette-item" draggable={editable && mode === "base"} aria-label={t("manage.live.paletteOpen", {name: item.label})}
                        aria-describedby={`live-palette-${item.key}`}
                        onDragStart={dragEvent => {setError(""); dragEvent.dataTransfer.setData(dragMime, item.key); dragEvent.dataTransfer.effectAllowed = "copy"; setDragItem(item);}}
                        onDragEnd={() => {setDragItem(null); setGhost(null);}}
                        onClick={() => setPreviewItem(item)}>
                        <LiveMiniature layout={paletteLayouts.get(item.key)!} event={event} results={shownResults} sample={sample} box={paletteBox} crop={item.preview} />
                        <span><b>{item.label}</b><small id={`live-palette-${item.key}`}>{item.description}</small></span>
                    </button>)}
                </section>)}
                {!paletteGroups.length && <EmptyState compact message={t("manage.live.paletteNothing")} />}
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
                            <EventTooltip help content={<span className="event-brand-tooltip-copy">{t("manage.live.format.modeHelp", {name: tabLabel(layout.aspect)})}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.fields.aboutField", {title: t("manage.live.format.mode")})} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
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
                    <EventTooltip help content={<span className="event-brand-tooltip-copy">{t(canManage ? "manage.live.note" : "manage.live.noteViewer")}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.live.noteLabel")} aria-describedby={id}><CircleHelp size={14} /></button>}</EventTooltip>
                    <span className="event-live-editor__stage-note">{t("manage.live.preview.size", {width: shown.screen.width, height: shown.screen.height, profile})}{sample ? ` ${t("manage.live.sampleShort")}` : ""}</span>
                    {warnings.length > 0 && <button type="button" className={`event-live-editor__warnings-toggle${fits.length ? "" : " is-quiet"}`} aria-expanded={warningsOpen} aria-controls="live-warnings" onClick={() => setWarningsOpen(value => !value)}>
                        {fits.length > 0 && <TriangleAlert size={14} aria-hidden="true" />}{fits.length ? tPlural("manage.live.warningsCount", fits.length) : tPlural("manage.live.floorsCount", warnings.length)}
                    </button>}
                    {warnings.length > 0 && warningsOpen && <div id="live-warnings" className={`event-live-editor__warnings${fits.length ? "" : " is-quiet"}`}>
                        {/* The legend once: a problem to fix, and a note on what the screen did by itself. */}
                        <dl className="event-live-editor__legend">
                            <dt className="is-fit"><TriangleAlert size={14} aria-hidden="true" />{t("manage.live.legend.fit")}</dt><dd>{t("manage.live.legend.fitText")}</dd>
                            <dt className="is-floor"><Info size={14} aria-hidden="true" />{t("manage.live.legend.floor")}</dt><dd>{t("manage.live.legend.floorText")}</dd>
                        </dl>
                        <ul aria-label={t("manage.live.warningsTitle", {width: shown.screen.width, height: shown.screen.height})}>
                            {[...fits, ...warnings.filter(item => item.kind === "floor")].map((warning, index) => <li key={`${warning.id}-${index}`} className={warning.kind === "floor" ? "is-floor" : "is-fit"}>
                                <button type="button" onClick={() => setSelectedID(warning.id)}>{warning.kind === "floor" ? <Info size={14} aria-label={t("manage.live.legend.floor")} /> : <TriangleAlert size={14} aria-label={t("manage.live.legend.fit")} />}{warning.text}</button>
                            </li>)}
                        </ul>
                    </div>}
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
                <div className="event-live-editor__screen-box" style={screenStyle}>
                    <div className="event-live-editor__screen" style={screenStyle} ref={setScreen}>
                        {/* The problem lies over the top edge of the screen: it never moves the canvas under a drag. */}
                        {(problem || validation) && <div className="event-live-editor__error" role="alert">
                            <span>{problem || validation}</span>
                            {error && <button type="button" aria-label={t("manage.live.error.dismiss")} onClick={() => setError("")}><X size={14} aria-hidden="true" /></button>}
                        </div>}
                        <div className={`event-live-editor__native${shown.theme === "light" ? " is-light" : ""}`} style={nativeStyle}>
                            <LiveCanvas layout={shown} event={event} stages={stages.data} results={previewResults} sample={sample} nowOffset={previewNow - openedAt} selectedID={selectedID} onSelect={setSelectedID} edit={editable} showGrid onPointerDown={pointerDown}
                                conflicts={conflicts} warned={warned} ghost={ghost} onDragOver={dragOver} onDragLeave={() => setGhost(null)} onDrop={drop} />
                        </div>
                    </div>
                </div>
            </div>
            <aside className="event-live-editor__properties">
                {selected ? <>
                    <button className="event-live-editor__back" type="button" onClick={() => setSelectedID(null)}>{t("manage.live.backToScreen")}</button>
                    <LiveWidgetSettings event={event} layout={shown} widget={selected} disabled={!editable} placeDisabled={!editable} onPlace={updateWidget} onProp={updateProp} onProps={updateProps} onDistribute={distribute} onRemove={() => setConfirmRemove(true)} />
                </> : <LiveScreenSettings eventID={eventID} event={event} layout={layout} results={previewResults} sample={sample} nowOffset={previewNow - openedAt} canManage={canManage} disabled={locked}
                    onChange={next => {mutate(next); if (next.aspect !== layout.aspect && shape === layout.aspect) setFormat(next.aspect);}} />}
            </aside>
        </div>
        {showing && <LiveShowPreview layout={shown} event={event} stages={stages.data} results={showResults} sample={showSample} nowOffset={previewNow - openedAt}
            data={showSample ? "sample" : "real"} realAvailable={!sample} onData={setShowData} onClose={() => setShowing(false)} />}
        {canManage && <LiveScreenLinksDialog open={linksOpen} event={event} screenID={screenID} onClose={() => setLinksOpen(false)} />}
        <LivePaletteDialog item={previewItem} layout={previewItem ? paletteLayouts.get(previewItem.key) ?? null : null} event={event} results={shownResults} sample={sample}
            canAdd={editable && mode === "base"} blocked={editable && mode === "base" ? null : t(locked ? "manage.live.palettePreview.locked" : "manage.live.paletteBaseOnly", {name: tabLabel(layout.aspect)})}
            onClose={() => setPreviewItem(null)} onAdd={item => {setPreviewItem(null); addWidget(item);}} />
        <LiveTemplateDialog open={templatesOpen} layout={doc} scene={scene} separate={sceneMode === "separate"} event={event} stages={stages.data} results={shownResults} sample={sample} onClose={() => setTemplatesOpen(false)} onApply={applyTemplate} />
        <ConfirmDialog open={copyFrom !== null && !locked} onCancel={() => setCopyFrom(null)} tone="danger" title={t("manage.live.scene.copyConfirm.title", {scene: sceneName(scene)})}
            description={copyFrom ? t("manage.live.scene.copyConfirm.body", {scene: sceneName(scene), source: sceneName(copyFrom)}) : undefined} confirmLabel={t("manage.live.scene.copyConfirm.action")} busyLabel={t("common.busy.copying")}
            onConfirm={() => {if (copyFrom) mutateDoc(withLiveSceneCopy(doc, scene, copyFrom)); setSelectedID(null); setCopyFrom(null);}} />
        <ConfirmDialog open={keepScene !== null && !locked} onCancel={() => setKeepScene(null)} tone="danger" title={t("manage.live.scene.singleConfirm.title")}
            description={t("manage.live.scene.singleConfirm.body")} confirmLabel={t("manage.live.scene.singleConfirm.action")} busyLabel={t("common.busy.applying")}
            onConfirm={() => {if (keepScene) mutateDoc(withLiveSceneMode(doc, "single", keepScene)); setScene("running"); setSelectedID(null); setKeepScene(null);}}>
            <div className="event-live-field">
                <ManageFieldLabel title={t("manage.live.scene.keep")} help={t("manage.live.scene.keepHelp")} />
                <EventSelect ariaLabel={t("manage.live.scene.keep")} value={keepScene ?? "running"} onValueChange={value => setKeepScene(value as LiveSceneKey)}
                    options={liveSceneKeys.map(key => ({value: key, label: sceneName(key)}))} />
            </div>
        </ConfirmDialog>
        <ConfirmDialog open={confirmRemove && !!selected && editable} onCancel={() => setConfirmRemove(false)} tone="danger" title={t("manage.live.removeConfirm.title")} subject={selected ? liveWidgetName(selected) : undefined}
            description={t(selected?.type === "logos" ? "manage.live.removeConfirm.bodyLogos" : "manage.live.removeConfirm.body")} confirmLabel={t("manage.live.removeWidget")} busyLabel={t("common.busy.removing")}
            onConfirm={() => {if (selected) mutate({...layout, widgets: layout.widgets.filter(item => item.id !== selected.id)}); setSelectedID(null); setConfirmRemove(false);}} />
    </div></FloatingTooltips.Provider>;
}
