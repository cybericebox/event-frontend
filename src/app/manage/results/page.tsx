"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Download, RefreshCw} from "lucide-react";
import {downloadResultsCSV, getModeratorResults, resultsLiveURL, setResultsOpened, type ModeratorResults} from "@/api/manageResults";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";
import {useEventStream} from "@/utils/eventStream";
import {clockLabel, freezeLeadMinutes} from "@/utils/resultsFreeze";

const number = new Intl.NumberFormat("uk-UA");
const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});

// `now` is the snapshot time, so the text follows the data, not the render.
function freezeStatus(freeze: ModeratorResults["Freeze"], now: number): string {
    const lead = freezeLeadMinutes(freeze);
    if (freeze.OpenedAt) return `Підсумки відкрито о ${clockLabel(freeze.OpenedAt)} — учасники бачать актуальний рейтинг.`;
    if (freeze.Active && freeze.FrozenAt) return `Рейтинг заморожено з ${clockLabel(freeze.FrozenAt)} для учасників і гостей. Ви бачите актуальні дані.`;
    if (freeze.FrozenAt && freeze.FinishAt && Date.parse(freeze.FinishAt) <= now) return "Подію завершено — заморожування знято.";
    if (freeze.FrozenAt) return `Заморожування почнеться о ${clockLabel(freeze.FrozenAt)}${lead === null ? "" : `, за ${lead} хв до фіналу`}.`;
    return "Заморожування ввімкнено, але в події немає часу фінішу.";
}

export default function ManageResultsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<"open" | "export" | null>(null);
    const queryKey = ["event-management-moderator-results", eventID];
    const revision = queryClient.getQueryData<ModeratorResults>(queryKey)?.Revision;
    // Moderators are never frozen: the public stream only signals changes.
    const stream = useEventStream({url: () => revision === undefined ? null : resultsLiveURL(eventID, revision), events: ["result-change"], resetEvents: ["snapshot-required"], onChange: () => void queryClient.invalidateQueries({queryKey}), enabled: revision !== undefined});
    const query = useQuery({queryKey, queryFn: () => getModeratorResults(eventID), refetchInterval: stream === "fallback" ? 30_000 : false, refetchOnWindowFocus: false});

    async function toggleOpened(opened: boolean) {
        setBusy("open");
        try {
            await setResultsOpened(eventID, opened);
            await queryClient.invalidateQueries({queryKey});
            toast.success(opened ? "Підсумки відкрито" : "Заморожування повернуто");
        } catch {toast.error("Не вдалося змінити заморожування.");}
        finally {setBusy(null);}
    }

    async function exportCSV() {
        setBusy("export");
        try {await downloadResultsCSV(eventID);}
        catch {toast.error("Не вдалося експортувати результати.");}
        finally {setBusy(null);}
    }

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо результати…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити результати</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    const results = query.data;
    const teamMode = event.Participation === 1;
    const maxPoints = Math.max(1, ...results.Teams.map(entry => entry.Points));
    const freeze = results.Freeze;
    const generatedAt = Date.parse(results.GeneratedAt);
    const finished = !!freeze.FinishAt && Date.parse(freeze.FinishAt) <= generatedAt;
    return <div className="event-manage-settings event-manage-results">
        <header className="event-manage-heading"><div><h1>Таблиця результатів</h1><p>Актуальний рейтинг з усіма {teamMode ? "командами" : "учасниками"}, зокрема прихованими й недопущеними. {stream === "live" ? "Оновлюється наживо." : stream === "fallback" ? "Оновлюється кожні 30 с." : ""}</p></div>
            <div className="event-manage-results__actions"><button className="ib-btn" type="button" disabled={busy === "export"} onClick={() => void exportCSV()}><Download size={16} aria-hidden="true" /> {busy === "export" ? "Експортуємо…" : "Експорт CSV"}</button><button className="ib-btn" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} aria-hidden="true" /> {query.isFetching ? "Оновлюємо…" : "Оновити"}</button></div>
        </header>
        <div className="event-manage-results__summary"><div><span>У рейтингу</span><strong>{number.format(results.Counts.Ranked)}</strong></div><div><span>Приховані · недопущені</span><strong>{number.format(results.Counts.Hidden)} · {number.format(results.Counts.NotAdmitted)}</strong></div><div><span>Оновлено</span><strong>{date.format(new Date(results.GeneratedAt))} UTC</strong></div></div>
        {freeze.Enabled && <section className="event-manage-section event-manage-results__freeze" aria-label="Заморожування рейтингу"><p>{freezeStatus(freeze, generatedAt)}</p>{canManage && !finished && (freeze.OpenedAt
            ? <button className="ib-btn" type="button" disabled={busy === "open"} onClick={() => void toggleOpened(false)}>Повернути заморожування</button>
            : <button className="ib-btn ib-btn--primary" type="button" disabled={busy === "open"} onClick={() => void toggleOpened(true)}>Відкрити підсумки</button>)}</section>}
        <section className="event-manage-section"><div className="event-manage-section__head"><h2>Рейтинг</h2><p>{teamMode ? "Приховані й недопущені команди не мають місця." : "Приховані й недопущені учасники не мають місця."}</p></div>
            {results.Teams.length === 0 ? <p className="event-challenge-manager__empty">Результатів поки немає. Вони з’являться після першого зарахованого розв’язання.</p> : <div className="event-manage-results__table" role="table" aria-label="Рейтинг події">
                <div className="event-manage-results__table-head" role="row"><span role="columnheader">Місце</span><span role="columnheader">{teamMode ? "Команда" : "Учасник"}</span><span role="columnheader">Бали</span><span role="columnheader">Розв’язано</span><span role="columnheader">Останнє розв’язання</span></div>
                {results.Teams.map(entry => <div className="event-manage-results__row" role="row" key={entry.TeamID}>
                    <span role="cell" className="event-manage-results__rank">{entry.Rank ?? "—"}</span>
                    <span role="cell" className="event-manage-results__name">
                        <span className="event-manage-results__title"><strong>{entry.Name}</strong>{entry.Hidden && <span className="ib-tag ib-tag--sm">Прихована</span>}{!entry.Admitted && <span className="ib-tag ib-tag--sm ib-tag--warn">Не допущена</span>}</span>
                        {entry.Individual && (entry.RealName !== entry.Name || entry.Pseudonym) && <small>{entry.RealName}{entry.Pseudonym ? ` · псевдонім «${entry.Pseudonym}»` : ""}</small>}
                        <span className="event-manage-results__bar" aria-hidden="true"><i style={{width: `${Math.max(0, Math.min(100, entry.Points / maxPoints * 100))}%`}} /></span>
                    </span>
                    <span role="cell" className="event-manage-results__points">{number.format(entry.Points)}</span>
                    <span role="cell" className="event-manage-results__points">{number.format(entry.Solved)}</span>
                    <span role="cell" className="event-manage-results__time">{entry.LastSolveAt ? `${date.format(new Date(entry.LastSolveAt))} UTC` : "—"}</span>
                </div>)}
            </div>}
        </section>
    </div>;
}
