"use client";

import Link from "next/link";
import {useInfiniteQuery, useQuery} from "@tanstack/react-query";
import {ArrowLeft} from "lucide-react";
import {mailResultLabels} from "@/api/manageMail";
import {getEventBroadcast, getEventBroadcastDeliveries, type BroadcastDelivery} from "@/api/manageBroadcasts";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {useManager} from "../ManagerShell";
import {ManageTable} from "../ManageTable";
import {EmailPreview} from "../notifications/EmailPreview";
import {InAppPreview} from "../notifications/InAppPreview";
import {audienceLabel, broadcastSampleValues, broadcastTitle, channelLabel, channelsLabel, inAppPreviewInput} from "./broadcastModel";
import {BroadcastStatus, formatBroadcastTime} from "./BroadcastHistory";
import "./broadcasts.css";

const PAGE = 50;

function deliveryStatus(delivery: BroadcastDelivery): {label: string; className: string} {
    const status = delivery.TargetStatus || delivery.DispatchStatus;
    if (status === "done") return {label: mailResultLabels.done, className: "is-2"};
    if (status === "error") return {label: mailResultLabels.error, className: "is-3"};
    return {label: t("manage.mail.journal.pending"), className: "is-1"};
}

// One broadcast: the facts, the message as it was sent and every recipient with
// the outcome, failures first.
export function BroadcastDetails({broadcastID}: {broadcastID: string}) {
    const {event} = useManager();
    const eventID = event.EventID;
    const broadcast = useQuery({
        queryKey: ["event-manage-broadcast", eventID, broadcastID], queryFn: () => getEventBroadcast(eventID, broadcastID),
        refetchOnWindowFocus: false, retry: false,
        // While it is still going out the counters move.
        refetchInterval: query => query.state.data?.Status === "sending" ? 5000 : false,
    });
    const deliveries = useInfiniteQuery({
        queryKey: ["event-manage-broadcast-deliveries", eventID, broadcastID, broadcast.data?.Status, broadcast.data?.SentCount, broadcast.data?.FailedCount],
        enabled: !!broadcast.data, refetchOnWindowFocus: false, retry: false, initialPageParam: 0,
        queryFn: ({pageParam}) => getEventBroadcastDeliveries(eventID, broadcastID, PAGE, pageParam),
        getNextPageParam: (last, all) => last.length === PAGE ? all.length * PAGE : undefined,
    });
    const back = <Link className="event-template-header__back" href="/manage/broadcasts"><ArrowLeft size={15} aria-hidden="true" /> {t("manage.broadcasts.title")}</Link>;

    if (broadcast.isPending) return <EventLoading event={event} label={t("manage.broadcasts.detailsLoading")} />;
    if (broadcast.isError) return <div className="event-manage-settings">{back}<EventLoadError message={t("manage.broadcasts.detailsError")} error={broadcast.error} onRetry={() => void broadcast.refetch()} /></div>;

    const item = broadcast.data;
    const rows = (deliveries.data?.pages ?? []).flat();
    const state = deliveries.isPending ? "loading" : deliveries.isError && rows.length === 0 ? "error" : rows.length === 0 ? "empty" : "ready";
    const emailBody = Array.isArray(item.EmailBody) ? item.EmailBody as Array<{type: string}> : [];
    const emailInput = item.Channels.includes("email") ? {NotificationType: "broadcast", Subject: item.Subject, Preheader: item.Preheader, Body: emailBody, Styling: (item.EmailStyling ?? {}) as Record<string, unknown>} : null;
    return <div className="event-manage-settings event-template-page">
        <div className="event-template-header">
            {back}
            <div className="event-template-header__title"><h1>{broadcastTitle(item)}</h1><BroadcastStatus status={item.Status} /></div>
        </div>
        <dl className="event-broadcast-facts">
            <div><dt>{t("manage.broadcasts.col.channels")}</dt><dd>{channelsLabel(item.Channels)}</dd></div>
            <div><dt>{t("manage.broadcasts.col.audience")}</dt><dd>{audienceLabel(item.Audience)}</dd></div>
            <div><dt>{t("manage.broadcasts.col.recipients")}</dt><dd>{item.RecipientCount}</dd></div>
            <div><dt>{t("manage.broadcasts.col.sent")}</dt><dd>{item.SentCount}</dd></div>
            <div><dt>{t("manage.broadcasts.col.failed")}</dt><dd>{item.FailedCount}</dd></div>
            <div><dt>{t("manage.broadcasts.col.author")}</dt><dd>{item.CreatedByName || "—"}</dd></div>
            <div><dt>{t("manage.broadcasts.col.date")}</dt><dd><time dateTime={item.CreatedAt}>{formatBroadcastTime(item.CreatedAt)}</time></dd></div>
            {item.FinishedAt && <div><dt>{t("manage.broadcasts.finished")}</dt><dd><time dateTime={item.FinishedAt}>{formatBroadcastTime(item.FinishedAt)}</time></dd></div>}
        </dl>
        <div className="event-template-grid">
            <div className="event-template-grid__fields event-broadcast-details">
                <section className="event-broadcast-section">
                    <h2>{t("manage.broadcasts.deliveries")}</h2>
                    <div className="event-broadcast-deliveries">
                        <ManageTable event={event} state={state} busy={deliveries.isFetchingNextPage} loadingLabel={t("manage.broadcasts.deliveriesLoading")} emptyMessage={t("manage.broadcasts.deliveriesEmpty")}
                            errorMessage={t("manage.broadcasts.deliveriesError")} onRetry={() => void deliveries.refetch()} error={deliveries.error}
                            head={<tr>
                                <th scope="col">{t("manage.mail.journal.col.recipient")}</th>
                                <th scope="col">{t("manage.mail.journal.channel")}</th>
                                <th scope="col">{t("manage.mail.journal.col.status")}</th>
                            </tr>}
                            footer={deliveries.hasNextPage ? <div className="event-manage-table__footer"><div className="event-manage-table__pager">
                                <button className="ib-btn ib-btn--sm" type="button" disabled={deliveries.isFetchingNextPage} onClick={() => void deliveries.fetchNextPage()}>{t("manage.broadcasts.picker.more")}</button>
                            </div></div> : undefined}>
                            <tbody>{rows.map((row, index) => {
                                const status = deliveryStatus(row);
                                return <tr key={`${row.DispatchID}:${row.Channel}:${index}`}>
                                    <td>{row.RecipientEmail || <span className="event-manage-table__dim">—</span>}</td>
                                    <td>{channelLabel(row.Channel)}</td>
                                    <td><div className="event-participants-table__person">
                                        <span className={`event-manage-participants__status ${status.className}`}>{status.label}</span>
                                        {row.Error && <small className="event-manage-mail__error">{row.Error}</small>}
                                    </div></td>
                                </tr>;
                            })}</tbody>
                        </ManageTable>
                    </div>
                </section>
            </div>
            <div className="event-template-grid__preview event-broadcast-preview">
                {emailInput ? <div><h2>{t("manage.broadcasts.previewEmail")}</h2><EmailPreview event={event} input={emailInput} valid /></div> : null}
                {item.Channels.includes("in_app") ? <div><h2>{t("manage.broadcasts.previewInApp")}</h2>
                    <InAppPreview template={inAppPreviewInput(item)} values={broadcastSampleValues(event.Name)} /></div> : null}
                {!emailInput && !item.Channels.includes("in_app") && <EmptyState message={t("manage.broadcasts.noMessage")} />}
            </div>
        </div>
    </div>;
}
