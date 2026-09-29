"use client";

import {Fragment, useEffect, useState, type KeyboardEvent, type MouseEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import {decideManageParticipant, getManageParticipants, resendManageInvitation, revokeManageInvitation, setIndividualParticipantHidden, type ManageParticipant, type ParticipantStatus} from "@/api/manageParticipants";
import {EventSelect} from "@/components/ui/EventSelect";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {AnswersList} from "./FieldColumns";
import {fieldColumnDefinitions, formFields, formatAnswer, toAnswerFilters, type AnswerFilterDraft, type TableColumn} from "./listColumns";
import {TableColumnsPopover, TableFiltersPopover, useTableColumns} from "./TableControls";
import {InviteParticipantsDialog} from "./InviteParticipantsDialog";
import {ManageTable, ManageTablePagination, ManageTableSearch, useCursorPages} from "./ManageTable";
import {participantTabHref, participantTabs, type ParticipantTab} from "./participantTabs";
import {useManager} from "./ManagerShell";
import {t} from "@/i18n/t";

const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
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
    const pages = useCursorPages();
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [statusFilter, setStatusFilter] = useState<ParticipantStatus | null>(null);
    const [drafts, setDrafts] = useState<Record<string, AnswerFilterDraft>>({});
    const [appliedFilters, setAppliedFilters] = useState("[]");
    const [busyID, setBusyID] = useState<string | null>(null);
    const [opened, setOpened] = useState<ManageParticipant | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const {cursor, pageSize, reset: resetPages} = pages;
    const status = tab === "applications" ? statusFilter : null;
    const showAnswers = tab !== "invitations";
    const formQuery = useQuery({queryKey: ["event-management-participant-form", eventID], queryFn: () => getManageParticipantForm(eventID), refetchOnWindowFocus: false});
    const fields = formFields(formQuery.data?.Document.blocks);
    const answerFilters = showAnswers ? toAnswerFilters(fields, drafts) : [];
    const fieldsFilter = showAnswers ? appliedFilters : "[]";
    const query = useQuery({
        queryKey: ["event-management-participants", eventID, tab, status, debounced, fieldsFilter, pageSize, cursor],
        queryFn: () => getManageParticipants(eventID, {kind: tab, status, search: debounced, fields: JSON.parse(fieldsFilter)}, cursor, pageSize),
        refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const filtered = !!debounced || status !== null || fieldsFilter !== "[]";
    const anyFilter = !!search.trim() || status !== null || answerFilters.length > 0;
    const answerFiltersKey = JSON.stringify(answerFilters);

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

    const tableColumns = useTableColumns(eventID, "participants", [
        {key: "@name", label: t("manage.participants.col.name"), locked: true},
        {key: "@email", label: t("manage.participants.col.emailAddress")},
        {key: "@status", label: t("manage.participants.col.status")},
        ...(teamMode ? [{key: "@team", label: t("manage.participants.col.team")}] : []),
        {key: "@date", label: t("manage.participants.col.registered")},
        ...fieldColumnDefinitions(fields),
    ], canManage);
    // The invitations tab has no answers and no email column (the address is
    // the first column); applications have no team yet.
    const shown = tableColumns.visible.filter(column => tab === "invitations" ? column.key.startsWith("@") && column.key !== "@email" : tab === "applications" ? column.key !== "@team" : true);
    const counts = query.data?.Counts;

    function resetFilters() {
        setSearch(""); setDebounced(""); setStatusFilter(null); setDrafts({}); setAppliedFilters("[]");
        pages.reset();
    }

    function changeTab(value: ParticipantTab) {
        setTab(value);
        setStatusFilter(null);
        pages.reset();
        window.history.replaceState(null, "", participantTabHref(value));
    }

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-management-participants", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-team-participants", eventID], refetchType: "all"}),
            queryClient.invalidateQueries({queryKey: ["event-management-teams", eventID]}),
        ]);
    }

    async function run(participant: ManageParticipant, action: () => Promise<unknown>, success: string, failure: string) {
        if (!canManage || busyID) return;
        setBusyID(participant.UserID);
        try {
            await action();
            await refresh();
            toast.success(success);
        } catch (error) {toast.error(errorText(error, failure));}
        finally {setBusyID(null);}
    }

    function decide(participant: ManageParticipant, action: "approve" | "reject") {
        if (action === "reject" && !window.confirm(t("manage.participants.confirmReject", {name: personName(participant)}))) return;
        void run(participant, () => decideManageParticipant(eventID, participant.UserID, action), action === "approve" ? t("manage.participants.approved") : t("manage.participants.rejected"), t("manage.participants.decideFailed"));
    }

    function revoke(participant: ManageParticipant) {
        if (!window.confirm(t("manage.participants.confirmRevoke", {name: participant.Email || personName(participant)}))) return;
        void run(participant, () => revokeManageInvitation(eventID, participant.UserID), t("manage.participants.revoked"), t("manage.participants.revokeFailed"));
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
        if (tab === "invitations" && column.key === "@date") return t("manage.participants.col.invited");
        return column.label;
    }

    function cell(column: TableColumn, participant: ManageParticipant) {
        switch (column.key) {
        case "@name": return <td><div className="event-manage-table__person">
            {tab === "invitations" ? <><strong>{participant.Email || personName(participant)}</strong>{participant.Name && <small>{participant.Name}</small>}</>
                : <><strong>{personName(participant)}</strong>{participant.Pseudonym && <small>{t("manage.participants.pseudonym", {pseudonym: participant.Pseudonym})}</small>}</>}
        </div></td>;
        case "@email": return <td className="event-manage-table__dim">{participant.Email || "—"}</td>;
        case "@status": return <td>{tab === "invitations"
            ? participant.InvitationExpired ? <span className="ib-tag ib-tag--danger">{t("manage.participants.expired")}</span>
                : participant.InvitationSentAt ? <span className="ib-tag ib-tag--ok" title={t("manage.participants.sentAt", {date: date.format(new Date(participant.InvitationSentAt))})}>{t("manage.participants.invitationSent")}</span>
                    : <span className="ib-tag ib-tag--warn">{t("manage.participants.notSent")}</span>
            : <span className={`ib-tag ${statusTags[participant.Status]}`}>{statusNames[participant.Status]}</span>}</td>;
        case "@team": return <td>{tab === "invitations"
            ? participant.InvitedToTeam ? participant.InvitedTeamName || t("manage.participants.col.team") : <span className="event-manage-table__dim">—</span>
            : participant.TeamID ? <Link href="/manage/teams" onClick={stop}>{participant.TeamName || t("manage.participants.inTeam")}</Link> : <span className="event-manage-table__dim">{t("manage.participants.noTeam")}</span>}</td>;
        case "@date": return <td className="event-manage-table__nowrap event-manage-table__dim">{t("manage.participants.dateUtc", {date: date.format(new Date(participant.CreatedAt))})}</td>;
        default: return <td className="event-manage-table__answer">{formatAnswer(participant.Answers[column.key])}</td>;
        }
    }

    const items = query.data?.Items ?? [];
    const tableState = query.isPending ? "loading" : query.isError && !query.data ? "error" : items.length === 0 ? "empty" : "ready";
    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.participants")}</h1><p>{teamMode ? t("manage.participants.subtitleTeams") : t("manage.participants.subtitle")}</p></div><div className="event-manage-heading__actions">{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => setInviteOpen(true)}>{t("manage.participants.invite.title")}</button>}</div></header>
        <InviteParticipantsDialog eventID={eventID} open={inviteOpen} onOpenChange={setInviteOpen} onSent={refresh} />
        <div className="event-manage-participants__filters" role="tablist" aria-label={t("manage.participants.sections")}>{participantTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => changeTab(option.value)}>{option.label}{counts && <span className="event-manage-participants__count">{counts[option.count]}</span>}</button>)}</div>
        <ManageTable event={event} state={tableState} busy={query.isFetching && !query.isPending} loadingLabel={t("manage.participants.loading")} errorMessage={t("manage.participants.loadFailed")} onRetry={() => void query.refetch()}
            emptyMessage={filtered ? t("manage.participants.emptySearch") : emptyTexts[tab]}
            toolbar={<>
                <ManageTableSearch value={search} onChange={setSearch} label={t("manage.participants.search")} />
                {tab === "applications" && <EventSelect ariaLabel={t("manage.participants.filter.status")} value={String(statusFilter ?? "all")} onValueChange={value => {setStatusFilter(value === "all" ? null : Number(value) as ParticipantStatus); pages.reset();}}
                    options={[{value: "all", label: t("manage.participants.filter.statusAll")}, {value: "1", label: statusNames[1]}, {value: "3", label: statusNames[3]}]} />}
                {showAnswers && <TableFiltersPopover fields={fields} drafts={drafts} onChange={setDrafts} active={answerFilters.length} />}
                <TableColumnsPopover columns={tableColumns.columns} canManage={canManage} onChange={tableColumns.save} onReset={tableColumns.reset} />
                {anyFilter && <button className="ib-btn ib-btn--ghost event-manage-table__reset" type="button" onClick={resetFilters}>{t("manage.table.filters.reset")}</button>}
            </>}
            footer={<ManageTablePagination event={event} page={pages.page} pageSize={pageSize} total={query.data?.Total ?? 0} hasNext={!!query.data?.NextCursor} busy={query.isFetching}
                onPrevious={pages.previous} onNext={() => pages.next(query.data?.NextCursor)} onPageSize={pages.setPageSize} />}
            head={<tr>
                {shown.map(column => <th scope="col" key={column.key}>{headerLabel(column)}</th>)}
                {canManage && <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.participants.col.actions")}</span></th>}
            </tr>}>
            <tbody>{items.map(participant => <tr key={participant.UserID} className={showAnswers ? "is-clickable" : undefined} tabIndex={showAnswers ? 0 : undefined} aria-label={showAnswers ? t("manage.participants.answersFor", {name: personName(participant)}) : undefined} onClick={() => open(participant)} onKeyDown={event => onRowKey(event, participant)}>
                {shown.map(column => <Fragment key={column.key}>{cell(column, participant)}</Fragment>)}
                {canManage && <td onClick={stop}><div className="event-manage-table__actions">
                    {tab === "participants" && !teamMode && participant.TeamID && <button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => setHidden(participant)}>{participant.Hidden ? t("manage.participants.show") : t("manage.participants.hide")}</button>}
                    {tab === "applications" && participant.Status === 1 && <><button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!!busyID} onClick={() => decide(participant, "approve")}>{t("manage.participants.approve")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => decide(participant, "reject")}>{t("manage.participants.reject")}</button></>}
                    {tab === "invitations" && <><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID || participant.InvitationExpired} onClick={() => resend(participant)}>{t("manage.participants.resend")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => revoke(participant)}>{t("manage.participants.revoke")}</button></>}
                </div></td>}
            </tr>)}</tbody>
        </ManageTable>
        <Dialog open={opened !== null} onOpenChange={value => {if (!value) setOpened(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto">
            <DialogHeader><DialogTitle>{opened ? personName(opened) : ""}</DialogTitle><DialogDescription>{[opened?.Pseudonym && t("manage.participants.pseudonym", {pseudonym: opened.Pseudonym}), opened?.Email, opened && !opened.Invited && t("manage.participants.submittedAt", {date: date.format(new Date(opened.CreatedAt))})].filter(Boolean).join(" · ")}</DialogDescription></DialogHeader>
            {opened && <AnswersList fields={fields} answers={opened.Answers} />}
        </DialogContent></Dialog>
    </div>;
}
