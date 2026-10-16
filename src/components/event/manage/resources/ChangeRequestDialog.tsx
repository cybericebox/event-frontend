"use client";

import {useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useState, type FormEvent} from "react";
import {toast} from "react-hot-toast";
import {requestResourceChange} from "@/api/manageResources";
import {ManageDialog} from "@/components/event/manage/invites/ManageDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {t} from "@/i18n/t";
import {buildChangeRequest, changeRequestErrors, emptyDraft, resourceErrorMessage, type ChangeDraft} from "./resourcesModel";
import "./resources.css";

// The change request: size, dynamic estimate and/or window, with a reason. Only the submit button is busy.
export function ChangeRequestDialog({eventID, open, onClose, onSent}: {eventID: string; open: boolean; onClose: () => void; onSent: () => void}) {
    const [draft, setDraft] = useSessionDraftState<ChangeDraft>("resource-request", emptyDraft);
    const [issues, setIssues] = useState<ReturnType<typeof changeRequestErrors>>({});
    const [failure, setFailure] = useState("");
    const [busy, setBusy] = useState(false);
    const set = (patch: Partial<ChangeDraft>) => {setDraft(current => ({...current, ...patch})); setIssues({}); setFailure("");};

    function close() {
        if (busy) return;
        setIssues({});
        setFailure("");
        onClose();
    }

    async function submit(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (busy) return;
        const built = buildChangeRequest(draft);
        if ("issue" in built) {setIssues(changeRequestErrors(draft)); return;}
        setBusy(true);
        try {
            await requestResourceChange(eventID, built.input);
            toast.success(t("manage.resources.request.sent"));
            setDraft(emptyDraft);
            onSent();
            onClose();
        } catch (error) {setFailure(resourceErrorMessage(error, t("manage.resources.request.failed")));}
        finally {setBusy(false);}
    }

    const fieldIssue = (field: keyof ChangeDraft) => issues[field] && <p id={`resources-${field}-error`} className="event-manage-validation" role="alert">{t(`manage.resources.request.issue.${issues[field]}`)}</p>;
    const props = (field: keyof ChangeDraft) => ({"aria-invalid": !!issues[field] || undefined, "aria-describedby": issues[field] ? `resources-${field}-error` : undefined});
    const numberField = (field: keyof ChangeDraft, id: string, label: string, value: string, onChange: (value: string) => void) => <div className="event-manage-field">
        <label htmlFor={id}>{label}</label>
        <input {...props(field)} id={id} className="event-manage-input" type="number" inputMode="numeric" min={1} step={1} value={value} onChange={change => onChange(change.target.value)} disabled={busy} />{fieldIssue(field)}
    </div>;

    return <ManageDialog open={open} onOpenChange={next => {if (!next) close();}} size="md" onSubmit={submit} title={t("manage.resources.request.title")} description={t("manage.resources.request.description")}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={close}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="submit" busy={busy} disabled={busy}>{t("manage.resources.request.send")}</EventButton></>}>
        <div className="event-resources-form">
            <fieldset className="event-resources-form__group">
                <legend>{t("manage.resources.request.size")}</legend>
                <div className="event-manage-fields-two">
                    {numberField("sizeCpu", "resources-size-cpu", t("manage.resources.request.cpu"), draft.sizeCpu, value => set({sizeCpu: value}))}
                    {numberField("sizeMemory", "resources-size-memory", t("manage.resources.request.memory"), draft.sizeMemory, value => set({sizeMemory: value}))}
                </div>
            </fieldset>
            <fieldset className="event-resources-form__group">
                <legend>{t("manage.resources.request.dynamic")}</legend>
                <p className="event-resources-form__help">{t("manage.resources.request.dynamicHelp")}</p>
                <div className="event-manage-fields-two">
                    {numberField("dynamicCpu", "resources-dynamic-cpu", t("manage.resources.request.cpu"), draft.dynamicCpu, value => set({dynamicCpu: value}))}
                    {numberField("dynamicMemory", "resources-dynamic-memory", t("manage.resources.request.memory"), draft.dynamicMemory, value => set({dynamicMemory: value}))}
                </div>
            </fieldset>
            <fieldset className="event-resources-form__group">
                <legend>{t("manage.resources.request.window")}</legend>
                <div className="event-manage-fields-two">
                    <div className="event-manage-field"><span>{t("manage.resources.request.windowStart")}</span><EventDateTimePicker {...props("windowStart")} ariaLabel={t("manage.resources.request.windowStart")} value={draft.windowStart} onChange={value => set({windowStart: value})} allowClear disabled={busy} />{fieldIssue("windowStart")}</div>
                    <div className="event-manage-field"><span>{t("manage.resources.request.windowEnd")}</span><EventDateTimePicker {...props("windowEnd")} ariaLabel={t("manage.resources.request.windowEnd")} value={draft.windowEnd} onChange={value => set({windowEnd: value})} allowClear disabled={busy} />{fieldIssue("windowEnd")}</div>
                </div>
            </fieldset>
            <div className="event-manage-field">
                <label htmlFor="resources-reason">{t("manage.resources.request.reason")}</label>
                <textarea {...props("reason")} id="resources-reason" className="event-manage-input" rows={3} maxLength={1000} value={draft.reason} onChange={change => set({reason: change.target.value})} disabled={busy} />{fieldIssue("reason")}
            </div>
            {issues.empty && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{t("manage.resources.request.issue.empty")}</p>}
            {failure && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{failure}</p>}
        </div>
    </ManageDialog>;
}
