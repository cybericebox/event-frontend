"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {CircleAlert, Info, TriangleAlert, X} from "lucide-react";
import {getSiteBanners, type VisibleBanner} from "@/api/siteBanners";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import { keepBrand } from "@/i18n/brand";

export type SiteBannerData = Pick<VisibleBanner, "Text" | "LinkURL" | "LinkLabel" | "Level" | "Dismissible">;

const tones = {info: "info", warning: "warning", critical: "danger"} as const;
const icons = {info: Info, warning: TriangleAlert, critical: CircleAlert} as const;

// Only a site path or an http(s) address may be a banner link.
export function safeBannerLink(url: string): boolean {
    const value = url.trim();
    return (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value);
}

// The banner row of the site: a calm tinted line under the navbar with the text,
// one optional link and (when dismissible) a close button. Purely presentational:
// the shared ds-v2 banner (no left accent border, no shadow), used both by the
// site and by the live preview in the banner editor.
export function SiteBanner({banner, onDismiss}: {banner: SiteBannerData; onDismiss?: () => void}) {
    const Icon = icons[banner.Level];
    const link = banner.LinkURL.trim();
    const label = keepBrand(banner.LinkLabel.trim() || t("siteBanner.more"));
    return <div className={`ib-banner ib-banner--${tones[banner.Level]}`} role={banner.Level === "critical" ? "alert" : "status"} data-level={banner.Level}>
        <span className="ib-banner__icon"><Icon aria-hidden="true" /></span>
        <div className="ib-banner__text"><span className="ib-banner__msg">{keepBrand(banner.Text)}</span></div>
        {link && safeBannerLink(link) && <div className="ib-banner__action">
            {link.startsWith("/") ? <Link className="ib-link ib-link--standalone" href={link}>{label}</Link>
                : <a className="ib-link ib-link--standalone" href={link} target="_blank" rel="noopener noreferrer">{label}<span className="ib-sr"> {t("siteBanner.newTab")}</span></a>}
        </div>}
        {banner.Dismissible && onDismiss && <EventTooltip content={t("siteBanner.dismiss")} silent>{() =>
            <button className="ib-icon-btn ib-icon-btn--sm ib-banner__close" type="button" aria-label={t("siteBanner.dismiss")} onClick={onDismiss}><X aria-hidden="true" /></button>}</EventTooltip>}
    </div>;
}

const STORAGE_PREFIX = "site-banner-dismissed:";
export const bannerDismissKey = (banner: Pick<VisibleBanner, "ID" | "Version">) => `${banner.ID}:${banner.Version}`;

function isDismissed(banner: VisibleBanner): boolean {
    try {return window.localStorage.getItem(STORAGE_PREFIX + bannerDismissKey(banner)) === "1";} catch {return false;}
}

function rememberDismissal(banner: VisibleBanner) {
    try {window.localStorage.setItem(STORAGE_PREFIX + bannerDismissKey(banner), "1");} catch {/* storage is unavailable: the banner stays hidden until reload */}
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
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
    const visible = (query.data ?? []).filter(banner => !(banner.Dismissible && (hidden.has(bannerDismissKey(banner)) || isDismissed(banner))));
    if (visible.length === 0) return null;
    return <div className="ib-banner-stack" data-testid="site-banners">
        {visible.map(banner => <SiteBanner key={bannerDismissKey(banner)} banner={banner} onDismiss={() => {
            rememberDismissal(banner);
            setHidden(current => new Set(current).add(bannerDismissKey(banner)));
        }} />)}
    </div>;
}
