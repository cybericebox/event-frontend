"use client";

import {useState} from "react";
import Link from "next/link";
import {signalLabel, type ManageNotificationSubscription} from "@/api/manageNotifications";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t} from "@/i18n/t";
import {ManageTable, ManageTableSearch, type ManageTableState} from "../ManageTable";
import {listStatus, orderedVersions} from "./notificationModel";
import {TemplateStatusTag} from "./TemplateStatusTag";

type ListedTemplate = {ID: string; NotificationType: string; Status: "draft" | "published" | "unpublished"; UpdatedAt: string; Source: "platform" | "event"};

// The list of an event's templates of one channel, like admin's template list:
// a row per signal with its status, the last change and the on/off switch of
// sending it. A row opens the template page.
export function TemplateList({event, state, onRetry, error, loadingLabel, errorMessage, emptyMessage, signals, rows, templates, basePath, canManage, busy, onToggle}: {
    event: PublicEventInfo;
    state: ManageTableState;
    onRetry: () => void;
    error?: unknown;
    loadingLabel: string;
    errorMessage: string;
    emptyMessage: string;
    signals: string[];
    rows: ManageNotificationSubscription[];
    templates: ListedTemplate[];
    basePath: string;
    canManage: boolean;
    busy: boolean;
    onToggle: (signal: string, enabled: boolean) => void;
}) {
    const [search, setSearch] = useState("");
    const needle = search.trim().toLocaleLowerCase();
    const shown = signals.filter(signal => !needle || signalLabel(signal).title.toLocaleLowerCase().includes(needle) || signal.toLowerCase().includes(needle));
    const tableState: ManageTableState = state !== "ready" ? state : shown.length === 0 ? "empty" : "ready";
    return <ManageTable event={event} state={tableState} loadingLabel={loadingLabel} errorMessage={errorMessage} onRetry={onRetry} error={error} emptyMessage={needle ? t("manage.notifications.list.emptySearch") : emptyMessage}
        toolbar={<ManageTableSearch value={search} onChange={setSearch} label={t("manage.notifications.list.search")} />}
        head={<tr>
            <th scope="col">{t("manage.notifications.list.colType")}</th>
            <th scope="col">{t("manage.notifications.list.colStatus")}</th>
            <th scope="col">{t("manage.notifications.list.colUpdated")}</th>
            <th scope="col">{t("manage.notifications.list.colSend")}</th>
        </tr>}>
        <tbody>{shown.map(signal => {
            const label = signalLabel(signal);
            const versions = orderedVersions(templates, signal);
            const {status, draftPending} = listStatus(versions);
            const effective = versions.find(item => item.Source === "event" && item.Status === status) ?? versions[0];
            const row = rows.find(item => item.SignalType === signal);
            const href = `${basePath}/${encodeURIComponent(signal)}`;
            return <tr key={signal}>
                <td><div className="event-manage-table__person"><Link className="event-template-list__name" href={href}>{label.title}</Link>{label.description && <small>{label.description}</small>}</div></td>
                <td><div className="event-template-list__status"><TemplateStatusTag status={status} />{draftPending && <span className="ib-tag ib-tag--warn">{t("manage.notifications.list.draftPending")}</span>}
                    {versions.filter(item => item.Source === "event").map(item => <Link key={item.ID} href={`${href}?id=${item.ID}`}>{t(`manage.notifications.status.${item.Status}`)}</Link>)}</div></td>
                <td className="event-manage-table__nowrap">{effective && effective.Source === "event" ? new Date(effective.UpdatedAt).toLocaleDateString("uk-UA") : <span className="event-manage-table__dim">—</span>}</td>
                <td>{row ? <EventSwitch checked={row.Enabled} disabled={!canManage || busy || row.Required} ariaLabel={t("manage.notifications.switchLabel", {title: label.title})} onCheckedChange={checked => onToggle(signal, checked)} /> : <span className="event-manage-table__dim">—</span>}</td>
            </tr>;
        })}</tbody>
    </ManageTable>;
}
