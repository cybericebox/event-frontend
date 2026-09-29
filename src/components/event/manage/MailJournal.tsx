"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {
    emptyMailJournalFilters, getEventMailJournal, journalTarget, mailResultLabels, mailTransportLabel,
    mailTransportLabels, type MailJournalFilters, type MailResult, type MailTransport,
} from "@/api/manageMail";
import {signalLabel, signalLabels} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {t, tPlural} from "@/i18n/t";
import {EventSelect} from "@/components/ui/EventSelect";
import {useManager} from "./ManagerShell";

const all = "all";

function timestamp(value: string) {
    return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}).format(new Date(value));
}


export function MailJournal() {
    const {event} = useManager();
    const eventID = event.EventID;
    const [filters, setFilters] = useState<MailJournalFilters>(emptyMailJournalFilters);
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const cursor = cursors[pageIndex] ?? null;
    const query = useQuery({
        queryKey: ["event-manage-mail-journal", eventID, filters, cursor],
        queryFn: () => getEventMailJournal(eventID, filters, cursor),
        refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const filtered = filters.type !== null || filters.result !== null || filters.transport !== null || filters.channel !== emptyMailJournalFilters.channel;
    const email = filters.channel === "email";

    function changeFilters(patch: Partial<MailJournalFilters>) {
        setFilters(current => ({...current, ...patch}));
        setCursors([null]);
        setPageIndex(0);
    }

    function nextPage() {
        const next = query.data?.NextCursor;
        if (!next) return;
        setCursors(current => [...current.slice(0, pageIndex + 1), next]);
        setPageIndex(index => index + 1);
    }

    if (query.isPending && !query.data) return <EventLoading event={event} label={t("manage.mail.journal.loading")} />;
    if (query.isError && !query.data) return <div className="event-manage-error" role="alert"><h1>{t("manage.mail.journal.loadError")}</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>{t("common.retry")}</button></div>;

    const items = query.data?.Items ?? [];
    const channelOptions = [{value: "email", label: t("manage.mail.channel.email")}, {value: "in_app", label: t("manage.mail.channel.inApp")}];
    const typeOptions = [{value: all, label: t("manage.mail.journal.allTypes")}, ...Object.keys(signalLabels).map(type => ({value: type, label: signalLabel(type).title}))];
    const transportOptions = [{value: all, label: t("manage.mail.journal.allTransports")}, ...Object.entries(mailTransportLabels).map(([value, label]) => ({value, label}))];

    return <div className="event-manage-mail__panel">
        <section className="event-manage-section event-manage-mail__filters" aria-label={t("manage.mail.journal.filters")}>
            <label className="event-manage-field">{t("manage.mail.journal.type")}<EventSelect ariaLabel={t("manage.mail.journal.typeLabel")} value={filters.type ?? all} options={typeOptions} onValueChange={value => changeFilters({type: value === all ? null : value})} /></label>
            <label className="event-manage-field">{t("manage.mail.journal.channel")}<EventSelect ariaLabel={t("manage.mail.journal.channel")} value={filters.channel} options={channelOptions} onValueChange={value => changeFilters({channel: value, transport: value === "email" ? filters.transport : null})} /></label>
            {email && <label className="event-manage-field">{t("manage.mail.journal.transport")}<EventSelect ariaLabel={t("manage.mail.journal.transport")} value={filters.transport ?? all} options={transportOptions} onValueChange={value => changeFilters({transport: value === all ? null : value as MailTransport})} /></label>}
            <div className="event-manage-mail__filter-row">
                <div className="event-manage-participants__filters" role="group" aria-label={t("manage.mail.journal.result")}>
                    {([null, "done", "error"] as const).map(value => <button className="event-manage-participants__filter" key={value ?? all} type="button" aria-pressed={filters.result === value} onClick={() => changeFilters({result: value as MailResult | null})}>{value ? mailResultLabels[value] : t("common.all")}</button>)}
                </div>
                <span className="event-manage-mail__total">{tPlural("manage.mail.journal.count", query.data?.Total ?? 0)}</span>
                {filtered && <button className="ib-btn ib-btn--sm" type="button" onClick={() => changeFilters(emptyMailJournalFilters)}>{t("common.resetFilters")}</button>}
            </div>
        </section>
        <section className="event-manage-section event-manage-mail__journal" aria-label={t("manage.mail.tab.journal")}>
            {items.length === 0 ? <p className="event-challenge-manager__empty">{t(filtered ? "manage.mail.journal.emptyFiltered" : "manage.mail.journal.empty")}</p> : <div className="event-participants-table"><table>
                <thead><tr>
                    <th scope="col">{t("manage.mail.journal.col.time")}</th>
                    <th scope="col">{t("manage.mail.journal.col.recipient")}</th>
                    <th scope="col">{t("manage.mail.journal.col.type")}</th>
                    <th scope="col">{t("manage.mail.journal.col.status")}</th>
                    {email && <th scope="col">{t("manage.mail.journal.col.transport")}</th>}
                    <th scope="col">{t("manage.mail.journal.col.attempts")}</th>
                </tr></thead>
                <tbody>{items.map(item => {
                    const target = journalTarget(item, filters.channel);
                    const status = target?.Status === "done" || target?.Status === "error" ? target.Status : null;
                    return <tr key={item.ID}>
                        <td className="event-manage-mail__time"><time dateTime={target?.UpdatedAt ?? item.CreatedAt}>{timestamp(target?.UpdatedAt ?? item.CreatedAt)}</time></td>
                        <td><span className="event-manage-mail__recipient">{target?.Recipient || item.RecipientEmail || "—"}</span></td>
                        <td>{signalLabel(item.NotificationType).title}</td>
                        <td><div className="event-participants-table__person">
                            <span className={`event-manage-participants__status ${status === "done" ? "is-2" : status === "error" ? "is-3" : "is-1"}`}>{status ? mailResultLabels[status] : t("manage.mail.journal.pending")}</span>
                            {target?.Error && <small className="event-manage-mail__error">{target.Error}</small>}
                            {target?.FallbackError && <small>{t("manage.mail.journal.fallbackError", {error: target.FallbackError})}</small>}
                        </div></td>
                        {email && <td className="event-manage-mail__nowrap">{target?.Transport ? mailTransportLabel(target.Transport) : <span className="event-participants-table__dim">—</span>}</td>}
                        <td>{target ? target.Attempts : <span className="event-participants-table__dim">—</span>}</td>
                    </tr>;
                })}</tbody>
            </table></div>}
            {(pageIndex > 0 || !!query.data?.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>{t("common.back")}</button><span>{t("common.page", {number: pageIndex + 1})}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!query.data?.NextCursor} onClick={nextPage}>{t("common.next")}</button></div>}
        </section>
    </div>;
}
