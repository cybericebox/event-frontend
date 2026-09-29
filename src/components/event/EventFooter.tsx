"use client";

import {CookieSettingsLink} from "@/components/consent/CookieSettingsLink";
import {t} from "@/i18n/t";
import {PlatformCredit} from "./PlatformCredit";
import {ThemeToggle} from "./ThemeToggle";

// The event site footer: platform credit and cookie settings on the left, the theme switch on the right
// (the same placement as the platform and ID footers).
export function EventFooter() {
    return <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row">
        <span className="ib-footer__org"><PlatformCredit /></span>
        <div className="ib-footer__end">
            <nav className="ib-footer__links" aria-label={t("shell.footerLinks")}><CookieSettingsLink /></nav>
            <ThemeToggle />
        </div>
    </div></div></footer>;
}
