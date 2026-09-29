"use client";

import {t} from "@/i18n/t";
import {openConsentSettings} from "@/utils/consent";

// «Налаштування файлів cookie» in the event footer: reopens the consent banner. Renders nothing when GA is not configured.
export function CookieSettingsButton() {
    if (!process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) return null;
    return <button type="button" className="cb-consent-link" onClick={openConsentSettings}>{t("consent.settings")}</button>;
}
