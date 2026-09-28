"use client";

import {useState, type FormEvent} from "react";
import {useInfiniteQuery, useQuery, useQueryClient} from "@tanstack/react-query";
import {Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageParticipants, inviteManageParticipants} from "@/api/manageParticipants";
import {getManageTeamFields} from "@/api/manageTeamFields";
import type {ParticipantAnswers} from "@/api/participantForm";
import {changeManageTeamMember, createManageTeam, deleteManageTeam, getManageTeams, setManageTeamAdmission, transferManageTeamCaptain, updateManageTeam, type ManageTeam, type ManageTeamMember} from "@/api/manageTeams";
import {EventLoading} from "@/components/event/EventLoading";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {useManager} from "@/components/event/manage/ManagerShell";
import {TeamInvitationDialog} from "@/components/event/manage/TeamInvitationDialog";
import {AnswersList, FieldColumnsButton, useFieldColumns} from "@/components/event/manage/FieldColumns";
import {formFields, formatAnswer} from "@/components/event/manage/listColumns";
import {invitationEmails, parseInvitationCsv} from "@/components/event/manage/participantInvitations";
import {EventSelect} from "@/components/ui/EventSelect";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";

const sentAt = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});

function memberName(member: Pick<ManageTeamMember, "Name" | "Email" | "UserID">): string {
    return member.Name || member.Email || member.UserID.slice(0, 8);
}

function admissionText(team: ManageTeam): string {
    if (team.AdmittedManually) return "Допущена вручну";
    if (team.Admitted) return "Допущена";
    return `Не допущена: менше ${team.MinTeamSize ?? 2} учасників`;
}

function failure(error: unknown, fallback: string): string {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}

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
    const [inviteTeam, setInviteTeam] = useState<{ID: string; Name: string; InitialEmails?: string[]} | null>(null);
    const [createInviteManual, setCreateInviteManual] = useState("");
    const [createInviteCsv, setCreateInviteCsv] = useState<string[]>([]);
    const [fieldAnswers, setFieldAnswers] = useState<ParticipantAnswers>({});
    const [editing, setEditing] = useState<{id: string; name: string; hidden: boolean; fields: ParticipantAnswers} | null>(null);
    const [answersTeam, setAnswersTeam] = useState<ManageTeam | null>(null);
    const [memberChoices, setMemberChoices] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const cursor = cursors[pageIndex] ?? null;
    const teamsQuery = useQuery({queryKey: ["event-management-teams", eventID, cursor], queryFn: () => getManageTeams(eventID, cursor), enabled: teamMode, refetchOnWindowFocus: false});
    const fieldsQuery = useQuery({queryKey: ["event-management-team-fields", eventID], queryFn: () => getManageTeamFields(eventID), enabled: teamMode, refetchOnWindowFocus: false});
    const participantsQuery = useInfiniteQuery({
        queryKey: ["event-management-team-participants", eventID],
        queryFn: ({pageParam}) => getManageParticipants(eventID, {kind: "participants"}, pageParam, 100),
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
    const fields = formFields(fieldsQuery.data?.Document.blocks);
    const {columns, visible: fieldColumns} = useFieldColumns(eventID, "teams", fields, teamMode && fields.length > 0);

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
        const captainEmail = participantByID.get(captainID)?.Email.toLowerCase();
        const emails = invitationEmails(createInviteManual, createInviteCsv).filter(email => email !== captainEmail);
        if (emails.length > 200) return;
        setBusy(true);
        let team: ManageTeam;
        try {
            team = await createManageTeam(eventID, name.trim(), captainID, fieldAnswers);
        } catch {
            toast.error("Не вдалося створити команду. Перевірте капітана й обмеження події.");
            setBusy(false);
            return;
        }
        setName(""); setCaptainID(""); setFieldAnswers({});
        setCreateInviteManual(""); setCreateInviteCsv([]);
        setCreateOpen(false);
        try {await refresh();} catch {toast.error("Команду створено, але список не оновився.");}
        if (emails.length === 0) {
            toast.success("Команду створено");
            setBusy(false);
            return;
        }
        try {
            const results = await inviteManageParticipants(eventID, emails, team.ID);
            const failed = results.filter(result => result.Error).map(result => result.Email);
            const sent = results.length - failed.length;
            if (failed.length) {
                setInviteTeam({ID: team.ID, Name: team.Name, InitialEmails: failed});
                toast.error(`Команду створено. Надіслано: ${sent}. Не вдалося: ${failed.length}.`);
            } else toast.success(`Команду створено. Надіслано запрошень: ${sent}`);
            try {await refresh();} catch {toast.error("Не вдалося оновити список учасників.");}
        } catch {
            setInviteTeam({ID: team.ID, Name: team.Name, InitialEmails: emails});
            toast.error("Команду створено, але запрошення не надіслані. Спробуйте ще раз у відкритому вікні.");
        } finally {setBusy(false);}
    }

    async function saveTeam(team: ManageTeam) {
        if (!canManage || busy || editing?.id !== team.ID || !editing.name.trim()) return;
        setBusy(true);
        try {
            await updateManageTeam(eventID, team.ID, {Name: editing.name.trim(), Hidden: editing.hidden, ...(fields.length > 0 ? {Fields: editing.fields} : {})});
            setEditing(null);
            await refresh();
            toast.success("Команду оновлено");
        } catch (error) {toast.error(failure(error, "Не вдалося зберегти команду."));}
        finally {setBusy(false);}
    }

    async function removeTeam(team: ManageTeam) {
        if (!canManage || busy || !window.confirm(`Видалити команду «${team.Name}»?\n\nУсі результати й розв’язання цієї команди буде втрачено без можливості відновлення. Учасники залишаться в події без команди.`)) return;
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
        } catch (error) {toast.error(failure(error, "Не вдалося змінити склад команди."));}
        finally {setBusy(false);}
    }

    async function transferCaptain(team: ManageTeam, userID: string) {
        if (!canManage || busy || !window.confirm("Передати права капітана цьому учаснику?")) return;
        setBusy(true);
        try {
            await transferManageTeamCaptain(eventID, team.ID, userID);
            await refresh();
            toast.success("Капітана змінено");
        } catch (error) {toast.error(failure(error, "Не вдалося змінити капітана."));}
        finally {setBusy(false);}
    }

    async function setAdmission(team: ManageTeam, admitted: boolean) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await setManageTeamAdmission(eventID, team.ID, admitted);
            await refresh();
            toast.success(admitted ? "Команду допущено вручну" : "Ручний допуск скасовано");
        } catch (error) {toast.error(failure(error, "Не вдалося змінити допуск команди."));}
        finally {setBusy(false);}
    }

    if (!teamMode) return <div className="event-manage-settings event-manage-teams"><header className="event-manage-heading"><div><h1>Команди</h1></div></header><div className="event-manage-notice">Команди доступні лише для командного формату події.</div></div>;
    if (teamsQuery.isPending || participantsQuery.isPending || fieldsQuery.isPending) return <EventLoading event={event} label="Завантажуємо команди…" />;
    if (teamsQuery.isError || participantsQuery.isError || fieldsQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити команди</h1><button className="ib-btn" type="button" onClick={() => {void teamsQuery.refetch(); void participantsQuery.refetch(); void fieldsQuery.refetch();}}>Повторити</button></div>;

    return <div className="event-manage-settings event-manage-teams">
        <header className="event-manage-heading"><div><h1>Команди</h1><p>Склад, допуск і відомості команд. Результати — на сторінці результатів.</p></div><div className="event-manage-section__actions"><span className="event-attempts-manager__total">Усього: {teamsQuery.data.Total}</span><FieldColumnsButton eventID={eventID} list="teams" columns={columns} canManage={canManage} />{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setCreateOpen(true)}>Створити команду</button>}</div></header>
        <Dialog open={createOpen} onOpenChange={open => {if (!busy) setCreateOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(480px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>Нова команда</DialogTitle><DialogDescription>Капітан має бути підтвердженим учасником без команди. Іншим учасникам можна одразу надіслати запрошення.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={create}><label className="event-manage-field">Назва<input className="event-manage-input" value={name} onChange={e => setName(e.target.value)} minLength={3} maxLength={64} required disabled={busy} placeholder="Назва команди" /></label><div className="event-manage-field"><span>Капітан</span><EventSelect ariaLabel="Капітан нової команди" value={captainID} placeholder="Оберіть учасника" options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={setCaptainID} disabled={busy || available.length === 0} /></div>{fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fieldAnswers} onChange={(key, value) => setFieldAnswers(current => ({...current, [key]: value}))} disabled={busy} />}<label className="event-manage-field"><span>Запросити учасників</span><textarea className="event-manage-input" rows={3} value={createInviteManual} onChange={e => setCreateInviteManual(e.target.value)} placeholder="Одна адреса на рядок (необов’язково)" disabled={busy} /></label><label className="event-manage-field"><span>Або додати CSV-файл</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => {const file = e.target.files?.[0]; if (file) {try {setCreateInviteCsv(parseInvitationCsv(await file.text()));} catch {toast.error("Не вдалося прочитати CSV-файл.");}}}} /><small>Колонка email або перша колонка. До 200 адрес за раз. Капітана повторно не запрошуємо.</small></label>{invitationEmails(createInviteManual, createInviteCsv).length > 200 && <p className="event-manage-validation" role="alert">За один раз можна запросити не більше 200 учасників.</p>}<div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={busy} onClick={() => setCreateOpen(false)}>Скасувати</button><button className="ib-btn ib-btn--primary" type="submit" disabled={busy || !name.trim() || !captainID || invitationEmails(createInviteManual, createInviteCsv).length > 200}>Створити команду</button></div></form></DialogContent></Dialog>
        <TeamInvitationDialog key={inviteTeam?.ID ?? "closed"} eventID={eventID} team={inviteTeam} onClose={() => setInviteTeam(null)} onSent={refresh} />
        {teams.length === 0 ? <section className="event-manage-section"><p className="event-challenge-manager__empty">Команд поки немає.</p></section> : <div className="event-manage-teams__list">{teams.map(team => {
            const captain = team.Members.find(member => member.UserID === team.CaptainID);
            const choice = memberChoices[team.ID] ?? "";
            return <section className="event-manage-section event-manage-teams__card" key={team.ID}>
                <div className="event-manage-teams__head"><div><h2>{team.Name}</h2><p>{team.MemberCount} у команді · Капітан: {captain ? memberName(captain) : team.CaptainID.slice(0, 8)}{team.Hidden ? " · Прихована" : ""}</p><p className={`event-manage-teams__admission${team.Admitted ? " is-admitted" : ""}`}>{admissionText(team)}</p></div>{canManage && <div className="event-manage-teams__head-actions"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setInviteTeam({ID: team.ID, Name: team.Name})}>Запросити</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(current => current?.id === team.ID ? null : {id: team.ID, name: team.Name, hidden: team.Hidden, fields: team.ExtraFields as ParticipantAnswers})}>{editing?.id === team.ID ? "Скасувати" : "Змінити"}</button><button className="ib-btn ib-btn--sm event-content-editor__delete" type="button" aria-label={`Видалити команду ${team.Name}`} disabled={busy} onClick={() => void removeTeam(team)}><Trash2 size={16} /></button></div>}</div>
                {canManage && <label className="event-manage-form__switch"><input type="checkbox" checked={team.AdmittedManually} disabled={busy} onChange={event => void setAdmission(team, event.target.checked)} />Допустити вручну</label>}
                {editing?.id === team.ID && <div className="event-manage-teams__edit"><label className="event-manage-field">Назва<input className="event-manage-input" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} minLength={3} maxLength={64} disabled={busy} /></label><label className="event-exercise-editor__check"><input type="checkbox" checked={editing.hidden} onChange={e => setEditing({...editing, hidden: e.target.checked})} disabled={busy} /> Не враховувати в рейтингу та підрахунках</label><button className="ib-btn ib-btn--primary" type="button" disabled={busy || !editing.name.trim()} onClick={() => void saveTeam(team)}>Зберегти</button>{fieldsQuery.data && fields.length > 0 && <div className="event-manage-teams__edit-fields"><TeamFieldsInputs form={fieldsQuery.data} answers={editing.fields} onChange={(key, value) => setEditing(current => current && {...current, fields: {...current.fields, [key]: value}})} disabled={busy} /></div>}</div>}
                {fieldColumns.length > 0 && <div className="event-manage-teams__members"><div className="event-manage-teams__members-head"><h3>Додаткові поля</h3><button className="ib-btn ib-btn--sm" type="button" onClick={() => setAnswersTeam(team)}>Усі відповіді</button></div><dl className="event-manage-teams__fields">{fieldColumns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{formatAnswer(team.ExtraFields[column.key])}</dd></div>)}</dl></div>}
                <div className="event-manage-teams__members"><h3>Склад</h3>{team.Members.length === 0 ? <p>У команді немає учасників.</p> : team.Members.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{memberName(person)}</strong>{person.Pseudonym && <small>Псевдонім: {person.Pseudonym}</small>}{person.UserID === team.CaptainID && <small>Капітан</small>}</span>{canManage && person.UserID !== team.CaptainID && <div><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void transferCaptain(team, person.UserID)}>Зробити капітаном</button><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void changeMember(team, person.UserID, "remove")}>Прибрати</button></div>}</div>)}</div>
                {team.PendingInvitations.length > 0 && <div className="event-manage-teams__members"><h3>Запрошені</h3>{team.PendingInvitations.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{person.Email || person.Name || person.UserID.slice(0, 8)}</strong><small>{person.InvitationSentAt ? `Надіслано ${sentAt.format(new Date(person.InvitationSentAt))} UTC` : "Лист не надіслано"}</small></span></div>)}</div>}
                {canManage && <div className="event-manage-teams__assign"><div className="event-manage-field"><span>Додати учасника</span><EventSelect ariaLabel={`Додати учасника до ${team.Name}`} value={choice} placeholder="Оберіть учасника" options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={value => setMemberChoices(current => ({...current, [team.ID]: value}))} disabled={busy || available.length === 0} /></div><button className="ib-btn" type="button" disabled={busy || !choice} onClick={() => void changeMember(team, choice, "add")}>Додати</button></div>}
            </section>;
        })}</div>}
        {(pageIndex > 0 || !!teamsQuery.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!teamsQuery.data.NextCursor} onClick={() => {const next = teamsQuery.data.NextCursor; if (!next) return; setCursors(current => [...current.slice(0, pageIndex + 1), next]); setPageIndex(index => index + 1);}}>Далі</button></div>}
        {participantsQuery.hasNextPage && <button className="ib-btn event-manage-teams__load-more" type="button" disabled={participantsQuery.isFetchingNextPage} onClick={() => void participantsQuery.fetchNextPage()}>{participantsQuery.isFetchingNextPage ? "Завантажуємо…" : "Завантажити ще учасників без команди"}</button>}
        <Dialog open={answersTeam !== null} onOpenChange={open => {if (!open) setAnswersTeam(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{answersTeam?.Name}</DialogTitle><DialogDescription>Відповіді на додаткові поля команди.</DialogDescription></DialogHeader>{answersTeam && <AnswersList fields={fields} answers={answersTeam.ExtraFields} />}</DialogContent></Dialog>
    </div>;
}
