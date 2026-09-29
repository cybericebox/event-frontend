export type MailTab = "settings" | "journal";

export const mailTabs: {value: MailTab; label: string}[] = [
    {value: "settings", label: "Налаштування"},
    {value: "journal", label: "Журнал відправлення"},
];

// `?tab=journal` opens the delivery journal; anything else opens settings.
export function mailTabFromParam(tab: string | null | undefined): MailTab {
    return mailTabs.find(item => item.value === tab)?.value ?? "settings";
}

export function mailTabHref(tab: MailTab): string {
    return tab === "settings" ? "/manage/mail" : `/manage/mail?tab=${tab}`;
}
