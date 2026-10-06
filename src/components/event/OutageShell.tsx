"use client";

import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventBrandLogo} from "./EventBrandLogo";
import {ThemeToggle} from "./ThemeToggle";
import {t} from "@/i18n/t";

// The shell frame without data, shown while the API is unreachable: the guest
// navbar, or the /manage sidebar and top bar, around an empty content area. The
// outage modal sits on top of it. Without event data it carries the platform
// crest and name.
export function OutageShell({manage = false, event = null}: {manage?: boolean; event?: PublicEventInfo | null}) {
    const name = event?.Name || t("meta.brand");
    if (manage) {
        return <div className="event-manage-frame">
            <div className="ib-admin-shell event-manage-shell">
                <div className="ib-admin-shell__layout">
                    <aside className="ib-admin-side ib-mass" aria-label={t("manage.nav.eventManagement")}>
                        <div className="ib-admin-side__head">
                            <span className="event-manage-brand"><EventBrandLogo event={event} className="ib-admin-side__crest" /><div className="ib-admin-side__title"><b>{name}</b><small>{t("manage.nav.eventManagement")}</small></div></span>
                        </div>
                    </aside>
                    <div className="ib-admin-shell__main">
                        <header className="ib-topbar"><div className="ib-topbar__actions"><ThemeToggle /></div></header>
                        <main id="main" tabIndex={-1} className="ib-admin-shell__scroll" />
                    </div>
                </div>
            </div>
        </div>;
    }
    return <div className="event-guest-shell">
        <header className="ib-navbar event-navbar">
            <div className="ib-navbar__bar">
                <span className="ib-navbar__brand"><EventBrandLogo event={event} className="ib-navbar__crest" /><span className="ib-navbar__name">{name}</span></span>
                <nav className="ib-navbar__nav" aria-label={t("nav.sections")} />
                <div className="ib-navbar__actions"><div className="event-header-theme event-header-theme--desktop"><ThemeToggle /></div></div>
            </div>
        </header>
        <main id="main" tabIndex={-1} className="event-guest-main" />
    </div>;
}
