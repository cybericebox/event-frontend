"use client";

import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {CircleHelp, Send} from "lucide-react";
import {getEventBroadcasts, type Broadcast} from "@/api/manageBroadcasts";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {useManager} from "../ManagerShell";
import {ManageTable, useCursorPages} from "../ManageTable";
import {audienceLabel, broadcastTitle, channelsLabel} from "./broadcastModel";
import "./broadcasts.css";

export function formatBroadcastTime(value: string): string {
    return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}).format(new Date(value));
}

export function BroadcastStatus({status}: {status: Broadcast["Status"]}) {
    return <span className={`event-manage-participants__status ${status === "done" ? "is-2" : status === "failed" ? "is-3" : "is-1"}`}>{t(`manage.broadcasts.status.${status}`)}</span>;
}

// «Розсилка»: the history of the messages sent to the event's people, newest
// first, and the way to send a new one (owners and moderators with write access).
export function BroadcastHistory() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const pages = useCursorPages();
    const query = useQuery({
        queryKey: ["event-manage-broadcasts", eventID, pages.cursor, pages.pageSize],
        queryFn: () => getEventBroadcasts(eventID, pages.cursor, pages.pageSize),
        refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const items = query.data?.Items ?? [];
    const busy = query.isFetching && !!query.data;
    const state = query.isPending ? "loading" : query.isError && !query.data ? "error" : items.length === 0 ? "empty" : "ready";

    const action = canManage
        ? <Link className="ib-btn ib-btn--primary" href="/manage/broadcasts/new"><Send size={15} aria-hidden="true" /> {t("manage.broadcasts.send")}</Link>
        : <span className="event-broadcast-heading-actions">
            <button className="ib-btn ib-btn--primary" type="button" disabled><Send size={15} aria-hidden="true" /> {t("manage.broadcasts.send")}</button>
            <EventTooltip content={t("manage.broadcasts.viewerCannotSend")}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.broadcasts.viewerCannotSendLabel")} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
        </span>;

    return <div className="event-manage-settings event-journal">
        <header className="event-manage-heading"><div><h1>{t("manage.broadcasts.title")}</h1><p>{t("manage.broadcasts.subtitle")}</p></div>{action}</header>
        <ManageTable event={event} state={state} busy={busy} loadingLabel={t("manage.broadcasts.loading")} emptyMessage={t("manage.broadcasts.empty")}
            errorMessage={t("manage.broadcasts.loadError")} onRetry={() => void query.refetch()} error={query.error}
            head={<tr>
                <th scope="col">{t("manage.broadcasts.col.message")}</th>
                <th scope="col">{t("manage.broadcasts.col.channels")}</th>
                <th scope="col">{t("manage.broadcasts.col.audience")}</th>
                <th scope="col" className="ib-num">{t("manage.broadcasts.col.recipients")}</th>
                <th scope="col" className="ib-num">{t("manage.broadcasts.col.sent")}</th>
                <th scope="col" className="ib-num">{t("manage.broadcasts.col.failed")}</th>
                <th scope="col">{t("manage.broadcasts.col.status")}</th>
                <th scope="col">{t("manage.broadcasts.col.author")}</th>
                <th scope="col">{t("manage.broadcasts.col.date")}</th>
            </tr>}
            footer={<div className="event-manage-table__footer">
                <div className="event-manage-table__meta"><span>{t("manage.broadcasts.page", {page: pages.page})}</span></div>
                <div className="event-manage-table__pager">
                    <button className="ib-btn ib-btn--sm" type="button" disabled={busy || pages.page <= 1} onClick={pages.previous}>{t("manage.table.previous")}</button>
                    <button className="ib-btn ib-btn--sm" type="button" disabled={busy || !query.data?.NextCursor} onClick={() => pages.next(query.data?.NextCursor)}>{t("manage.table.next")}</button>
                </div>
            </div>}>
            <tbody>{items.map(item => <tr key={item.ID}>
                <td><Link className="ib-link" href={`/manage/broadcasts/${item.ID}`}>{broadcastTitle(item)}</Link></td>
                <td>{channelsLabel(item.Channels)}</td>
                <td>{audienceLabel(item.Audience)}</td>
                <td className="ib-num">{item.RecipientCount}</td>
                <td className="ib-num">{item.SentCount}</td>
                <td className="ib-num">{item.FailedCount}</td>
                <td><BroadcastStatus status={item.Status} /></td>
                <td>{item.CreatedByName || <span className="event-manage-table__dim">—</span>}</td>
                <td className="event-manage-table__nowrap"><time dateTime={item.CreatedAt}>{formatBroadcastTime(item.CreatedAt)}</time></td>
            </tr>)}</tbody>
        </ManageTable>
    </div>;
}
