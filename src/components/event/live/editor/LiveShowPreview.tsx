"use client";

import {useEffect, useRef, type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {Maximize, Minimize, X} from "lucide-react";
import type {LiveLayout} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveCanvas} from "../LiveCanvas";
import {useElementSize} from "../LiveParts";
import {useFullscreen} from "../liveScreenHooks";
import {liveSafeArea, liveSafeInsets} from "../liveText";
import type {LiveStage} from "../liveStages";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

export type LivePreviewData = "sample" | "real";

// «Перегляд»: the screen as the hall sees it, over the whole editor window —
// no grid, frames or handles, the clock running, table pages turning and
// logos scrolling. It shows sample data on request (or until the event has
// results), so the screen can be shown before the event. Esc closes it.
export function LiveShowPreview({layout, event, stages, results, sample, nowOffset, data, realAvailable, onData, onClose}: {
    layout: LiveLayout; event: PublicEventInfo; stages?: LiveStage[]; results?: ManageResultsSnapshot; sample: boolean; nowOffset: number;
    data: LivePreviewData; realAvailable: boolean; onData: (data: LivePreviewData) => void; onClose: () => void;
}) {
    const [boxRef, box] = useElementSize<HTMLDivElement>();
    const closeRef = useRef<HTMLButtonElement>(null);
    const fullscreen = useFullscreen();
    const close = useRef(onClose);
    useEffect(() => {close.current = onClose;});
    // Opening focuses «Закрити»; closing leaves the browser full screen and returns the focus.
    useEffect(() => {
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeRef.current?.focus();
        const onKey = (keyEvent: KeyboardEvent) => {
            if (keyEvent.key === "Escape") {keyEvent.preventDefault(); close.current();}
        };
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
            opener?.focus();
        };
    }, []);
    const {width, height} = layout.screen;
    const scale = box.width && box.height ? Math.min(box.width / width, box.height / height) : 0;
    const safe = liveSafeInsets(width, height, liveSafeArea(layout.screen));
    const frameStyle = {width: width * scale, height: height * scale} as CSSProperties;
    const nativeStyle = {width, height, padding: `${safe.y}px ${safe.x}px`, "--live-preview-scale": scale || 1, visibility: scale ? "visible" : "hidden"} as CSSProperties;
    return createPortal(<div className="event-live-show" role="dialog" aria-modal="true" aria-label={t("manage.live.show.title")}>
        <div className="event-live-show__stage" ref={boxRef}>
            <div className="event-live-show__frame" style={frameStyle}>
                <div className={`event-live-editor__native${layout.theme === "light" ? " is-light" : ""}`} style={nativeStyle}>
                    <LiveCanvas layout={layout} event={event} stages={stages} results={results} sample={sample} nowOffset={nowOffset} />
                </div>
            </div>
        </div>
        <div className="live-controls event-live-show__controls">
            <div className="event-live-show__data" role="group" aria-label={t("manage.live.show.data")}>
                {(["sample", "real"] as const).map(value => {
                    const unavailable = value === "real" && !realAvailable;
                    const button = (described?: string) => <button type="button" aria-pressed={data === value} disabled={unavailable} aria-describedby={described} onClick={() => onData(value)}>{t(`manage.live.show.data.${value}`)}</button>;
                    return unavailable ? <EventTooltip key={value} content={t("manage.live.show.noResults")}>{id => <span>{button(id)}</span>}</EventTooltip> : <span key={value}>{button()}</span>;
                })}
            </div>
            {fullscreen.supported && <button type="button" onClick={fullscreen.toggle}>{fullscreen.active ? <Minimize size={16} /> : <Maximize size={16} />}{fullscreen.active ? t("live.exitFullscreen") : t("live.enterFullscreen")}</button>}
            <button type="button" ref={closeRef} onClick={onClose} aria-keyshortcuts="Escape"><X size={16} />{t("manage.live.show.close")}</button>
        </div>
    </div>, document.body);
}
