"use client";

import {EventSelect} from "@/components/ui/EventSelect";
import type {ManageNotificationVariable} from "@/api/manageNotifications";
import {t} from "@/i18n/t";

// «Вставити змінну»: the variables of the signal; a choice is handed to the
// caller (which puts the token at the caret) and the select stays empty.
export function VariableInsert({variables, disabled, onInsert}: {variables: ManageNotificationVariable[]; disabled?: boolean; onInsert: (name: string) => void}) {
    if (!variables.length) return null;
    return <EventSelect className="event-manage-notifications__variables" ariaLabel={t("manage.notifications.insertVariable")} placeholder={t("manage.notifications.insertVariable")} disabled={disabled} value=""
        options={variables.map(variable => ({value: variable.Name, label: variable.Description ? `${variable.Description} · ${variable.Name}` : variable.Name}))} onValueChange={onInsert} />;
}
