"use client";

import {t} from "@/i18n/t";
import {RegistrySecretsPanel} from "./RegistrySecretsPanel";

export function RegistriesSection() {
    return <div className="event-manage-settings event-manage-mail">
        <header className="event-manage-heading"><div><h1>{t("manage.registries.title")}</h1><p>{t("manage.registries.subtitle")}</p></div></header>
        <RegistrySecretsPanel />
    </div>;
}
