"use client";

import {useDraftDirty, useDraftRouter as useRouter} from "@/components/event/manage/manualDraft";
import {useRevealFirstError} from "@/components/event/manage/useRevealFirstError";

import {useRef, useState, type FocusEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowLeft, Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    BROADCAST_TEMPLATE_NAME_MAX, broadcastTemplatesKey, createBroadcastTemplate, deleteBroadcastTemplate, getBroadcastTemplate, updateBroadcastTemplate, type BroadcastTemplateRecord,
} from "@/api/manageBroadcastTemplates";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {useManager} from "../ManagerShell";
import {sameValue} from "./notificationModel";
import {BroadcastMessageFields, BroadcastMessagePreview} from "../broadcasts/BroadcastMessageFields";
import {templateSaveError} from "../broadcasts/SaveTemplateDialog";
import {emptyMessage, messageValidation, templateInput, templateMessage, templateNameError, type BroadcastMessage} from "../broadcasts/broadcastModel";
import "../broadcasts/broadcasts.css";

type TemplateForm = {Name: string; message: BroadcastMessage};
type Channel = "email" | "in_app";

// The templates page a custom template is opened from: its address, its title and the channel a new template starts on.
const pages: Record<Channel, {basePath: string; title: string}> = {
    email: {basePath: "/manage/email", title: "manage.email.title"},
    in_app: {basePath: "/manage/notifications", title: "manage.notifications.title"},
};

// One custom template (a saved broadcast message, not bound to any platform action): a name and the very fields of
// the broadcast composer, with the channels of a broadcast and no action or trigger settings. `templateID` undefined
// is a new template; `channel` is the templates page it belongs to.
export function CustomTemplateEditor({templateID, channel}: {templateID?: string; channel: Channel}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const page = pages[channel];
    const query = useQuery({
        queryKey: [...broadcastTemplatesKey(eventID), templateID], queryFn: () => getBroadcastTemplate(eventID, templateID!),
        enabled: !!templateID, refetchOnWindowFocus: false, retry: false,
    });
    const back = <Link className="event-template-header__back" href={page.basePath}><ArrowLeft size={15} aria-hidden="true" /> {t(page.title)}</Link>;
    if (!canManage) return <div className="event-manage-settings">{back}<EmptyState message={t("manage.customTemplates.viewerCannotEdit")} /></div>;
    if (templateID && query.isPending) return <EventLoading event={event} label={t("manage.customTemplates.loadingOne")} />;
    if (templateID && query.isError) return <div className="event-manage-settings">{back}<EventLoadError message={t("manage.customTemplates.loadOneError")} error={query.error} onRetry={() => void query.refetch()} /></div>;
    // A saved template remounts the form only when another template is opened, never after its own save.
    return <TemplateForm key={templateID ?? "new"} event={event} back={back} basePath={page.basePath} channel={channel} saved={query.data ?? null} />;
}

function TemplateForm({event, back, basePath, channel, saved: loaded}: {event: PublicEventInfo; back: React.ReactNode; basePath: string; channel: Channel; saved: BroadcastTemplateRecord | null}) {
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const [saved, setSaved] = useState(loaded);
    const fresh = (): BroadcastMessage => ({...emptyMessage(), email: channel === "email", inApp: channel === "in_app"});
    const initial = (): TemplateForm => saved ? {Name: saved.Name, message: templateMessage(saved)} : {Name: "", message: fresh()};
    const [form, setForm] = useState<TemplateForm>(initial);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [serverName, setServerName] = useState<{name: string; error: string} | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
    const [attempted, setAttempted] = useState(false);
    const fieldsRef = useRef<HTMLDivElement>(null);
    const revealFirstError = useRevealFirstError(fieldsRef);
    const visible = (field: string) => attempted || touched.has(field);
    const leave = (field: string) => (focus: FocusEvent<HTMLElement>) => {
        if (!focus.currentTarget.contains(focus.relatedTarget as Node | null)) setTouched(current => current.has(field) ? current : new Set(current).add(field));
    };
    const reference = initial();
    const dirty = !sameValue(templateInput(form.Name, form.message), templateInput(reference.Name, reference.message));
    useDraftDirty("custom-template", dirty);
    const nameError = (visible("name") ? templateNameError(form.Name) : "") || (serverName && serverName.name === form.Name ? serverName.error : "");

    async function save() {
        setFormError("");
        if (templateNameError(form.Name) || messageValidation(form.message)) {
            setAttempted(true);
            revealFirstError();
            return;
        }
        if (saving) return;
        setSaving(true);
        const submitted = form;
        try {
            const input = templateInput(submitted.Name, submitted.message);
            const result = saved ? await updateBroadcastTemplate(eventID, saved.ID, input) : await createBroadcastTemplate(eventID, input);
            queryClient.setQueryData<BroadcastTemplateRecord[]>(broadcastTemplatesKey(eventID), rows => rows ? [result, ...rows.filter(row => row.ID !== result.ID)] : rows);
            queryClient.setQueryData([...broadcastTemplatesKey(eventID), result.ID], result);
            toast.success(t("manage.customTemplates.saved"));
            setSaved(result);
            // Edits made while saving stay; the saved values become the new reference.
            setForm(current => current === submitted ? {Name: result.Name, message: templateMessage(result)} : current);
            if (!saved) router.replace(`${basePath}/custom/${result.ID}`);
        } catch (failure) {
            const errors = templateSaveError(failure);
            if (errors.name) setServerName({name: submitted.Name, error: errors.name});
            setFormError(errors.form ?? "");
        } finally {setSaving(false);}
    }

    async function remove() {
        if (!saved || deleting) return;
        setDeleting(true);
        setDeleteError("");
        try {
            await deleteBroadcastTemplate(eventID, saved.ID);
            queryClient.setQueryData<BroadcastTemplateRecord[]>(broadcastTemplatesKey(eventID), rows => rows?.filter(row => row.ID !== saved.ID));
            queryClient.removeQueries({queryKey: [...broadcastTemplatesKey(eventID), saved.ID], exact: true});
            toast.success(t("manage.customTemplates.deleted"));
            setConfirmDelete(false);
            router.push(basePath);
        } catch (failure) {
            setDeleteError(apiErrorMessage(failure instanceof ManageApiError ? failure.code : undefined, t("manage.customTemplates.error.delete")));
        } finally {setDeleting(false);}
    }

    return <div className="event-manage-settings event-template-page">
        <div className="event-template-header">
            {back}
            <div className="event-template-header__title"><h1>{saved ? saved.Name : t("manage.customTemplates.newTitle")}</h1><span className="ib-tag ib-tag--ok">{t("manage.customTemplates.kind.custom")}</span></div>
            <div className="event-template-header__actions">
                {saved && <button className="ib-btn" type="button" onClick={() => {setDeleteError(""); setConfirmDelete(true);}}><Trash2 size={15} aria-hidden="true" /> {t("manage.customTemplates.delete")}</button>}
                <EventButton className="ib-btn ib-btn--primary" type="button" busy={saving} busyLabel={t("common.busy.saving")} saveDirty={dirty} onClick={() => void save()}>{t("common.save")}</EventButton>
            </div>
        </div>
        <p className="event-template-page__intro">{t("manage.customTemplates.editorIntro")}</p>
        {formError && <p className="event-manage-validation" role="alert">{formError}</p>}
        <div className="event-template-grid">
            <div className="event-template-grid__fields" ref={fieldsRef}>
                <div className="event-manage-field event-broadcast-template" onBlur={leave("name")}>
                    <ManageFieldLabel title={t("manage.customTemplates.field.name")} help={t("manage.customTemplates.field.nameHelp")} htmlFor="custom-template-name" required />
                    <input id="custom-template-name" className="event-manage-input" value={form.Name} maxLength={BROADCAST_TEMPLATE_NAME_MAX} autoComplete="off"
                        aria-invalid={!!nameError || undefined} aria-describedby={nameError ? "custom-template-name-error" : undefined}
                        onChange={change => setForm(current => ({...current, Name: change.target.value}))} />
                    {nameError && <p id="custom-template-name-error" className="event-manage-validation" role="alert">{nameError}</p>}
                </div>
                <BroadcastMessageFields event={event} value={form.message} onChange={patch => setForm(current => ({...current, message: {...current.message, ...patch}}))}
                    fields={{visible, leave}} idPrefix="custom-template" canLoadPresets />
            </div>
            <div className="event-template-grid__preview event-broadcast-preview">
                <BroadcastMessagePreview event={event} value={form.message} />
            </div>
        </div>
        <ConfirmDialog open={confirmDelete} onCancel={() => setConfirmDelete(false)} tone="danger" title={t("manage.customTemplates.deleteTitle")} description={t("manage.customTemplates.deleteBody")}
            subject={saved?.Name} confirmLabel={t("manage.customTemplates.deleteAction")} busy={deleting} busyLabel={t("common.busy.deleting")} error={deleteError || undefined} onConfirm={() => void remove()} />
    </div>;
}
