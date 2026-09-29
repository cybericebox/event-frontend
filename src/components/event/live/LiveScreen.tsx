"use client";

import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Maximize, Minimize, MonitorCheck} from "lucide-react";
import {getLiveLayoutVersion, getPublishedLiveLayout, type LiveLayout} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "./LiveCanvas";
import {useLiveResults} from "./useLiveResults";
import {useFullscreen, useIdle, useWakeLock, useWindowSize, type WakeLockState} from "./liveScreenHooks";

const wakeLabels: Record<WakeLockState, string> = {
    active: "Екран не згасне", released: "Екран може згаснути", denied: "Браузер не дозволив тримати екран увімкненим", unsupported: "Браузер не вміє тримати екран увімкненим",
};

// Screen test (LIVE-CONSTRUCTOR §2): the frame marks the edges of the render
// area, so a video processor's crop is visible; the panel shows the actual
// window size and the LED text samples.
function LiveScreenTest({layout}: {layout: LiveLayout}) {
    const size = useWindowSize();
    const [windowSize, ratio] = size.split("@");
    const anchored = layout.screen.anchor === "top-left";
    const area = anchored ? `${layout.screen.width}×${layout.screen.height}` : windowSize;
    return <div className="live-test" role="status" aria-label="Тест екрана">
        <span className="live-test__corner">0,0</span><span className="live-test__corner">{area.split("×")[0]}</span><span className="live-test__corner">{area.split("×")[1]}</span><span className="live-test__corner">{area}</span>
        <div className="live-test__panel">
            <strong>{area}</strong>
            <dl>
                <dt>Вікно браузера</dt><dd>{windowSize} px</dd>
                <dt>Щільність пікселів</dt><dd>{ratio ? `×${ratio}` : "—"}</dd>
                <dt>Макет</dt><dd>{layout.screen.width}×{layout.screen.height} · {anchored ? "зліва зверху" : "на весь екран"}</dd>
                <dt>Сітка</dt><dd>{layout.grid.cols}×{layout.grid.rows} · текст {Math.round(layout.screen.textScale * 100)}%</dd>
            </dl>
            <div className="live-test__samples">
                <span style={{fontSize: 14}}>14 px — підписи: Організатори · 12:30</span>
                <span style={{fontSize: 20}}>20 px — основний текст: 1 · IceBreakers · 4 820</span>
                <span style={{fontSize: 34}}>34 px — таймер 01:24:37</span>
            </div>
        </div>
    </div>;
}

export function LiveScreen({event}: {event: PublicEventInfo}) {
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const layoutQuery = useQuery({queryKey: ["event-live-screen-layout", eventID], queryFn: () => getPublishedLiveLayout(eventID), retry: false, refetchOnWindowFocus: false});
    // A light version check replaces reloading the whole layout every 15 s.
    const version = useQuery({queryKey: ["event-live-screen-version", eventID], queryFn: () => getLiveLayoutVersion(eventID), retry: false, refetchInterval: 15000, enabled: layoutQuery.isSuccess});
    useEffect(() => {
        if (version.data !== undefined && layoutQuery.data && version.data !== layoutQuery.data.version) void queryClient.invalidateQueries({queryKey: ["event-live-screen-layout", eventID]});
    }, [version.data, layoutQuery.data, queryClient, eventID]);
    const {results} = useLiveResults(eventID, layoutQuery.isSuccess);
    const fullscreen = useFullscreen();
    const wake = useWakeLock(true);
    const idle = useIdle(3000);
    const [testing, setTesting] = useState(false);
    useEffect(() => {
        // ?test=1 opens the screen test straight away (set up on the venue).
        const initial = new URLSearchParams(window.location.search).get("test") === "1";
        if (initial) queueMicrotask(() => setTesting(true));
    }, []);
    const toggleFullscreen = fullscreen.toggle;
    const onKey = useCallback((keyEvent: KeyboardEvent) => {
        if (keyEvent.ctrlKey || keyEvent.metaKey || keyEvent.altKey) return;
        if (keyEvent.key === "f" || keyEvent.key === "а") toggleFullscreen();
        if (keyEvent.key === "t" || keyEvent.key === "е") setTesting(value => !value);
    }, [toggleFullscreen]);
    useEffect(() => {
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onKey]);

    if (layoutQuery.isError) return <main className="live-fullscreen"><div className="live-fullscreen__state" role="alert"><h1>Не вдалося завантажити Live-екран</h1><button className="ib-btn" type="button" onClick={() => void layoutQuery.refetch()}>Повторити</button></div></main>;
    if (!layoutQuery.data) return <main className="live-fullscreen"><div className="live-fullscreen__state" role="status">Завантажуємо Live-екран…</div></main>;
    const layout = layoutQuery.data;
    const style = {"--live-screen-width": `${layout.screen.width}px`, "--live-screen-height": `${layout.screen.height}px`} as CSSProperties;
    return <main className={`live-fullscreen${layout.screen.anchor === "top-left" ? " live-fullscreen--anchor" : ""}${idle ? " is-idle" : ""}`} style={style}>
        <div className="live-area">
            <LiveCanvas layout={layout} event={event} results={results.data} />
            {testing && <LiveScreenTest layout={layout} />}
        </div>
        {results.isError && <div className="live-fullscreen__notice" role="alert">Дані результатів тимчасово недоступні</div>}
        <div className="live-controls" aria-label="Керування екраном">
            {fullscreen.supported && <button type="button" onClick={fullscreen.toggle} title="Клавіша F">{fullscreen.active ? <Minimize size={16} /> : <Maximize size={16} />}{fullscreen.active ? "Вийти з повного екрана" : "На весь екран"}</button>}
            <button type="button" aria-pressed={testing} onClick={() => setTesting(value => !value)} title="Клавіша T"><MonitorCheck size={16} />Тест екрана</button>
            <span>{wakeLabels[wake]}</span>
        </div>
    </main>;
}
