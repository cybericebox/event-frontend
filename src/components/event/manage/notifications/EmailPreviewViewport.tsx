"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";
import {Monitor, Smartphone, Tablet} from "lucide-react";
import {t} from "@/i18n/t";

const viewports = [
    {key: "desktop", width: 1024, icon: Monitor},
    {key: "tablet", width: 768, icon: Tablet},
    {key: "mobile", width: 390, icon: Smartphone},
] as const;

// Scale the sheet, not its viewport: media queries and wrapping still see the
// selected device width, while the iframe scrolls inside the available canvas.
export function EmailPreviewViewport({html, children}: {html?: string; children?: ReactNode}) {
    const [device, setDevice] = useState<(typeof viewports)[number]["key"]>("desktop");
    const canvas = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({width: 0, height: 0});
    useEffect(() => {
        const element = canvas.current;
        if (!element) return;
        const update = (width: number, height: number) => setBox(previous => previous.width === width && previous.height === height ? previous : {width, height});
        const bounds = element.getBoundingClientRect();
        update(bounds.width, bounds.height);
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(entries => {
            const rect = entries[0]?.contentRect;
            if (rect) update(rect.width, rect.height);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const width = viewports.find(viewport => viewport.key === device)!.width;
    const scale = box.width > 0 ? Math.min(1, box.width / width) : 1;
    const height = box.height || 560;
    return <>
        <div className="event-email-preview__toolbar">
            <div className="ib-seg ib-seg--sm" role="group" aria-label={t("manage.email.viewport.label")}>
                {viewports.map(({key, width, icon: Icon}) => <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)}>
                    <Icon size={16} aria-hidden="true" />{t(`manage.email.viewport.${key}`)}
                    <span className="event-email-preview__width" aria-hidden="true">{width}</span>
                </button>)}
            </div>
            <span className="event-email-preview__dimensions" role="status">{t("manage.email.viewport.width", {width})}</span>
        </div>
        <div ref={canvas} className="event-email-preview__canvas">
            {html !== undefined ? <div className="event-email-preview__viewport" style={{width: width * scale, height}}>
                <iframe title={t("manage.email.previewFrame")} sandbox="" srcDoc={html} width={width}
                    style={{width, height: height / scale, transform: `scale(${scale})`, transformOrigin: "top left"}} />
            </div> : children}
        </div>
    </>;
}
