"use client";

import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Maximize, Minimize, MonitorCheck} from "lucide-react";
import {getLiveLayoutVersion, getLiveScreenByLink, getPublishedLiveLayout, LiveScreenLinkError, type LiveLayout} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "./LiveCanvas";
import {liveFormatLayout, pickLiveFormat} from "./liveFormats";
import {useLiveResults} from "./useLiveResults";
import {useFullscreen, useIdle, useWakeLock, useWindowSize, type WakeLockState} from "./liveScreenHooks";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {EventTooltip} from "@/components/ui/EventTooltip";

// The screen link no longer works: a full-screen state, no sign-in offer
// (the projector PC is not meant to sign in).
export function LiveLinkClosed() {
    return <main className="live-fullscreen"><div className="live-fullscreen__state" role="alert"><h1>{t("live.link.closedTitle")}</h1><p>{t("live.link.closedText")}</p></div></main>;
}

const wakeLabel = (state: WakeLockState) => t(`live.wake.${state}`);

// Screen test (LIVE-CONSTRUCTOR §2): the frame marks the edges of the render
// area, so a video processor's crop is visible; the panel shows the actual
// window size and the LED text samples.
function LiveScreenTest({layout}: {layout: LiveLayout}) {
    const size = useWindowSize();
    const [windowSize, ratio] = size.split("@");
    const anchored = layout.screen.anchor === "top-left";
    const area = anchored ? `${layout.screen.width}×${layout.screen.height}` : windowSize;
    return <div className="live-test" role="status" aria-label={t("live.test.title")}>
        <span className="live-test__corner">0,0</span><span className="live-test__corner">{area.split("×")[0]}</span><span className="live-test__corner">{area.split("×")[1]}</span><span className="live-test__corner">{area}</span>
        <div className="live-test__panel">
            <strong>{area}</strong>
            <dl>
                <dt>{t("live.test.window")}</dt><dd>{windowSize} px</dd>
                <dt>{t("live.test.density")}</dt><dd>{ratio ? `×${ratio}` : "—"}</dd>
                <dt>{t("live.test.layout")}</dt><dd>{layout.screen.width}×{layout.screen.height} · {anchored ? t("live.test.anchorTopLeft") : t("live.test.anchorFull")}</dd>
                <dt>{t("live.test.grid")}</dt><dd>{t("live.test.gridValue", {cols: layout.grid.cols, rows: layout.grid.rows, scale: Math.round(layout.screen.textScale * 100)})}</dd>
            </dl>
            <div className="live-test__samples">
                <span style={{fontSize: 14}}>{t("live.test.sampleCaption")}</span>
                <span style={{fontSize: 20}}>{t("live.test.sampleBody")}</span>
                <span style={{fontSize: 34}}>{t("live.test.sampleTimer")}</span>
            </div>
        </div>
    </div>;
}

// Two ways in, both showing the staff live board: a moderator signed in
// (the layout through the management API, works before publication, a light
// version check reloads it on publish), or a screen link `token` for a
// projector PC that is not signed in (the link endpoint returns the event and
// the published layout; it is re-read every 30 s to pick up a publish).
export function LiveScreen({event, token, initialLayout}: {event: PublicEventInfo; token?: string; initialLayout?: LiveLayout}) {
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const layoutQuery = useQuery({
        queryKey: ["event-live-screen-layout", eventID, token ? "link" : "staff"],
        queryFn: async () => token ? (await getLiveScreenByLink(token)).Layout : getPublishedLiveLayout(eventID),
        initialData: initialLayout, retry: false, refetchOnWindowFocus: false, refetchInterval: token ? 30000 : false,
    });
    // A light version check replaces reloading the whole layout every 15 s.
    const version = useQuery({queryKey: ["event-live-screen-version", eventID], queryFn: () => getLiveLayoutVersion(eventID), retry: false, refetchInterval: 15000, enabled: !token && layoutQuery.isSuccess});
    useEffect(() => {
        if (version.data !== undefined && layoutQuery.data && version.data !== layoutQuery.data.version) void queryClient.invalidateQueries({queryKey: ["event-live-screen-layout", eventID]});
    }, [version.data, layoutQuery.data, queryClient, eventID]);
    const {results} = useLiveResults(eventID, layoutQuery.isSuccess, {token, refreshSeconds: layoutQuery.data?.refreshSeconds});
    // The shape of the window picks the layout: the nearest saved format.
    const windowSize = useWindowSize();
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
        // eslint-disable-next-line no-restricted-syntax -- the same physical key on the Ukrainian layout, not UI text
        if (keyEvent.key === "f" || keyEvent.key === "а") toggleFullscreen();
        // eslint-disable-next-line no-restricted-syntax -- the same physical key on the Ukrainian layout, not UI text
        if (keyEvent.key === "t" || keyEvent.key === "е") setTesting(value => !value);
    }, [toggleFullscreen]);
    useEffect(() => {
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onKey]);

    // A link revoked or expired while the screen is open.
    if (token && (layoutQuery.error ?? results.error) instanceof LiveScreenLinkError && ((layoutQuery.error ?? results.error) as LiveScreenLinkError).status === 403) return <LiveLinkClosed />;
    if (layoutQuery.isError) return <main className="live-fullscreen"><EventLoadError message={t("live.loadFailed")} onRetry={() => void layoutQuery.refetch()} /></main>;
    if (!layoutQuery.data) return <main className="live-fullscreen"><EventLoading event={event} label={t("live.loading")} /></main>;
    const base = layoutQuery.data;
    const [windowWidth, windowHeight] = windowSize.split("@")[0].split("×").map(Number);
    const layout = base.screen.anchor === "top-left" ? base : liveFormatLayout(base, pickLiveFormat(base, windowWidth / windowHeight));
    const style = {"--live-screen-width": `${layout.screen.width}px`, "--live-screen-height": `${layout.screen.height}px`} as CSSProperties;
    return <main className={`live-fullscreen${layout.screen.anchor === "top-left" ? " live-fullscreen--anchor" : ""}${idle ? " is-idle" : ""}`} style={style}>
        <div className="live-area">
            <LiveCanvas layout={layout} event={event} results={results.data} />
            {testing && <LiveScreenTest layout={layout} />}
        </div>
        {results.isError && <div className="live-fullscreen__notice" role="alert">{t("live.resultsUnavailable")}</div>}
        <div className="live-controls" aria-label={t("live.controls")}>
            {fullscreen.supported && <EventTooltip content={t("live.keyF")}>{id => <button type="button" onClick={fullscreen.toggle} aria-keyshortcuts="F" aria-describedby={id}>{fullscreen.active ? <Minimize size={16} /> : <Maximize size={16} />}{fullscreen.active ? t("live.exitFullscreen") : t("live.enterFullscreen")}</button>}</EventTooltip>}
            <EventTooltip content={t("live.keyT")}>{id => <button type="button" aria-pressed={testing} onClick={() => setTesting(value => !value)} aria-keyshortcuts="T" aria-describedby={id}><MonitorCheck size={16} />{t("live.test.title")}</button>}</EventTooltip>
            <span>{wakeLabel(wake)}</span>
        </div>
    </main>;
}
