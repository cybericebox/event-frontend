"use client";

import {useState, type CSSProperties, type PointerEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {ExternalLink, Eye, Save, Send, Trash2} from "lucide-react";
import {getManageLive, publishManageLive, saveManageLiveDraft, type LiveLayout, type LiveWidget} from "@/api/manageLive";
import {getManageResults} from "@/api/manageResults";
import {LiveCanvas} from "@/components/event/live/LiveCanvas";
import {canPlace, firstFreeWidget, fitGrid, liveGridLimits, liveGridValid, liveLogoURL, livePresets, liveWidgetLabels, liveWidgetMinimums, presetLayout} from "@/components/event/live/liveLayout";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";

const aspects = {"16:9": 16 / 9, "16:10": 16 / 10, "4:3": 4 / 3, "5:3": 5 / 3};

export default function ManageLivePage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const editor = useQuery({queryKey: ["event-live-editor", eventID], queryFn: () => getManageLive(eventID), refetchOnWindowFocus: false});
    const results = useQuery({queryKey: ["event-live-results", eventID], queryFn: () => getManageResults(eventID), retry: false, refetchInterval: 15000});
    const [override, setOverride] = useState<LiveLayout | null>(null);
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [preview, setPreview] = useState(false);
    const [customGrid, setCustomGrid] = useState(false);
    const [gridCols, setGridCols] = useState(12);
    const [gridRows, setGridRows] = useState(8);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const layout = override ?? editor.data?.Draft ?? editor.data?.Published ?? null;
    if (editor.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити Live</h1><button className="ib-btn" onClick={() => void editor.refetch()}>Повторити</button></div>;
    if (editor.isPending || !layout) return <EventLoading event={event} label="Завантажуємо Live…" />;

    const selected = layout.widgets.find(item => item.id === selectedID) ?? null;
    const saved = editor.data?.Draft ?? editor.data?.Published;
    const dirty = JSON.stringify(layout) !== JSON.stringify(saved);
    const validation = !liveGridValid(layout.grid.cols, layout.grid.rows)
        ? `Сітка має бути від ${liveGridLimits.minCols}×${liveGridLimits.minRows} до ${liveGridLimits.maxCols}×${liveGridLimits.maxRows}.`
        : layout.screen.width < 320 || layout.screen.width > 7680 || layout.screen.height < 240 || layout.screen.height > 4320 || layout.screen.width <= layout.screen.height
        ? "Вкажіть альбомний розмір екрана: ширина 320–7680 px, висота 240–4320 px."
        : layout.widgets.some(widget => widget.type === "logos" && Array.isArray(widget.props.logos) && widget.props.logos.some(value => typeof value !== "string" || !liveLogoURL(value)))
            ? "Для логотипів укажіть HTTPS-посилання або шлях сайту, що починається з /."
        : layout.widgets.some(widget => widget.type === "qr" && (typeof widget.props.url !== "string" || !/^https?:\/\/[^\s]+$/.test(widget.props.url) && !/^\/(?!\/)/.test(widget.props.url)))
            ? "Для QR-коду вкажіть повне посилання або шлях сайту, що починається з /."
            : "";
    const aspect = layout.aspect === "custom" ? layout.screen.width / layout.screen.height : aspects[layout.aspect];
    const screenStyle = {"--live-aspect": aspect} as CSSProperties;

    function mutate(next: LiveLayout) {setOverride(next); setError("");}
    function updateWidget(next: LiveWidget) {
        if (!canPlace(layout!, next, next.id)) {setError("Віджет перетинається з іншим або виходить за межі сітки."); return;}
        mutate({...layout!, widgets: layout!.widgets.map(item => item.id === next.id ? next : item)});
    }
    function updateProp(key: string, value: string | number | boolean | string[]) {
        if (selected) updateWidget({...selected, props: {...selected.props, [key]: value}});
    }
    function addWidget(type: LiveWidget["type"]) {
        let working = layout!;
        let next = firstFreeWidget(working, type);
        if (!next && working.grid.rows + liveWidgetMinimums[type].h <= liveGridLimits.maxRows) {
            working = {...working, grid: {...working.grid, rows: working.grid.rows + liveWidgetMinimums[type].h}};
            next = firstFreeWidget(working, type);
        }
        if (!next) {setError("На сітці немає вільного місця для цього віджета."); return;}
        if (type === "qr") next.props = {url: window.location.origin};
        mutate({...working, widgets: [...working.widgets, next]});
        setSelectedID(next.id);
    }
    function pointerDown(event: PointerEvent<HTMLButtonElement | HTMLSpanElement>, item: LiveWidget, mode: "move" | "resize") {
        if (!canManage || preview || event.button !== 0) return;
        const screen = event.currentTarget.closest(".live-canvas") as HTMLElement | null;
        if (!screen) return;
        const rect = screen.getBoundingClientRect();
        const originX = event.clientX, originY = event.clientY;
        const start = {...item};
        setSelectedID(item.id);
        event.currentTarget.setPointerCapture(event.pointerId);
        const target = event.currentTarget;
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
    function changeGrid(cols: number, rows: number) {
        if (!liveGridValid(cols, rows)) return;
        const next = fitGrid(layout!, cols, rows);
        if (!next) {setError("У новій сітці бракує місця для наявних віджетів."); return;}
        mutate(next);
    }
    async function save() {
        if (!layout || !canManage || busy) return;
        setBusy(true);
        try {
            await saveManageLiveDraft(eventID, layout);
            await queryClient.invalidateQueries({queryKey: ["event-live-editor", eventID]});
            setOverride(current => JSON.stringify(current) === JSON.stringify(layout) ? null : current);
            toast.success("Чернетку Live збережено");
        } catch {toast.error("Не вдалося зберегти чернетку. Перевірте розташування віджетів.");}
        finally {setBusy(false);}
    }
    async function publish() {
        if (!canManage || busy || dirty || !editor.data?.Draft) return;
        setBusy(true);
        try {
            await publishManageLive(eventID);
            await queryClient.invalidateQueries({queryKey: ["event-live-editor", eventID]});
            setOverride(current => JSON.stringify(current) === JSON.stringify(layout) ? null : current);
            toast.success("Live-екран опубліковано");
        } catch {toast.error("Не вдалося опублікувати Live-екран.");}
        finally {setBusy(false);}
    }

    return <div className="event-live-editor">
        <header className="event-live-editor__heading"><div><h1>Live-екран</h1><p>Зберіть екран для проєктора або LED-стіни. Чернетка не впливає на опублікований вигляд.</p></div><div className="event-live-editor__actions"><a className="ib-btn" href="/live" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Відкрити екран</a><button className="ib-btn" type="button" onClick={() => setPreview(value => !value)}><Eye size={16} /> {preview ? "Редагувати" : "Переглянути"}</button>{canManage && <><button className="ib-btn" type="button" disabled={!dirty || !!validation || busy} onClick={() => void save()}><Save size={16} /> Зберегти чернетку</button><button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !editor.data?.Draft || busy} onClick={() => void publish()}><Send size={16} /> Опублікувати</button></>}</div></header>
        <div className="event-live-editor__toolbar"><label>Пресет<select disabled={!canManage || preview} value="" onChange={event => {const key = event.target.value as keyof typeof livePresets; if (key in livePresets) {mutate(presetLayout(key, layout)); setSelectedID(null);}}}><option value="" disabled>Оберіть пресет</option>{Object.entries(livePresets).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select></label><label>Формат<select value={layout.aspect} disabled={!canManage || preview} onChange={event => {const aspect = event.target.value as LiveLayout["aspect"]; mutate({...layout, aspect, screen: {...layout.screen, width: aspect === "custom" ? layout.screen.width : Math.round(layout.screen.height * aspects[aspect as keyof typeof aspects])}});}}>{["16:9", "16:10", "4:3", "5:3", "custom"].map(value => <option key={value} value={value}>{value === "custom" ? "Власний" : value}</option>)}</select></label><label>Тема<select value={layout.theme} disabled={!canManage || preview} onChange={event => mutate({...layout, theme: event.target.value as LiveLayout["theme"]})}><option value="dark">Темна</option><option value="light">Світла</option></select></label><label>Сітка<select value={`${layout.grid.cols}x${layout.grid.rows}`} disabled={!canManage || preview} onChange={event => {const [cols, rows] = event.target.value.split("x").map(Number); changeGrid(cols, rows);}}>{["12x8", "16x9", "24x16", `${layout.grid.cols}x${layout.grid.rows}`].filter((value, index, all) => all.indexOf(value) === index).map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Масштаб тексту<input type="range" min="80" max="150" value={Math.round(layout.screen.textScale * 100)} disabled={!canManage || preview} onChange={event => mutate({...layout, screen: {...layout.screen, textScale: Number(event.target.value) / 100}})} />{Math.round(layout.screen.textScale * 100)}%</label></div>
        {layout.aspect === "custom" && <div className="event-live-editor__toolbar"><label>Ширина екрана, px<input type="number" min="320" max="7680" value={layout.screen.width} disabled={!canManage || preview} onChange={event => mutate({...layout, screen: {...layout.screen, width: Number(event.target.value)}})} /></label><label>Висота екрана, px<input type="number" min="240" max="4320" value={layout.screen.height} disabled={!canManage || preview} onChange={event => mutate({...layout, screen: {...layout.screen, height: Number(event.target.value)}})} /></label><label>Розміщення<select value={layout.screen.anchor} disabled={!canManage || preview} onChange={event => mutate({...layout, screen: {...layout.screen, anchor: event.target.value as "full" | "top-left"}})}><option value="full">На весь екран</option><option value="top-left">Зліва зверху</option></select></label></div>}
        <div className="event-live-editor__grid-options"><button className="ib-btn" type="button" disabled={!canManage || preview} onClick={() => {setGridCols(layout.grid.cols); setGridRows(layout.grid.rows); setCustomGrid(value => !value);}}>{customGrid ? "Сховати налаштування сітки" : "Власний розмір сітки"}</button>{customGrid && <div className="event-live-editor__custom-grid"><label>Колонки<input type="number" min={liveGridLimits.minCols} max={liveGridLimits.maxCols} value={gridCols} disabled={!canManage || preview} onChange={event => setGridCols(Number(event.target.value))} /></label><label>Рядки<input type="number" min={liveGridLimits.minRows} max={liveGridLimits.maxRows} value={gridRows} disabled={!canManage || preview} onChange={event => setGridRows(Number(event.target.value))} /></label><button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || preview || !liveGridValid(gridCols, gridRows)} onClick={() => changeGrid(gridCols, gridRows)}>Застосувати сітку</button></div>}</div>
        {(error || validation) && <div className="event-live-editor__error" role="alert">{error || validation}</div>}
        <div className={`event-live-editor__workspace${preview ? " is-preview" : ""}`}><aside className="event-live-editor__palette"><h2>Віджети</h2>{(Object.keys(liveWidgetLabels) as LiveWidget["type"][]).map(type => <button key={type} type="button" disabled={!canManage || preview || type === "ad_table"} title={type === "ad_table" ? "Дані A/D ще не підтримуються джерелом результатів" : undefined} onClick={() => addWidget(type)}>+ {liveWidgetLabels[type]}</button>)}</aside><div className="event-live-editor__stage"><div className="event-live-editor__screen" style={screenStyle}><LiveCanvas layout={layout} event={event} results={results.data} selectedID={selectedID} onSelect={setSelectedID} edit={canManage && !preview} showGrid={!preview} onPointerDown={pointerDown} /></div></div><aside className="event-live-editor__properties"><h2>Властивості</h2>{selected ? <><p>{liveWidgetLabels[selected.type]}</p><div className="event-live-editor__grid-fields">{(["x", "y", "w", "h"] as const).map((key, index) => <label key={key}>{["Колонка", "Рядок", "Ширина", "Висота"][index]}<input type="number" min="1" value={selected[key]} disabled={!canManage || preview} onChange={event => updateWidget({...selected, [key]: Number(event.target.value)})} /></label>)}</div>{selected.type === "title" && <label>Підзаголовок<input value={String(selected.props.subtitle ?? "")} disabled={!canManage || preview} onChange={event => updateProp("subtitle", event.target.value)} /></label>}{selected.type === "announcement" && <label>Текст оголошення<textarea value={String(selected.props.text ?? "")} disabled={!canManage || preview} onChange={event => updateProp("text", event.target.value)} /></label>}{selected.type === "qr" && <label>Посилання<input type="url" value={String(selected.props.url ?? "")} disabled={!canManage || preview} onChange={event => updateProp("url", event.target.value)} /></label>}{selected.type === "logos" && <><label>Назва блоку<input value={String(selected.props.title ?? "")} disabled={!canManage || preview} onChange={event => updateProp("title", event.target.value)} /></label><label>Режим<select value={String(selected.props.mode ?? "fixed")} disabled={!canManage || preview} onChange={event => updateProp("mode", event.target.value)}><option value="fixed">Фіксовані</option><option value="carousel">Карусель</option></select></label>{selected.props.mode === "carousel" && <><label>Швидкість<select value={String(selected.props.speed ?? "normal")} disabled={!canManage || preview} onChange={event => updateProp("speed", event.target.value)}><option value="slow">Повільно</option><option value="normal">Звичайно</option><option value="fast">Швидко</option></select></label><label className="event-live-editor__checkbox"><input type="checkbox" checked={selected.props.paused === true} disabled={!canManage || preview} onChange={event => updateProp("paused", event.target.checked)} /> Зупинити рух</label></>}<label>URL логотипів, по одному на рядок<textarea value={Array.isArray(selected.props.logos) ? selected.props.logos.join("\n") : ""} disabled={!canManage || preview} onChange={event => updateProp("logos", event.target.value.split("\n").map(value => value.trim()).filter(Boolean))} /></label></>}{selected.type === "chart" && <label>Ліній на графіку<input type="number" min="5" max="10" value={Number(selected.props.lines ?? 5)} disabled={!canManage || preview} onChange={event => updateProp("lines", Number(event.target.value))} /></label>}{selected.type === "table" && <><label>Рядків на сторінці<input type="number" min="1" max="60" value={Number(selected.props.rowsPerPage ?? 10)} disabled={!canManage || preview} onChange={event => updateProp("rowsPerPage", Number(event.target.value))} /></label><label>Інтервал, с<input type="number" min="1" max="60" value={Number(selected.props.pageSeconds ?? 10)} disabled={!canManage || preview} onChange={event => updateProp("pageSeconds", Number(event.target.value))} /></label></>}{selected.type === "solves" && <label>Кількість рядків<input type="number" min="1" max="60" value={Number(selected.props.rows ?? 5)} disabled={!canManage || preview} onChange={event => updateProp("rows", Number(event.target.value))} /></label>}{canManage && !preview && <button className="ib-btn" type="button" onClick={() => {mutate({...layout, widgets: layout.widgets.filter(item => item.id !== selected.id)}); setSelectedID(null);}}><Trash2 size={16} /> Прибрати віджет</button>}</> : <p>Оберіть віджет на сітці, щоб змінити його розташування та вміст.</p>}</aside></div>
        <p className="event-live-editor__note">Версія {editor.data?.Published.version}. Перетягніть віджет для переміщення, потягніть за правий нижній кут для зміни розміру. Зміни побачать глядачі після публікації.</p>
    </div>;
}
