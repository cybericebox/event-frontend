"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowDown, ArrowUp, Columns3} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageListColumns, putManageListColumns, type ManagedList} from "@/api/manageListColumns";
import type {FormField} from "@/api/manageParticipantForm";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {formatAnswer, moveColumn, resolveColumns, toSavedColumns, type FieldColumn} from "./listColumns";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";

export function useFieldColumns(eventID: string, list: ManagedList, fields: FormField[], enabled = true) {
    const query = useQuery({queryKey: ["event-management-list-columns", eventID, list], queryFn: () => getManageListColumns(eventID, list), enabled, refetchOnWindowFocus: false});
    const columns = resolveColumns(fields.map(field => ({key: field.key, label: field.label})), query.data?.Columns ?? []);
    return {columns, visible: columns.filter(column => column.visible), query};
}

export function FieldColumnsButton({eventID, list, columns, canManage}: {eventID: string; list: ManagedList; columns: FieldColumn[]; canManage: boolean}) {
    const [draft, setDraft] = useState<FieldColumn[] | null>(null);
    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();
    if (columns.length === 0) return null;

    async function save() {
        if (!draft || saving || !canManage) return;
        setSaving(true);
        try {
            const saved = await putManageListColumns(eventID, list, toSavedColumns(draft));
            queryClient.setQueryData(["event-management-list-columns", eventID, list], saved);
            setDraft(null);
            toast.success(t("manage.fields.columns.saved"));
        } catch {toast.error(t("manage.fields.columns.saveFailed"));}
        finally {setSaving(false);}
    }

    return <>
        <button className="ib-btn" type="button" onClick={() => setDraft(columns)}><Columns3 size={16} aria-hidden="true" /> {t("manage.fields.columns.button")}</button>
        <Dialog open={draft !== null} onOpenChange={open => {if (!open && !saving) setDraft(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(480px,calc(100vw-24px))] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("manage.fields.columns.title")}</DialogTitle><DialogDescription>{t("manage.fields.columns.description")}</DialogDescription></DialogHeader>
            <ol className="event-field-columns">{(draft ?? []).map((column, index) => <li key={column.key}>
                <label className="event-manage-form__switch"><input type="checkbox" checked={column.visible} disabled={!canManage || saving} onChange={event => setDraft(current => current && current.map(item => item.key === column.key ? {...item, visible: event.target.checked} : item))} />{column.label}</label>
                {canManage && <span className="event-content-editor__block-actions"><button type="button" aria-label={t("manage.fields.columns.moveUp", {label: column.label})} disabled={index === 0 || saving} onClick={() => setDraft(current => current && moveColumn(current, index, -1))}><ArrowUp size={16} /></button><button type="button" aria-label={t("manage.fields.columns.moveDown", {label: column.label})} disabled={index === (draft?.length ?? 0) - 1 || saving} onClick={() => setDraft(current => current && moveColumn(current, index, 1))}><ArrowDown size={16} /></button></span>}
            </li>)}</ol>
            <div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={saving} onClick={() => setDraft(null)}>{t("common.cancel")}</button>{canManage && <EventButton className="ib-btn ib-btn--primary" type="button" disabled={saving} onClick={() => void save()} busy={saving}>{t("common.save")}</EventButton>}</div>
        </DialogContent></Dialog>
    </>;
}

// Every configured field in form order, then answers to fields that are no
// longer in the form (kept by the backend for earlier registrations).
export function AnswersList({fields, answers}: {fields: FormField[]; answers: Record<string, unknown>}) {
    const known = new Set(fields.map(field => field.key));
    const extra = Object.entries(answers).filter(([key]) => !known.has(key));
    if (fields.length === 0 && extra.length === 0) return <EmptyState compact message={t("manage.fields.noAnswers")} />;
    return <dl className="event-form-responses__answers">
        {fields.map(field => <div key={field.key}><dt>{field.label || field.key}</dt><dd>{formatAnswer(answers[field.key])}</dd></div>)}
        {extra.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatAnswer(value)}</dd></div>)}
    </dl>;
}
