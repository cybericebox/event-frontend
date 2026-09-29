"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import {getManageStaffFields, putManageStaffFields, type StaffScope} from "@/api/manageStaffFields";
import type {ParticipantAnswers} from "@/api/participantForm";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {formFields} from "./listColumns";

const changedAt = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});

export function hasStaffFields(form: ParticipantForm | null | undefined): boolean {
    return formFields(form?.Document.blocks).some(field => field.staffOnly);
}

// Only the staff-only keys whose value differs from what is saved; a cleared
// field goes as "" (the backend deletes it).
export function changedStaffValues(saved: ParticipantAnswers, draft: ParticipantAnswers, keys: string[]): ParticipantAnswers {
    const changed: ParticipantAnswers = {};
    for (const key of keys) {
        if (!(key in draft)) continue;
        if (JSON.stringify(saved[key] ?? null) !== JSON.stringify(draft[key] ?? null)) changed[key] = draft[key];
    }
    return changed;
}

// Staff-only fields of one participant or team, filled by organizers in the
// row's dialog. `answers` are the row's other answers (staff-only conditions
// may depend on them). Participants never receive these values.
export function StaffFieldsPanel({eventID, scope, subjectID, form, answers, canManage, onSaved}: {
    eventID: string;
    scope: StaffScope;
    subjectID: string;
    form: ParticipantForm;
    answers: Record<string, unknown>;
    canManage: boolean;
    onSaved: () => Promise<void> | void;
}) {
    const queryClient = useQueryClient();
    const queryKey = ["event-staff-fields", eventID, scope, subjectID];
    const query = useQuery({queryKey, queryFn: () => getManageStaffFields(eventID, scope, subjectID), refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<ParticipantAnswers | null>(null);
    const [busy, setBusy] = useState(false);
    const keys = formFields(form.Document.blocks).filter(field => field.staffOnly).map(field => field.key);
    const staffForm = {...form, Enabled: true, Required: false};

    if (query.isPending) return <EventLoading compact label={t("manage.staffFields.loading")} />;
    if (query.isError) return <EventLoadError compact message={t("manage.staffFields.loadFailed")} error={query.error} onRetry={() => void query.refetch()} />;

    const saved = query.data.Values as ParticipantAnswers;
    const draft = edited ?? saved;
    const changed = changedStaffValues(saved, draft, keys);
    const dirty = Object.keys(changed).length > 0;
    const change = query.data.Change;

    async function save() {
        if (!canManage || busy || !dirty) return;
        setBusy(true);
        try {
            const result = await putManageStaffFields(eventID, scope, subjectID, changed);
            queryClient.setQueryData(queryKey, result);
            setEdited(null);
            await onSaved();
            toast.success(t("manage.staffFields.saved"));
        } catch (error) {
            toast.error(apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, t("manage.staffFields.saveFailed")));
        } finally {setBusy(false);}
    }

    return <section className="event-manage-staff-fields" aria-label={t("manage.staffFields.title")}>
        <h3>{t("manage.staffFields.title")}</h3>
        <p className="event-manage-staff-fields__note">{t("manage.staffFields.note")}</p>
        <TeamFieldsInputs form={staffForm} staffOnly answers={{...answers, ...draft} as ParticipantAnswers} disabled={!canManage || busy}
            onChange={(key, value) => setEdited({...draft, [key]: value})} />
        <small className="event-manage-staff-fields__change">{change
            ? t("manage.staffFields.changed", {name: change.ActorName || t("manage.staffFields.unknownActor"), date: changedAt.format(new Date(change.At))})
            : t("manage.staffFields.never")}</small>
        {canManage && dirty && <div className="event-manage-staff-fields__actions">
            <EventButton className="ib-btn ib-btn--primary" type="button" busy={busy} disabled={busy} onClick={() => void save()}>{t("manage.staffFields.save")}</EventButton>
            <button className="ib-btn" type="button" disabled={busy} onClick={() => setEdited(null)}>{t("common.cancel")}</button>
        </div>}
    </section>;
}
