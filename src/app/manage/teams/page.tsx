"use client";

import {useState, type FormEvent} from "react";
import {useInfiniteQuery, useQuery, useQueryClient} from "@tanstack/react-query";
import {Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageParticipants} from "@/api/manageParticipants";
import {getManageTeamFields} from "@/api/manageTeamFields";
import type {ParticipantAnswers} from "@/api/participantForm";
import {changeManageTeamMember, createManageTeam, deleteManageTeam, getManageTeams, transferManageTeamCaptain, updateManageTeam, type ManageTeam} from "@/api/manageTeams";
import {EventLoading} from "@/components/event/EventLoading";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {useManager} from "@/components/event/manage/ManagerShell";
import {TeamInvitationDialog} from "@/components/event/manage/TeamInvitationDialog";
import {EventSelect} from "@/components/ui/EventSelect";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";

export default function ManageTeamsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const teamMode = event.Participation === 1;
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const [name, setName] = useState("");
    const [captainID, setCaptainID] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [inviteTeam, setInviteTeam] = useState<{ID: string; Name: string} | null>(null);
    const [fieldAnswers, setFieldAnswers] = useState<ParticipantAnswers>({});
    const [editing, setEditing] = useState<{id: string; name: string; hidden: boolean} | null>(null);
    const [memberChoices, setMemberChoices] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const cursor = cursors[pageIndex] ?? null;
    const teamsQuery = useQuery({queryKey: ["event-management-teams", eventID, cursor], queryFn: () => getManageTeams(eventID, cursor), enabled: teamMode, refetchOnWindowFocus: false});
    const fieldsQuery = useQuery({queryKey: ["event-management-team-fields", eventID], queryFn: () => getManageTeamFields(eventID), enabled: teamMode, refetchOnWindowFocus: false});
    const participantsQuery = useInfiniteQuery({
        queryKey: ["event-management-team-participants", eventID],
        queryFn: ({pageParam}) => getManageParticipants(eventID, 2, pageParam, 40),
        initialPageParam: null as string | null,
        getNextPageParam: last => last.NextCursor ?? undefined,
        enabled: teamMode,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
    });
    const participants = participantsQuery.data?.pages.flatMap(page => page.Items) ?? [];
    const participantByID = new Map(participants.map(participant => [participant.UserID, participant]));
    const available = participants.filter(participant => !participant.TeamID);
    const teams = teamsQuery.data?.Items ?? [];

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-management-teams", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-team-participants", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]}),
        ]);
    }

    async function create(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!canManage || busy || !name.trim() || !captainID) return;
        setBusy(true);
        try {
            await createManageTeam(eventID, name.trim(), captainID, fieldAnswers);
            setName(""); setCaptainID(""); setFieldAnswers({});
            setCreateOpen(false);
            await refresh();
            toast.success("Команду створено");
        } catch {toast.error("Не вдалося створити команду. Перевірте капітана й обмеження події.");}
        finally {setBusy(false);}
    }

    async function saveTeam(team: ManageTeam) {
        if (!canManage || busy || editing?.id !== team.ID || !editing.name.trim()) return;
        setBusy(true);
        try {
            await updateManageTeam(eventID, team.ID, editing.name.trim(), editing.hidden);
            setEditing(null);
            await refresh();
            toast.success("Команду оновлено");
        } catch {toast.error("Не вдалося зберегти команду.");}
        finally {setBusy(false);}
    }

    async function removeTeam(team: ManageTeam) {
        if (!canManage || busy || !window.confirm(`Видалити команду «${team.Name}»? Учасники залишаться в події без команди, а результати цієї команди можуть бути втрачені.`)) return;
        setBusy(true);
        try {
            await deleteManageTeam(eventID, team.ID);
            await refresh();
            toast.success("Команду видалено");
        } catch {toast.error("Не вдалося видалити команду.");}
        finally {setBusy(false);}
    }

    async function changeMember(team: ManageTeam, userID: string, action: "add" | "remove") {
        if (!canManage || busy || !userID) return;
        if (action === "remove" && !window.confirm("Прибрати учасника з команди? Його результати можуть змінитися.")) return;
        setBusy(true);
        try {
            await changeManageTeamMember(eventID, team.ID, userID, action);
            setMemberChoices(current => ({...current, [team.ID]: ""}));
            await refresh();
            toast.success(action === "add" ? "Учасника додано" : "Учасника прибрано");
        } catch {toast.error("Не вдалося змінити склад команди.");}
        finally {setBusy(false);}
    }

    async function transferCaptain(team: ManageTeam, userID: string) {
        if (!canManage || busy || !window.confirm("Передати права капітана цьому учаснику?")) return;
        setBusy(true);
        try {
            await transferManageTeamCaptain(eventID, team.ID, userID);
            await refresh();
            toast.success("Капітана змінено");
        } catch {toast.error("Не вдалося змінити капітана.");}
        finally {setBusy(false);}
    }

    if (!teamMode) return <div className="event-manage-settings event-manage-teams"><header className="event-manage-heading"><div><h1>Команди</h1></div></header><div className="event-manage-notice">Команди доступні лише для командного формату події.</div></div>;
    if (teamsQuery.isPending || participantsQuery.isPending || fieldsQuery.isPending) return <EventLoading event={event} label="Завантажуємо команди…" />;
    if (teamsQuery.isError || participantsQuery.isError || fieldsQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити команди</h1><button className="ib-btn" type="button" onClick={() => {void teamsQuery.refetch(); void participantsQuery.refetch(); void fieldsQuery.refetch();}}>Повторити</button></div>;

    return <div className="event-manage-settings event-manage-teams">
        <header className="event-manage-heading"><div><h1>Команди</h1><p>Створюйте команди, змінюйте їхній склад і видимість.</p></div><div className="event-manage-section__actions"><span className="event-attempts-manager__total">Усього: {teamsQuery.data.Total}</span>{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setCreateOpen(true)}>Створити команду</button>}</div></header>
        <Dialog open={createOpen} onOpenChange={open => {if (!busy) setCreateOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(480px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>Нова команда</DialogTitle><DialogDescription>Капітан має бути підтвердженим учасником без команди.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={create}><label className="event-manage-field">Назва<input className="event-manage-input" value={name} onChange={e => setName(e.target.value)} maxLength={100} required disabled={busy} placeholder="Назва команди" /></label><div className="event-manage-field"><span>Капітан</span><EventSelect ariaLabel="Капітан нової команди" value={captainID} placeholder="Оберіть учасника" options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={setCaptainID} disabled={busy || available.length === 0} /></div>{fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fieldAnswers} onChange={(key, value) => setFieldAnswers(current => ({...current, [key]: value}))} disabled={busy} />}<div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={busy} onClick={() => setCreateOpen(false)}>Скасувати</button><button className="ib-btn ib-btn--primary" type="submit" disabled={busy || !name.trim() || !captainID}>Створити команду</button></div></form></DialogContent></Dialog>
        <TeamInvitationDialog key={inviteTeam?.ID ?? "closed"} eventID={eventID} team={inviteTeam} onClose={() => setInviteTeam(null)} onSent={refresh} />
        {teams.length === 0 ? <section className="event-manage-section"><p className="event-challenge-manager__empty">Команд поки немає.</p></section> : <div className="event-manage-teams__list">{teams.map(team => {
            const members = participants.filter(person => person.TeamID === team.ID);
            const captain = participantByID.get(team.CaptainID);
            const choice = memberChoices[team.ID] ?? "";
            return <section className="event-manage-section event-manage-teams__card" key={team.ID}>
                <div className="event-manage-teams__head"><div><h2>{team.Name}</h2><p>{team.MemberCount} у команді · Капітан: {captain?.Name || captain?.Email || team.CaptainID.slice(0, 8)}{team.Hidden ? " · Прихована" : ""}</p></div>{canManage && <div className="event-manage-teams__head-actions"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setInviteTeam({ID: team.ID, Name: team.Name})}>Запросити</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(current => current?.id === team.ID ? null : {id: team.ID, name: team.Name, hidden: team.Hidden})}>{editing?.id === team.ID ? "Скасувати" : "Змінити"}</button><button className="ib-btn ib-btn--sm event-content-editor__delete" type="button" aria-label={`Видалити команду ${team.Name}`} disabled={busy} onClick={() => void removeTeam(team)}><Trash2 size={16} /></button></div>}</div>
                {editing?.id === team.ID && <div className="event-manage-teams__edit"><label className="event-manage-field">Назва<input className="event-manage-input" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} maxLength={100} disabled={busy} /></label><label className="event-exercise-editor__check"><input type="checkbox" checked={editing.hidden} onChange={e => setEditing({...editing, hidden: e.target.checked})} disabled={busy} /> Не враховувати в рейтингу та підрахунках</label><button className="ib-btn ib-btn--primary" type="button" disabled={busy || !editing.name.trim()} onClick={() => void saveTeam(team)}>Зберегти</button></div>}
                {Object.keys(team.ExtraFields).length > 0 && <div className="event-manage-teams__members"><h3>Додаткові поля</h3>{Object.entries(team.ExtraFields).map(([key, value]) => {
                    const field = fieldsQuery.data?.Document.blocks.find(block => block.type === "field" && block.key === key);
                    return <p key={key}><strong>{field?.label ?? key}:</strong> {Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? value ? "Так" : "Ні" : String(value)}</p>;
                })}</div>}
                <div className="event-manage-teams__members"><h3>Склад</h3>{members.length === 0 ? <p>Учасники цієї команди ще не завантажені.</p> : members.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{person.Name || person.Email || person.UserID.slice(0, 8)}</strong>{person.UserID === team.CaptainID && <small>Капітан</small>}</span>{canManage && person.UserID !== team.CaptainID && <div><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void transferCaptain(team, person.UserID)}>Зробити капітаном</button><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void changeMember(team, person.UserID, "remove")}>Прибрати</button></div>}</div>)}{team.MemberCount > members.length && <p>Показано {members.length} із {team.MemberCount} учасників. Завантажте наступну сторінку списку.</p>}</div>
                {canManage && <div className="event-manage-teams__assign"><div className="event-manage-field"><span>Додати учасника</span><EventSelect ariaLabel={`Додати учасника до ${team.Name}`} value={choice} placeholder="Оберіть учасника" options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={value => setMemberChoices(current => ({...current, [team.ID]: value}))} disabled={busy || available.length === 0} /></div><button className="ib-btn" type="button" disabled={busy || !choice} onClick={() => void changeMember(team, choice, "add")}>Додати</button></div>}
            </section>;
        })}</div>}
        {(pageIndex > 0 || !!teamsQuery.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!teamsQuery.data.NextCursor} onClick={() => {const next = teamsQuery.data.NextCursor; if (!next) return; setCursors(current => [...current.slice(0, pageIndex + 1), next]); setPageIndex(index => index + 1);}}>Далі</button></div>}
        {participantsQuery.hasNextPage && <button className="ib-btn event-manage-teams__load-more" type="button" disabled={participantsQuery.isFetchingNextPage} onClick={() => void participantsQuery.fetchNextPage()}>{participantsQuery.isFetchingNextPage ? "Завантажуємо…" : "Завантажити ще учасників"}</button>}
    </div>;
}
