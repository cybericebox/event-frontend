"use client";

import {t} from "@/i18n/t";
import {MailSettingsPanel} from "./MailSettingsPanel";
import {mailTabs} from "./mailTabs";

export function MailSection() {
    return <div className="event-manage-settings event-manage-mail">
        <header className="event-manage-heading"><div><h1>{t("manage.mail.title")}</h1><p>{t("manage.mail.subtitle")}</p></div></header>
        <div className="event-manage-participants__filters" role="tablist" aria-label={t("manage.mail.sectionsLabel")}>{mailTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected>{option.label}</button>)}</div>
        <div role="tabpanel"><MailSettingsPanel /></div>
    </div>;
}
