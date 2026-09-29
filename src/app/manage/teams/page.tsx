"use client";

import {Fragment, useEffect, useState} from "react";
import {useInfiniteQuery, useQuery, useQueryClient} from "@tanstack/react-query";
import {Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageParticipants} from "@/api/manageParticipants";
import {getManageTeamFields} from "@/api/manageTeamFields";
import type {ParticipantAnswers} from "@/api/participantForm";
import {changeManageTeamMember, deleteManageTeam, getManageTeams, setManageTeamAdmission, transferManageTeamCaptain, updateManageTeam, type ManageTeam, type ManageTeamMember, type TeamAdmissionFilter} from "@/api/manageTeams";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {useManager} from "@/components/event/manage/ManagerShell";
import {CreateTeamDialog} from "@/components/event/manage/CreateTeamDialog";
import {TeamInvitationDialog} from "@/components/event/manage/TeamInvitationDialog";
import {ManageTable, ManageTablePagination, ManageTableSearch, useCursorPages} from "@/components/event/manage/ManageTable";
import {AnswersList} from "@/components/event/manage/FieldColumns";
import {TableColumnsPopover, TableFiltersPopover, useTableColumns} from "@/components/event/manage/TableControls";
import {fieldColumnDefinitions, formFields, formatAnswer, toAnswerFilters, type AnswerFilterDraft, type TableColumn} from "@/components/event/manage/listColumns";
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

// The captain may still be a pending invitee (batch-built teams).
function captainName(team: ManageTeam): string {
    const captain = team.Members.find(member => member.UserID === team.CaptainID) ?? team.PendingInvitations.find(person => person.UserID === team.CaptainID);
    return captain ? memberName(captain) : team.CaptainID.slice(0, 8);
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
    const [drafts, setDrafts] = useState<Record<string, AnswerFilterDraft>>({});
    const [appliedFilters, setAppliedFilters] = useState("[]");
    const [managedID, setManagedID] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [inviteTeam, setInviteTeam] = useState<{ID: string; Name: string; InitialEmails?: string[]} | null>(null);
    const [editing, setEditing] = useState<{id: string; name: string; hidden: boolean; fields: ParticipantAnswers} | null>(null);
    const [answersTeam, setAnswersTeam] = useState<ManageTeam | null>(null);
    const [memberChoices, setMemberChoices] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const teamsQuery = useQuery({
        queryKey: ["event-management-teams", eventID, debounced, admission, appliedFilters, pageSize, cursor],
        queryFn: () => getManageTeams(eventID, cursor, {search: debounced, admission, fields: JSON.parse(appliedFilters)}, pageSize),
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
    const available = participants.filter(participant => !participant.TeamID);
    const teams = teamsQuery.data?.Items ?? [];
    const fields = formFields(fieldsQuery.data?.Document.blocks);
    const tableColumns = useTableColumns(eventID, "teams", [
        {key: "@name", label: t("manage.teams.col.name"), locked: true},
        {key: "@captain", label: t("manage.teams.col.captain")},
        {key: "@members", label: t("manage.teams.col.members")},
        {key: "@status", label: t("manage.teams.col.status")},
        {key: "@created", label: t("manage.teams.col.created")},
        ...fieldColumnDefinitions(fields),
    ], canManage);
    const fieldColumns = tableColumns.visible.filter(column => !column.key.startsWith("@"));
    const answerFilters = toAnswerFilters(fields, drafts);
    const answerFiltersKey = JSON.stringify(answerFilters);
    const anyFilter = !!search.trim() || admission !== null || answerFilters.length > 0;
    const managed = teams.find(team => team.ID === managedID) ?? null;

    // Debounce the search box; an unchanged query keeps the current page.
    useEffect(() => {
        const next = search.trim();
        if (next === debounced) return;
        const id = setTimeout(() => {setDebounced(next); resetPages();}, 300);
        return () => clearTimeout(id);
    }, [search, debounced, resetPages]);

    // Field filters apply after the same pause as the search box.
    useEffect(() => {
        if (answerFiltersKey === appliedFilters) return;
        const id = setTimeout(() => {setAppliedFilters(answerFiltersKey); resetPages();}, 300);
        return () => clearTimeout(id);
    }, [answerFiltersKey, appliedFilters, resetPages]);

    function resetFilters() {
        setSearch(""); setDebounced(""); setAdmissionFilter(null); setDrafts({}); setAppliedFilters("[]");
        resetPages();
    }

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-management-teams", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-team-participants", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]}),
        ]);
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
    function teamCell(column: TableColumn, team: ManageTeam) {
        const others = team.Members.filter(member => member.UserID !== team.CaptainID);
        const pending = team.PendingInvitations.filter(person => person.UserID !== team.CaptainID);
        const tags = [...others.map(member => ({id: member.UserID, name: memberName(member), pending: false})), ...pending.map(person => ({id: person.UserID, name: memberName(person), pending: true}))];
        switch (column.key) {
        case "@name": return <td><div className="event-manage-table__person"><strong>{team.Name}</strong>{team.Hidden && <small>{t("manage.teams.hidden")}</small>}</div></td>;
        case "@captain": return <td><div className="event-manage-table__person"><span>{captainName(team)}</span>{team.CaptainPending && <small>{t("manage.teams.pendingConfirmation")}</small>}</div></td>;
        case "@members": return <td><div className="event-manage-table__person"><div className="event-manage-table__tags"><span className="event-manage-table__count">{team.MemberCount}</span>{tags.slice(0, MEMBER_TAGS).map(tag => <span className={`ib-tag ib-tag--sm${tag.pending ? " ib-tag--warn" : ""}`} key={tag.id} title={tag.pending ? t("manage.teams.pendingConfirmation") : undefined}>{tag.name}</span>)}{tags.length > MEMBER_TAGS && <span className="ib-tag ib-tag--sm">{t("manage.teams.moreMembers", {count: tags.length - MEMBER_TAGS})}</span>}</div>{team.PendingInvitations.length > 0 && <small>{t("manage.teams.pendingCount", {count: team.PendingInvitations.length})}</small>}</div></td>;
        case "@status": return <td><span className={`ib-tag ${admissionTag(team)}`}>{admissionText(team)}</span></td>;
        case "@created": return <td className="event-manage-table__nowrap event-manage-table__dim">{t("manage.participants.dateUtc", {date: sentAt.format(new Date(team.CreatedAt))})}</td>;
        default: return <td className="event-manage-table__answer">{formatAnswer(team.ExtraFields[column.key])}</td>;
        }
    }

    const tableState = teamsQuery.isPending || participantsQuery.isPending || fieldsQuery.isPending ? "loading"
        : (teamsQuery.isError && !teamsQuery.data) || participantsQuery.isError || fieldsQuery.isError ? "error"
            : teams.length === 0 ? "empty" : "ready";

    return <div className="event-manage-settings event-manage-teams">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.teams")}</h1><p>{t("manage.teams.subtitle")}</p></div><div className="event-manage-heading__actions">{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setCreateOpen(true)}>{t("manage.teams.create")}</button>}</div></header>
        <CreateTeamDialog eventID={eventID} open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
        <TeamInvitationDialog key={inviteTeam?.ID ?? "closed"} eventID={eventID} team={inviteTeam} onClose={() => setInviteTeam(null)} onSent={refresh} />
        <ManageTable event={event} state={tableState} busy={teamsQuery.isFetching && !teamsQuery.isPending} loadingLabel={t("manage.teams.loading")} errorMessage={t("manage.teams.loadFailed")}
            onRetry={() => {void teamsQuery.refetch(); void participantsQuery.refetch(); void fieldsQuery.refetch();}}
            emptyMessage={debounced || admission || appliedFilters !== "[]" ? t("manage.teams.emptySearch") : t("manage.teams.empty")}
            toolbar={<>
                <ManageTableSearch value={search} onChange={setSearch} label={t("manage.teams.search")} />
                <EventSelect ariaLabel={t("manage.teams.filter.admission")} value={admission ?? "all"} onValueChange={value => {setAdmissionFilter(value === "all" ? null : value as TeamAdmissionFilter); resetPages();}}
                    options={[{value: "all", label: t("manage.teams.filter.all")}, {value: "admitted", label: t("manage.teams.filter.admitted")}, {value: "notAdmitted", label: t("manage.teams.filter.notAdmitted")}]} />
                <TableFiltersPopover fields={fields} drafts={drafts} onChange={setDrafts} active={answerFilters.length} />
                <TableColumnsPopover columns={tableColumns.columns} canManage={canManage} onChange={tableColumns.save} onReset={tableColumns.reset} />
                {anyFilter && <button className="ib-btn ib-btn--ghost event-manage-table__reset" type="button" onClick={resetFilters}>{t("manage.table.filters.reset")}</button>}
            </>}
            footer={<ManageTablePagination event={event} page={pages.page} pageSize={pageSize} total={teamsQuery.data?.Total ?? 0} hasNext={!!teamsQuery.data?.NextCursor} busy={teamsQuery.isFetching}
                onPrevious={pages.previous} onNext={() => pages.next(teamsQuery.data?.NextCursor)} onPageSize={pages.setPageSize} />}
            head={<tr>
                {tableColumns.visible.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
                <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.teams.col.actions")}</span></th>
            </tr>}>
            <tbody>{teams.map(team => {
                return <tr key={team.ID}>
                    {tableColumns.visible.map(column => <Fragment key={column.key}>{teamCell(column, team)}</Fragment>)}
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
                const choice = memberChoices[team.ID] ?? "";
                return <div className="event-manage-team-details">
                    <div className="event-manage-teams__head"><div><p>{t("manage.teams.summary", {count: team.MemberCount, captain: captainName(team)})}{team.Hidden ? t("manage.teams.hiddenSuffix") : ""}</p><p className={`event-manage-teams__admission${team.Admitted ? " is-admitted" : ""}`}>{admissionText(team)}</p></div>{canManage && <div className="event-manage-teams__head-actions"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(current => current?.id === team.ID ? null : {id: team.ID, name: team.Name, hidden: team.Hidden, fields: team.ExtraFields as ParticipantAnswers})}>{editing?.id === team.ID ? t("common.cancel") : t("manage.teams.edit")}</button></div>}</div>
                    {canManage && <label className="event-manage-form__switch"><input type="checkbox" checked={team.AdmittedManually} disabled={busy} onChange={event => void setAdmission(team, event.target.checked)} />{t("manage.teams.admitManually")}</label>}
                    {editing?.id === team.ID && <div className="event-manage-teams__edit"><label className="event-manage-field">{t("manage.teams.name")}<input className="event-manage-input" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} minLength={3} maxLength={64} disabled={busy} /></label><label className="event-exercise-editor__check"><input type="checkbox" checked={editing.hidden} onChange={e => setEditing({...editing, hidden: e.target.checked})} disabled={busy} /> {t("manage.teams.excludeFromRanking")}</label><button className="ib-btn ib-btn--primary" type="button" disabled={busy || !editing.name.trim()} onClick={() => void saveTeam(team)}>{t("common.save")}</button>{fieldsQuery.data && fields.length > 0 && <div className="event-manage-teams__edit-fields"><TeamFieldsInputs form={fieldsQuery.data} answers={editing.fields} onChange={(key, value) => setEditing(current => current && {...current, fields: {...current.fields, [key]: value}})} disabled={busy} /></div>}</div>}
                    {fields.length > 0 && <div className="event-manage-teams__members"><div className="event-manage-teams__members-head"><h3>{t("manage.fields.title")}</h3><button className="ib-btn ib-btn--sm" type="button" onClick={() => setAnswersTeam(team)}>{t("manage.teams.allAnswers")}</button></div>{fieldColumns.length > 0 && <dl className="event-manage-teams__fields">{fieldColumns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{formatAnswer(team.ExtraFields[column.key])}</dd></div>)}</dl>}</div>}
                    <div className="event-manage-teams__members"><h3>{t("manage.teams.roster")}</h3>{team.Members.length === 0 ? <EmptyState compact message={t("manage.teams.noMembers")} /> : team.Members.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{memberName(person)}</strong>{person.Pseudonym && <small>{t("manage.participants.pseudonym", {pseudonym: person.Pseudonym})}</small>}{person.UserID === team.CaptainID && <small>{t("manage.teams.captain")}</small>}</span>{canManage && person.UserID !== team.CaptainID && <div><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void transferCaptain(team, person.UserID)}>{t("manage.teams.makeCaptain")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void changeMember(team, person.UserID, "remove")}>{t("manage.teams.removeMember")}</button></div>}</div>)}</div>
                    {team.PendingInvitations.length > 0 && <div className="event-manage-teams__members"><h3>{t("manage.teams.invited")}</h3>{team.PendingInvitations.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{person.Email || person.Name || person.UserID.slice(0, 8)}</strong>{person.UserID === team.CaptainID && <small>{t("manage.teams.captain")}</small>}<small>{t("manage.teams.pendingConfirmation")}</small><small>{person.InvitationSentAt ? t("manage.participants.sentAt", {date: sentAt.format(new Date(person.InvitationSentAt))}) : t("manage.participants.notSent")}</small></span></div>)}</div>}
                    {canManage && <div className="event-manage-teams__assign"><div className="event-manage-field"><span>{t("manage.teams.addMember")}</span><EventSelect ariaLabel={t("manage.teams.addMemberTo", {name: team.Name})} value={choice} placeholder={t("manage.teams.chooseParticipant")} options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={value => setMemberChoices(current => ({...current, [team.ID]: value}))} disabled={busy || available.length === 0} /></div><button className="ib-btn" type="button" disabled={busy || !choice} onClick={() => void changeMember(team, choice, "add")}>{t("common.add")}</button></div>}
                    {canManage && participantsQuery.hasNextPage && <EventButton className="ib-btn event-manage-teams__load-more" type="button" disabled={participantsQuery.isFetchingNextPage} onClick={() => void participantsQuery.fetchNextPage()} busy={participantsQuery.isFetchingNextPage}>{t("manage.teams.loadMore")}</EventButton>}
                </div>;
            })()}
        </DialogContent></Dialog>
        <Dialog open={answersTeam !== null} onOpenChange={open => {if (!open) setAnswersTeam(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{answersTeam?.Name}</DialogTitle><DialogDescription>{t("manage.teams.answersDescription")}</DialogDescription></DialogHeader>{answersTeam && <AnswersList fields={fields} answers={answersTeam.ExtraFields} />}</DialogContent></Dialog>
    </div>;
}
