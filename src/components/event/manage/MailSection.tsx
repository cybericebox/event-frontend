"use client";

import {useState} from "react";
import {t} from "@/i18n/t";
import {MailJournal} from "./MailJournal";
import {MailSettingsPanel} from "./MailSettingsPanel";
import {mailTabFromParam, mailTabHref, mailTabs, type MailTab} from "./mailTabs";

export function MailSection({initialTab}: {initialTab: string | undefined}) {
    const [tab, setTab] = useState<MailTab>(mailTabFromParam(initialTab));

    function change(value: MailTab) {
        setTab(value);
        window.history.replaceState(null, "", mailTabHref(value));
    }

    return <div className="event-manage-settings event-manage-mail">
        <header className="event-manage-heading"><div><h1>{t("manage.mail.title")}</h1><p>{t("manage.mail.subtitle")}</p></div></header>
        <div className="event-manage-participants__filters" role="tablist" aria-label={t("manage.mail.sectionsLabel")}>{mailTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => change(option.value)}>{option.label}</button>)}</div>
        <div role="tabpanel">{tab === "settings" ? <MailSettingsPanel /> : <MailJournal />}</div>
    </div>;
}
