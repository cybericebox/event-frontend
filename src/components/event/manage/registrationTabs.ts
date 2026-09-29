import {t} from "@/i18n/t";

export type RegistrationTab = "registration" | "participant-fields" | "team-fields";

export function registrationTabs(teamMode: boolean): {value: RegistrationTab; label: string}[] {
    return [
        {value: "registration", label: t("manage.registration.tab.registration")},
        {value: "participant-fields", label: t("manage.registration.tab.participantFields")},
        ...(teamMode ? [{value: "team-fields" as const, label: t("manage.registration.tab.teamFields")}] : []),
    ];
}

// Team fields exist only in team mode (P10); an unknown tab opens registration.
export function registrationTabFromParam(tab: string | null | undefined, teamMode: boolean): RegistrationTab {
    return registrationTabs(teamMode).find(item => item.value === tab)?.value ?? "registration";
}

export function registrationTabHref(tab: RegistrationTab): string {
    return tab === "registration" ? "/manage/registration" : `/manage/registration?tab=${tab}`;
}
