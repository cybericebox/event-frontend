"use client";

import {useQuery} from "@tanstack/react-query";
import {RefreshCw} from "lucide-react";
import {getManageResults} from "@/api/manageResults";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";

const number = new Intl.NumberFormat("uk-UA");
const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});

export default function ManageResultsPage() {
    const {event} = useManager();
    const query = useQuery({
        queryKey: ["event-management-results", event.EventID],
        queryFn: () => getManageResults(event.EventID),
        refetchInterval: 30_000,
        refetchOnWindowFocus: false,
    });
    if (query.isPending) return <EventLoading event={event} label="Завантажуємо результати…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити результати</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    const snapshot = query.data;
    const maxPoints = Math.max(1, ...snapshot.Scoreboard.map(entry => entry.Points));
    return <div className="event-manage-settings event-manage-results">
        <header className="event-manage-heading"><div><h1>Таблиця результатів</h1><p>Поточний рейтинг події. Дані оновлюються кожні 30 секунд.</p></div><button className="ib-btn" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} /> {query.isFetching ? "Оновлюємо…" : "Оновити"}</button></header>
        <div className="event-manage-results__summary"><div><span>У рейтингу</span><strong>{number.format(snapshot.Scoreboard.length)}</strong></div><div><span>Зарахованих розв’язань</span><strong>{number.format(snapshot.Timeline.length)}</strong></div><div><span>Оновлено</span><strong>{date.format(new Date(snapshot.GeneratedAt))} UTC</strong></div></div>
        <section className="event-manage-section"><div className="event-manage-section__head"><h2>Рейтинг</h2><p>{event.Participation === 1 ? "Команди впорядковані за балами." : "Учасники впорядковані за балами."}</p></div>
            {snapshot.Scoreboard.length === 0 ? <p className="event-challenge-manager__empty">Результатів поки немає. Вони з’являться після першого зарахованого розв’язання.</p> : <div className="event-manage-results__table" role="table" aria-label="Рейтинг події">
                <div className="event-manage-results__table-head" role="row"><span role="columnheader">Місце</span><span role="columnheader">{event.Participation === 1 ? "Команда" : "Учасник"}</span><span role="columnheader">Бали</span><span role="columnheader">Останнє розв’язання</span></div>
                {snapshot.Scoreboard.map(entry => <div className="event-manage-results__row" role="row" key={entry.TeamID}>
                    <span role="cell" className="event-manage-results__rank">{entry.Rank}</span>
                    <span role="cell" className="event-manage-results__name"><strong>{entry.TeamName}</strong><span className="event-manage-results__bar" aria-hidden="true"><i style={{width: `${Math.max(0, Math.min(100, entry.Points / maxPoints * 100))}%`}} /></span></span>
                    <span role="cell" className="event-manage-results__points">{number.format(entry.Points)}</span>
                    <span role="cell" className="event-manage-results__time">{entry.LastSolveAt ? `${date.format(new Date(entry.LastSolveAt))} UTC` : "—"}</span>
                </div>)}
            </div>}
        </section>
    </div>;
}
