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
import {t} from "@/i18n/t";

const sentAt = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});

function memberName(member: Pick<ManageTeamMember, "Name" | "Email" | "UserID">): string {
    return member.Name || member.Email || member.UserID.slice(0, 8);
}

function admissionText(team: ManageTeam): string {
    if (team.AdmittedManually) return t("manage.teams.admission.manual");
    if (team.Admitted) return t("manage.teams.admission.admitted");
    return t("manage.teams.admission.notAdmitted", {min: team.MinTeamSize ?? 2});
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
            toast.error(t("manage.teams.createFailed"));
            setBusy(false);
            return;
        }
        setName(""); setCaptainID(""); setFieldAnswers({});
        setCreateInviteManual(""); setCreateInviteCsv([]);
        setCreateOpen(false);
        try {await refresh();} catch {toast.error(t("manage.teams.createdNoRefresh"));}
        if (emails.length === 0) {
            toast.success(t("manage.teams.created"));
            setBusy(false);
            return;
        }
        try {
            const results = await inviteManageParticipants(eventID, emails, team.ID);
            const failed = results.filter(result => result.Error).map(result => result.Email);
            const sent = results.length - failed.length;
            if (failed.length) {
                setInviteTeam({ID: team.ID, Name: team.Name, InitialEmails: failed});
                toast.error(t("manage.teams.createdPartial", {sent, failed: failed.length}));
            } else toast.success(t("manage.teams.createdInvited", {count: sent}));
            try {await refresh();} catch {toast.error(t("manage.participants.refreshFailed"));}
        } catch {
            setInviteTeam({ID: team.ID, Name: team.Name, InitialEmails: emails});
            toast.error(t("manage.teams.createdInviteFailed"));
        } finally {setBusy(false);}
    }

    async function saveTeam(team: ManageTeam) {
        if (!canManage || busy || editing?.id !== team.ID || !editing.name.trim()) return;
        setBusy(true);
        try {
            await updateManageTeam(eventID, team.ID, {Name: editing.name.trim(), Hidden: editing.hidden, ...(fields.length > 0 ? {Fields: editing.fields} : {})});
            setEditing(null);
            await refresh();
            toast.success(t("manage.teams.updated"));
        } catch (error) {toast.error(failure(error, t("manage.teams.saveFailed")));}
        finally {setBusy(false);}
    }

    async function removeTeam(team: ManageTeam) {
        if (!canManage || busy || !window.confirm(t("manage.teams.confirmDelete", {name: team.Name}))) return;
        setBusy(true);
        try {
            await deleteManageTeam(eventID, team.ID);
            await refresh();
            toast.success(t("manage.teams.deleted"));
        } catch {toast.error(t("manage.teams.deleteFailed"));}
        finally {setBusy(false);}
    }

    async function changeMember(team: ManageTeam, userID: string, action: "add" | "remove") {
        if (!canManage || busy || !userID) return;
        if (action === "remove" && !window.confirm(t("manage.teams.confirmRemoveMember"))) return;
        setBusy(true);
        try {
            await changeManageTeamMember(eventID, team.ID, userID, action);
            setMemberChoices(current => ({...current, [team.ID]: ""}));
            await refresh();
            toast.success(action === "add" ? t("manage.teams.memberAdded") : t("manage.teams.memberRemoved"));
        } catch (error) {toast.error(failure(error, t("manage.teams.memberFailed")));}
        finally {setBusy(false);}
    }

    async function transferCaptain(team: ManageTeam, userID: string) {
        if (!canManage || busy || !window.confirm(t("manage.teams.confirmCaptain"))) return;
        setBusy(true);
        try {
            await transferManageTeamCaptain(eventID, team.ID, userID);
            await refresh();
            toast.success(t("manage.teams.captainChanged"));
        } catch (error) {toast.error(failure(error, t("manage.teams.captainFailed")));}
        finally {setBusy(false);}
    }

    async function setAdmission(team: ManageTeam, admitted: boolean) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await setManageTeamAdmission(eventID, team.ID, admitted);
            await refresh();
            toast.success(admitted ? t("manage.teams.admittedManually") : t("manage.teams.admissionCancelled"));
        } catch (error) {toast.error(failure(error, t("manage.teams.admissionFailed")));}
        finally {setBusy(false);}
    }

    if (!teamMode) return <div className="event-manage-settings event-manage-teams"><header className="event-manage-heading"><div><h1>{t("manage.nav.teams")}</h1></div></header><div className="event-manage-notice">{t("manage.teams.teamModeOnly")}</div></div>;
    if (teamsQuery.isPending || participantsQuery.isPending || fieldsQuery.isPending) return <EventLoading event={event} label={t("manage.teams.loading")} />;
    if (teamsQuery.isError || participantsQuery.isError || fieldsQuery.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.teams.loadFailed")}</h1><button className="ib-btn" type="button" onClick={() => {void teamsQuery.refetch(); void participantsQuery.refetch(); void fieldsQuery.refetch();}}>{t("common.retry")}</button></div>;

    return <div className="event-manage-settings event-manage-teams">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.teams")}</h1><p>{t("manage.teams.subtitle")}</p></div><div className="event-manage-section__actions"><span className="event-attempts-manager__total">{t("manage.teams.total", {count: teamsQuery.data.Total})}</span><FieldColumnsButton eventID={eventID} list="teams" columns={columns} canManage={canManage} />{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setCreateOpen(true)}>{t("manage.teams.create")}</button>}</div></header>
        <Dialog open={createOpen} onOpenChange={open => {if (!busy) setCreateOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(480px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{t("manage.teams.newTitle")}</DialogTitle><DialogDescription>{t("manage.teams.newDescription")}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={create}><label className="event-manage-field">{t("manage.teams.name")}<input className="event-manage-input" value={name} onChange={e => setName(e.target.value)} minLength={3} maxLength={64} required disabled={busy} placeholder={t("manage.teams.namePlaceholder")} /></label><div className="event-manage-field"><span>{t("manage.teams.captain")}</span><EventSelect ariaLabel={t("manage.teams.newCaptain")} value={captainID} placeholder={t("manage.teams.chooseParticipant")} options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={setCaptainID} disabled={busy || available.length === 0} /></div>{fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fieldAnswers} onChange={(key, value) => setFieldAnswers(current => ({...current, [key]: value}))} disabled={busy} />}<label className="event-manage-field"><span>{t("manage.participants.invite.title")}</span><textarea className="event-manage-input" rows={3} value={createInviteManual} onChange={e => setCreateInviteManual(e.target.value)} placeholder={t("manage.teams.invitePlaceholder")} disabled={busy} /></label><label className="event-manage-field"><span>{t("manage.teams.inviteCsv")}</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => {const file = e.target.files?.[0]; if (file) {try {setCreateInviteCsv(parseInvitationCsv(await file.text()));} catch {toast.error(t("manage.participants.invite.csvFailed"));}}}} /><small>{t("manage.teams.inviteCsvHint")}</small></label>{invitationEmails(createInviteManual, createInviteCsv).length > 200 && <p className="event-manage-validation" role="alert">{t("manage.participants.invite.limit")}</p>}<div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={busy} onClick={() => setCreateOpen(false)}>{t("common.cancel")}</button><button className="ib-btn ib-btn--primary" type="submit" disabled={busy || !name.trim() || !captainID || invitationEmails(createInviteManual, createInviteCsv).length > 200}>{t("manage.teams.create")}</button></div></form></DialogContent></Dialog>
        <TeamInvitationDialog key={inviteTeam?.ID ?? "closed"} eventID={eventID} team={inviteTeam} onClose={() => setInviteTeam(null)} onSent={refresh} />
        {teams.length === 0 ? <section className="event-manage-section"><p className="event-challenge-manager__empty">{t("manage.teams.empty")}</p></section> : <div className="event-manage-teams__list">{teams.map(team => {
            const captain = team.Members.find(member => member.UserID === team.CaptainID);
            const choice = memberChoices[team.ID] ?? "";
            return <section className="event-manage-section event-manage-teams__card" key={team.ID}>
                <div className="event-manage-teams__head"><div><h2>{team.Name}</h2><p>{t("manage.teams.summary", {count: team.MemberCount, captain: captain ? memberName(captain) : team.CaptainID.slice(0, 8)})}{team.Hidden ? t("manage.teams.hiddenSuffix") : ""}</p><p className={`event-manage-teams__admission${team.Admitted ? " is-admitted" : ""}`}>{admissionText(team)}</p></div>{canManage && <div className="event-manage-teams__head-actions"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setInviteTeam({ID: team.ID, Name: team.Name})}>{t("manage.teams.invite")}</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(current => current?.id === team.ID ? null : {id: team.ID, name: team.Name, hidden: team.Hidden, fields: team.ExtraFields as ParticipantAnswers})}>{editing?.id === team.ID ? t("common.cancel") : t("manage.teams.edit")}</button><button className="ib-btn ib-btn--sm event-content-editor__delete" type="button" aria-label={t("manage.teams.deleteLabel", {name: team.Name})} disabled={busy} onClick={() => void removeTeam(team)}><Trash2 size={16} /></button></div>}</div>
                {canManage && <label className="event-manage-form__switch"><input type="checkbox" checked={team.AdmittedManually} disabled={busy} onChange={event => void setAdmission(team, event.target.checked)} />{t("manage.teams.admitManually")}</label>}
                {editing?.id === team.ID && <div className="event-manage-teams__edit"><label className="event-manage-field">{t("manage.teams.name")}<input className="event-manage-input" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} minLength={3} maxLength={64} disabled={busy} /></label><label className="event-exercise-editor__check"><input type="checkbox" checked={editing.hidden} onChange={e => setEditing({...editing, hidden: e.target.checked})} disabled={busy} /> {t("manage.teams.excludeFromRanking")}</label><button className="ib-btn ib-btn--primary" type="button" disabled={busy || !editing.name.trim()} onClick={() => void saveTeam(team)}>{t("common.save")}</button>{fieldsQuery.data && fields.length > 0 && <div className="event-manage-teams__edit-fields"><TeamFieldsInputs form={fieldsQuery.data} answers={editing.fields} onChange={(key, value) => setEditing(current => current && {...current, fields: {...current.fields, [key]: value}})} disabled={busy} /></div>}</div>}
                {fieldColumns.length > 0 && <div className="event-manage-teams__members"><div className="event-manage-teams__members-head"><h3>{t("manage.fields.title")}</h3><button className="ib-btn ib-btn--sm" type="button" onClick={() => setAnswersTeam(team)}>{t("manage.teams.allAnswers")}</button></div><dl className="event-manage-teams__fields">{fieldColumns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{formatAnswer(team.ExtraFields[column.key])}</dd></div>)}</dl></div>}
                <div className="event-manage-teams__members"><h3>{t("manage.teams.roster")}</h3>{team.Members.length === 0 ? <p>{t("manage.teams.noMembers")}</p> : team.Members.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{memberName(person)}</strong>{person.Pseudonym && <small>{t("manage.participants.pseudonym", {pseudonym: person.Pseudonym})}</small>}{person.UserID === team.CaptainID && <small>{t("manage.teams.captain")}</small>}</span>{canManage && person.UserID !== team.CaptainID && <div><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void transferCaptain(team, person.UserID)}>{t("manage.teams.makeCaptain")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void changeMember(team, person.UserID, "remove")}>{t("manage.teams.removeMember")}</button></div>}</div>)}</div>
                {team.PendingInvitations.length > 0 && <div className="event-manage-teams__members"><h3>{t("manage.teams.invited")}</h3>{team.PendingInvitations.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{person.Email || person.Name || person.UserID.slice(0, 8)}</strong><small>{person.InvitationSentAt ? t("manage.participants.sentAt", {date: sentAt.format(new Date(person.InvitationSentAt))}) : t("manage.participants.notSent")}</small></span></div>)}</div>}
                {canManage && <div className="event-manage-teams__assign"><div className="event-manage-field"><span>{t("manage.teams.addMember")}</span><EventSelect ariaLabel={t("manage.teams.addMemberTo", {name: team.Name})} value={choice} placeholder={t("manage.teams.chooseParticipant")} options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={value => setMemberChoices(current => ({...current, [team.ID]: value}))} disabled={busy || available.length === 0} /></div><button className="ib-btn" type="button" disabled={busy || !choice} onClick={() => void changeMember(team, choice, "add")}>{t("common.add")}</button></div>}
            </section>;
        })}</div>}
        {(pageIndex > 0 || !!teamsQuery.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>{t("common.back")}</button><span>{t("common.page", {number: pageIndex + 1})}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!teamsQuery.data.NextCursor} onClick={() => {const next = teamsQuery.data.NextCursor; if (!next) return; setCursors(current => [...current.slice(0, pageIndex + 1), next]); setPageIndex(index => index + 1);}}>{t("common.next")}</button></div>}
        {participantsQuery.hasNextPage && <button className="ib-btn event-manage-teams__load-more" type="button" disabled={participantsQuery.isFetchingNextPage} onClick={() => void participantsQuery.fetchNextPage()}>{participantsQuery.isFetchingNextPage ? t("manage.teams.loadingMore") : t("manage.teams.loadMore")}</button>}
        <Dialog open={answersTeam !== null} onOpenChange={open => {if (!open) setAnswersTeam(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{answersTeam?.Name}</DialogTitle><DialogDescription>{t("manage.teams.answersDescription")}</DialogDescription></DialogHeader>{answersTeam && <AnswersList fields={fields} answers={answersTeam.ExtraFields} />}</DialogContent></Dialog>
    </div>;
}
