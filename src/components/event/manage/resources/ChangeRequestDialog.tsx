"use client";

import {useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useState, type FormEvent} from "react";
import {toast} from "react-hot-toast";
import {requestResourceChange, type Amount} from "@/api/manageResources";
import {ManageDialog} from "@/components/event/manage/invites/ManageDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {t} from "@/i18n/t";
import {buildChangeRequest, changeRequestErrors, emptyDraft, enlarged, formatGB, resourceErrorMessage, type ChangeDraft} from "./resourcesModel";
import "./resources.css";

// The request for more: «на скільки більше» (GB) and/or «продовжити до», with a reason. Only the submit button is busy.
export function ChangeRequestDialog({eventID, allocated, to, open, onClose, onSent}: {eventID: string; allocated: Amount; to: string | null; open: boolean; onClose: () => void; onSent: () => void}) {
    const [draft, setDraft] = useSessionDraftState<ChangeDraft>("resource-request", emptyDraft);
    const [issues, setIssues] = useState<ReturnType<typeof changeRequestErrors>>({});
    const [failure, setFailure] = useState("");
    const [busy, setBusy] = useState(false);
    const current = {allocated, to};
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
        const built = buildChangeRequest(draft, current);
        if ("issue" in built) {setIssues(changeRequestErrors(draft, current)); return;}
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
    const extra = Number(draft.extraGB.trim().replace(",", "."));
    const previewable = /^\d+([.,]\d+)?$/.test(draft.extraGB.trim()) && extra > 0;

    return <ManageDialog open={open} onOpenChange={next => {if (!next) close();}} size="md" onSubmit={submit} title={t("manage.resources.request.title")} description={t("manage.resources.request.description")}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={close}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="submit" busy={busy} busyLabel={t("common.busy.sending")} disabled={busy}>{t("manage.resources.request.send")}</EventButton></>}>
        <div className="event-resources-form">
            <div className="event-manage-field">
                <label htmlFor="resources-extra">{t("manage.resources.request.extra")}</label>
                <input {...props("extraGB")} id="resources-extra" className="event-manage-input" type="text" inputMode="decimal" autoComplete="off" value={draft.extraGB} onChange={change => set({extraGB: change.target.value})} disabled={busy} />{fieldIssue("extraGB")}
                {previewable && <p className="event-resources-form__help">{t("manage.resources.request.preview", {from: formatGB(allocated.MemoryBytes), to: formatGB(enlarged(allocated, extra).MemoryBytes)})}</p>}
            </div>
            <div className="event-manage-field"><span>{t("manage.resources.request.extend")}</span><EventDateTimePicker {...props("extendTo")} ariaLabel={t("manage.resources.request.extend")} value={draft.extendTo} onChange={value => set({extendTo: value})} allowClear disabled={busy} />{fieldIssue("extendTo")}</div>
            <div className="event-manage-field">
                <label htmlFor="resources-reason">{t("manage.resources.request.reason")}</label>
                <textarea {...props("reason")} id="resources-reason" className="event-manage-input" rows={3} maxLength={1000} value={draft.reason} onChange={change => set({reason: change.target.value})} disabled={busy} />{fieldIssue("reason")}
            </div>
            {issues.empty && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{t("manage.resources.request.issue.empty")}</p>}
            {failure && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{failure}</p>}
        </div>
    </ManageDialog>;
}
