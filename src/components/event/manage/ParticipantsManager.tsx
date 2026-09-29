"use client";

import {useState, type KeyboardEvent, type MouseEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import {decideManageParticipant, getManageParticipants, inviteManageParticipants, resendManageInvitation, revokeManageInvitation, setIndividualParticipantHidden, type ManageParticipant, type ParticipantInvitationResult, type ParticipantStatus} from "@/api/manageParticipants";
import {EventLoading} from "@/components/event/EventLoading";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {AnswersList, FieldColumnsButton, useFieldColumns} from "./FieldColumns";
import {formFields, formatAnswer} from "./listColumns";
import {invitationEmails, parseInvitationCsv} from "./participantInvitations";
import {participantTabHref, participantTabs, type ParticipantTab} from "./participantTabs";
import {useManager} from "./ManagerShell";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";

const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const statusNames: Record<ParticipantStatus, string> = {1: t("manage.participants.status.pending"), 2: t("manage.participants.status.approved"), 3: t("manage.participants.status.rejected")};
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
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const [busyID, setBusyID] = useState<string | null>(null);
    const [opened, setOpened] = useState<ManageParticipant | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteText, setInviteText] = useState("");
    const [csvEmails, setCsvEmails] = useState<string[]>([]);
    const [inviteResults, setInviteResults] = useState<ParticipantInvitationResult[]>([]);
    const [inviting, setInviting] = useState(false);
    const emails = invitationEmails(inviteText, csvEmails);
    const cursor = cursors[pageIndex] ?? null;
    const query = useQuery({queryKey: ["event-management-participants", eventID, tab, cursor], queryFn: () => getManageParticipants(eventID, {kind: tab}, cursor), refetchOnWindowFocus: false});
    const formQuery = useQuery({queryKey: ["event-management-participant-form", eventID], queryFn: () => getManageParticipantForm(eventID), refetchOnWindowFocus: false});
    const fields = formFields(formQuery.data?.Document.blocks);
    const {columns, visible: fieldColumns} = useFieldColumns(eventID, "participants", fields, fields.length > 0);
    const showAnswers = tab !== "invitations";
    const counts = query.data?.Counts;

    function changeTab(value: ParticipantTab) {
        setTab(value);
        setCursors([null]);
        setPageIndex(0);
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

    if (query.isPending) return <EventLoading event={event} label={t("manage.participants.loading")} />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.participants.loadFailed")}</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>{t("common.retry")}</button></div>;

    const items = query.data.Items;
    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.participants")}</h1><p>{teamMode ? t("manage.participants.subtitleTeams") : t("manage.participants.subtitle")}</p></div><div className="event-manage-section__actions">{showAnswers && <FieldColumnsButton eventID={eventID} list="participants" columns={columns} canManage={canManage} />}{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => {setInviteResults([]); setInviteOpen(true);}}>{t("manage.participants.invite.title")}</button>}</div></header>
        <Dialog open={inviteOpen} onOpenChange={open => {if (!inviting) setInviteOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>{t("manage.participants.invite.title")}</DialogTitle><DialogDescription>{t("manage.participants.invite.description")}</DialogDescription></DialogHeader><div className="grid gap-4"><label className="event-manage-field"><span>{t("manage.participants.invite.emails")}</span><textarea className="event-manage-input" rows={5} value={inviteText} onChange={e => setInviteText(e.target.value)} placeholder={t("manage.participants.invite.emailsPlaceholder")} disabled={inviting} /></label><label className="event-manage-field"><span>{t("manage.participants.invite.csv")}</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={inviting} onChange={async e => {const file = e.target.files?.[0]; if (file) {try {setCsvEmails(parseInvitationCsv(await file.text())); setInviteResults([]);} catch {toast.error(t("manage.participants.invite.csvFailed"));}}}} /><small>{t("manage.participants.invite.csvHint")}</small></label><p>{t("manage.participants.invite.count", {count: emails.length})}</p>{emails.length > 200 && <p className="event-manage-validation" role="alert">{t("manage.participants.invite.limit")}</p>}{inviteResults.length > 0 && <div role="status" className="grid gap-1">{inviteResults.map(result => <p key={result.Email}>{result.Email}: {result.Error || t("manage.participants.invite.resultSent")}</p>)}</div>}<div className="event-manage-section__actions"><button className="ib-btn" type="button" onClick={() => setInviteOpen(false)} disabled={inviting}>{t("common.close")}</button><button className="ib-btn ib-btn--primary" type="button" onClick={() => void invite()} disabled={inviting || emails.length === 0 || emails.length > 200}>{inviting ? t("manage.participants.invite.sending") : t("manage.participants.invite.send")}</button></div></div></DialogContent></Dialog>
        <div className="event-manage-participants__filters" role="tablist" aria-label={t("manage.participants.sections")}>{participantTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => changeTab(option.value)}>{option.label}{counts && <span className="event-manage-participants__count">{counts[option.count]}</span>}</button>)}</div>
        <section className="event-manage-section event-manage-participants__list" role="tabpanel">
            {items.length === 0 ? <EmptyState message={emptyTexts[tab]} /> : <div className="event-participants-table"><table>
                <thead><tr>
                    <th scope="col">{tab === "invitations" ? t("manage.participants.col.address") : t("manage.participants.col.participant")}</th>
                    {teamMode && tab !== "applications" && <th scope="col">{t("manage.participants.col.team")}</th>}
                    {tab === "applications" && <th scope="col">{t("manage.participants.col.application")}</th>}
                    {tab === "invitations" && <th scope="col">{t("manage.participants.col.email")}</th>}
                    {showAnswers && fieldColumns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
                    {canManage && <th scope="col"><span className="sr-only">{t("manage.participants.col.actions")}</span></th>}
                </tr></thead>
                <tbody>{items.map(participant => <tr key={participant.UserID} className={showAnswers ? "is-clickable" : undefined} tabIndex={showAnswers ? 0 : undefined} aria-label={showAnswers ? t("manage.participants.answersFor", {name: personName(participant)}) : undefined} onClick={() => open(participant)} onKeyDown={event => onRowKey(event, participant)}>
                    <td><div className="event-participants-table__person">
                        {tab === "invitations" ? <><strong>{participant.Email || personName(participant)}</strong>{participant.Name && <small>{participant.Name}</small>}</>
                            : <><strong>{personName(participant)}</strong>{participant.Pseudonym && <small>{t("manage.participants.pseudonym", {pseudonym: participant.Pseudonym})}</small>}{participant.Email && participant.Email !== personName(participant) && <small>{participant.Email}</small>}</>}
                    </div></td>
                    {teamMode && tab === "participants" && <td>{participant.TeamID ? <Link href="/manage/teams" onClick={stop}>{participant.TeamName || t("manage.participants.inTeam")}</Link> : <span className="event-participants-table__dim">{t("manage.participants.noTeam")}</span>}</td>}
                    {teamMode && tab === "invitations" && <td>{participant.InvitedToTeam ? participant.InvitedTeamName || t("manage.participants.col.team") : <span className="event-participants-table__dim">—</span>}</td>}
                    {tab === "applications" && <td><div className="event-participants-table__person"><span className={`event-manage-participants__status is-${participant.Status}`}>{statusNames[participant.Status]}</span><small>{t("manage.participants.dateUtc", {date: date.format(new Date(participant.CreatedAt))})}</small></div></td>}
                    {tab === "invitations" && <td><div className="event-participants-table__person">{participant.InvitationExpired ? <span className="event-manage-participants__status is-3">{t("manage.participants.expired")}</span> : participant.InvitationSentAt ? <small>{t("manage.participants.sentAt", {date: date.format(new Date(participant.InvitationSentAt))})}</small> : <span className="event-manage-participants__status is-1">{t("manage.participants.notSent")}</span>}</div></td>}
                    {showAnswers && fieldColumns.map(column => <td key={column.key} className="event-participants-table__answer">{formatAnswer(participant.Answers[column.key])}</td>)}
                    {canManage && <td onClick={stop}><div className="event-manage-participants__actions">
                        {tab === "participants" && !teamMode && participant.TeamID && <button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => setHidden(participant)}>{participant.Hidden ? t("manage.participants.show") : t("manage.participants.hide")}</button>}
                        {tab === "applications" && participant.Status === 1 && <><button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!!busyID} onClick={() => decide(participant, "approve")}>{t("manage.participants.approve")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => decide(participant, "reject")}>{t("manage.participants.reject")}</button></>}
                        {tab === "invitations" && <><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID || participant.InvitationExpired} onClick={() => resend(participant)}>{t("manage.participants.resend")}</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => revoke(participant)}>{t("manage.participants.revoke")}</button></>}
                    </div></td>}
                </tr>)}</tbody>
            </table></div>}
            {(pageIndex > 0 || !!query.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>{t("common.back")}</button><span>{t("common.page", {number: pageIndex + 1})}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!query.data.NextCursor} onClick={nextPage}>{t("common.next")}</button></div>}
        </section>
        <Dialog open={opened !== null} onOpenChange={value => {if (!value) setOpened(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto">
            <DialogHeader><DialogTitle>{opened ? personName(opened) : ""}</DialogTitle><DialogDescription>{[opened?.Pseudonym && t("manage.participants.pseudonym", {pseudonym: opened.Pseudonym}), opened?.Email, opened && !opened.Invited && t("manage.participants.submittedAt", {date: date.format(new Date(opened.CreatedAt))})].filter(Boolean).join(" · ")}</DialogDescription></DialogHeader>
            {opened && <AnswersList fields={fields} answers={opened.Answers} />}
        </DialogContent></Dialog>
    </div>;
}
