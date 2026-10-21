"use client";

import {useEffect, useId, useRef, useState, type ReactNode} from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import {useQuery} from "@tanstack/react-query";
import {CircleAlert, Info, TriangleAlert, X} from "lucide-react";
import {getSiteBanners, type VisibleBanner} from "@/api/siteBanners";
import {getResultsFreeze} from "@/api/manageResults";
import {ManageApiError} from "@/api/manage";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t, tPlural} from "@/i18n/t";
import { keepBrand } from "@/i18n/brand";
import "@/styles/event-site-banners.css";
import {siteBannerDismissedKey} from "@/utils/storageKeys";
import {freezeBannerData} from "@/utils/freezeBanner";
import {nextFreezeBoundary} from "@/utils/resultsFreeze";

export type SiteBannerData = Pick<VisibleBanner, "Text" | "LinkURL" | "LinkLabel" | "Level" | "Dismissible">;

const tones = {info: "info", warning: "warning", critical: "danger"} as const;
const icons = {info: Info, warning: TriangleAlert, critical: CircleAlert} as const;
const priorities = {critical: 0, warning: 1, info: 2} as const;

// Only a site path or an http(s) address may be a banner link.
export function safeBannerLink(url: string): boolean {
    const value = url.trim();
    return (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value);
}

// The banner row of the site: a calm tinted line above the navbar with the text,
// one optional link and (when dismissible) a close button. Purely presentational:
// the shared ds-v2 banner (no left accent border, no shadow), used both by the
// site and by the live preview in the banner editor.
export function SiteBanner({banner, onDismiss, actions}: {banner: SiteBannerData; onDismiss?: () => void; actions?: ReactNode}) {
    const Icon = icons[banner.Level];
    const link = banner.LinkURL.trim();
    const label = keepBrand(banner.LinkLabel.trim() || t("siteBanner.more"));
    return <div className={`ib-banner ib-banner--${tones[banner.Level]}`} role={banner.Level === "critical" ? "alert" : "status"} data-level={banner.Level}>
        <span className="ib-banner__icon"><Icon aria-hidden="true" /></span>
        <div className="ib-banner__text"><span className="ib-banner__msg">{keepBrand(banner.Text)}</span></div>
        {(link && safeBannerLink(link) || actions) && <div className="ib-banner__action">
            {link && safeBannerLink(link) && (link.startsWith("/") ? <Link className="ib-link ib-link--standalone" href={link}>{label}</Link>
                : <a className="ib-link ib-link--standalone" href={link} target="_blank" rel="noopener noreferrer">{label}<span className="ib-sr"> {t("siteBanner.newTab")}</span></a>)}
            {actions}
        </div>}
        {banner.Dismissible && onDismiss && <EventTooltip content={t("siteBanner.dismiss")} silent>{() =>
            <button className="ib-icon-btn ib-icon-btn--sm ib-banner__close" type="button" aria-label={t("siteBanner.dismiss")} onClick={onDismiss}><X aria-hidden="true" /></button>}</EventTooltip>}
    </div>;
}

export const bannerDismissKey = (banner: Pick<VisibleBanner, "ID" | "Version">) => siteBannerDismissedKey(banner.ID, banner.Version);

function isDismissed(banner: VisibleBanner): boolean {
    try {return window.localStorage.getItem(bannerDismissKey(banner)) === "1";} catch {return false;}
}

function rememberDismissal(banner: VisibleBanner) {
    try {window.localStorage.setItem(bannerDismissKey(banner), "1");} catch {/* storage is unavailable: the banner stays hidden until reload */}
}

export const SITE_BANNER_POLL_MS = 60_000;

// The data part: the banners of the event site for the current viewer, polled
// about every minute and again when the tab becomes visible. A dismissed banner
// stays hidden by `${ID}:${Version}`, so an edited banner shows up again.
export function SiteBannerBar({eventID}: {eventID: string}) {
    const query = useQuery({
        queryKey: ["site-banners", eventID], queryFn: () => getSiteBanners(eventID),
        refetchInterval: SITE_BANNER_POLL_MS, refetchOnWindowFocus: true, refetchIntervalInBackground: false, retry: false,
    });
    const freeze = useQuery({
        queryKey: ["event-results-freeze", eventID],
        queryFn: async () => {
            try {return await getResultsFreeze(eventID);}
            catch (error) {
                // Cache the denial as no state: a later transient failure must not revive the old banner.
                if (error instanceof ManageApiError && [401, 403, 404].includes(error.status)) return null;
                throw error;
            }
        },
        refetchInterval: SITE_BANNER_POLL_MS, refetchOnWindowFocus: true, refetchIntervalInBackground: false, retry: false,
    });
    const freezeState = freeze.data;
    const refetchFreeze = freeze.refetch;
    useEffect(() => {
        if (!freezeState?.Enabled) return;
        const delay = nextFreezeBoundary(freezeState, Date.now());
        if (delay === null || delay > 2_147_000_000) return;
        const timer = setTimeout(() => {void refetchFreeze();}, delay + 1000);
        return () => clearTimeout(timer);
    }, [freezeState, refetchFreeze]);
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
    const banners = [...(query.data ?? [])];
    if (freezeState?.Applied) banners.push({ID: `system-results-freeze:${eventID}`, Version: 1, ...freezeBannerData(freezeState)});
    const visible = banners.filter(banner => !(banner.Dismissible && (hidden.has(bannerDismissKey(banner)) || isDismissed(banner))))
        .sort((left, right) => priorities[left.Level] - priorities[right.Level]);
    if (visible.length === 0) return null;
    const dismiss = (banner: VisibleBanner) => {
        rememberDismissal(banner);
        setHidden(current => new Set(current).add(bannerDismissKey(banner)));
    };
    return <div className="ib-banner-stack" data-testid="site-banners">
        <SiteBanner banner={visible[0]} onDismiss={() => dismiss(visible[0])}
            actions={visible.length > 1 ? <OtherAnnouncements banners={visible.slice(1)} onDismiss={dismiss} /> : undefined} />
    </div>;
}

function OtherAnnouncements({banners, onDismiss}: {banners: VisibleBanner[]; onDismiss: (banner: VisibleBanner) => void}) {
    const titleID = useId();
    const titleRef = useRef<HTMLHeadingElement>(null);
    return <Popover.Root modal={false}>
        <Popover.Trigger className="event-announcements-trigger" type="button">{tPlural("siteBanner.moreAnnouncements", banners.length)}</Popover.Trigger>
        <Popover.Portal>
            <Popover.Content className="event-announcements-panel" align="end" side="bottom" sideOffset={8} collisionPadding={16} aria-labelledby={titleID} onOpenAutoFocus={event => {event.preventDefault(); titleRef.current?.focus();}}>
                <h2 ref={titleRef} id={titleID} tabIndex={-1}>{t("siteBanner.others")}</h2>
                {banners.map(banner => <SiteBanner key={bannerDismissKey(banner)} banner={banner} onDismiss={() => onDismiss(banner)} />)}
            </Popover.Content>
        </Popover.Portal>
    </Popover.Root>;
}
