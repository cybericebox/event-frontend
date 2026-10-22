"use client";

import {useCallback, useEffect, useState, type CSSProperties, type ReactNode} from "react";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CircleHelp, Maximize, Minimize, MonitorCheck} from "lucide-react";
import {getLiveLayoutVersion, getPublishedLiveLayout, LiveScreenLinkError, type LiveLayout, type LiveScreenByLink} from "@/api/manageLive";
import {getManageStages} from "@/api/manageStages";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "./LiveCanvas";
import {liveFormatLayout, pickLiveFormat} from "./liveFormats";
import {useLiveResults} from "./useLiveResults";
import {useFullscreen, useIdle, useWakeLock, useWindowSize, type WakeLockState} from "./liveScreenHooks";
import {useLiveConnection, useLiveRetry} from "./liveRecovery";
import {liveSafeArea, liveSafeInsets, liveTextFloors, liveTextProfile} from "./liveText";
import type {LiveStage} from "./liveStages";
import {liveSceneLayout, liveSceneState, type LiveSceneKey} from "./liveScenes";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {ErrorPage} from "@/components/event/ErrorPage";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {whiteTextContrast} from "@/components/event/manage/deriveTheme";
import {ManageApiError} from "@/api/manage";
import {SignInRedirect} from "@/components/event/SignInRedirect";
import {NoAccessScreen} from "@/components/event/NoAccessScreen";

// A full-screen state of the live screen (loading, error, closed link): the
// event colour behind it, as on the screen itself, and large enough to read
// from the hall.
export function LiveState({event, children}: {event?: PublicEventInfo | null; children: ReactNode}) {
    const light = !!event && (whiteTextContrast(event.Theme.Brand) ?? 21) < 4.5;
    return <main className="live-fullscreen live-fullscreen--state" data-theme={light ? "light" : "dark"}>{children}</main>;
}

// A failed load: the shared error block, retried by itself. `retryIn` is the
// seconds before the next try (0 while it runs).
export function LiveFailure({event, message, error, retryIn, onRetry}: {event?: PublicEventInfo | null; message: string; error: unknown; retryIn: number | null; onRetry: () => void}) {
    const hint = retryIn ? t("live.retry.in", {seconds: retryIn}) : t("live.retry.now");
    return <LiveState event={event}><EventLoadError message={message} error={error} hint={hint} onRetry={onRetry} /></LiveState>;
}

// The screen link no longer works: the shared error page, no sign-in offer
// and no button (the projector PC is not meant to sign in).
// Before any event data arrived the screen has no event colours: it uses the
// platform's neutral error page (crest in the footer) instead of a half-themed one.
export function LiveLinkClosed({event}: {event?: PublicEventInfo | null}) {
    if (!event) return <LiveNeutralPage code={403} title={t("live.link.closedTitle")} text={t("live.link.closedText")} />;
    return <LiveState event={event}><ErrorPage mode="block" role="alert" code={403} title={t("live.link.closedTitle")} text={t("live.link.closedText")} /></LiveState>;
}

// The link answers «not found»: the event does not exist or is not published
// yet. One message for both, as for any event the visitor cannot open, and no
// visible retry: the screen re-checks quietly and opens once it is published.
export function LiveLinkNotFound() {
    return <LiveNeutralPage code={404} title={[t("live.link.notFound.line1"), t("live.link.notFound.line2")]} text={t("live.link.notFound.body")} />;
}

function LiveNeutralPage({code, title, text}: {code: number; title: string | [string, string]; text: string}) {
    const documentTitle = typeof title === "string" ? title : title.join(" ");
    useEffect(() => {document.title = documentTitle;}, [documentTitle]);
    return <div className="live-neutral"><ErrorPage mode="page" role="alert" platformBrand code={code} title={title} text={text} /></div>;
}

const wakeLabel = (state: WakeLockState) => t(`live.wake.${state}`);

// 401 or 403 of a moderator's read: the session or the rights are gone.
function staffDenied(error: unknown): 401 | 403 | null {
    const status = error instanceof ManageApiError ? error.status : 0;
    return status === 401 || status === 403 ? status : null;
}

// Screen test (LIVE-CONSTRUCTOR §2): the frame marks the edges of the render
// area, so a video processor's crop is visible; the dashed lines mark 5% and
// the chosen safe area; the panel shows the actual window size and the text
// floors of the screen.
function LiveScreenTest({layout}: {layout: LiveLayout}) {
    const size = useWindowSize();
    const [windowSize, ratio] = size.split("@");
    const anchored = layout.screen.anchor === "top-left";
    const area = anchored ? `${layout.screen.width}×${layout.screen.height}` : windowSize;
    const floors = liveTextFloors[liveTextProfile(layout.screen)];
    const safe = liveSafeArea(layout.screen);
    return <div className="live-test" role="status" aria-label={t("live.test.title")}>
        <span className="live-test__corner">0,0</span><span className="live-test__corner">{area.split("×")[0]}</span><span className="live-test__corner">{area.split("×")[1]}</span><span className="live-test__corner">{area}</span>
        <span className="live-test__safe" style={{inset: "5%"}} aria-hidden="true"><b>{t("live.test.safeLine", {value: 5})}</b></span>
        {safe > 0 && safe !== 5 && <span className="live-test__safe" style={{inset: `${safe}%`}} aria-hidden="true"><b>{t("live.test.safeLine", {value: safe.toLocaleString("uk-UA")})}</b></span>}
        <div className="live-test__panel">
            <strong>{area}</strong>
            <dl>
                <dt>{t("live.test.window")}</dt><dd>{t("live.test.px", {size: windowSize})}</dd>
                <dt>{t("live.test.density")}</dt><dd>{ratio ? t("live.test.ratio", {ratio}) : t("live.test.unknown")}</dd>
                <dt>{t("live.test.layout")}</dt><dd>{t("live.test.layoutValue", {size: `${layout.screen.width}×${layout.screen.height}`, anchor: anchored ? t("live.test.anchorTopLeft") : t("live.test.anchorFull")})}</dd>
                <dt>{t("live.test.grid")}</dt><dd>{t("live.test.gridValue", {cols: layout.grid.cols, rows: layout.grid.rows, scale: Math.round(layout.screen.textScale * 100)})}</dd>
                <dt>{t("live.test.safe")}</dt><dd>{t("live.test.safeValue", {value: safe.toLocaleString("uk-UA")})}</dd>
            </dl>
            <div className="live-test__samples">
                <span style={{fontSize: floors.caption}}>{t("live.test.sampleCaption", {size: floors.caption})}</span>
                <span style={{fontSize: floors.body}}>{t("live.test.sampleBody", {size: floors.body})}</span>
                <span style={{fontSize: floors.timer}}>{t("live.test.sampleTimer", {size: floors.timer})}</span>
            </div>
        </div>
    </div>;
}

// Burn-in guard for LED, OLED and plasma screens: the canvas moves by 2 px
// every 10 minutes, so no edge stays lit at the same pixels all day.
const burnInSteps = [[0, 0], [2, 0], [2, 2], [0, 2]] as const;
function useBurnInShift(enabled: boolean): readonly [number, number] {
    const [step, setStep] = useState(0);
    useEffect(() => {
        if (!enabled) return;
        const update = () => setStep(Math.floor(Date.now() / 600_000) % burnInSteps.length);
        queueMicrotask(update);
        const timer = setInterval(update, 60_000);
        return () => clearInterval(timer);
    }, [enabled]);
    return enabled ? burnInSteps[step] : burnInSteps[0];
}

// The event state the scene follows, checked once a second. Only a change of
// the state re-renders the screen (the canvas keeps its own clock); null
// until the first check, so no scene is picked before the time is known.
// `serverNow`: a server-rendered first paint already shows the state's screen.
function useLiveSceneState(event: PublicEventInfo, freeze: Parameters<typeof liveSceneState>[1], serverNow?: number): LiveSceneKey | null {
    const [state, setState] = useState<LiveSceneKey | null>(() => serverNow ? liveSceneState(event, freeze, serverNow) : null);
    useEffect(() => {
        const update = () => setState(liveSceneState(event, freeze, Date.now()));
        queueMicrotask(update);
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [event, freeze]);
    return state;
}

// Two ways in, both showing the staff live board: a moderator signed in
// (the layout through the management API, works before publication, a light
// version check reloads it on publish), or a screen link `token` for a
// projector PC that is not signed in (`link`: the event, the published
// layout and the stages, re-read by the bootstrap every 30 s). The staff
// screen re-reads the stages every 30 s and the bootstrap the event, so a
// moved start or finish reaches the timer without a reload.
// `serverNow`: the server's clock of the first HTML, so the timers in it read right before the browser's clock runs.
export function LiveScreen({event, token, link, serverNow}: {event: PublicEventInfo; token?: string; link?: LiveScreenByLink; serverNow?: number}) {
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const staff = !token;
    // A moderator opens one of the event's screens with ?screen=<id>; without it, the first one.
    const [screenID] = useState(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("screen"));
    const layoutQuery = useQuery({
        queryKey: ["event-live-screen-layout", eventID, screenID], queryFn: () => getPublishedLiveLayout(eventID, screenID),
        enabled: staff, retry: false, refetchOnWindowFocus: false,
    });
    // A light version check replaces reloading the whole layout every 15 s.
    const version = useQuery({queryKey: ["event-live-screen-version", eventID, screenID], queryFn: () => getLiveLayoutVersion(eventID, screenID), retry: false, refetchInterval: 15000, enabled: staff && layoutQuery.isSuccess});
    useEffect(() => {
        if (version.data !== undefined && layoutQuery.data && version.data !== layoutQuery.data.version) void queryClient.invalidateQueries({queryKey: ["event-live-screen-layout", eventID, screenID]});
    }, [version.data, layoutQuery.data, queryClient, eventID, screenID]);
    const stagesQuery = useQuery({
        queryKey: ["event-management-stages", eventID], queryFn: () => getManageStages(eventID),
        enabled: staff, retry: false, refetchOnWindowFocus: false, refetchInterval: 30000,
    });
    const base = staff ? layoutQuery.data : link?.Layout;
    const stages: LiveStage[] = (staff ? stagesQuery.data : link?.Stages) ?? [];
    const refreshSeconds = base?.refreshSeconds ?? 10;
    const {results, stream} = useLiveResults(eventID, !!base, {token, refreshSeconds});
    const closed = !!token && results.error instanceof LiveScreenLinkError && results.error.status === 403;
    // The moderator's session ended or their rights were taken: sign in or «no access», no retries.
    const denied = staff ? staffDenied(layoutQuery.data ? null : layoutQuery.error) ?? staffDenied(results.error) : null;
    const layoutRetryIn = useLiveRetry(staff && layoutQuery.isError && !layoutQuery.data && !denied, layoutQuery.errorUpdatedAt, () => void layoutQuery.refetch());
    // A failed snapshot is retried with or without older data: while the
    // stream stays open no new change may come to reload it (a freeze holds
    // back the others' solves), so waiting for one would keep it stale.
    const resultsRetryIn = useLiveRetry(results.isError && !closed && !denied, results.errorUpdatedAt, () => void results.refetch());
    // Live while the stream is open or its fallback polls succeed, and the
    // last snapshot load did too.
    const lostAt = useLiveConnection(!results.isError && stream !== "connecting", refreshSeconds);
    // The shape of the window picks the layout: the nearest saved format.
    const windowSize = useWindowSize();
    const fullscreen = useFullscreen();
    const wake = useWakeLock(true);
    const idle = useIdle(3000);
    const [testing, setTesting] = useState(false);
    const shift = useBurnInShift(!!base && base.screen.anchor !== "top-left");
    const sceneState = useLiveSceneState(event, results.data?.Freeze, serverNow);
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
    if (closed) return <LiveLinkClosed event={event} />;
    if (denied === 401) return <SignInRedirect event={event} />;
    if (denied === 403) return <NoAccessScreen title={t("live.forbidden.title")} homeHref="/" />;
    if (staff && layoutQuery.isError && !layoutQuery.data) return <LiveFailure event={event} message={t("live.loadFailed")} error={layoutQuery.error} retryIn={layoutRetryIn} onRetry={() => void layoutQuery.refetch()} />;
    if (results.isError && !results.data) return <LiveFailure event={event} message={t("live.resultsUnavailable")} error={results.error} retryIn={resultsRetryIn} onRetry={() => void results.refetch()} />;
    if (!base || !sceneState) return <LiveState event={event}><EventLoading event={event} label={t("live.loading")} /></LiveState>;
    const [windowWidth, windowHeight] = windowSize.split("@")[0].split("×").map(Number);
    // Scenes: before the start, running, frozen, finished — each its own
    // canvas when the layout has one, else the running board.
    const scene = liveSceneLayout(base, sceneState);
    const layout = scene.screen.anchor === "top-left" ? scene : liveFormatLayout(scene, pickLiveFormat(scene, windowWidth / windowHeight));
    const anchored = layout.screen.anchor === "top-left";
    // «Безпечне поле»: the canvas keeps clear of the edges a TV crops.
    const safe = liveSafeInsets(anchored ? layout.screen.width : windowWidth || 0, anchored ? layout.screen.height : windowHeight || 0, liveSafeArea(layout.screen));
    const style = {"--live-screen-width": `${layout.screen.width}px`, "--live-screen-height": `${layout.screen.height}px`} as CSSProperties;
    const areaStyle = {padding: `${safe.y}px ${safe.x}px`, transform: shift[0] || shift[1] ? `translate(${shift[0]}px, ${shift[1]}px)` : undefined} as CSSProperties;
    return <main className={`live-fullscreen live-fullscreen--${layout.theme}${anchored ? " live-fullscreen--anchor" : ""}${idle ? " is-idle" : ""}`} style={style}>
        <div className="live-area" style={areaStyle}>
            <LiveCanvas layout={layout} event={event} stages={stages} results={results.data} offlineSince={lostAt} startClock={serverNow} />
            {testing && <LiveScreenTest layout={layout} />}
        </div>
        <div className="live-controls" aria-label={t("live.controls")}>
            {fullscreen.supported && <EventTooltip content={t("live.keyF")}>{id => <button type="button" onClick={fullscreen.toggle} aria-keyshortcuts="F" aria-describedby={id}>{fullscreen.active ? <Minimize size={16} /> : <Maximize size={16} />}{fullscreen.active ? t("live.exitFullscreen") : t("live.enterFullscreen")}</button>}</EventTooltip>}
            <EventTooltip content={t("live.keyT")}>{id => <button type="button" aria-pressed={testing} onClick={() => setTesting(value => !value)} aria-keyshortcuts="T" aria-describedby={id}><MonitorCheck size={16} />{t("live.test.title")}</button>}</EventTooltip>
            <span className="live-controls__wake">{wakeLabel(wake)}{(wake === "denied" || wake === "unsupported") && <EventTooltip help content={t(`live.wake.${wake}Help`)}>{id => <button type="button" className="live-controls__help" aria-label={t(`live.wake.${wake}Help`)} aria-describedby={id}><CircleHelp size={16} aria-hidden="true" /></button>}</EventTooltip>}</span>
        </div>
    </main>;
}
