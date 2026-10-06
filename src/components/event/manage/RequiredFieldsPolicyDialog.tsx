"use client";

import {useState} from "react";
import type {FormField} from "@/api/manageParticipantForm";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t, tPlural} from "@/i18n/t";
import type {FieldsScope} from "./FormBlockCard";
import {newRegistrationsOnly, type PolicyChoice} from "./requiredFieldsPolicy";

// Asked when a save adds a required field (or makes one required) while
// answers already exist: «Лише для нових реєстрацій» is the default. Mount it
// with a fresh key each time it opens so the choice starts from the default.
export function RequiredFieldsPolicyDialog({scope, fields, answered, busy, onCancel, onConfirm}: {
    scope: FieldsScope;
    fields: FormField[];
    answered: number;
    busy: boolean;
    onCancel: () => void;
    onConfirm: (choice: PolicyChoice) => void;
}) {
    const [choice, setChoice] = useState<PolicyChoice>(newRegistrationsOnly);
    const team = scope === "team";
    const names = fields.map(field => field.label.trim() || t("manage.fields.editor.untitledQuestion")).join(", ");
    return <ConfirmDialog open onCancel={onCancel} busy={busy} onConfirm={() => onConfirm(choice)}
        title={t("manage.fields.policy.title")} confirmLabel={t("manage.fields.save")}
        description={team ? tPlural("manage.fields.policy.bodyTeam", answered) : tPlural("manage.fields.policy.bodyParticipant", answered)}
        subject={t("manage.fields.policy.fields", {names})}>
        <div className="event-manage-choice-group" role="radiogroup" aria-label={t("manage.fields.policy.title")}>
            <label><input type="radio" name="required-policy" checked={!choice.RequireExisting} disabled={busy} onChange={() => setChoice(newRegistrationsOnly)} /><span><strong>{t("manage.fields.policy.newOnly")}</strong><small>{team ? t("manage.fields.policy.newOnlyHelpTeam") : t("manage.fields.policy.newOnlyHelpParticipant")}</small></span></label>
            <label><input type="radio" name="required-policy" checked={choice.RequireExisting} disabled={busy} onChange={() => setChoice({RequireExisting: true, BlockSubmissions: false})} /><span><strong>{team ? t("manage.fields.policy.everyoneTeam") : t("manage.fields.policy.everyoneParticipant")}</strong><small>{team ? t("manage.fields.policy.everyoneHelpTeam") : t("manage.fields.policy.everyoneHelpParticipant")}</small></span></label>
        </div>
        {choice.RequireExisting && <div className="event-manage-field"><EventSwitch className="event-manage-form__switch" checked={choice.BlockSubmissions} disabled={busy} onCheckedChange={checked => setChoice({...choice, BlockSubmissions: checked})} label={t("manage.fields.policy.block")} /><small>{team ? t("manage.fields.policy.blockHelpTeam") : t("manage.fields.policy.blockHelpParticipant")}</small></div>}
    </ConfirmDialog>;
}
