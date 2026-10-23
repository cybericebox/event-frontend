"use client";

import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage, ApiErrorCode} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {BROADCAST_TEMPLATE_NAME_MAX, broadcastTemplatesKey, createBroadcastTemplate, type BroadcastTemplateRecord} from "@/api/manageBroadcastTemplates";
import {DialogModal} from "@/components/event/DialogModal";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {templateInput, templateNameError, type BroadcastMessage} from "./broadcastModel";

// The error of a template write: a taken name belongs to the name field, everything else to the form.
export function templateSaveError(error: unknown): {name?: string; form?: string} {
    const code = error instanceof ManageApiError ? error.code : undefined;
    if (code === ApiErrorCode.BroadcastTemplateNameTaken) return {name: t("manage.customTemplates.validation.nameTaken")};
    if (code === ApiErrorCode.BroadcastInvalid) return {form: t("manage.customTemplates.error.invalid")};
    return {form: apiErrorMessage(code, t("manage.customTemplates.error.save"))};
}

// «Зберегти як шаблон» in the composer: asks for a name and stores the message (not the audience) as a template.
export function SaveTemplateDialog({open, eventID, message, onClose}: {open: boolean; eventID: string; message: BroadcastMessage; onClose: () => void}) {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [left, setLeft] = useState(false);
    const [saving, setSaving] = useState(false);
    const [serverName, setServerName] = useState<{name: string; error: string} | null>(null);
    const [formError, setFormError] = useState("");
    const clientError = left ? templateNameError(name) : "";
    const nameError = clientError || (serverName && serverName.name === name ? serverName.error : "");

    function close() {
        if (saving) return;
        setName(""); setLeft(false); setServerName(null); setFormError("");
        onClose();
    }

    async function save() {
        setLeft(true);
        if (templateNameError(name) || saving) return;
        setSaving(true);
        setFormError("");
        try {
            const saved = await createBroadcastTemplate(eventID, templateInput(name, message));
            queryClient.setQueryData<BroadcastTemplateRecord[]>(broadcastTemplatesKey(eventID), rows => rows ? [saved, ...rows] : rows);
            toast.success(t("manage.customTemplates.saved"));
            setSaving(false);
            setName(""); setLeft(false); setServerName(null);
            onClose();
        } catch (failure) {
            const errors = templateSaveError(failure);
            if (errors.name) setServerName({name, error: errors.name});
            setFormError(errors.form ?? "");
            setSaving(false);
        }
    }

    return <DialogModal open={open} onClose={close} size="sm" title={t("manage.customTemplates.saveAs.title")} description={t("manage.customTemplates.saveAs.body")}
        footer={<>
            <button className="ib-btn" type="button" disabled={saving} onClick={close}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="button" busy={saving} busyLabel={t("common.busy.saving")} onClick={() => void save()}>{t("common.save")}</EventButton>
        </>}>
        <form className="event-manage-field" onSubmit={event => {event.preventDefault(); void save();}}>
            <ManageFieldLabel title={t("manage.customTemplates.field.name")} help={t("manage.customTemplates.field.nameHelp")} htmlFor="broadcast-save-template-name" required />
            <input id="broadcast-save-template-name" className="event-manage-input" value={name} maxLength={BROADCAST_TEMPLATE_NAME_MAX} autoComplete="off"
                aria-invalid={!!nameError || undefined} aria-describedby={nameError ? "broadcast-save-template-name-error" : undefined}
                onChange={event => setName(event.target.value)} onBlur={() => setLeft(true)} />
            {nameError && <p id="broadcast-save-template-name-error" className="event-manage-validation" role="alert">{nameError}</p>}
        </form>
        {formError && <p className="event-manage-validation" role="alert">{formError}</p>}
    </DialogModal>;
}
