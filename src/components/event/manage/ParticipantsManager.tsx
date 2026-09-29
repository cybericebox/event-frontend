"use client";

import {useEffect, useState, type KeyboardEvent, type MouseEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import {decideManageParticipant, getManageParticipants, inviteManageParticipants, resendManageInvitation, revokeManageInvitation, setIndividualParticipantHidden, type ManageParticipant, type ParticipantInvitationResult, type ParticipantStatus} from "@/api/manageParticipants";
import {EventSelect} from "@/components/ui/EventSelect";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {AnswersList, FieldColumnsButton, useFieldColumns} from "./FieldColumns";
import {formFields, formatAnswer} from "./listColumns";
import {invitationEmails, parseInvitationCsv} from "./participantInvitations";
import {ManageTable, ManageTablePagination, ManageTableSearch, useCursorPages} from "./ManageTable";
import {participantTabHref, participantTabs, type ParticipantTab} from "./participantTabs";
import {useManager} from "./ManagerShell";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";

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
    const [busyID, setBusyID] = useState<string | null>(null);
    const [opened, setOpened] = useState<ManageParticipant | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteText, setInviteText] = useState("");
    const [csvEmails, setCsvEmails] = useState<string[]>([]);
    const [inviteResults, setInviteResults] = useState<ParticipantInvitationResult[]>([]);
    const [inviting, setInviting] = useState(false);
    const emails = invitationEmails(inviteText, csvEmails);
    const {cursor, pageSize, reset: resetPages} = pages;
    const status = tab === "applications" ? statusFilter : null;
    const query = useQuery({
        queryKey: ["event-management-participants", eventID, tab, status, debounced, pageSize, cursor],
        queryFn: () => getManageParticipants(eventID, {kind: tab, status, search: debounced}, cursor, pageSize),
        refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const filtered = !!debounced || status !== null;

    // Debounce the search box; an unchanged query keeps the current page.
    useEffect(() => {
        const next = search.trim();
        if (next === debounced) return;
        const id = setTimeout(() => {setDebounced(next); resetPages();}, 300);
        return () => clearTimeout(id);
    }, [search, debounced, resetPages]);
    const formQuery = useQuery({queryKey: ["event-management-participant-form", eventID], queryFn: () => getManageParticipantForm(eventID), refetchOnWindowFocus: false});
    const fields = formFields(formQuery.data?.Document.blocks);
    const {columns, visible: fieldColumns} = useFieldColumns(eventID, "participants", fields, fields.length > 0);
    const showAnswers = tab !== "invitations";
    const counts = query.data?.Counts;

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

    async function invite() {
        if (!canManage || inviting || emails.length === 0 || emails.length > 200) return;
        setInviting(true);
        try {
            const results = await inviteManageParticipants(eventID, emails);
            setInviteResults(results);
            const sent = results.filter(result => !result.Error).length;
            if (sent) {
                await refresh();
                toast.success(t("manage.participants.invite.sent", {count: sent}));
            }
            if (sent === results.length) {setInviteText(""); setCsvEmails([]);}
        } catch {toast.error(t("manage.participants.invite.sendFailed"));}
        finally {setInviting(false);}
    }

    const open = (participant: ManageParticipant) => {if (showAnswers) setOpened(participant);};
    const stop = (event: MouseEvent) => event.stopPropagation();
    const onRowKey = (event: KeyboardEvent, participant: ManageParticipant) => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); open(participant);}};

    const items = query.data?.Items ?? [];
    const tableState = query.isPending ? "loading" : query.isError && !query.data ? "error" : items.length === 0 ? "empty" : "ready";
    const dateLabel = tab === "invitations" ? t("manage.participants.col.invited") : t("manage.participants.col.registered");
    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.participants")}</h1><p>{teamMode ? t("manage.participants.subtitleTeams") : t("manage.participants.subtitle")}</p></div><div className="event-manage-heading__actions">{showAnswers && <FieldColumnsButton eventID={eventID} list="participants" columns={columns} canManage={canManage} />}{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => {setInviteResults([]); setInviteOpen(true);}}>{t("manage.participants.invite.title")}</button>}</div></header>
        <Dialog open={inviteOpen} onOpenChange={open => {if (!inviting) setInviteOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{t("manage.participants.invite.title")}</DialogTitle><DialogDescription>{t("manage.participants.invite.description")}</DialogDescription></DialogHeader><div className="grid gap-4"><label className="event-manage-field"><span>{t("manage.participants.invite.emails")}</span><textarea className="event-manage-input" rows={5} value={inviteText} onChange={e => setInviteText(e.target.value)} placeholder={t("manage.participants.invite.emailsPlaceholder")} disabled={inviting} /></label><label className="event-manage-field"><span>{t("manage.participants.invite.csv")}</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={inviting} onChange={async e => {const file = e.target.files?.[0]; if (file) {try {setCsvEmails(parseInvitationCsv(await file.text())); setInviteResults([]);} catch {toast.error(t("manage.participants.invite.csvFailed"));}}}} /><small>{t("manage.participants.invite.csvHint")}</small></label><p>{t("manage.participants.invite.count", {count: emails.length})}</p>{emails.length > 200 && <p className="event-manage-validation" role="alert">{t("manage.participants.invite.limit")}</p>}{inviteResults.length > 0 && <div role="status" className="grid gap-1">{inviteResults.map(result => <p key={result.Email}>{result.Email}: {result.Error || t("manage.participants.invite.resultSent")}</p>)}</div>}<div className="event-manage-section__actions"><button className="ib-btn" type="button" onClick={() => setInviteOpen(false)} disabled={inviting}>{t("common.close")}</button><EventButton className="ib-btn ib-btn--primary" type="button" onClick={() => void invite()} disabled={inviting || emails.length === 0 || emails.length > 200} busy={inviting}>{t("manage.participants.invite.send")}</EventButton></div></div></DialogContent></Dialog>
        <div className="event-manage-participants__filters" role="tablist" aria-label={t("manage.participants.sections")}>{participantTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => changeTab(option.value)}>{option.label}{counts && <span className="event-manage-participants__count">{counts[option.count]}</span>}</button>)}</div>
        <ManageTable event={event} state={tableState} busy={query.isFetching && !query.isPending} loadingLabel={t("manage.participants.loading")} errorMessage={t("manage.participants.loadFailed")} onRetry={() => void query.refetch()}
            emptyMessage={filtered ? t("manage.participants.emptySearch") : emptyTexts[tab]}
            toolbar={<>
                <ManageTableSearch value={search} onChange={setSearch} label={t("manage.participants.search")} />
                {tab === "applications" && <EventSelect ariaLabel={t("manage.participants.filter.status")} value={String(statusFilter ?? "all")} onValueChange={value => {setStatusFilter(value === "all" ? null : Number(value) as ParticipantStatus); pages.reset();}}
                    options={[{value: "all", label: t("manage.participants.filter.statusAll")}, {value: "1", label: statusNames[1]}, {value: "3", label: statusNames[3]}]} />}
            </>}
            footer={<ManageTablePagination event={event} page={pages.page} pageSize={pageSize} total={query.data?.Total ?? 0} hasNext={!!query.data?.NextCursor} busy={query.isFetching}
                onPrevious={pages.previous} onNext={() => pages.next(query.data?.NextCursor)} onPageSize={pages.setPageSize} />}>
            <thead><tr>
                <th scope="col">{tab === "invitations" ? t("manage.participants.col.address") : t("manage.participants.col.name")}</th>
                {tab !== "invitations" && <th scope="col">{t("manage.participants.col.emailAddress")}</th>}
                <th scope="col">{t("manage.participants.col.status")}</th>
                {teamMode && tab !== "applications" && <th scope="col">{t("manage.participants.col.team")}</th>}
                <th scope="col">{dateLabel}</th>
                {showAnswers && fieldColumns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
                {canManage && <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.participants.col.actions")}</span></th>}
            </tr></thead>
            <tbody>{items.map(participant => <tr key={participant.UserID} className={showAnswers ? "is-clickable" : undefined} tabIndex={showAnswers ? 0 : undefined} aria-label={showAnswers ? t("manage.participants.answersFor", {name: personName(participant)}) : undefined} onClick={() => open(participant)} onKeyDown={event => onRowKey(event, participant)}>
                <td><div className="event-manage-table__person">
                    {tab === "invitations" ? <><strong>{participant.Email || personName(participant)}</strong>{participant.Name && <small>{participant.Name}</small>}</>
                        : <><strong>{personName(participant)}</strong>{participant.Pseudonym && <small>{t("manage.participants.pseudonym", {pseudonym: participant.Pseudonym})}</small>}</>}
                </div></td>
                {tab !== "invitations" && <td className="event-manage-table__dim">{participant.Email || "—"}</td>}
                <td>{tab === "invitations"
                    ? participant.InvitationExpired ? <span className="ib-tag ib-tag--danger">{t("manage.participants.expired")}</span>
                        : participant.InvitationSentAt ? <span className="ib-tag ib-tag--ok" title={t("manage.participants.sentAt", {date: date.format(new Date(participant.InvitationSentAt))})}>{t("manage.participants.invitationSent")}</span>
                            : <span className="ib-tag ib-tag--warn">{t("manage.participants.notSent")}</span>
                    : <span className={`ib-tag ${statusTags[participant.Status]}`}>{statusNames[participant.Status]}</span>}</td>
                {teamMode && tab === "participants" && <td>{participant.TeamID ? <Link href="/manage/teams" onClick={stop}>{participant.TeamName || t("manage.participants.inTeam")}</Link> : <span className="event-manage-table__dim">{t("manage.participants.noTeam")}</span>}</td>}
                {teamMode && tab === "invitations" && <td>{participant.InvitedToTeam ? participant.InvitedTeamName || t("manage.participants.col.team") : <span className="event-manage-table__dim">—</span>}</td>}
                <td className="event-manage-table__nowrap event-manage-table__dim">{t("manage.participants.dateUtc", {date: date.format(new Date(participant.CreatedAt))})}</td>
                {showAnswers && fieldColumns.map(column => <td key={column.key} className="event-manage-table__answer">{formatAnswer(participant.Answers[column.key])}</td>)}
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
