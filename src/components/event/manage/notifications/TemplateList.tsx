"use client";

import {useState} from "react";
import Link from "next/link";
import {signalLabel, type ManageNotificationSubscription} from "@/api/manageNotifications";
import type {BroadcastTemplateRecord} from "@/api/manageBroadcastTemplates";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t} from "@/i18n/t";
import {ManageTable, ManageTableSearch, type ManageTableState} from "../ManageTable";
import {channelsLabel} from "../broadcasts/broadcastModel";
import {listStatus, orderedVersions} from "./notificationModel";
import {TemplateStatusTag} from "./TemplateStatusTag";
import {zoneOffset} from "@/utils/dateTime";

type ListedTemplate = {ID: string; NotificationType: string; Status: "draft" | "published" | "unpublished"; UpdatedAt: string; Source: "platform" | "event"};
export type TemplateKindFilter = "all" | "triggered" | "custom";

// The list of an event's templates of one channel, like admin's template list. Two kinds share it:
// triggered templates (a row per signal with its status, the last change and the on/off switch of sending it) and,
// when `custom` is given, the custom templates of this channel (saved messages for broadcasts, not bound to any
// action). A row opens its template page.
export function TemplateList({event, state, onRetry, error, loadingLabel, errorMessage, emptyMessage, signals, rows, templates, basePath, canManage, onToggle, custom}: {
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
    onToggle: (signal: string, enabled: boolean) => void;
    custom?: BroadcastTemplateRecord[];
}) {
    const [search, setSearch] = useState("");
    const [kind, setKind] = useState<TemplateKindFilter>("all");
    const withKinds = custom !== undefined;
    const needle = search.trim().toLocaleLowerCase();
    const shown = kind === "custom" ? [] : signals.filter(signal => !needle || signalLabel(signal).title.toLocaleLowerCase().includes(needle) || signal.toLowerCase().includes(needle));
    const shownCustom = kind === "triggered" ? [] : (custom ?? []).filter(item => !needle || item.Name.toLocaleLowerCase().includes(needle));
    const tableState: ManageTableState = state !== "ready" ? state : shown.length + shownCustom.length === 0 ? "empty" : "ready";
    const kindOptions = (["all", "triggered", "custom"] as const).map(value => ({value, label: t(`manage.customTemplates.filter.${value}`)}));
    const filtered = !!needle || kind !== "all";
    return <ManageTable cards event={event} state={tableState} loadingLabel={loadingLabel} errorMessage={errorMessage} onRetry={onRetry} error={error} emptyMessage={filtered ? t("manage.notifications.list.emptySearch") : emptyMessage}
        toolbar={<>
            <ManageTableSearch value={search} onChange={setSearch} label={t("manage.notifications.list.search")} />
            {withKinds && <EventSelect className="event-template-list__kind" ariaLabel={t("manage.customTemplates.filter.label")} value={kind} options={kindOptions} onValueChange={value => setKind(value as TemplateKindFilter)} />}
        </>}
        head={<tr>
            <th scope="col">{withKinds ? t("manage.customTemplates.col.template") : t("manage.notifications.list.colType")}</th>
            {withKinds && <th scope="col">{t("manage.customTemplates.col.kind")}</th>}
            <th scope="col">{t("manage.notifications.list.colStatus")}</th>
            <th scope="col">{t("manage.notifications.list.colUpdated", {zone: zoneOffset()})}</th>
            <th scope="col" className="event-manage-table__sticky-end">{t("manage.notifications.list.colSend")}</th>
        </tr>}>
        <tbody>{shown.map(signal => {
            const label = signalLabel(signal);
            const versions = orderedVersions(templates, signal);
            const {status, draftPending} = listStatus(versions);
            const effective = versions.find(item => item.Source === "event" && item.Status === status) ?? versions[0];
            const row = rows.find(item => item.SignalType === signal);
            // The tag already names the status; several own versions get one link to the template page, which lists them.
            const ownVersions = versions.filter(item => item.Source === "event").length;
            const href = `${basePath}/${encodeURIComponent(signal)}`;
            return <tr key={signal}>
                <td><div className="event-manage-table__person"><Link className="event-template-list__name" href={href}>{label.title}</Link>{label.description && <small>{label.description}</small>}</div></td>
                {withKinds && <td><span className="ib-tag">{t("manage.customTemplates.kind.triggered")}</span></td>}
                <td><div className="event-template-list__status"><TemplateStatusTag status={status} />{draftPending && <span className="ib-tag ib-tag--warn">{t("manage.notifications.list.draftPending")}</span>}
                    {ownVersions > 1 && <Link href={href}>{t("manage.notifications.list.versions", {count: ownVersions})}</Link>}</div></td>
                <td className="event-manage-table__nowrap">{effective && effective.Source === "event" ? new Date(effective.UpdatedAt).toLocaleDateString("uk-UA") : <span className="event-manage-table__dim">—</span>}</td>
                <td className="event-manage-table__sticky-end">{row ? <EventSwitch checked={row.Enabled} disabled={!canManage || row.Required} ariaLabel={t("manage.notifications.switchLabel", {title: label.title})} onCheckedChange={checked => onToggle(signal, checked)} /> : <span className="event-manage-table__dim">—</span>}</td>
            </tr>;
        })}
        {shownCustom.map(item => {
            const href = `${basePath}/custom/${encodeURIComponent(item.ID)}`;
            return <tr key={`custom:${item.ID}`}>
                <td><div className="event-manage-table__person"><Link className="event-template-list__name" href={href}>{item.Name}</Link><small>{t("manage.customTemplates.channels", {channels: channelsLabel(item.Channels)})}</small></div></td>
                <td><span className="ib-tag ib-tag--ok">{t("manage.customTemplates.kind.custom")}</span></td>
                <td><span className="event-manage-table__dim">{t("manage.customTemplates.manualOnly")}</span></td>
                <td className="event-manage-table__nowrap">{new Date(item.UpdatedAt).toLocaleDateString("uk-UA")}</td>
                <td className="event-manage-table__sticky-end"><span className="event-manage-table__dim">—</span></td>
            </tr>;
        })}</tbody>
    </ManageTable>;
}
