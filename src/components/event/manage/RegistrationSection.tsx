"use client";

import {useState} from "react";
import {ExtraFieldsEditor} from "./ExtraFieldsEditor";
import {RegistrationSettings} from "./RegistrationSettings";
import {registrationTabFromParam, registrationTabHref, registrationTabs, type RegistrationTab} from "./registrationTabs";
import {useManager} from "./ManagerShell";
import {ManageTabs, manageTabID, manageTabPanelID} from "./ManageTabs";
import {t} from "@/i18n/t";

export function RegistrationSection({initialTab}: {initialTab: string | undefined}) {
    const {event} = useManager();
    const teamMode = event.Participation === 1;
    const [selected, setSelected] = useState<string | undefined>(initialTab);
    const tab = registrationTabFromParam(selected, teamMode);

    function change(value: RegistrationTab) {
        setSelected(value);
        window.history.replaceState(null, "", registrationTabHref(value));
    }

    return <div className="event-manage-registration">
        <header className="event-manage-heading"><div><h1>{t("manage.registration.title")}</h1><p>{t("manage.registration.subtitle")}</p></div></header>
        <ManageTabs idPrefix="registration" label={t("manage.registration.sections")} tabs={registrationTabs(teamMode)} value={tab} onChange={change} />
        <div className="ib-tabpanel" role="tabpanel" id={manageTabPanelID("registration")} aria-labelledby={manageTabID("registration", tab)}>{tab === "registration" ? <RegistrationSettings /> : <ExtraFieldsEditor key={tab} scope={tab === "team-fields" ? "team" : "participant"} />}</div>
    </div>;
}
