"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CircleHelp, Pencil, Plus, Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {broadcastTemplatesKey, deleteBroadcastTemplate, getBroadcastTemplates, type BroadcastTemplateRecord} from "@/api/manageBroadcastTemplates";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {zoneOffset} from "@/utils/dateTime";
import {useManager} from "../ManagerShell";
import {ManageTable} from "../ManageTable";
import {formatBroadcastTime} from "./BroadcastHistory";
import {broadcastTitle, channelsLabel} from "./broadcastModel";
import "./broadcasts.css";

export const TEMPLATES_BASE = "/manage/broadcast-templates";

// «Шаблони розсилок»: the saved broadcast messages of the event. They are not bound to any platform action; a manager
// picks one in «Нова розсилка» to fill the form. Owners and write moderators create, edit and delete; viewers read.
export function BroadcastTemplateList() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const query = useQuery({queryKey: broadcastTemplatesKey(eventID), queryFn: () => getBroadcastTemplates(eventID), refetchOnWindowFocus: false, placeholderData: previous => previous});
    const [removing, setRemoving] = useState<BroadcastTemplateRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");
    const items = query.data ?? [];

    async function remove() {
        if (!removing || deleting) return;
        setDeleting(true);
        setError("");
        try {
            await deleteBroadcastTemplate(eventID, removing.ID);
            queryClient.setQueryData<BroadcastTemplateRecord[]>(broadcastTemplatesKey(eventID), rows => rows?.filter(row => row.ID !== removing.ID));
            toast.success(t("manage.broadcastTemplates.deleted"));
            setRemoving(null);
        } catch (failure) {
            setError(apiErrorMessage(failure instanceof ManageApiError ? failure.code : undefined, t("manage.broadcastTemplates.error.delete")));
        } finally {setDeleting(false);}
    }

    const create = canManage
        ? <Link className="ib-btn ib-btn--primary" href={`${TEMPLATES_BASE}/new`}><Plus size={15} aria-hidden="true" /> {t("manage.broadcastTemplates.create")}</Link>
        : <span className="event-broadcast-heading-actions">
            <button className="ib-btn ib-btn--primary" type="button" disabled><Plus size={15} aria-hidden="true" /> {t("manage.broadcastTemplates.create")}</button>
            <EventTooltip help content={t("manage.broadcastTemplates.viewerCannotEdit")}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.broadcastTemplates.viewerCannotEditLabel")} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
        </span>;

    return <div className="event-manage-settings event-journal">
        <header className="event-manage-heading"><div><h1>{t("manage.broadcastTemplates.title")}</h1><p>{t("manage.broadcastTemplates.subtitle")}</p></div>{create}</header>
        <ManageTable cards event={event} state={query.isPending ? "loading" : query.isError && !query.data ? "error" : items.length ? "ready" : "empty"}
            label={t("manage.broadcastTemplates.title")} loadingLabel={t("manage.broadcastTemplates.loading")} emptyMessage={t("manage.broadcastTemplates.empty")}
            errorMessage={t("manage.broadcastTemplates.loadError")} error={query.error} onRetry={() => void query.refetch()}
            head={<tr>
                <th scope="col">{t("manage.broadcastTemplates.col.name")}</th>
                <th scope="col">{t("manage.broadcastTemplates.col.message")}</th>
                <th scope="col">{t("manage.broadcastTemplates.col.channels")}</th>
                <th scope="col">{t("manage.broadcastTemplates.col.updatedBy")}</th>
                <th scope="col">{t("manage.broadcastTemplates.col.updated", {zone: zoneOffset()})}</th>
                {canManage && <th scope="col" className="event-manage-table__actions-col event-manage-table__sticky-end">{t("manage.broadcastTemplates.col.actions")}</th>}
            </tr>}>
            <tbody>{items.map(item => <tr key={item.ID}>
                <td><Link className="ib-link" href={`${TEMPLATES_BASE}/${item.ID}`}>{item.Name}</Link></td>
                <td>{broadcastTitle(item)}</td>
                <td>{channelsLabel(item.Channels)}</td>
                <td>{item.UpdatedByName || <span className="event-manage-table__dim">—</span>}</td>
                <td className="event-manage-table__nowrap"><time dateTime={item.UpdatedAt}>{formatBroadcastTime(item.UpdatedAt)}</time></td>
                {canManage && <td className="event-manage-table__sticky-end"><div className="event-manage-table__actions">
                    <EventTooltip content={t("manage.broadcastTemplates.edit")}>{id => <Link className="ib-icon-btn" href={`${TEMPLATES_BASE}/${item.ID}`} aria-label={t("manage.broadcastTemplates.edit")} aria-describedby={id}><Pencil size={16} strokeWidth={2} aria-hidden="true" /></Link>}</EventTooltip>
                    <EventTooltip content={t("manage.broadcastTemplates.delete")}>{id => <button className="ib-icon-btn" type="button" aria-label={t("manage.broadcastTemplates.delete")} aria-describedby={id} onClick={() => {setError(""); setRemoving(item);}}><Trash2 size={16} strokeWidth={2} aria-hidden="true" /></button>}</EventTooltip>
                </div></td>}
            </tr>)}</tbody>
        </ManageTable>
        <ConfirmDialog open={removing !== null} onCancel={() => setRemoving(null)} tone="danger" title={t("manage.broadcastTemplates.deleteTitle")} description={t("manage.broadcastTemplates.deleteBody")}
            subject={removing?.Name} confirmLabel={t("manage.broadcastTemplates.deleteAction")} busy={deleting} busyLabel={t("common.busy.deleting")} error={error || undefined} onConfirm={() => void remove()} />
    </div>;
}
