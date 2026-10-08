"use client";

import {useState} from "react";
import type {LabLifecycle} from "@/api/labLifecycle";
import type {LabRuntime} from "@/api/manageLabs";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {EmptyState} from "@/components/ui/EmptyState";
import {BusyMark} from "@/components/ui/EventButton";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {queueLine} from "@/components/event/labLive";
import {t} from "@/i18n/t";
import {hasCurrentRuntime} from "./descriptionValues";
import {labLinkErrorMessage, type LabLinkState} from "./useLabLink";

const svg = (path: React.ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const ICON = {
    x: svg(<path d="M6 6l12 12M18 6L6 18" />),
    dl: svg(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />),
    copy: svg(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
    check: svg(<path d="M5 12.5l4.5 4.5L19 7.5" />),
    ext: svg(<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />),
};

// A web device opens through a fresh short-lived link fetched on click: while it is fetched the row shows the busy mark.
function CopyField({value, onOpen, linkPending = false}: {value: string; onOpen?: () => void; linkPending?: boolean}) {
    const [copied, setCopied] = useState(false);
    return <div className="ib-copy">
        <EventTooltip content={value} className="ib-copy__tip" truncated>{() => <span className="ib-copy__value">{value}</span>}</EventTooltip>
        <button type="button" className={`ib-btn ib-btn--sm ib-copy__btn${copied ? " is-copied" : ""}`} aria-label={t("challenges.copy.ariaFor", {value})} onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
            }).catch(() => {});
        }}>
            <span className="ib-copy__idle">{ICON.copy}{t("challenges.copy.idle")}</span>
            <span className="ib-copy__done">{ICON.check}{t("challenges.copy.done")}</span>
        </button>
        <span className="ib-sr" role="status">{copied ? t("challenges.copy.done") : ""}</span>
        {onOpen && linkPending && <span className="ib-icon-btn ib-icon-btn--sm ib-icon-btn--outline" role="status" aria-label={t("challenges.lab.starting")}><BusyMark /></span>}
        {onOpen && !linkPending && <button type="button" className="ib-icon-btn ib-icon-btn--sm ib-icon-btn--outline" onClick={onOpen} aria-label={t("challenges.host.open")}>{ICON.ext}</button>}
    </div>;
}

export function LabAccessBlock({lab, lifecycle, pending, error, link, busyKey, onOpen, onRetry, onReload}: {
    lab: LabRuntime | undefined; lifecycle: LabLifecycle | null; pending: boolean; error?: unknown;
    link: LabLinkState; busyKey: string | null; onOpen: (device: string, port: number) => void;
    onRetry: () => void; onReload: () => void;
}) {
    // Logical closure is settled even while an older runtime request is outstanding.
    if (lifecycle?.LogicalClosed) return <section className="ib-cmodal__blk">
        <h3>{t("challenges.lab.environment")}</h3>
        <div className="event-cmodal__access-state" role="status"><EmptyState compact message={t(`challenges.lab.closed.${lifecycle.CloseReason ?? "event"}`)} /></div>
    </section>;
    const access = hasCurrentRuntime(lab, lifecycle) ? lab?.Access ?? [] : [];
    const web = access.some(item => /^https?$/i.test(item.Protocol) || !!item.URL);
    return <section className="ib-cmodal__blk">
        <h3>{web ? t("challenges.host.service") : t("challenges.host.connection")}</h3>
        {access.length ? <div className="event-cmodal__hosts">{access.map(item => {
            const value = item.URL || (/^tcp$/i.test(item.Protocol) ? `nc ${item.Device} ${item.Port}` : `${item.Device}:${item.Port}`);
            return <CopyField key={`${item.Device}-${item.Port}`} value={value} onOpen={item.URL ? () => onOpen(item.Device, item.Port) : undefined} linkPending={busyKey === `${item.Device}:${item.Port}`} />;
        })}</div> : <div className="event-cmodal__access-state">
            {error || lifecycle?.RuntimeState === "unavailable"
                ? <EventLoadError error={error} message={t("challenges.host.loadFailed")} onRetry={onReload} />
                : <EventLoading compact message={pending ? t("challenges.host.checking") : queueLine(lab?.Queue) ?? t("challenges.host.preparing")} />}
        </div>}
        {link.status === "error" && <EventLoadError error={link.error} message={labLinkErrorMessage(link.error)} onRetry={onRetry} />}
        {access.length > 0 && <p className="ib-cmodal__hint">{t("challenges.host.viaVpn")}</p>}
    </section>;
}
