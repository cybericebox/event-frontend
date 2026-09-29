import {t} from "@/i18n/t";

export type MailTab = "mail";

export const mailTabs: {value: MailTab; label: string}[] = [
    {value: "mail", label: t("manage.mail.tab.mail")},
];
