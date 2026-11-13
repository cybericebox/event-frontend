"use client";

import {t} from "@/i18n/t";
import {interceptSettingsLink} from "@/utils/consent";

// The Cookie Policy link (NEXT_PUBLIC_COOKIES_URL; empty = none). The settings links that use it open the consent panel on click, so with the
// setting empty they stay links and only lose their target (an image gives them an empty href, `next dev` without the variable none).
export const COOKIE_POLICY_HREF = process.env.NEXT_PUBLIC_COOKIES_URL;

// «Налаштування файлів cookie» in the event footer, always shown: a link to the cookie policy that,
// with JS, opens the consent preferences panel instead (see utils/consent).
export function CookieSettingsLink() {
    return <a href={COOKIE_POLICY_HREF} data-manual-draft-navigation className="cb-consent-link" onClick={interceptSettingsLink}>{t("consent.settings")}</a>;
}
