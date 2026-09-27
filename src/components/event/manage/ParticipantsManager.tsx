"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {decideManageParticipant, getManageParticipants, type ManageParticipant, type ParticipantStatus} from "@/api/manageParticipants";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";
import {useManager} from "./ManagerShell";

const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const statusNames: Record<ParticipantStatus, string> = {1: "Очікує рішення", 2: "Підтверджено", 3: "Відхилено"};

export function ParticipantsManager({applicationsOnly}: {applicationsOnly: boolean}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<ParticipantStatus | null>(applicationsOnly ? 1 : null);
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const [busyID, setBusyID] = useState<string | null>(null);
    const status = applicationsOnly ? 1 : filter;
    const cursor = cursors[pageIndex] ?? null;
    const query = useQuery({queryKey: ["event-management-participants", eventID, status, cursor], queryFn: () => getManageParticipants(eventID, status, cursor), refetchOnWindowFocus: false});

    function changeFilter(value: string) {
        setFilter(value === "all" ? null : Number(value) as ParticipantStatus);
        setCursors([null]);
        setPageIndex(0);
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

    function nextPage() {
        const next = query.data?.NextCursor;
        if (!next) return;
        setCursors(current => [...current.slice(0, pageIndex + 1), next]);
        setPageIndex(index => index + 1);
    }

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо учасників…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити учасників</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>{applicationsOnly ? "Заявки" : "Учасники"}</h1><p>{applicationsOnly ? "Розгляньте заявки на участь у події." : "Перегляньте статуси реєстрації учасників події."}</p></div><span className="event-attempts-manager__total">{applicationsOnly ? "На розгляді" : "Усього"}: {query.data.Total}</span></header>
        {!applicationsOnly && <div className="event-manage-participants__filter"><EventSelect ariaLabel="Статус учасника" value={status === null ? "all" : String(status)} options={[{value: "all", label: "Усі статуси"}, {value: "1", label: "Очікують рішення"}, {value: "2", label: "Підтверджені"}, {value: "3", label: "Відхилені"}]} onValueChange={changeFilter} /></div>}
        <section className="event-manage-section event-manage-participants__list">
            {query.data.Items.length === 0 ? <p className="event-challenge-manager__empty">{applicationsOnly ? "Нових заявок поки немає." : "Учасників із цим статусом поки немає."}</p> : query.data.Items.map(participant => <article className="event-manage-participants__row" key={participant.UserID}>
                <div className="event-manage-participants__identity"><strong>{participant.Name || participant.Email || `Учасник ${participant.UserID.slice(0, 8)}`}</strong>{participant.Email && <span>{participant.Email}</span>}<small>Подано {date.format(new Date(participant.CreatedAt))} UTC</small></div>
                <span className={`event-manage-participants__status is-${participant.Status}`}>{statusNames[participant.Status]}</span>
                {participant.Status === 1 && canManage && <div className="event-manage-participants__actions"><button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!!busyID} onClick={() => void decide(participant, "approve")}>Підтвердити</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => void decide(participant, "reject")}>Відхилити</button></div>}
            </article>)}
            {(pageIndex > 0 || !!query.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!query.data.NextCursor} onClick={nextPage}>Далі</button></div>}
        </section>
    </div>;
}
