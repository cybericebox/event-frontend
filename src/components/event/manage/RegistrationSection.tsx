"use client";

import {useState} from "react";
import {ExtraFieldsEditor} from "./ExtraFieldsEditor";
import {RegistrationSettings} from "./RegistrationSettings";
import {registrationTabFromParam, registrationTabHref, registrationTabs, type RegistrationTab} from "./registrationTabs";
import {useManager} from "./ManagerShell";
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
        <div className="event-manage-participants__filters" role="tablist" aria-label={t("manage.registration.sections")}>{registrationTabs(teamMode).map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => change(option.value)}>{option.label}</button>)}</div>
        <div role="tabpanel">{tab === "registration" ? <RegistrationSettings /> : <ExtraFieldsEditor key={tab} scope={tab === "team-fields" ? "team" : "participant"} />}</div>
    </div>;
}
