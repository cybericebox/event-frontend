import {t} from "@/i18n/t";

export type MailTab = "settings" | "journal";

export const mailTabs: {value: MailTab; label: string}[] = [
    {value: "settings", label: t("manage.mail.tab.settings")},
    {value: "journal", label: t("manage.mail.tab.journal")},
];

// `?tab=journal` opens the delivery journal; anything else opens settings.
export function mailTabFromParam(tab: string | null | undefined): MailTab {
    return mailTabs.find(item => item.value === tab)?.value ?? "settings";
}

export function mailTabHref(tab: MailTab): string {
    return tab === "settings" ? "/manage/mail" : `/manage/mail?tab=${tab}`;
}
