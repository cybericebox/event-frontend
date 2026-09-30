"use client";

import {useState} from "react";
import Link from "next/link";
import {Info} from "lucide-react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {
    emptyMailJournalFilters, getEventMailJournal, journalTarget, mailDispatchStatuses, mailJournalTypeLabel, mailJournalTypes, mailTestType, mailResultLabels, targetResult, mailTransportLabel,
    mailTransportLabels, targetRecipient, type MailJournalFilters, type MailJournalItem, type MailResult, type MailTransport,
} from "@/api/manageMail";
import {signalLabel, signalLabels} from "@/api/manageNotifications";
import {DialogModal} from "@/components/event/DialogModal";
import {t} from "@/i18n/t";
import {EventSelect} from "@/components/ui/EventSelect";
import {MailErrorText, MailRecipient} from "./MailJournalParts";
import {useManager} from "./ManagerShell";
import {ManageTable, ManageTablePagination, useCursorPages} from "./ManageTable";
import {formatDateTime, zoneOffset} from "@/utils/dateTime";

const all = "all";

const typeTitle = (type: string) => mailJournalTypeLabel(type, value => signalLabel(value).title);

// «Журнал надсилання»: every message the platform tried to send for this
// event, in the same table as the other manage journals.
export function MailJournal() {
    const {event} = useManager();
    const eventID = event.EventID;
    const [filters, setFilters] = useState<MailJournalFilters>(emptyMailJournalFilters);
    const pages = useCursorPages();
    const [detail, setDetail] = useState<MailJournalItem | null>(null);
    const query = useQuery({
        queryKey: ["event-manage-mail-journal", eventID, filters, pages.cursor, pages.pageSize],
        queryFn: () => getEventMailJournal(eventID, filters, pages.cursor, pages.pageSize),
        refetchOnWindowFocus: false, placeholderData: keepPreviousData,
    });
    const filtered = filters.type !== null || filters.status !== null || filters.result !== null || filters.transport !== null || filters.channel !== emptyMailJournalFilters.channel;
    const email = filters.channel === "email";
    const items = query.data?.Items ?? [];
    const busy = query.isFetching && !!query.data;
    const state = query.isPending ? "loading" : query.isError && !query.data ? "error" : items.length === 0 ? "empty" : "ready";

    function changeFilters(patch: Partial<MailJournalFilters>) {
        setFilters(current => ({...current, ...patch}));
        pages.reset();
    }

    const channelOptions = [{value: "email", label: t("manage.mail.channel.email")}, {value: "in_app", label: t("manage.mail.channel.inApp")}];
    const typeOptions = [{value: all, label: t("manage.mail.journal.allTypes")}, ...mailJournalTypes(Object.keys(signalLabels)).map(type => ({value: type, label: typeTitle(type)}))];
    const transportOptions = [{value: all, label: t("manage.mail.journal.allTransports")}, ...Object.entries(mailTransportLabels).map(([value, label]) => ({value, label}))];
    const statusOptions = [{value: all, label: t("manage.mail.journal.allStatuses")}, ...mailDispatchStatuses.map(value => ({value, label: t(`manage.mail.journal.status.${value}`)}))];
    const resultOptions = [{value: all, label: t("manage.mail.journal.allResults")}, ...(["done", "error", "deferred"] as const).map(value => ({value, label: mailResultLabels[value]}))];

    const toolbar = <>
        <EventSelect ariaLabel={t("manage.mail.journal.typeLabel")} value={filters.type ?? all} options={typeOptions} onValueChange={value => changeFilters({type: value === all ? null : value})} />
        <EventSelect ariaLabel={t("manage.mail.journal.statusLabel")} value={filters.status ?? all} options={statusOptions} onValueChange={value => changeFilters({status: value === all ? null : value})} />
        <EventSelect ariaLabel={t("manage.mail.journal.channel")} value={filters.channel} options={channelOptions} onValueChange={value => changeFilters({channel: value, transport: value === "email" ? filters.transport : null})} />
        <EventSelect ariaLabel={t("manage.mail.journal.result")} value={filters.result ?? all} options={resultOptions} onValueChange={value => changeFilters({result: value === all ? null : value as MailResult})} />
        {email && <EventSelect ariaLabel={t("manage.mail.journal.transport")} value={filters.transport ?? all} options={transportOptions} onValueChange={value => changeFilters({transport: value === all ? null : value as MailTransport})} />}
        {filtered && <button className="ib-btn ib-btn--sm" type="button" onClick={() => changeFilters(emptyMailJournalFilters)}>{t("common.resetFilters")}</button>}
    </>;

    return <div className="event-manage-settings event-journal">
        <header className="event-manage-heading"><div><h1>{t("manage.mailJournal.title")}</h1><p>{t("manage.mailJournal.subtitle")}</p></div></header>
        <ManageTable event={event} state={state} busy={busy} loadingLabel={t("manage.mail.journal.loading")} emptyMessage={t(filtered ? "manage.mail.journal.emptyFiltered" : "manage.mail.journal.empty")}
            errorMessage={t("manage.mail.journal.loadError")} onRetry={() => void query.refetch()} error={query.error} toolbar={toolbar}
            head={<tr>
                <th scope="col">{t("manage.mail.journal.col.time", {zone: zoneOffset()})}</th>
                <th scope="col">{t("manage.mail.journal.col.recipient")}</th>
                <th scope="col">{t("manage.mail.journal.col.type")}</th>
                <th scope="col">{t("manage.mail.journal.col.status")}</th>
                {email && <th scope="col">{t("manage.mail.journal.col.transport")}</th>}
                <th scope="col" className="ib-num">{t("manage.mail.journal.col.attempts")}</th>
                <th scope="col"><span className="ib-sr">{t("manage.mail.journal.col.details")}</span></th>
            </tr>}
            footer={<ManageTablePagination event={event} page={pages.page} pageSize={pages.pageSize} total={query.data?.Total ?? 0} hasNext={!!query.data?.NextCursor} busy={busy}
                onPrevious={pages.previous} onNext={() => pages.next(query.data?.NextCursor ?? undefined)} onPageSize={pages.setPageSize} />}>
            <tbody>{items.map(item => {
                const target = journalTarget(item, filters.channel);
                const status = targetResult(target);
                return <tr key={item.ID}>
                    <td className="event-manage-table__nowrap"><time dateTime={target?.UpdatedAt ?? item.CreatedAt}>{formatDateTime(target?.UpdatedAt ?? item.CreatedAt)}</time></td>
                    <td><MailRecipient {...targetRecipient(item, target)} /></td>
                    <td>{item.BroadcastID ? <Link className="ib-link" href={`/manage/broadcasts/${item.BroadcastID}`}>{typeTitle(item.NotificationType)}</Link> : typeTitle(item.NotificationType)}{item.NotificationType === mailTestType && <> <span className="event-manage-participants__status is-1">{t("manage.mail.journal.testBadge")}</span></>}</td>
                    <td><div className="event-participants-table__person">
                        <span className={`event-manage-participants__status ${status === "done" ? "is-2" : status === "error" ? "is-3" : "is-1"}`}>{status ? mailResultLabels[status] : t("manage.mail.journal.pending")}</span>
                        {target?.Error && (status === "deferred" ? <small>{target.Error}</small> : <MailErrorText className="event-manage-mail__error event-mail-note" kind={target.ErrorKind} code={target.ErrorCode} raw={target.Error} />)}
                        {target?.FallbackError && <MailErrorText className="event-mail-note" kind={target.FallbackErrorKind} code={target.FallbackErrorCode} raw={target.FallbackError} wrapKey="manage.mail.journal.fallbackError" />}
                    </div></td>
                    {email && <td className="event-manage-table__nowrap">{target?.Transport ? mailTransportLabel(target.Transport) : <span className="event-manage-table__dim">—</span>}</td>}
                    <td className="ib-num">{target ? target.Attempts : <span className="event-manage-table__dim">—</span>}</td>
                    <td><button className="ib-icon-btn ib-icon-btn--sm" type="button" aria-label={t("manage.mail.journal.detail.open", {type: typeTitle(item.NotificationType)})} onClick={() => setDetail(item)}><Info size={16} aria-hidden="true" /></button></td>
                </tr>;
            })}</tbody>
        </ManageTable>
        <DialogModal open={detail !== null} onClose={() => setDetail(null)} size="md" title={t("manage.mail.journal.detail.title")}
            footer={<button className="ib-btn" type="button" onClick={() => setDetail(null)}>{t("manage.mail.journal.detail.close")}</button>}>
            {detail && <div className="event-mail-detail">
                <dl className="event-mail-detail__facts">
                    <div><dt>{t("manage.mail.journal.col.type")}</dt><dd>{detail.BroadcastID ? <Link className="ib-link" href={`/manage/broadcasts/${detail.BroadcastID}`}>{typeTitle(detail.NotificationType)}</Link> : typeTitle(detail.NotificationType)}</dd></div>
                    <div><dt>{t("manage.mail.journal.col.recipient")}</dt><dd><MailRecipient name={detail.RecipientName.trim()} email={detail.RecipientEmail} /></dd></div>
                    <div><dt>{t("manage.mail.journal.detail.created")}</dt><dd><time dateTime={detail.CreatedAt}>{formatDateTime(detail.CreatedAt)}</time></dd></div>
                    <div><dt>{t("manage.mail.journal.col.status")}</dt><dd>{t(`manage.mail.journal.status.${detail.Status}`)}</dd></div>
                </dl>
                <h3>{t("manage.mail.journal.detail.targets")}</h3>
                {detail.Targets.length === 0 ? <p className="event-manage-table__dim">{t("manage.mail.journal.detail.noTargets")}</p>
                    : <ul>{detail.Targets.map(target => <li key={target.Channel}>
                        <div className="event-mail-detail__head"><strong>{t(target.Channel === "email" ? "manage.mail.channel.email" : "manage.mail.channel.inApp")}</strong>
                            <span className={`event-manage-participants__status ${target.Status === "done" ? "is-2" : target.Status === "error" ? "is-3" : "is-1"}`}>{targetResult(target) ? mailResultLabels[targetResult(target)!] : t("manage.mail.journal.pending")}</span></div>
                        <dl className="event-mail-detail__facts">
                            <div><dt>{t("manage.mail.journal.col.recipient")}</dt><dd><MailRecipient {...targetRecipient(detail, target)} /></dd></div>
                            <div><dt>{t("manage.mail.journal.col.attempts")}</dt><dd>{target.Attempts}</dd></div>
                            {target.Transport && <div><dt>{t("manage.mail.journal.col.transport")}</dt><dd>{mailTransportLabel(target.Transport)}</dd></div>}
                            <div><dt>{t("manage.mail.journal.detail.updated")}</dt><dd><time dateTime={target.UpdatedAt}>{formatDateTime(target.UpdatedAt)}</time></dd></div>
                        </dl>
                        {target.Error && (target.Status === "deferred" ? <p>{t("manage.mail.journal.detail.reason", {reason: target.Error})}</p> : <MailErrorText className="event-manage-mail__error" kind={target.ErrorKind} code={target.ErrorCode} raw={target.Error} wrapKey="manage.mail.journal.detail.error" />)}
                        {target.FallbackError && <MailErrorText kind={target.FallbackErrorKind} code={target.FallbackErrorCode} raw={target.FallbackError} wrapKey="manage.mail.journal.fallbackError" />}
                    </li>)}</ul>}
            </div>}
        </DialogModal>
    </div>;
}
