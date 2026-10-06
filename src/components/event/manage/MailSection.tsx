"use client";

import {t} from "@/i18n/t";
import {MailSettingsPanel} from "./MailSettingsPanel";

export function MailSection() {
    return <div className="event-manage-settings event-manage-mail">
        <header className="event-manage-heading"><div><h1>{t("manage.mail.title")}</h1><p>{t("manage.mail.subtitle")}</p></div></header>
        <MailSettingsPanel />
    </div>;
}
