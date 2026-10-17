"use client";

import {useDraftDirty, useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {toast} from "react-hot-toast";
import {toastFailure} from "@/components/ui/toastApiError";
import {getManageConfig, getManageName, ManageApiError, putManageGeneral} from "@/api/manage";
import {BrandDraftField, useBrandDraft} from "@/components/event/manage/BrandDraftField";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";

export default function ManageGeneralPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const nameQuery = useQuery({queryKey: ["event-management-name", eventID], queryFn: () => getManageName(eventID), refetchOnWindowFocus: false});
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [nameEdit, setNameEdit] = useSessionDraftState<{eventID: string; value: string} | null>("general-name", null);
    const [descriptionEdit, setDescriptionEdit] = useSessionDraftState<{eventID: string; value: string} | null>("general-description", null);
    const [saving, setSaving] = useState(false);
    const name = nameEdit?.eventID === eventID ? nameEdit.value : nameQuery.data?.Name ?? "";
    const description = descriptionEdit?.eventID === eventID ? descriptionEdit.value : configQuery.data?.PreviewDescription ?? "";
    const preview = useBrandDraft(eventID, "preview", configQuery.data?.PreviewPicture ?? "", 5 << 20);
    const dirty = !!nameQuery.data && !!configQuery.data && (name.trim() !== nameQuery.data.Name || description !== configQuery.data.PreviewDescription || preview.dirty);
    useDraftDirty("general-name", nameQuery.data ? name.trim() !== nameQuery.data.Name : undefined, {preserveInput: true});
    useDraftDirty("general-description", configQuery.data ? description !== configQuery.data.PreviewDescription : undefined);
    const disabled = !canManage;

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!dirty || !name.trim() || preview.uploading || preview.expired || saving || !canManage) return;
        setSaving(true);
        try {
            const result = await putManageGeneral(eventID, {Name: name.trim(), Description: description, Preview: preview.change});
            queryClient.setQueryData(["event-management-name", eventID], {Name: result.Name});
            queryClient.setQueryData(["event-management-config", eventID], result.Config);
            queryClient.setQueryData<PublicEventInfo>(["event-manager-public-info"], current =>
                current?.EventID === eventID ? {...current, Name: result.Name, PreviewDescription: result.Config.PreviewDescription, PreviewPicture: result.Config.PreviewPicture} : current
            );
            setNameEdit(current => current?.value === name ? null : current); setDescriptionEdit(current => current?.value === description ? null : current); preview.saved(result.Config.PreviewPicture);
            toast.success(t("manage.settings.saved"));
        } catch (error) {
            toastFailure(error, error instanceof ManageApiError && error.status === 409 ? t("manage.settings.conflict") : t("manage.settings.saveError"));
        } finally {setSaving(false);}
    }

    if (nameQuery.isPending || configQuery.isPending) return <EventLoading event={event} />;
    if (nameQuery.isError || configQuery.isError) return <EventLoadError message={t("manage.settings.loadError")} error={nameQuery.error ?? configQuery.error} onRetry={() => {void nameQuery.refetch(); void configQuery.refetch();}} />;
    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>{t("manage.settings.title")}</h1><p>{t("manage.settings.intro")}</p></div></header>
        {!canManage && <p className="event-manage-notice">{t("common.viewOnly")}</p>}
        <section className="event-manage-section">
            <div className="event-manage-field"><ManageFieldLabel htmlFor="event-name" title={t("manage.settings.name")} help={t("manage.settings.nameHelp")} required /><input id="event-name" aria-invalid={nameEdit !== null && !name.trim() || undefined} aria-describedby={nameEdit !== null && !name.trim() ? "event-name-error" : undefined} className="event-manage-input" value={name} onChange={change => setNameEdit({eventID, value: change.target.value})} maxLength={255} required disabled={disabled} />{nameEdit !== null && !name.trim() && <p id="event-name-error" className="event-manage-validation" role="alert">{t("manage.field.required")}</p>}</div>
            <div className="event-manage-field"><ManageFieldLabel htmlFor="event-description" title={t("manage.settings.description")} help={t("manage.settings.descriptionHelp")} /><textarea id="event-description" className="event-manage-input" value={description} onChange={change => setDescriptionEdit({eventID, value: change.target.value})} maxLength={1000} rows={3} disabled={disabled} /></div>
            <BrandDraftField id="event-preview-picture" title={t("manage.settings.preview")} help={t("manage.settings.previewHelp")} hint={t("manage.settings.previewHint")} kind="preview" draft={preview} disabled={disabled} />
        </section>
        <div className="event-manage-savebar"><EventButton saveDirty={dirty} className="ib-btn ib-btn--primary" type="submit" disabled={disabled || saving || !name.trim() || preview.uploading || preview.expired} busy={saving}>{t("common.save")}</EventButton></div>
    </form>;
}
