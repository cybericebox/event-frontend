"use client";

import {useEffect, useState, type FormEvent} from "react";
import {useInfiniteQuery, useQuery, useQueryClient} from "@tanstack/react-query";
import {Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageParticipants, inviteManageParticipants} from "@/api/manageParticipants";
import {getManageTeamFields} from "@/api/manageTeamFields";
import type {ParticipantAnswers} from "@/api/participantForm";
import {changeManageTeamMember, createManageTeam, deleteManageTeam, getManageTeams, setManageTeamAdmission, transferManageTeamCaptain, updateManageTeam, type ManageTeam, type ManageTeamMember, type TeamAdmissionFilter} from "@/api/manageTeams";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {useManager} from "@/components/event/manage/ManagerShell";
import {TeamInvitationDialog} from "@/components/event/manage/TeamInvitationDialog";
import {ManageTable, ManageTablePagination, ManageTableSearch, useCursorPages} from "@/components/event/manage/ManageTable";
import {AnswersList, FieldColumnsButton, useFieldColumns} from "@/components/event/manage/FieldColumns";
import {formFields, formatAnswer} from "@/components/event/manage/listColumns";
import {invitationEmails, parseInvitationCsv} from "@/components/event/manage/participantInvitations";
import {EventSelect} from "@/components/ui/EventSelect";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";

const sentAt = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const MEMBER_TAGS = 3;

function memberName(member: Pick<ManageTeamMember, "Name" | "Email" | "UserID">): string {
    return member.Name || member.Email || member.UserID.slice(0, 8);
}

function admissionTag(team: ManageTeam): string {
    return team.Admitted ? "ib-tag--ok" : "ib-tag--danger";
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
    const pages = useCursorPages();
    const {cursor, pageSize, reset: resetPages} = pages;
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [admission, setAdmissionFilter] = useState<TeamAdmissionFilter | null>(null);
    const [managedID, setManagedID] = useState<string | null>(null);
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
    const teamsQuery = useQuery({
        queryKey: ["event-management-teams", eventID, debounced, admission, pageSize, cursor],
        queryFn: () => getManageTeams(eventID, cursor, {search: debounced, admission}, pageSize),
        enabled: teamMode, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
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
    const managed = teams.find(team => team.ID === managedID) ?? null;

    // Debounce the search box; an unchanged query keeps the current page.
    useEffect(() => {
        const next = search.trim();
        if (next === debounced) return;
        const id = setTimeout(() => {setDebounced(next); resetPages();}, 300);
        return () => clearTimeout(id);
    }, [search, debounced, resetPages]);

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
    const tableState = teamsQuery.isPending || participantsQuery.isPending || fieldsQuery.isPending ? "loading"
        : (teamsQuery.isError && !teamsQuery.data) || participantsQuery.isError || fieldsQuery.isError ? "error"
            : teams.length === 0 ? "empty" : "ready";

    return <div className="event-manage-settings event-manage-teams">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.teams")}</h1><p>{t("manage.teams.subtitle")}</p></div><div className="event-manage-heading__actions"><FieldColumnsButton eventID={eventID} list="teams" columns={columns} canManage={canManage} />{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setCreateOpen(true)}>{t("manage.teams.create")}</button>}</div></header>
        <Dialog open={createOpen} onOpenChange={open => {if (!busy) setCreateOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(480px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{t("manage.teams.newTitle")}</DialogTitle><DialogDescription>{t("manage.teams.newDescription")}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={create}><label className="event-manage-field">{t("manage.teams.name")}<input className="event-manage-input" value={name} onChange={e => setName(e.target.value)} minLength={3} maxLength={64} required disabled={busy} placeholder={t("manage.teams.namePlaceholder")} /></label><div className="event-manage-field"><span>{t("manage.teams.captain")}</span><EventSelect ariaLabel={t("manage.teams.newCaptain")} value={captainID} placeholder={t("manage.teams.chooseParticipant")} options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={setCaptainID} disabled={busy || available.length === 0} /></div>{fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fieldAnswers} onChange={(key, value) => setFieldAnswers(current => ({...current, [key]: value}))} disabled={busy} />}<label className="event-manage-field"><span>{t("manage.participants.invite.title")}</span><textarea className="event-manage-input" rows={3} value={createInviteManual} onChange={e => setCreateInviteManual(e.target.value)} placeholder={t("manage.teams.invitePlaceholder")} disabled={busy} /></label><label className="event-manage-field"><span>{t("manage.teams.inviteCsv")}</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => {const file = e.target.files?.[0]; if (file) {try {setCreateInviteCsv(parseInvitationCsv(await file.text()));} catch {toast.error(t("manage.participants.invite.csvFailed"));}}}} /><small>{t("manage.teams.inviteCsvHint")}</small></label>{invitationEmails(createInviteManual, createInviteCsv).length > 200 && <p className="event-manage-validation" role="alert">{t("manage.participants.invite.limit")}</p>}<div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={busy} onClick={() => setCreateOpen(false)}>{t("common.cancel")}</button><button className="ib-btn ib-btn--primary" type="submit" disabled={busy || !name.trim() || !captainID || invitationEmails(createInviteManual, createInviteCsv).length > 200}>{t("manage.teams.create")}</button></div></form></DialogContent></Dialog>
        <TeamInvitationDialog key={inviteTeam?.ID ?? "closed"} eventID={eventID} team={inviteTeam} onClose={() => setInviteTeam(null)} onSent={refresh} />
        <ManageTable event={event} state={tableState} busy={teamsQuery.isFetching && !teamsQuery.isPending} loadingLabel={t("manage.teams.loading")} errorMessage={t("manage.teams.loadFailed")}
            onRetry={() => {void teamsQuery.refetch(); void participantsQuery.refetch(); void fieldsQuery.refetch();}}
            emptyMessage={debounced || admission ? t("manage.teams.emptySearch") : t("manage.teams.empty")}
            toolbar={<>
                <ManageTableSearch value={search} onChange={setSearch} label={t("manage.teams.search")} />
                <EventSelect ariaLabel={t("manage.teams.filter.admission")} value={admission ?? "all"} onValueChange={value => {setAdmissionFilter(value === "all" ? null : value as TeamAdmissionFilter); resetPages();}}
                    options={[{value: "all", label: t("manage.teams.filter.all")}, {value: "admitted", label: t("manage.teams.filter.admitted")}, {value: "notAdmitted", label: t("manage.teams.filter.notAdmitted")}]} />
            </>}
            footer={<ManageTablePagination event={event} page={pages.page} pageSize={pageSize} total={teamsQuery.data?.Total ?? 0} hasNext={!!teamsQuery.data?.NextCursor} busy={teamsQuery.isFetching}
                onPrevious={pages.previous} onNext={() => pages.next(teamsQuery.data?.NextCursor)} onPageSize={pages.setPageSize} />}>
            <thead><tr>
                <th scope="col">{t("manage.teams.col.name")}</th>
                <th scope="col">{t("manage.teams.col.captain")}</th>
                <th scope="col">{t("manage.teams.col.members")}</th>
                <th scope="col">{t("manage.teams.col.status")}</th>
                <th scope="col">{t("manage.teams.col.created")}</th>
                {fieldColumns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
                <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.teams.col.actions")}</span></th>
            </tr></thead>
            <tbody>{teams.map(team => {
                const captain = team.Members.find(member => member.UserID === team.CaptainID);
                const others = team.Members.filter(member => member.UserID !== team.CaptainID);
                return <tr key={team.ID}>
                    <td><div className="event-manage-table__person"><strong>{team.Name}</strong>{team.Hidden && <small>{t("manage.teams.hidden")}</small>}</div></td>
                    <td>{captain ? memberName(captain) : <span className="event-manage-table__dim">{team.CaptainID.slice(0, 8)}</span>}</td>
                    <td><div className="event-manage-table__tags"><span className="event-manage-table__count">{team.MemberCount}</span>{others.slice(0, MEMBER_TAGS).map(member => <span className="ib-tag ib-tag--sm" key={member.UserID}>{memberName(member)}</span>)}{others.length > MEMBER_TAGS && <span className="ib-tag ib-tag--sm">{t("manage.teams.moreMembers", {count: others.length - MEMBER_TAGS})}</span>}</div></td>
                    <td><span className={`ib-tag ${admissionTag(team)}`}>{admissionText(team)}</span></td>
                    <td className="event-manage-table__nowrap event-manage-table__dim">{t("manage.participants.dateUtc", {date: sentAt.format(new Date(team.CreatedAt))})}</td>
                    {fieldColumns.map(column => <td key={column.key} className="event-manage-table__answer">{formatAnswer(team.ExtraFields[column.key])}</td>)}
                    <td><div className="event-manage-table__actions">
                        {canManage && <button className="ib-btn ib-btn--sm" type="button" onClick={() => setInviteTeam({ID: team.ID, Name: team.Name})}>{t("manage.teams.invite")}</button>}
                        <button className="ib-btn ib-btn--sm" type="button" aria-label={t("manage.teams.manageLabel", {name: team.Name})} onClick={() => {setEditing(null); setManagedID(team.ID);}}>{t("manage.teams.manage")}</button>
                        {canManage && <button className="ib-btn ib-btn--sm event-content-editor__delete" type="button" aria-label={t("manage.teams.deleteLabel", {name: team.Name})} disabled={busy} onClick={() => void removeTeam(team)}><Trash2 size={16} /></button>}
                    </div></td>
                </tr>;
            })}</tbody>
        </ManageTable>
        <Dialog open={managed !== null} onOpenChange={open => {if (!open && !busy) {setManagedID(null); setEditing(null);}}}><DialogContent className="max-h-[90dvh] max-w-[min(640px,calc(100vw-24px))] overflow-y-auto">
            <DialogHeader><DialogTitle>{managed?.Name}</DialogTitle><DialogDescription>{t("manage.teams.detailsDescription")}</DialogDescription></DialogHeader>
            {managed && (() => {
                const team = managed;
                const captain = team.Members.find(member => member.UserID === team.CaptainID);
                const choice = memberChoices[team.ID] ?? "";
                return <div className="event-manage-team-details">
                    <div className="event-manage-teams__head"><div><p>{t("manage.teams.summary", {count: team.MemberCount, captain: captain ? memberName(captain) : team.CaptainID.slice(0, 8)})}{team.Hidden ? t("manage.teams.hiddenSuffix") : ""}</p><p className={`event-manage-teams__admission${team.Admitted ? " is-admitted" : ""}`}>{admissionText(team)}</p></div>{canManage && <div className="event-manage-teams__head-actions"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(current => current?.id === team.ID ? null : {id: team.ID, name: team.Name, hidden: team.Hidden, fields: team.ExtraFields as ParticipantAnswers})}>{editing?.id === team.ID ? t("common.cancel") : t("manage.teams.edit")}</button></div>}</div>
                    {canManage && <label className="event-manage-form__switch"><input type="checkbox" checked={team.AdmittedManually} disabled={busy} onChange={event => void setAdmission(team, event.target.checked)} />{t("manage.teams.admitManually")}</label>}
                    {editing?.id === team.ID && <div className="event-manage-teams__edit"><label className="event-manage-field">{t("manage.teams.name")}<input className="event-manage-input" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} minLength={3} maxLength={64} disabled={busy} /></label><label className="event-exercise-editor__check"><input type="checkbox" checked={editing.hidden} onChange={e => setEditing({...editing, hidden: e.target.checked})} disabled={busy} /> {t("manage.teams.excludeFromRanking")}</label><button className="ib-btn ib-btn--primary" type="button" disabled={busy || !editing.name.trim()} onClick={() => void saveTeam(team)}>{t("common.save")}</button>{fieldsQuery.data && fields.length > 0 && <div className="event-manage-teams__edit-fields"><TeamFieldsInputs form={fieldsQuery.data} answers={editing.fields} onChange={(key, value) => setEditing(current => current && {...current, fields: {...current.fields, [key]: value}})} disabled={busy} /></div>}</div>}
                    {fields.length > 0 && <div className="event-manage-teams__members"><div className="event-manage-teams__members-head"><h3>{t("manage.fields.title")}</h3><button className="ib-btn ib-btn--sm" type="button" onClick={() => setAnswersTeam(team)}>{t("manage.teams.allAnswers")}</button></div>{fieldColumns.length > 0 && <dl className="event-manage-teams__fields">{fieldColumns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{formatAnswer(team.ExtraFields[column.key])}</dd></div>)}</dl>}</div>}
                    <div className="event-manage-teams__members"><h3>{t("manage.teams.roster")}</h3>{team.Members.length === 0 ? <EmptyState compact message={t("manage.teams.noMembers")} /> : team.Members.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{memberName(person)}</strong>{person.Pseudonym && <small>{t("manage.participants.pseudonym", {pseudonym: person.Pseudonym})}</small>}{person.UserID === team.CaptainID && <small>{t("manage.teams.captain")}</small>}</span>{canManage && person.UserID !== team.CaptainID && <div><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void transferCaptain(team, person.UserID)}>{t("manage.teams.makeCaptain")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void changeMember(team, person.UserID, "remove")}>{t("manage.teams.removeMember")}</button></div>}</div>)}</div>
                    {team.PendingInvitations.length > 0 && <div className="event-manage-teams__members"><h3>{t("manage.teams.invited")}</h3>{team.PendingInvitations.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{person.Email || person.Name || person.UserID.slice(0, 8)}</strong><small>{person.InvitationSentAt ? t("manage.participants.sentAt", {date: sentAt.format(new Date(person.InvitationSentAt))}) : t("manage.participants.notSent")}</small></span></div>)}</div>}
                    {canManage && <div className="event-manage-teams__assign"><div className="event-manage-field"><span>{t("manage.teams.addMember")}</span><EventSelect ariaLabel={t("manage.teams.addMemberTo", {name: team.Name})} value={choice} placeholder={t("manage.teams.chooseParticipant")} options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={value => setMemberChoices(current => ({...current, [team.ID]: value}))} disabled={busy || available.length === 0} /></div><button className="ib-btn" type="button" disabled={busy || !choice} onClick={() => void changeMember(team, choice, "add")}>{t("common.add")}</button></div>}
                    {canManage && participantsQuery.hasNextPage && <EventButton className="ib-btn event-manage-teams__load-more" type="button" disabled={participantsQuery.isFetchingNextPage} onClick={() => void participantsQuery.fetchNextPage()} busy={participantsQuery.isFetchingNextPage}>{t("manage.teams.loadMore")}</EventButton>}
                </div>;
            })()}
        </DialogContent></Dialog>
        <Dialog open={answersTeam !== null} onOpenChange={open => {if (!open) setAnswersTeam(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{answersTeam?.Name}</DialogTitle><DialogDescription>{t("manage.teams.answersDescription")}</DialogDescription></DialogHeader>{answersTeam && <AnswersList fields={fields} answers={answersTeam.ExtraFields} />}</DialogContent></Dialog>
    </div>;
}
