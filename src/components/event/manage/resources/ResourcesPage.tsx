"use client";

import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {AlertTriangle} from "lucide-react";
import {getManageResources, type ChangeStatus, type ResourceChange} from "@/api/manageResources";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {formatDateTime} from "@/utils/dateTime";
import {ChangeRequestDialog} from "./ChangeRequestDialog";
import {amountText} from "./resourcesModel";
import "./resources.css";

const STATUS_TONE: Record<ChangeStatus, string> = {pending: "ib-tag--warn", approved: "ib-tag--ok", rejected: "ib-tag--danger"};

// What a request asks for, as one line: «розмір 2 · 4Gi · запас 500m · 1Gi · вікно …».
function changeSummary(change: ResourceChange): string {
    const parts: string[] = [];
    if (change.Size) parts.push(t("manage.resources.history.size", {value: amountText(change.Size)}));
    if (change.Dynamic) parts.push(t("manage.resources.history.dynamic", {value: amountText(change.Dynamic)}));
    if (change.WindowStart) parts.push(t("manage.resources.history.from", {value: formatDateTime(change.WindowStart)}));
    if (change.WindowEnd) parts.push(t("manage.resources.history.to", {value: formatDateTime(change.WindowEnd)}));
    return parts.join(" · ");
}

export function ResourcesPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const query = useQuery({queryKey: ["event-management-resources", eventID], queryFn: () => getManageResources(eventID), refetchInterval: 30_000, refetchOnWindowFocus: false, placeholderData: previous => previous});
    const [requesting, setRequesting] = useState(false);

    // The task picker links here with ?request=1 when it hits «not enough reserved».
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only address, unknown on the server
        if (new URLSearchParams(window.location.search).get("request") === "1") setRequesting(true);
    }, []);

    const heading = <header className="event-manage-heading"><div><h1>{t("manage.resources.title")}</h1><p>{t("manage.resources.subtitle")}</p></div>
        {canManage && query.data?.Reserved && <div className="event-manage-heading__actions"><button className="ib-btn ib-btn--primary" type="button" onClick={() => setRequesting(true)}>{t("manage.resources.requestChange")}</button></div>}
    </header>;
    if (query.isPending) return <EventLoading event={event} label={t("manage.resources.loading")} />;
    if (query.isError) return <EventLoadError message={t("manage.resources.loadFailed")} error={query.error} onRetry={() => void query.refetch()} />;
    const resources = query.data;

    return <div className="event-manage-settings event-resources">
        {heading}
        {!resources.Reserved ? <section className="event-manage-section"><EmptyState message={t("manage.resources.notReserved")} /></section> : <>
            {!resources.Covered && <div className="event-manage-notice" role="status"><AlertTriangle size={18} aria-hidden="true" />{t("manage.resources.notCovered")}</div>}
            <dl className="event-resources__facts">
                <div><dt>{t("manage.resources.window")}</dt><dd className="event-resources__window"><span>{resources.From ? formatDateTime(resources.From) : "—"}</span><span>{resources.To ? formatDateTime(resources.To) : "—"}</span></dd></div>
                <div><dt>{t("manage.resources.allocated")}</dt><dd>{amountText(resources.Allocated)}</dd></div>
                <div><dt>{t("manage.resources.inUse")}</dt><dd>{amountText(resources.InUse)}</dd></div>
                <div><dt>{t("manage.resources.free")}</dt><dd>{amountText(resources.Free)}</dd></div>
                <div><dt>{t("manage.resources.teams")}</dt><dd>{resources.Teams}</dd></div>
                <div><dt>{t("manage.resources.buffer")}</dt><dd>{t("manage.resources.bufferValue", {percent: resources.BufferPercent})}</dd></div>
                <div><dt>{t("manage.resources.dynamic")}</dt><dd>{resources.Dynamic ? amountText(resources.Dynamic) : "—"}</dd></div>
            </dl>
            <section className="event-manage-section">
                <h2>{t("manage.resources.history.title")}</h2>
                {resources.Changes.length === 0 ? <EmptyState compact message={t("manage.resources.history.empty")} /> : <div className="event-participants-table"><table>
                    <thead><tr><th>{t("manage.resources.history.requested")}</th><th>{t("manage.resources.history.change")}</th><th>{t("manage.resources.history.reason")}</th><th>{t("manage.resources.history.status")}</th></tr></thead>
                    <tbody>{resources.Changes.map(change => <tr key={change.ID}>
                        <td className="event-participants-table__dim">{formatDateTime(change.RequestedAt)}</td>
                        <td>{changeSummary(change)}</td>
                        <td>{change.Reason}</td>
                        <td><span className={`ib-tag ib-tag--sm ${STATUS_TONE[change.Status]}`}>{t(`manage.resources.status.${change.Status}`)}</span>
                            {change.DecidedAt && <small className="event-participants-table__dim"> {formatDateTime(change.DecidedAt)}</small>}
                            {change.DecisionNote && <small className="event-participants-table__dim">{change.DecisionNote}</small>}</td>
                    </tr>)}</tbody>
                </table></div>}
            </section>
        </>}
        <ChangeRequestDialog eventID={eventID} open={requesting} onClose={() => setRequesting(false)} onSent={() => void query.refetch()} />
    </div>;
}
