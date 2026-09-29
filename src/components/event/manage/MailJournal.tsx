"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {
    emptyMailJournalFilters, getEventMailJournal, journalTarget, mailResultLabels, mailTransportLabel,
    mailTransportLabels, type MailJournalFilters, type MailResult, type MailTransport,
} from "@/api/manageMail";
import {signalLabel, signalLabels} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {useManager} from "./ManagerShell";

const all = "all";
const channelOptions = [{value: "email", label: "Електронна пошта"}, {value: "in_app", label: "На сайті"}];

function timestamp(value: string) {
    return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}).format(new Date(value));
}

function recordCount(count: number) {
    const ending = count % 10 === 1 && count % 100 !== 11 ? "лист" : [2, 3, 4].includes(count % 10) && (count % 100 < 12 || count % 100 > 14) ? "листи" : "листів";
    return `${count} ${ending}`;
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

    if (query.isPending && !query.data) return <EventLoading event={event} label="Завантажуємо журнал…" />;
    if (query.isError && !query.data) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити журнал відправлення</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    const items = query.data?.Items ?? [];
    const typeOptions = [{value: all, label: "Усі типи"}, ...Object.keys(signalLabels).map(type => ({value: type, label: signalLabel(type).title}))];
    const transportOptions = [{value: all, label: "Усі способи"}, ...Object.entries(mailTransportLabels).map(([value, label]) => ({value, label}))];

    return <div className="event-manage-mail__panel">
        <section className="event-manage-section event-manage-mail__filters" aria-label="Фільтри журналу">
            <label className="event-manage-field">Тип<EventSelect ariaLabel="Тип листа" value={filters.type ?? all} options={typeOptions} onValueChange={value => changeFilters({type: value === all ? null : value})} /></label>
            <label className="event-manage-field">Канал<EventSelect ariaLabel="Канал" value={filters.channel} options={channelOptions} onValueChange={value => changeFilters({channel: value, transport: value === "email" ? filters.transport : null})} /></label>
            {email && <label className="event-manage-field">Спосіб надсилання<EventSelect ariaLabel="Спосіб надсилання" value={filters.transport ?? all} options={transportOptions} onValueChange={value => changeFilters({transport: value === all ? null : value as MailTransport})} /></label>}
            <div className="event-manage-mail__filter-row">
                <div className="event-manage-participants__filters" role="group" aria-label="Результат">
                    {([null, "done", "error"] as const).map(value => <button className="event-manage-participants__filter" key={value ?? all} type="button" aria-pressed={filters.result === value} onClick={() => changeFilters({result: value as MailResult | null})}>{value ? mailResultLabels[value] : "Усі"}</button>)}
                </div>
                <span className="event-manage-mail__total">{recordCount(query.data?.Total ?? 0)}</span>
                {filtered && <button className="ib-btn ib-btn--sm" type="button" onClick={() => changeFilters(emptyMailJournalFilters)}>Скинути фільтри</button>}
            </div>
        </section>
        <section className="event-manage-section event-manage-mail__journal" aria-label="Журнал відправлення">
            {items.length === 0 ? <p className="event-challenge-manager__empty">{filtered ? "За цим фільтром записів немає." : "Листів учасникам ще не надсилали."}</p> : <div className="event-participants-table"><table>
                <thead><tr>
                    <th scope="col">Час (UTC)</th>
                    <th scope="col">Одержувач</th>
                    <th scope="col">Тип</th>
                    <th scope="col">Статус</th>
                    {email && <th scope="col">Спосіб</th>}
                    <th scope="col">Спроби</th>
                </tr></thead>
                <tbody>{items.map(item => {
                    const target = journalTarget(item, filters.channel);
                    const status = target?.Status === "done" || target?.Status === "error" ? target.Status : null;
                    return <tr key={item.ID}>
                        <td className="event-manage-mail__time"><time dateTime={target?.UpdatedAt ?? item.CreatedAt}>{timestamp(target?.UpdatedAt ?? item.CreatedAt)}</time></td>
                        <td><span className="event-manage-mail__recipient">{target?.Recipient || item.RecipientEmail || "—"}</span></td>
                        <td>{signalLabel(item.NotificationType).title}</td>
                        <td><div className="event-participants-table__person">
                            <span className={`event-manage-participants__status ${status === "done" ? "is-2" : status === "error" ? "is-3" : "is-1"}`}>{status ? mailResultLabels[status] : "Очікує"}</span>
                            {target?.Error && <small className="event-manage-mail__error">{target.Error}</small>}
                            {target?.FallbackError && <small>Резерв після помилки SMTP заходу: {target.FallbackError}</small>}
                        </div></td>
                        {email && <td className="event-manage-mail__nowrap">{target?.Transport ? mailTransportLabel(target.Transport) : <span className="event-participants-table__dim">—</span>}</td>}
                        <td>{target ? target.Attempts : <span className="event-participants-table__dim">—</span>}</td>
                    </tr>;
                })}</tbody>
            </table></div>}
            {(pageIndex > 0 || !!query.data?.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!query.data?.NextCursor} onClick={nextPage}>Далі</button></div>}
        </section>
    </div>;
}
