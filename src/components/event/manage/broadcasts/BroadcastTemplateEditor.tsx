"use client";

import {useDraftDirty, useDraftRouter as useRouter} from "@/components/event/manage/manualDraft";
import {useRevealFirstError} from "@/components/event/manage/useRevealFirstError";

import {useRef, useState, type FocusEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowLeft} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    BROADCAST_TEMPLATE_NAME_MAX, broadcastTemplatesKey, createBroadcastTemplate, getBroadcastTemplate, updateBroadcastTemplate, type BroadcastTemplateRecord,
} from "@/api/manageBroadcastTemplates";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {useManager} from "../ManagerShell";
import {sameValue} from "../notifications/notificationModel";
import {BroadcastMessageFields, BroadcastMessagePreview} from "./BroadcastMessageFields";
import {templateSaveError} from "./SaveTemplateDialog";
import {TEMPLATES_BASE} from "./BroadcastTemplateList";
import {emptyMessage, messageValidation, templateInput, templateMessage, templateNameError, type BroadcastMessage} from "./broadcastModel";
import "./broadcasts.css";

type TemplateForm = {Name: string; message: BroadcastMessage};

// One saved broadcast template: a name and the very fields of the broadcast composer (no audience). `templateID`
// undefined is a new template.
export function BroadcastTemplateEditor({templateID}: {templateID?: string}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const query = useQuery({
        queryKey: [...broadcastTemplatesKey(eventID), templateID], queryFn: () => getBroadcastTemplate(eventID, templateID!),
        enabled: !!templateID, refetchOnWindowFocus: false, retry: false,
    });
    const back = <Link className="event-template-header__back" href={TEMPLATES_BASE}><ArrowLeft size={15} aria-hidden="true" /> {t("manage.broadcastTemplates.title")}</Link>;
    if (!canManage) return <div className="event-manage-settings">{back}<EmptyState message={t("manage.broadcastTemplates.viewerCannotEdit")} /></div>;
    if (templateID && query.isPending) return <EventLoading event={event} label={t("manage.broadcastTemplates.loadingOne")} />;
    if (templateID && query.isError) return <div className="event-manage-settings">{back}<EventLoadError message={t("manage.broadcastTemplates.loadOneError")} error={query.error} onRetry={() => void query.refetch()} /></div>;
    // A saved template remounts the form only when another template is opened, never after its own save.
    return <TemplateForm key={templateID ?? "new"} event={event} back={back} saved={query.data ?? null} />;
}

function TemplateForm({event, back, saved: loaded}: {event: PublicEventInfo; back: React.ReactNode; saved: BroadcastTemplateRecord | null}) {
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const [saved, setSaved] = useState(loaded);
    const initial = (): TemplateForm => saved ? {Name: saved.Name, message: templateMessage(saved)} : {Name: "", message: emptyMessage()};
    const [form, setForm] = useState<TemplateForm>(initial);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [serverName, setServerName] = useState<{name: string; error: string} | null>(null);
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
    useDraftDirty("broadcast-template", dirty);
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
            toast.success(t("manage.broadcastTemplates.saved"));
            setSaved(result);
            // Edits made while saving stay; the saved values become the new reference.
            setForm(current => current === submitted ? {Name: result.Name, message: templateMessage(result)} : current);
            if (!saved) router.replace(`${TEMPLATES_BASE}/${result.ID}`);
        } catch (failure) {
            const errors = templateSaveError(failure);
            if (errors.name) setServerName({name: submitted.Name, error: errors.name});
            setFormError(errors.form ?? "");
        } finally {setSaving(false);}
    }

    return <div className="event-manage-settings event-template-page">
        <div className="event-template-header">
            {back}
            <div className="event-template-header__title"><h1>{saved ? saved.Name : t("manage.broadcastTemplates.newTitle")}</h1></div>
            <div className="event-template-header__actions">
                <EventButton className="ib-btn ib-btn--primary" type="button" busy={saving} busyLabel={t("common.busy.saving")} saveDirty={dirty} onClick={() => void save()}>{t("common.save")}</EventButton>
            </div>
        </div>
        <p className="event-template-page__intro">{t("manage.broadcastTemplates.editorIntro")}</p>
        {formError && <p className="event-manage-validation" role="alert">{formError}</p>}
        <div className="event-template-grid">
            <div className="event-template-grid__fields" ref={fieldsRef}>
                <div className="event-manage-field event-broadcast-template" onBlur={leave("name")}>
                    <ManageFieldLabel title={t("manage.broadcastTemplates.field.name")} help={t("manage.broadcastTemplates.field.nameHelp")} htmlFor="broadcast-template-name" required />
                    <input id="broadcast-template-name" className="event-manage-input" value={form.Name} maxLength={BROADCAST_TEMPLATE_NAME_MAX} autoComplete="off"
                        aria-invalid={!!nameError || undefined} aria-describedby={nameError ? "broadcast-template-name-error" : undefined}
                        onChange={change => setForm(current => ({...current, Name: change.target.value}))} />
                    {nameError && <p id="broadcast-template-name-error" className="event-manage-validation" role="alert">{nameError}</p>}
                </div>
                <BroadcastMessageFields event={event} value={form.message} onChange={patch => setForm(current => ({...current, message: {...current.message, ...patch}}))}
                    fields={{visible, leave}} idPrefix="broadcast-template" canLoadPresets />
            </div>
            <div className="event-template-grid__preview event-broadcast-preview">
                <BroadcastMessagePreview event={event} value={form.message} />
            </div>
        </div>
    </div>;
}
