"use client";

import {FeedbackLink} from "@/components/FeedbackLink";
import {CookieSettingsLink} from "@/components/consent/CookieSettingsLink";
import {t} from "@/i18n/t";
import {PlatformCredit} from "./PlatformCredit";
import {EventRichTextView} from "./content/EventRichTextView";
import {richTextHasContent, type ContentRichText} from "./content/richTextState";
import {ThemeToggle} from "./ThemeToggle";

// The event site footer: platform credit and cookie settings on the left, the theme switch on the right
// (the same placement as the platform and ID footers).
export function EventFooter({eventName, signature, showTheme = true}: {eventName?: string; signature?: ContentRichText | null; showTheme?: boolean}) {
    return <footer className="ib-footer ib-footer--event"><div className="ib-footer__inner"><div className="ib-footer__row">
        <div className="ib-footer__org">{richTextHasContent(signature) ? <div className="ib-footer__signature"><EventRichTextView value={signature} /></div> : <PlatformCredit />}</div>
        <div className="ib-footer__end">
            <nav className="ib-footer__links" aria-label={t("shell.footerLinks")}><CookieSettingsLink /><FeedbackLink app={eventName ? t("feedback.appEvent", {name: eventName}) : undefined} /></nav>
            {showTheme && <ThemeToggle />}
        </div>
    </div></div></footer>;
}
