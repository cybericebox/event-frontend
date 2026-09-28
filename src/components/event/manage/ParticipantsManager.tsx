"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {decideManageParticipant, getManageParticipants, inviteManageParticipants, setIndividualParticipantHidden, type ManageParticipant, type ParticipantInvitationResult, type ParticipantStatus} from "@/api/manageParticipants";
import {EventLoading} from "@/components/event/EventLoading";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {invitationEmails, parseInvitationCsv} from "./participantInvitations";
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
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteText, setInviteText] = useState("");
    const [csvEmails, setCsvEmails] = useState<string[]>([]);
    const [inviteResults, setInviteResults] = useState<ParticipantInvitationResult[]>([]);
    const [inviting, setInviting] = useState(false);
    const emails = invitationEmails(inviteText, csvEmails);
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

    async function invite() {
        if (!canManage || inviting || emails.length === 0 || emails.length > 200) return;
        setInviting(true);
        try {
            const results = await inviteManageParticipants(eventID, emails);
            setInviteResults(results);
            const sent = results.filter(result => !result.Error).length;
            if (sent) {
                await queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]});
                toast.success(`Надіслано запрошень: ${sent}`);
            }
            if (sent === results.length) {setInviteText(""); setCsvEmails([]);}
        } catch {toast.error("Не вдалося надіслати запрошення. Спробуйте ще раз.");}
        finally {setInviting(false);}
    }

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо учасників…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити учасників</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>Учасники</h1><p>{teamMode ? "Заявки, статуси реєстрації та належність до команд." : "Заявки та статуси особистої участі."}</p></div><div className="event-manage-section__actions"><span className="event-attempts-manager__total">{filter === 1 ? "На розгляді" : "У списку"}: {query.data.Total}</span>{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => {setInviteResults([]); setInviteOpen(true);}}>Запросити учасників</button>}</div></header>
        <Dialog open={inviteOpen} onOpenChange={open => {if (!inviting) setInviteOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>Запросити учасників</DialogTitle><DialogDescription>Вкажіть адреси вручну або додайте CSV. Запрошені з’являться в очікуванні до власного підтвердження.</DialogDescription></DialogHeader><div className="grid gap-4"><label className="event-manage-field"><span>Адреси електронної пошти</span><textarea className="event-manage-input" rows={5} value={inviteText} onChange={e => setInviteText(e.target.value)} placeholder="Одна адреса на рядок" disabled={inviting} /></label><label className="event-manage-field"><span>CSV-файл</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={inviting} onChange={async e => {const file = e.target.files?.[0]; if (file) {try {setCsvEmails(parseInvitationCsv(await file.text())); setInviteResults([]);} catch {toast.error("Не вдалося прочитати CSV-файл.");}}}} /><small>Колонка email або перша колонка файлу. До 200 адрес за раз.</small></label><p>Адрес для запрошення: {emails.length}</p>{emails.length > 200 && <p className="event-manage-validation" role="alert">За один раз можна запросити не більше 200 учасників.</p>}{inviteResults.length > 0 && <div role="status" className="grid gap-1">{inviteResults.map(result => <p key={result.Email}>{result.Email}: {result.Error || "запрошення надіслано"}</p>)}</div>}<div className="event-manage-section__actions"><button className="ib-btn" type="button" onClick={() => setInviteOpen(false)} disabled={inviting}>Закрити</button><button className="ib-btn ib-btn--primary" type="button" onClick={() => void invite()} disabled={inviting || emails.length === 0 || emails.length > 200}>{inviting ? "Надсилаємо…" : "Надіслати запрошення"}</button></div></div></DialogContent></Dialog>
        <div className="event-manage-participants__filters" role="group" aria-label="Фільтр учасників">{filters.map(option => <button key={option.label} className="event-manage-participants__filter" type="button" aria-pressed={filter === option.value} onClick={() => changeFilter(option.value)}>{option.label}{option.value === 1 && pendingCount !== undefined && <span className="event-manage-participants__count">{pendingCount}</span>}</button>)}</div>
        <section className="event-manage-section event-manage-participants__list">
            {query.data.Items.length === 0 ? <p className="event-challenge-manager__empty">{filter === 1 ? "Нових заявок поки немає." : "Учасників із цим статусом поки немає."}</p> : query.data.Items.map(participant => <article className="event-manage-participants__row" key={participant.UserID}>
                <div className="event-manage-participants__identity"><strong>{participant.Name || participant.Email || `Учасник ${participant.UserID.slice(0, 8)}`}</strong>{participant.Email && <span>{participant.Email}</span>}<small>Подано {date.format(new Date(participant.CreatedAt))} UTC</small>{teamMode && participant.Status === 2 && <small>{participant.TeamID ? <Link href="/manage/teams">У команді</Link> : "Без команди"}</small>}</div>
                <span className={`event-manage-participants__status is-${participant.Status}`}>{participant.Invited && participant.Status === 1 ? "Очікує відповіді" : statusNames[participant.Status]}{!teamMode && participant.Hidden ? " · Приховано" : ""}</span>
                {!teamMode && participant.Status === 2 && participant.TeamID && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => void setHidden(participant)}>{participant.Hidden ? "Показати в рейтингу" : "Приховати з рейтингу"}</button>}
                {participant.Status === 1 && !participant.Invited && canManage && <div className="event-manage-participants__actions"><button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!!busyID} onClick={() => void decide(participant, "approve")}>Підтвердити</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => void decide(participant, "reject")}>Відхилити</button></div>}
            </article>)}
            {(pageIndex > 0 || !!query.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!query.data.NextCursor} onClick={nextPage}>Далі</button></div>}
        </section>
    </div>;
}
