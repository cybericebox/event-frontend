"use client";

import {Fragment, useState} from "react";
import {useInfiniteQuery, useQuery, useQueryClient} from "@tanstack/react-query";
import {Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageParticipants} from "@/api/manageParticipants";
import {getManageTeamFields} from "@/api/manageTeamFields";
import type {ParticipantAnswers} from "@/api/participantForm";
import {changeManageTeamMember, deleteManageTeam, getManageTeamProfile, getManageTeamsTable, setManageTeamAdmission, transferManageTeamCaptain, updateManageTeam, type ManageTeam, type ManageTeamMember} from "@/api/manageTeams";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {useManager} from "@/components/event/manage/ManagerShell";
import {CreateTeamDialog} from "@/components/event/manage/CreateTeamDialog";
import {TeamInvitationDialog} from "@/components/event/manage/TeamInvitationDialog";
import {ManageTable, ManageTablePagination, ManageTableSearch} from "@/components/event/manage/ManageTable";
import {AnswersList, AnswerValue} from "@/components/event/manage/FieldColumns";
import {TableColumnsPopover, useTableColumns} from "@/components/event/manage/TableControls";
import {SortHeader, TableFilterChips, TableFiltersButton} from "@/components/event/manage/TableFilters";
import {fieldFilterSpecs, type FilterSpec} from "@/components/event/manage/tableFilterModel";
import {useTableState} from "@/components/event/manage/useTableState";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {fieldColumnDefinitions, formFields, formatAnswer, type TableColumn} from "@/components/event/manage/listColumns";
import {hasStaffFields, StaffFieldsPanel} from "@/components/event/manage/StaffFieldsPanel";
import {EventSelect} from "@/components/ui/EventSelect";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {t, tPlural} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";

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

// Staff-only answers are saved through their own panel, never with the team form.
function withoutKeys(answers: ParticipantAnswers, keys: ReadonlySet<string>): ParticipantAnswers {
    return Object.fromEntries(Object.entries(answers).filter(([key]) => !keys.has(key)));
}

function failure(error: unknown, fallback: string): string {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}

export default function ManageTeamsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const teamMode = event.Participation === 1;
    const [managedID, setManagedID] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [inviteTeam, setInviteTeam] = useState<{ID: string; Name: string; InitialEmails?: string[]} | null>(null);
    const [editing, setEditing] = useState<{id: string; name: string; hidden: boolean; fields: ParticipantAnswers} | null>(null);
    const [answersTeam, setAnswersTeam] = useState<ManageTeam | null>(null);
    const [memberChoices, setMemberChoices] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState<{kind: "delete"; team: ManageTeam} | {kind: "remove" | "captain"; team: ManageTeam; userID: string; name: string} | null>(null);
    const [confirmError, setConfirmError] = useState("");
    const fieldsQuery = useQuery({queryKey: ["event-management-team-fields", eventID], queryFn: () => getManageTeamFields(eventID), enabled: teamMode, refetchOnWindowFocus: false});
    const fields = formFields(fieldsQuery.data?.Document.blocks);
    // «Не заповнено» exists once the organizer asked every team for the new required fields.
    const askedEveryone = !!fieldsQuery.data?.RequireExisting;
    const specs: FilterSpec[] = [
        {key: "@name", label: t("manage.teams.col.name"), kind: "contains"},
        {key: "@captain", label: t("manage.teams.col.captain"), kind: "contains"},
        {key: "@captainPending", label: t("manage.teams.filter.captainPending"), kind: "bool"},
        {key: "@members", label: t("manage.teams.col.members"), kind: "number"},
        {key: "@status", label: t("manage.teams.col.status"), kind: "any", options: [
            {value: "admitted", label: t("manage.teams.admission.admitted")},
            {value: "manual", label: t("manage.teams.admission.manual")},
            {value: "notAdmitted", label: t("manage.teams.filter.notAdmitted")},
        ]},
        {key: "@pending", label: t("manage.teams.filter.pendingInvitees"), kind: "bool"},
        {key: "@created", label: t("manage.teams.col.created"), kind: "date"},
        ...(askedEveryone ? [{key: "@missing", label: t("manage.fields.missing.filter"), kind: "bool" as const, yes: t("manage.fields.missing.yes"), no: t("manage.fields.missing.no")}] : []),
        ...fieldFilterSpecs(fields),
    ];
    const table = useTableState(specs, {key: "@created", desc: true});
    const teamsQuery = useQuery({
        queryKey: ["event-management-teams", eventID, table.debounced, table.appliedKey, table.sort, table.page, table.pageSize],
        queryFn: () => getManageTeamsTable(eventID, {search: table.debounced, filters: table.appliedFilters, sort: table.sort}, table.page, table.pageSize),
        enabled: teamMode, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
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
    const tableColumns = useTableColumns(eventID, "teams", [
        {key: "@name", label: t("manage.teams.col.name"), locked: true},
        {key: "@captain", label: t("manage.teams.col.captain")},
        {key: "@members", label: t("manage.teams.col.members")},
        {key: "@status", label: t("manage.teams.col.status")},
        {key: "@created", label: t("manage.teams.col.created")},
        ...(askedEveryone ? [{key: "@missing", label: t("manage.fields.missing.column")}] : []),
        ...fieldColumnDefinitions(fields),
    ], canManage);
    const staffKeys = new Set(fields.filter(field => field.staffOnly).map(field => field.key));
    const fieldColumns = tableColumns.visible.filter(column => !column.key.startsWith("@") && !staffKeys.has(column.key));
    const managed = teams.find(team => team.ID === managedID) ?? null;
    // The profile adds the team's results (places, points, solves) to the row the table already has.
    const profile = useQuery({queryKey: ["event-management-team-profile", eventID, managedID], queryFn: () => getManageTeamProfile(eventID, managedID!), enabled: managedID !== null, refetchOnWindowFocus: false});

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-management-teams", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-team-profile", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-team-participants", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]}),
        ]);
    }

    async function saveTeam(team: ManageTeam) {
        if (!canManage || busy || editing?.id !== team.ID || !editing.name.trim()) return;
        setBusy(true);
        try {
            await updateManageTeam(eventID, team.ID, {Name: editing.name.trim(), Hidden: editing.hidden, ...(fields.length > 0 ? {Fields: withoutKeys(editing.fields, staffKeys)} : {})});
            setEditing(null);
            await refresh();
            toast.success(t("manage.teams.updated"));
        } catch (error) {toast.error(failure(error, t("manage.teams.saveFailed")));}
        finally {setBusy(false);}
    }

    function ask(next: NonNullable<typeof confirm>) {
        if (!canManage || busy) return;
        setConfirmError("");
        setConfirm(next);
    }

    function confirmDialog(open: boolean) {
        const current = confirm;
        return <ConfirmDialog open={open} onCancel={() => setConfirm(null)} tone={current?.kind === "captain" ? "default" : "danger"} busy={busy} error={confirmError}
            title={t(current?.kind === "captain" ? "manage.teams.captainTitle" : current?.kind === "remove" ? "manage.teams.removeMemberTitle" : "manage.teams.deleteTitle")}
            description={current?.kind === "captain" ? undefined : t(current?.kind === "remove" ? "manage.teams.removeMemberBody" : "manage.teams.deleteBody")}
            subject={current ? current.kind === "delete" ? current.team.Name : current.name : undefined}
            confirmLabel={t(current?.kind === "captain" ? "manage.teams.makeCaptain" : current?.kind === "remove" ? "manage.teams.removeMember" : "manage.teams.deleteConfirm")}
            onConfirm={() => {
                if (!current) return;
                if (current.kind === "delete") void removeTeam(current.team);
                else if (current.kind === "remove") void changeMember(current.team, current.userID, "remove");
                else void transferCaptain(current.team, current.userID);
            }} />;
    }

    async function removeTeam(team: ManageTeam) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await deleteManageTeam(eventID, team.ID);
            setConfirm(null);
            await refresh();
            toast.success(t("manage.teams.deleted"));
        } catch {setConfirmError(t("manage.teams.deleteFailed"));}
        finally {setBusy(false);}
    }

    async function changeMember(team: ManageTeam, userID: string, action: "add" | "remove") {
        if (!canManage || busy || !userID) return;
        setBusy(true);
        try {
            await changeManageTeamMember(eventID, team.ID, userID, action);
            setMemberChoices(current => ({...current, [team.ID]: ""}));
            if (action === "remove") setConfirm(null);
            await refresh();
            toast.success(action === "add" ? t("manage.teams.memberAdded") : t("manage.teams.memberRemoved"));
        } catch (error) {
            if (action === "remove") setConfirmError(failure(error, t("manage.teams.memberFailed")));
            else toast.error(failure(error, t("manage.teams.memberFailed")));
        }
        finally {setBusy(false);}
    }

    async function transferCaptain(team: ManageTeam, userID: string) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await transferManageTeamCaptain(eventID, team.ID, userID);
            setConfirm(null);
            await refresh();
            toast.success(t("manage.teams.captainChanged"));
        } catch (error) {setConfirmError(failure(error, t("manage.teams.captainFailed")));}
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
        case "@members": return <td><div className="event-manage-table__person"><div className="event-manage-table__tags"><span className="event-manage-table__count">{team.MemberCount}</span>{tags.slice(0, MEMBER_TAGS).map(tag => tag.pending
            ? <EventTooltip key={tag.id} content={t("manage.teams.pendingConfirmation")}>{id => <span className="ib-tag ib-tag--sm ib-tag--warn" aria-describedby={id}>{tag.name}</span>}</EventTooltip>
            : <span className="ib-tag ib-tag--sm" key={tag.id}>{tag.name}</span>)}{tags.length > MEMBER_TAGS && <span className="ib-tag ib-tag--sm">{t("manage.teams.moreMembers", {count: tags.length - MEMBER_TAGS})}</span>}</div>{team.PendingInvitations.length > 0 && <small>{t("manage.teams.pendingCount", {count: team.PendingInvitations.length})}</small>}</div></td>;
        case "@status": return <td><span className={`ib-tag ${admissionTag(team)}`}>{admissionText(team)}</span></td>;
        case "@created": return <td className="event-manage-table__nowrap event-manage-table__dim">{t("manage.participants.dateUtc", {date: sentAt.format(new Date(team.CreatedAt))})}</td>;
        case "@missing": return <td>{team.FieldsMissing > 0
            ? <EventTooltip content={tPlural("manage.fields.missing.tooltip", team.FieldsMissing)}>{id => <span className="ib-tag ib-tag--warn" aria-describedby={id}>{team.FieldsMissing}</span>}</EventTooltip>
            : <span className="event-manage-table__dim">—</span>}</td>;
        default: return <td className="event-manage-table__answer"><AnswerValue eventID={eventID} value={team.ExtraFields[column.key]} /></td>;
        }
    }

    const tableState = !teamMode ? "empty" : teamsQuery.isPending || participantsQuery.isPending || fieldsQuery.isPending ? "loading"
        : (teamsQuery.isError && !teamsQuery.data) || participantsQuery.isError || fieldsQuery.isError ? "error"
            : teams.length === 0 ? "empty" : "ready";

    return <div className="event-manage-settings event-manage-teams">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.teams")}</h1><p>{t("manage.teams.subtitle")}</p></div><div className="event-manage-heading__actions"><LiveStatus freshness={{kind: "manual", onRefresh: () => {void teamsQuery.refetch(); void participantsQuery.refetch();}, refreshing: teamsQuery.isFetching}} updatedAt={teamsQuery.dataUpdatedAt} />{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setCreateOpen(true)}>{t("manage.teams.create")}</button>}</div></header>
        <CreateTeamDialog eventID={eventID} open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
        <TeamInvitationDialog key={inviteTeam?.ID ?? "closed"} eventID={eventID} team={inviteTeam} onClose={() => setInviteTeam(null)} onSent={refresh} />
        <ManageTable event={event} state={tableState} busy={teamsQuery.isFetching && !teamsQuery.isPending} loadingLabel={t("manage.teams.loading")} errorMessage={t("manage.teams.loadFailed")}
            onRetry={() => {void teamsQuery.refetch(); void participantsQuery.refetch(); void fieldsQuery.refetch();}} error={teamsQuery.error ?? participantsQuery.error ?? fieldsQuery.error}
            emptyMessage={table.filtered ? t("manage.teams.emptySearch") : t("manage.teams.empty")}
            toolbar={<>
                <ManageTableSearch value={table.search} onChange={table.setSearch} label={t("manage.teams.search")} />
                <TableFiltersButton specs={specs} drafts={table.drafts} onChange={table.setDrafts} active={table.active} />
                <TableColumnsPopover columns={tableColumns.columns} canManage={canManage} onChange={tableColumns.save} onReset={tableColumns.reset} />
                <TableFilterChips specs={specs} drafts={table.drafts} onChange={table.setDrafts} onReset={table.reset}
                    extra={table.search.trim() ? [{key: "@search", text: t("manage.table.filters.searchChip", {text: table.search.trim()}), onRemove: () => table.setSearch("")}] : []} />
            </>}
            footer={<ManageTablePagination event={event} page={table.page} pageSize={table.pageSize} total={teamsQuery.data?.Total ?? 0} hasNext={table.page * table.pageSize < (teamsQuery.data?.Total ?? 0)} busy={teamsQuery.isFetching}
                onPrevious={() => table.setPage(table.page - 1)} onNext={() => table.setPage(table.page + 1)} onPageSize={table.setPageSize} />}
            head={<tr>
                {tableColumns.visible.map(column => <SortHeader key={column.key} columnKey={column.key} label={column.label} sort={table.sort} onSort={table.setSort} />)}
                <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.teams.col.actions")}</span></th>
            </tr>}>
            <tbody>{teams.map(team => {
                return <tr key={team.ID} className="is-clickable" onClick={event => {if (!(event.target as HTMLElement).closest("button, a, input, label")) {setEditing(null); setManagedID(team.ID);}}}>
                    {tableColumns.visible.map(column => <Fragment key={column.key}>{teamCell(column, team)}</Fragment>)}
                    <td><div className="event-manage-table__actions">
                        {canManage && <button className="ib-btn ib-btn--sm" type="button" onClick={() => setInviteTeam({ID: team.ID, Name: team.Name})}>{t("manage.teams.invite")}</button>}
                        <button className="ib-btn ib-btn--sm" type="button" aria-label={t("manage.teams.manageLabel", {name: team.Name})} onClick={() => {setEditing(null); setManagedID(team.ID);}}>{t("manage.teams.manage")}</button>
                        {canManage && <EventTooltip content={t("manage.teams.deleteLabel", {name: team.Name})} silent>{() => <button className="ib-btn ib-btn--sm event-content-editor__delete" type="button" aria-label={t("manage.teams.deleteLabel", {name: team.Name})} disabled={busy} onClick={() => ask({kind: "delete", team})}><Trash2 size={16} /></button>}</EventTooltip>}
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
                    <div className="event-manage-teams__head"><div><p>{t("manage.teams.summary", {count: team.MemberCount, captain: captainName(team)})}{team.Hidden ? t("manage.teams.hiddenSuffix") : ""}</p><p className={`event-manage-teams__admission${team.Admitted ? " is-admitted" : ""}`}>{admissionText(team)}</p></div>{canManage && <div className="event-manage-teams__head-actions"><button className="ib-btn ib-btn--sm" type="button" onClick={() => setInviteTeam({ID: team.ID, Name: team.Name})}>{t("manage.teams.invite")}</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => setEditing(current => current?.id === team.ID ? null : {id: team.ID, name: team.Name, hidden: team.Hidden, fields: team.ExtraFields as ParticipantAnswers})}>{editing?.id === team.ID ? t("common.cancel") : t("manage.teams.edit")}</button></div>}</div>
                    {canManage && <label className="event-manage-form__switch"><input type="checkbox" checked={team.AdmittedManually} disabled={busy} onChange={event => void setAdmission(team, event.target.checked)} />{t("manage.teams.admitManually")}</label>}
                    {editing?.id === team.ID && <div className="event-manage-teams__edit"><label className="event-manage-field">{t("manage.teams.name")}<input className="event-manage-input" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} minLength={3} maxLength={64} disabled={busy} /></label><label className="event-exercise-editor__check"><input type="checkbox" checked={editing.hidden} onChange={e => setEditing({...editing, hidden: e.target.checked})} disabled={busy} /> {t("manage.teams.excludeFromRanking")}</label><button className="ib-btn ib-btn--primary" type="button" disabled={busy || !editing.name.trim()} onClick={() => void saveTeam(team)}>{t("common.save")}</button>{fieldsQuery.data && fields.length > 0 && <div className="event-manage-teams__edit-fields"><TeamFieldsInputs form={{...fieldsQuery.data, Document: {blocks: fieldsQuery.data.Document.blocks.filter(block => !(isFormField(block) && block.staffOnly))}}} answers={editing.fields} onChange={(key, value) => setEditing(current => current && {...current, fields: {...current.fields, [key]: value}})} disabled={busy} /></div>}</div>}
                    <div className="event-manage-teams__members"><h3>{t("manage.teams.results")}</h3>
                        {profile.isPending ? <EventLoading compact label={t("manage.teams.resultsLoading")} /> : profile.isError ? <EventLoadError compact message={t("manage.teams.resultsFailed")} error={profile.error} onRetry={() => void profile.refetch()} />
                            : !profile.data.Results ? <EmptyState compact message={t("manage.teams.resultsNone")} />
                                : <><dl className="event-manage-teams__fields">
                                    <div><dt>{t("manage.teams.place")}</dt><dd>{profile.data.Results.Rank ?? "—"}</dd></div>
                                    <div><dt>{t("manage.teams.points")}</dt><dd>{profile.data.Results.Points}</dd></div>
                                    <div><dt>{t("manage.teams.solved")}</dt><dd>{profile.data.Results.Solved}</dd></div>
                                    <div><dt>{t("manage.teams.hints")}</dt><dd>{t("manage.teams.hintsValue", {count: profile.data.Results.Hints, points: profile.data.Results.HintPoints})}</dd></div>
                                </dl>{profile.data.Results.Solves.length === 0 ? <EmptyState compact message={t("manage.teams.noSolves")} /> : profile.data.Results.Solves.map(solve => <div className="event-manage-teams__member" key={solve.ChallengeID}><span><strong>{solve.ChallengeName}</strong>{solve.FirstBlood && <small>{t("manage.teams.firstBlood")}</small>}<small>{t("manage.participants.dateUtc", {date: sentAt.format(new Date(solve.SolvedAt))})}</small></span><span className="ib-tag ib-tag--sm">{t("manage.teams.solvePoints", {points: solve.Points})}</span></div>)}</>}
                    </div>
                    {fields.length > 0 && <div className="event-manage-teams__members"><div className="event-manage-teams__members-head"><h3>{t("manage.fields.title")}</h3><button className="ib-btn ib-btn--sm" type="button" onClick={() => setAnswersTeam(team)}>{t("manage.teams.allAnswers")}</button></div>{fieldColumns.length > 0 && <dl className="event-manage-teams__fields">{fieldColumns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{formatAnswer(team.ExtraFields[column.key])}</dd></div>)}</dl>}</div>}
                    {fieldsQuery.data && hasStaffFields(fieldsQuery.data) && <StaffFieldsPanel key={team.ID} eventID={eventID} scope="team" subjectID={team.ID} form={fieldsQuery.data} answers={team.ExtraFields} canManage={canManage} onSaved={refresh} />}
                    <div className="event-manage-teams__members"><h3>{t("manage.teams.roster")}</h3>{team.Members.length === 0 ? <EmptyState compact message={t("manage.teams.noMembers")} /> : team.Members.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{memberName(person)}</strong>{person.Pseudonym && <small>{t("manage.participants.pseudonym", {pseudonym: person.Pseudonym})}</small>}{person.UserID === team.CaptainID && <small>{t("manage.teams.captain")}</small>}</span>{canManage && person.UserID !== team.CaptainID && <div><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => ask({kind: "captain", team, userID: person.UserID, name: memberName(person)})}>{t("manage.teams.makeCaptain")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => ask({kind: "remove", team, userID: person.UserID, name: memberName(person)})}>{t("manage.teams.removeMember")}</button></div>}</div>)}</div>
                    {team.PendingInvitations.length > 0 && <div className="event-manage-teams__members"><h3>{t("manage.teams.invited")}</h3>{team.PendingInvitations.map(person => <div className="event-manage-teams__member" key={person.UserID}><span><strong>{person.Email || person.Name || person.UserID.slice(0, 8)}</strong>{person.UserID === team.CaptainID && <small>{t("manage.teams.captain")}</small>}<small>{t("manage.teams.pendingConfirmation")}</small><small>{person.InvitationSentAt ? t("manage.participants.sentAt", {date: sentAt.format(new Date(person.InvitationSentAt))}) : t("manage.participants.notSent")}</small></span></div>)}</div>}
                    {canManage && <div className="event-manage-teams__assign"><div className="event-manage-field"><span>{t("manage.teams.addMember")}</span><EventSelect ariaLabel={t("manage.teams.addMemberTo", {name: team.Name})} value={choice} placeholder={t("manage.teams.chooseParticipant")} options={available.map(person => ({value: person.UserID, label: person.Name || person.Email || person.UserID}))} onValueChange={value => setMemberChoices(current => ({...current, [team.ID]: value}))} disabled={busy || available.length === 0} /></div><button className="ib-btn" type="button" disabled={busy || !choice} onClick={() => void changeMember(team, choice, "add")}>{t("common.add")}</button></div>}
                    {canManage && participantsQuery.hasNextPage && <EventButton className="ib-btn event-manage-teams__load-more" type="button" disabled={participantsQuery.isFetchingNextPage} onClick={() => void participantsQuery.fetchNextPage()} busy={participantsQuery.isFetchingNextPage}>{t("manage.teams.loadMore")}</EventButton>}
                </div>;
            })()}
            {confirmDialog(!!confirm && confirm.kind !== "delete")}
        </DialogContent></Dialog>
        {confirmDialog(confirm?.kind === "delete")}
        <Dialog open={answersTeam !== null} onOpenChange={open => {if (!open) setAnswersTeam(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{answersTeam?.Name}</DialogTitle><DialogDescription>{t("manage.teams.answersDescription")}</DialogDescription></DialogHeader>{answersTeam && <AnswersList fields={fields} answers={answersTeam.ExtraFields} />}</DialogContent></Dialog>
    </div>;
}
