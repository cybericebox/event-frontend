"use client";

import {Fragment, useState, type KeyboardEvent, type MouseEvent} from "react";
import Link from "next/link";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageConfig} from "@/api/manage";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import {decideManageParticipant, getManageParticipant, getManageParticipantsTable, participantListKind, resendManageInvitation, revokeManageInvitation, setIndividualParticipantHidden, type ManageParticipant, type ParticipantStatus} from "@/api/manageParticipants";
import {getManageTeams} from "@/api/manageTeams";
import {ManageDialog} from "./invites/ManageDialog";
import {EventButton} from "@/components/ui/EventButton";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {AnswersList, AnswerValue} from "./FieldColumns";
import {fieldColumnDefinitions, formFields, type TableColumn} from "./listColumns";
import {hasStaffFields, StaffFieldsPanel} from "./StaffFieldsPanel";
import {TableColumnsPopover, useTableColumns} from "./TableControls";
import {SortHeader, TableFilterChips, TableFiltersButton} from "./TableFilters";
import {fieldFilterSpecs, type FilterSpec} from "./tableFilterModel";
import {useTableState} from "./useTableState";
import {InviteParticipantsDialog} from "./InviteParticipantsDialog";
import {LiveStatus} from "./LiveStatus";
import {ManageTable, ManageTablePagination, ManageTableSearch} from "./ManageTable";
import {participantTabHref, participantTabs, type ParticipantTab} from "./participantTabs";
import {useManager} from "./ManagerShell";
import {t, tPlural} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";
import {ParticipantFacts} from "./ParticipantFacts";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {formatDateTime, zoneOffset} from "@/utils/dateTime";
import {LastActivity} from "./LastActivity";

const statusNames: Record<ParticipantStatus, string> = {1: t("manage.participants.status.pending"), 2: t("manage.participants.status.approved"), 3: t("manage.participants.status.rejected")};
const statusTags: Record<ParticipantStatus, string> = {1: "ib-tag--warn", 2: "ib-tag--ok", 3: "ib-tag--danger"};
const emptyTexts: Record<ParticipantTab, string> = {participants: t("manage.participants.empty.participants"), applications: t("manage.participants.empty.applications"), invitations: t("manage.participants.empty.invitations")};

function personName(participant: Pick<ManageParticipant, "Name" | "DisplayName" | "Email" | "UserID">): string {
    return participant.Name || participant.DisplayName || participant.Email || t("manage.participants.fallbackName", {id: participant.UserID.slice(0, 8)});
}

function errorText(error: unknown, fallback: string): string {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}

export function ParticipantsManager({initialTab}: {initialTab: ParticipantTab}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const teamMode = event.Participation === 1;
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<ParticipantTab>(initialTab);
    // Only the participant being saved is locked; every other row stays usable.
    const [busyIDs, setBusyIDs] = useState<string[]>([]);
    const isBusy = (userID?: string) => !!userID && busyIDs.includes(userID);
    const [confirm, setConfirm] = useState<{kind: "reject" | "revoke"; participant: ManageParticipant} | null>(null);
    const [confirmError, setConfirmError] = useState("");
    // The open participant lives in the URL (`?participant=<userID>`), so a modal is linkable and survives reloads.
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const openedID = searchParams?.get("participant") || null;
    function setOpened(participant: Pick<ManageParticipant, "UserID"> | null) {
        const params = new URLSearchParams(window.location.search);
        if (participant) params.set("participant", participant.UserID); else params.delete("participant");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {scroll: false});
    }
    const [inviteOpen, setInviteOpen] = useState(false);
    const showAnswers = tab !== "invitations";
    const formQuery = useQuery({queryKey: ["event-management-participant-form", eventID], queryFn: () => getManageParticipantForm(eventID), refetchOnWindowFocus: false});
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const teamsQuery = useQuery({queryKey: ["event-management-teams", eventID, "options"], queryFn: () => getManageTeams(eventID, null, {}, 200), enabled: teamMode, refetchOnWindowFocus: false});
    const detailQuery = useQuery({
        queryKey: ["event-management-participant", eventID, openedID],
        queryFn: () => getManageParticipant(eventID, openedID!),
        enabled: !!openedID, refetchOnWindowFocus: false, placeholderData: previous => previous?.UserID === openedID ? previous : undefined,
        retry: (count, error) => !(error instanceof ManageApiError && (error.status === 404 || error.status === 400)) && count < 2,
    });
    const fields = formFields(formQuery.data?.Document.blocks);
    const pseudonyms = !!configQuery.data?.AllowPseudonyms;
    // «Не заповнено» exists once the organizer asked everyone for the new required fields.
    const askedEveryone = !!formQuery.data?.RequireExisting;
    const specs: FilterSpec[] = [
        {key: "@name", label: tab === "invitations" ? t("manage.participants.col.address") : t("manage.participants.col.name"), kind: "contains"},
        ...(tab !== "invitations" ? [{key: "@email", label: t("manage.participants.col.emailAddress"), kind: "contains" as const}] : []),
        ...(pseudonyms && tab !== "invitations" ? [{key: "@pseudonym", label: t("manage.participants.col.pseudonym"), kind: "contains" as const}] : []),
        ...(tab === "applications" ? [{key: "@status", label: t("manage.participants.col.status"), kind: "any" as const, options: [{value: "1", label: statusNames[1]}, {value: "3", label: statusNames[3]}]}] : []),
        ...(tab === "invitations" ? [{key: "@invitation", label: t("manage.participants.col.status"), kind: "any" as const, options: [{value: "sent", label: t("manage.participants.invitationSent")}, {value: "notSent", label: t("manage.participants.notSent")}]}] : []),
        ...(teamMode && tab !== "applications" ? [{key: "@team", label: t("manage.participants.col.team"), kind: "any" as const, options: [{value: "none", label: t("manage.participants.noTeam")}, ...(teamsQuery.data?.Items ?? []).map(team => ({value: team.ID, label: team.Name}))]}] : []),
        {key: "@date", label: tab === "invitations" ? t("manage.participants.col.invited", {zone: zoneOffset()}) : t("manage.participants.col.registered", {zone: zoneOffset()}), kind: "date"},
        ...(askedEveryone && tab === "participants" ? [{key: "@missing", label: t("manage.fields.missing.filter"), kind: "bool" as const, yes: t("manage.fields.missing.yes"), no: t("manage.fields.missing.no")}] : []),
        ...(showAnswers ? fieldFilterSpecs(fields) : []),
    ];
    const table = useTableState(specs, {key: "@date", desc: true});
    const query = useQuery({
        queryKey: ["event-management-participants", eventID, tab, table.debounced, table.appliedKey, table.sort, table.page, table.pageSize],
        queryFn: () => getManageParticipantsTable(eventID, {kind: tab, search: table.debounced, filters: table.appliedFilters, sort: table.sort}, table.page, table.pageSize),
        refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const tableColumns = useTableColumns(eventID, "participants", [
        {key: "@name", label: t("manage.participants.col.name"), locked: true},
        {key: "@email", label: t("manage.participants.col.emailAddress")},
        ...(pseudonyms ? [{key: "@pseudonym", label: t("manage.participants.col.pseudonym")}] : []),
        {key: "@status", label: t("manage.participants.col.status")},
        ...(teamMode ? [{key: "@team", label: t("manage.participants.col.team")}] : []),
        {key: "@date", label: t("manage.participants.col.registered", {zone: zoneOffset()})},
        {key: "@lastSeen", label: t("manage.participants.col.lastSeen")},
        {key: "@lastLab", label: t("manage.participants.col.lastLab")},
        ...(askedEveryone ? [{key: "@missing", label: t("manage.fields.missing.column")}] : []),
        ...fieldColumnDefinitions(fields),
    ], canManage);
    // The invitations tab has no answers, no email and no pseudonym column
    // (the address is the first column); applications have no team yet.
    const shown = tableColumns.visible.filter(column => tab === "invitations" ? column.key.startsWith("@") && column.key !== "@email" && column.key !== "@pseudonym" && column.key !== "@missing" && column.key !== "@lastSeen" && column.key !== "@lastLab" : tab === "applications" ? column.key !== "@team" && column.key !== "@missing" && column.key !== "@lastSeen" && column.key !== "@lastLab" : true);
    const counts = query.data?.Counts;

    function changeTab(value: ParticipantTab) {
        setTab(value);
        table.reset();
        window.history.replaceState(null, "", participantTabHref(value));
    }

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-participant", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-team-participants", eventID], refetchType: "all"}),
            queryClient.invalidateQueries({queryKey: ["event-management-teams", eventID]}),
        ]);
    }

    async function run(participant: ManageParticipant, action: () => Promise<unknown>, success: string, failure: string) {
        if (!canManage || isBusy(participant.UserID)) return;
        setBusyIDs(ids => [...ids, participant.UserID]);
        try {
            await action();
            await refresh();
            if (openedID === participant.UserID && participant.Status === 1) setOpened(null);
            toast.success(success);
        } catch (error) {toast.error(errorText(error, failure));}
        finally {setBusyIDs(ids => ids.filter(id => id !== participant.UserID));}
    }

    function decide(participant: ManageParticipant, action: "approve" | "reject") {
        if (action === "reject") {ask("reject", participant); return;}
        void run(participant, () => decideManageParticipant(eventID, participant.UserID, action), action === "approve" ? t("manage.participants.approved") : t("manage.participants.rejected"), t("manage.participants.decideFailed"));
    }

    function revoke(participant: ManageParticipant) {
        ask("revoke", participant);
    }

    function ask(kind: "reject" | "revoke", participant: ManageParticipant) {
        if (!canManage || isBusy(participant.UserID)) return;
        setConfirmError("");
        setConfirm({kind, participant});
    }

    async function runConfirmed() {
        if (!confirm || !canManage || isBusy(confirm.participant.UserID)) return;
        const {kind, participant} = confirm;
        setBusyIDs(ids => [...ids, participant.UserID]);
        setConfirmError("");
        try {
            await (kind === "reject" ? decideManageParticipant(eventID, participant.UserID, "reject") : revokeManageInvitation(eventID, participant.UserID));
            setConfirm(null);
            if (kind === "reject") setOpened(null);
            await refresh();
            toast.success(t(kind === "reject" ? "manage.participants.rejected" : "manage.participants.revoked"));
        } catch (error) {setConfirmError(errorText(error, t(kind === "reject" ? "manage.participants.decideFailed" : "manage.participants.revokeFailed")));}
        finally {setBusyIDs(ids => ids.filter(id => id !== participant.UserID));}
    }

    function resend(participant: ManageParticipant) {
        void run(participant, () => resendManageInvitation(eventID, participant.UserID), t("manage.participants.resent"), t("manage.participants.resendFailed"));
    }

    function setHidden(participant: ManageParticipant) {
        if (teamMode || participant.Status !== 2 || !participant.TeamID) return;
        void run(participant, () => setIndividualParticipantHidden(eventID, participant.UserID, !participant.Hidden), participant.Hidden ? t("manage.participants.shown") : t("manage.participants.hidden"), t("manage.participants.visibilityFailed"));
    }

    const open = (participant: ManageParticipant) => {if (showAnswers) setOpened(participant);};
    const stop = (event: MouseEvent) => event.stopPropagation();
    const onRowKey = (event: KeyboardEvent, participant: ManageParticipant) => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); open(participant);}};

    function headerLabel(column: TableColumn): string {
        if (tab === "invitations" && column.key === "@name") return t("manage.participants.col.address");
        if (tab === "invitations" && column.key === "@date") return t("manage.participants.col.invited", {zone: zoneOffset()});
        return column.label;
    }

    function cell(column: TableColumn, participant: ManageParticipant) {
        switch (column.key) {
        case "@name": return <td><div className="event-manage-table__person">
            {tab === "invitations" ? <><strong>{participant.Email || personName(participant)}</strong>{participant.Name && <small>{participant.Name}</small>}</>
                : <><strong>{personName(participant)}</strong>{participant.Pseudonym && !pseudonymShown && <small>{t("manage.participants.pseudonym", {pseudonym: participant.Pseudonym})}</small>}</>}
        </div></td>;
        case "@email": return <td className="event-manage-table__dim">{participant.Email || "—"}</td>;
        case "@pseudonym": return <td>{participant.Pseudonym || <span className="event-manage-table__dim">—</span>}</td>;
        case "@status": return <td>{tab === "invitations"
            ? participant.InvitationExpired ? <span className="ib-tag ib-tag--danger">{t("manage.participants.expired")}</span>
                : participant.InvitationSentAt ? <EventTooltip content={t("manage.participants.sentAt", {date: formatDateTime(participant.InvitationSentAt)})}>{id => <span className="ib-tag ib-tag--ok" aria-describedby={id}>{t("manage.participants.invitationSent")}</span>}</EventTooltip>
                    : <span className="ib-tag ib-tag--warn">{t("manage.participants.notSent")}</span>
            : <span className={`ib-tag ${statusTags[participant.Status]}`}>{statusNames[participant.Status]}</span>}</td>;
        case "@team": return <td>{tab === "invitations"
            ? participant.InvitedToTeam ? participant.InvitedTeamName || t("manage.participants.col.team") : <span className="event-manage-table__dim">—</span>
            : participant.TeamID ? <Link href="/manage/teams" onClick={stop}>{participant.TeamName || t("manage.participants.inTeam")}</Link> : <span className="event-manage-table__dim">{t("manage.participants.noTeam")}</span>}</td>;
        case "@date": return <td className="event-manage-table__nowrap event-manage-table__dim">{formatDateTime(participant.CreatedAt)}</td>;
        case "@lastSeen": return <td className="event-manage-table__nowrap"><LastActivity at={participant.LastSeenAt} /></td>;
        case "@lastLab": return <td className="event-manage-table__nowrap"><LastActivity at={participant.LastLabAt} /></td>;
        case "@missing": return <td>{participant.FieldsMissing > 0
            ? <EventTooltip content={tPlural("manage.fields.missing.tooltip", participant.FieldsMissing)}>{id => <span className="ib-tag ib-tag--warn" aria-describedby={id}>{participant.FieldsMissing}</span>}</EventTooltip>
            : <span className="event-manage-table__dim">—</span>}</td>;
        default: return <td className="event-manage-table__answer"><AnswerValue eventID={eventID} value={participant.Answers[column.key]} /></td>;
        }
    }

    // Rendered inside the participant dialog while it is open (Radix hides everything outside it), else on the page.
    function confirmDialog(open: boolean) {
        return <ConfirmDialog open={open} onCancel={() => setConfirm(null)} tone="danger" busy={isBusy(confirm?.participant.UserID)} error={confirmError}
            title={t(confirm?.kind === "revoke" ? "manage.participants.revokeTitle" : "manage.participants.rejectTitle")}
            description={confirm?.kind === "revoke" ? t("manage.participants.revokeBody") : undefined}
            subject={confirm ? confirm.kind === "revoke" ? confirm.participant.Email || personName(confirm.participant) : personName(confirm.participant) : undefined}
            confirmLabel={t(confirm?.kind === "revoke" ? "manage.participants.revoke" : "manage.participants.reject")} onConfirm={() => void runConfirmed()} />;
    }

    const pseudonymShown = shown.some(column => column.key === "@pseudonym");
    const items = query.data?.Items ?? [];
    // The detail endpoint is the source for the modal; a row already in the list fills it while that loads.
    const listRow = openedID ? items.find(item => item.UserID === openedID) : undefined;
    const detail = detailQuery.data?.UserID === openedID ? detailQuery.data : undefined;
    const current: ManageParticipant | null = openedID ? detail ?? listRow ?? null : null;
    const modalKind = current ? participantListKind(current) : null;
    const notFound = !!openedID && !current && detailQuery.isError;
    const tableState = query.isPending ? "loading" : query.isError && !query.data ? "error" : items.length === 0 ? "empty" : "ready";
    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.participants")}</h1><p>{teamMode ? t("manage.participants.subtitleTeams") : t("manage.participants.subtitle")}</p></div><div className="event-manage-heading__actions"><LiveStatus freshness={{kind: "manual", onRefresh: () => void query.refetch(), refreshing: query.isFetching}} updatedAt={query.dataUpdatedAt} />{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setInviteOpen(true)}>{t("manage.participants.invite.title")}</button>}</div></header>
        <InviteParticipantsDialog eventID={eventID} open={inviteOpen} onOpenChange={setInviteOpen} onSent={refresh} />
        <div className="event-manage-participants__filters" role="tablist" aria-label={t("manage.participants.sections")}>{participantTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => changeTab(option.value)}>{option.label}{counts && <span className="event-manage-participants__count">{counts[option.count]}</span>}</button>)}</div>
        <ManageTable event={event} state={tableState} busy={query.isFetching && !query.isPending} loadingLabel={t("manage.participants.loading")} errorMessage={t("manage.participants.loadFailed")} onRetry={() => void query.refetch()} error={query.error}
            emptyMessage={table.filtered ? t("manage.participants.emptySearch") : emptyTexts[tab]}
            toolbar={<>
                <ManageTableSearch value={table.search} onChange={table.setSearch} label={t("manage.participants.search")} />
                <TableFiltersButton specs={specs} drafts={table.drafts} onChange={table.setDrafts} active={table.active} />
                <TableColumnsPopover columns={tableColumns.columns} canManage={canManage} onChange={tableColumns.save} onReset={tableColumns.reset} />
                <TableFilterChips specs={specs} drafts={table.drafts} onChange={table.setDrafts} onReset={table.reset}
                    extra={table.search.trim() ? [{key: "@search", text: t("manage.table.filters.searchChip", {text: table.search.trim()}), onRemove: () => table.setSearch("")}] : []} />
            </>}
            footer={<ManageTablePagination event={event} page={table.page} pageSize={table.pageSize} total={query.data?.Total ?? 0} hasNext={table.page * table.pageSize < (query.data?.Total ?? 0)} busy={query.isFetching}
                onPrevious={() => table.setPage(table.page - 1)} onNext={() => table.setPage(table.page + 1)} onPageSize={table.setPageSize} />}
            head={<tr>
                {shown.map(column => <SortHeader key={column.key} columnKey={column.key} label={headerLabel(column)} sort={table.sort} onSort={table.setSort} />)}
                {canManage && <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.participants.col.actions")}</span></th>}
            </tr>}>
            <tbody>{items.map(participant => <tr key={participant.UserID} className={showAnswers ? "is-clickable" : undefined} tabIndex={showAnswers ? 0 : undefined} aria-label={showAnswers ? t("manage.participants.answersFor", {name: personName(participant)}) : undefined} onClick={() => open(participant)} onKeyDown={event => onRowKey(event, participant)}>
                {shown.map(column => <Fragment key={column.key}>{cell(column, participant)}</Fragment>)}
                {canManage && <td onClick={stop}><div className="event-manage-table__actions">
                    {tab === "participants" && !teamMode && participant.TeamID && <button className="ib-btn ib-btn--sm" type="button" disabled={isBusy(participant.UserID)} onClick={() => setHidden(participant)}>{participant.Hidden ? t("manage.participants.show") : t("manage.participants.hide")}</button>}
                    {tab === "applications" && participant.Status === 1 && <><button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={isBusy(participant.UserID)} onClick={() => decide(participant, "approve")}>{t("manage.participants.approve")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={isBusy(participant.UserID)} onClick={() => decide(participant, "reject")}>{t("manage.participants.reject")}</button></>}
                    {tab === "invitations" && <><button className="ib-btn ib-btn--sm" type="button" disabled={isBusy(participant.UserID) || participant.InvitationExpired} onClick={() => resend(participant)}>{t("manage.participants.resend")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={isBusy(participant.UserID)} onClick={() => revoke(participant)}>{t("manage.participants.revoke")}</button></>}
                </div></td>}
            </tr>)}</tbody>
        </ManageTable>
        <ManageDialog open={openedID !== null} onOpenChange={value => {if (!value) setOpened(null);}} size="md"
            title={current ? personName(current) : notFound ? t("manage.participants.detail.notFound") : ""}
            description={current ? [current.Pseudonym && t("manage.participants.pseudonym", {pseudonym: current.Pseudonym}), current.Email, !current.Invited && t("manage.participants.submittedAt", {date: formatDateTime(current.CreatedAt)})].filter(Boolean).join(" · ") : undefined}
            footer={<>
                <button className="ib-btn" type="button" onClick={() => setOpened(null)}>{t("common.close")}</button>
                {canManage && current && modalKind === "participants" && !teamMode && current.Status === 2 && current.TeamID && <EventButton className="ib-btn" type="button" disabled={isBusy(current.UserID)} busy={isBusy(current.UserID) && !confirm} onClick={() => setHidden(current)}>{current.Hidden ? t("manage.participants.show") : t("manage.participants.hide")}</EventButton>}
                {canManage && current && current.Status === 1 && modalKind === "applications" && <>
                    <button className="ib-btn" type="button" disabled={isBusy(current.UserID)} onClick={() => decide(current, "reject")}>{t("manage.participants.reject")}</button>
                    <EventButton className="ib-btn ib-btn--primary" type="button" disabled={isBusy(current.UserID)} busy={isBusy(current.UserID) && !confirm} onClick={() => decide(current, "approve")}>{t("manage.participants.approve")}</EventButton>
                </>}
            </>}>
            {notFound && <div className="event-manage-participants__modal-state">{detailQuery.error instanceof ManageApiError && (detailQuery.error.status === 404 || detailQuery.error.status === 400)
                ? <EmptyState message={t("manage.participants.detail.notFound")} />
                : <EventLoadError message={t("manage.participants.detail.loadFailed")} onRetry={() => void detailQuery.refetch()} error={detailQuery.error} />}</div>}
            {openedID && !current && !notFound && <div className="event-manage-participants__modal-state"><EventLoading event={event} label={t("manage.participants.loading")} /></div>}
            {current && (detail ? <ParticipantFacts participant={detail} teamMode={teamMode} pseudonyms={pseudonyms} />
                : <div className="event-manage-participants__facts-state"><EventLoading event={event} compact label={t("manage.participants.loading")} /></div>)}
            {current && <AnswersList fields={fields} answers={current.Answers} />}
            {current && formQuery.data && hasStaffFields(formQuery.data) && <StaffFieldsPanel key={current.UserID} eventID={eventID} scope="participant" subjectID={current.UserID} form={formQuery.data} answers={current.Answers} canManage={canManage} onSaved={refresh} />}
            {confirmDialog(confirm !== null && current !== null)}
        </ManageDialog>
        {confirmDialog(confirm !== null && current === null)}
    </div>;
}
