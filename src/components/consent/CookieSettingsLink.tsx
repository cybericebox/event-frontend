"use client";

import {t} from "@/i18n/t";
import {interceptSettingsLink} from "@/utils/consent";
import {mainOrigin} from "@/utils/origins";

// The Cookie Policy lives on the main site.
export const COOKIE_POLICY_HREF = `${mainOrigin}/cookies`;

// «Налаштування файлів cookie» in the event footer, always shown: a link to the cookie policy that,
// with JS, opens the consent preferences panel instead (see utils/consent).
export function CookieSettingsLink() {
    return <a href={COOKIE_POLICY_HREF} className="cb-consent-link" onClick={interceptSettingsLink}>{t("consent.settings")}</a>;
}
