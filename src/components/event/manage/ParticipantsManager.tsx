"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {decideManageParticipant, getManageParticipants, setIndividualParticipantHidden, type ManageParticipant, type ParticipantStatus} from "@/api/manageParticipants";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "./ManagerShell";

const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const statusNames: Record<ParticipantStatus, string> = {1: "Очікує рішення", 2: "Підтверджено", 3: "Відхилено"};

const filters: {value: ParticipantStatus | null; label: string}[] = [
    {value: null, label: "Усі"},
    {value: 1, label: "Заявки"},
    {value: 2, label: "Підтверджені"},
    {value: 3, label: "Відхилені"},
];

export function ParticipantsManager({initialFilter}: {initialFilter: ParticipantStatus | null}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<ParticipantStatus | null>(initialFilter);
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const [busyID, setBusyID] = useState<string | null>(null);
    const cursor = cursors[pageIndex] ?? null;
    const query = useQuery({queryKey: ["event-management-participants", eventID, filter, cursor], queryFn: () => getManageParticipants(eventID, filter, cursor), refetchOnWindowFocus: false});
    const pendingQuery = useQuery({queryKey: ["event-management-participants", eventID, 1, null, "count"], queryFn: () => getManageParticipants(eventID, 1, null, 1), enabled: filter !== 1, refetchOnWindowFocus: false});
    const pendingCount = filter === 1 ? query.data?.Total : pendingQuery.data?.Total;

    function changeFilter(value: ParticipantStatus | null) {
        setFilter(value);
        setCursors([null]);
        setPageIndex(0);
        const status = value === 1 ? "pending" : value === 2 ? "approved" : value === 3 ? "rejected" : null;
        window.history.replaceState(null, "", status ? `/manage/participants?status=${status}` : "/manage/participants");
    }

    async function decide(participant: ManageParticipant, action: "approve" | "reject") {
        if (!canManage || busyID) return;
        if (action === "reject" && !window.confirm(`Відхилити заявку ${participant.Name || participant.Email || participant.UserID}?`)) return;
        setBusyID(participant.UserID);
        try {
            await decideManageParticipant(eventID, participant.UserID, action);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-management-team-participants", eventID], refetchType: "all"}),
            ]);
            toast.success(action === "approve" ? "Участь підтверджено" : "Заявку відхилено");
        } catch {toast.error("Не вдалося змінити статус заявки.");}
        finally {setBusyID(null);}
    }

    async function setHidden(participant: ManageParticipant) {
        if (!canManage || busyID || teamMode || participant.Status !== 2 || !participant.TeamID) return;
        setBusyID(participant.UserID);
        try {
            await setIndividualParticipantHidden(eventID, participant.UserID, !participant.Hidden);
            await queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]});
            toast.success(participant.Hidden ? "Учасника повернуто до рейтингу" : "Учасника приховано з рейтингу та підрахунків");
        } catch {toast.error("Не вдалося змінити видимість учасника.");}
        finally {setBusyID(null);}
    }

    function nextPage() {
        const next = query.data?.NextCursor;
        if (!next) return;
        setCursors(current => [...current.slice(0, pageIndex + 1), next]);
        setPageIndex(index => index + 1);
    }

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо учасників…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити учасників</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>Учасники</h1><p>{teamMode ? "Заявки, статуси реєстрації та належність до команд." : "Заявки та статуси особистої участі."}</p></div><span className="event-attempts-manager__total">{filter === 1 ? "На розгляді" : "У списку"}: {query.data.Total}</span></header>
        <div className="event-manage-participants__filters" role="group" aria-label="Фільтр учасників">{filters.map(option => <button key={option.label} className="event-manage-participants__filter" type="button" aria-pressed={filter === option.value} onClick={() => changeFilter(option.value)}>{option.label}{option.value === 1 && pendingCount !== undefined && <span className="event-manage-participants__count">{pendingCount}</span>}</button>)}</div>
        <section className="event-manage-section event-manage-participants__list">
            {query.data.Items.length === 0 ? <p className="event-challenge-manager__empty">{filter === 1 ? "Нових заявок поки немає." : "Учасників із цим статусом поки немає."}</p> : query.data.Items.map(participant => <article className="event-manage-participants__row" key={participant.UserID}>
                <div className="event-manage-participants__identity"><strong>{participant.Name || participant.Email || `Учасник ${participant.UserID.slice(0, 8)}`}</strong>{participant.Email && <span>{participant.Email}</span>}<small>Подано {date.format(new Date(participant.CreatedAt))} UTC</small>{teamMode && participant.Status === 2 && <small>{participant.TeamID ? <Link href="/manage/teams">У команді</Link> : "Без команди"}</small>}</div>
                <span className={`event-manage-participants__status is-${participant.Status}`}>{statusNames[participant.Status]}{!teamMode && participant.Hidden ? " · Приховано" : ""}</span>
                {!teamMode && participant.Status === 2 && participant.TeamID && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => void setHidden(participant)}>{participant.Hidden ? "Показати в рейтингу" : "Приховати з рейтингу"}</button>}
                {participant.Status === 1 && canManage && <div className="event-manage-participants__actions"><button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!!busyID} onClick={() => void decide(participant, "approve")}>Підтвердити</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => void decide(participant, "reject")}>Відхилити</button></div>}
            </article>)}
            {(pageIndex > 0 || !!query.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!query.data.NextCursor} onClick={nextPage}>Далі</button></div>}
        </section>
    </div>;
}
