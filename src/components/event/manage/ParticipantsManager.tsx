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

const date = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const statusNames: Record<ParticipantStatus, string> = {1: "Очікує рішення", 2: "Підтверджено", 3: "Відхилено"};
const emptyTexts: Record<ParticipantTab, string> = {participants: "Підтверджених учасників поки немає.", applications: "Заявок поки немає.", invitations: "Активних запрошень немає."};

function personName(participant: Pick<ManageParticipant, "Name" | "DisplayName" | "Email" | "UserID">): string {
    return participant.Name || participant.DisplayName || participant.Email || `Учасник ${participant.UserID.slice(0, 8)}`;
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
        if (action === "reject" && !window.confirm(`Відхилити заявку ${personName(participant)}?`)) return;
        void run(participant, () => decideManageParticipant(eventID, participant.UserID, action), action === "approve" ? "Участь підтверджено" : "Заявку відхилено", "Не вдалося змінити статус заявки.");
    }

    function revoke(participant: ManageParticipant) {
        if (!window.confirm(`Відкликати запрошення для ${participant.Email || personName(participant)}?`)) return;
        void run(participant, () => revokeManageInvitation(eventID, participant.UserID), "Запрошення відкликано", "Не вдалося відкликати запрошення.");
    }

    function resend(participant: ManageParticipant) {
        void run(participant, () => resendManageInvitation(eventID, participant.UserID), "Лист надіслано повторно", "Не вдалося надіслати лист.");
    }

    function setHidden(participant: ManageParticipant) {
        if (teamMode || participant.Status !== 2 || !participant.TeamID) return;
        void run(participant, () => setIndividualParticipantHidden(eventID, participant.UserID, !participant.Hidden), participant.Hidden ? "Учасника повернуто до рейтингу" : "Учасника приховано з рейтингу та підрахунків", "Не вдалося змінити видимість учасника.");
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
                toast.success(`Надіслано запрошень: ${sent}`);
            }
            if (sent === results.length) {setInviteText(""); setCsvEmails([]);}
        } catch {toast.error("Не вдалося надіслати запрошення. Спробуйте ще раз.");}
        finally {setInviting(false);}
    }

    const open = (participant: ManageParticipant) => {if (showAnswers) setOpened(participant);};
    const stop = (event: MouseEvent) => event.stopPropagation();
    const onRowKey = (event: KeyboardEvent, participant: ManageParticipant) => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); open(participant);}};

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо учасників…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити учасників</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    const items = query.data.Items;
    return <div className="event-manage-settings event-manage-participants">
        <header className="event-manage-heading"><div><h1>Учасники</h1><p>{teamMode ? "Люди, заявки та запрошення. Склад команд — на сторінці «Команди»." : "Учасники, заявки та запрошення."}</p></div><div className="event-manage-section__actions">{showAnswers && <FieldColumnsButton eventID={eventID} list="participants" columns={columns} canManage={canManage} />}{canManage && <button className="ib-btn ib-btn--primary" type="button" onClick={() => {setInviteResults([]); setInviteOpen(true);}}>Запросити учасників</button>}</div></header>
        <Dialog open={inviteOpen} onOpenChange={open => {if (!inviting) setInviteOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>Запросити учасників</DialogTitle><DialogDescription>Вкажіть адреси вручну або додайте CSV. Запрошені стануть учасниками після власного підтвердження.</DialogDescription></DialogHeader><div className="grid gap-4"><label className="event-manage-field"><span>Адреси електронної пошти</span><textarea className="event-manage-input" rows={5} value={inviteText} onChange={e => setInviteText(e.target.value)} placeholder="Одна адреса на рядок" disabled={inviting} /></label><label className="event-manage-field"><span>CSV-файл</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={inviting} onChange={async e => {const file = e.target.files?.[0]; if (file) {try {setCsvEmails(parseInvitationCsv(await file.text())); setInviteResults([]);} catch {toast.error("Не вдалося прочитати CSV-файл.");}}}} /><small>Колонка email або перша колонка файлу. До 200 адрес за раз.</small></label><p>Адрес для запрошення: {emails.length}</p>{emails.length > 200 && <p className="event-manage-validation" role="alert">За один раз можна запросити не більше 200 учасників.</p>}{inviteResults.length > 0 && <div role="status" className="grid gap-1">{inviteResults.map(result => <p key={result.Email}>{result.Email}: {result.Error || "запрошення надіслано"}</p>)}</div>}<div className="event-manage-section__actions"><button className="ib-btn" type="button" onClick={() => setInviteOpen(false)} disabled={inviting}>Закрити</button><button className="ib-btn ib-btn--primary" type="button" onClick={() => void invite()} disabled={inviting || emails.length === 0 || emails.length > 200}>{inviting ? "Надсилаємо…" : "Надіслати запрошення"}</button></div></div></DialogContent></Dialog>
        <div className="event-manage-participants__filters" role="tablist" aria-label="Розділи учасників">{participantTabs.map(option => <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => changeTab(option.value)}>{option.label}{counts && <span className="event-manage-participants__count">{counts[option.count]}</span>}</button>)}</div>
        <section className="event-manage-section event-manage-participants__list" role="tabpanel">
            {items.length === 0 ? <p className="event-challenge-manager__empty">{emptyTexts[tab]}</p> : <div className="event-participants-table"><table>
                <thead><tr>
                    <th scope="col">{tab === "invitations" ? "Адреса" : "Учасник"}</th>
                    {teamMode && tab !== "applications" && <th scope="col">Команда</th>}
                    {tab === "applications" && <th scope="col">Заявка</th>}
                    {tab === "invitations" && <th scope="col">Лист</th>}
                    {showAnswers && fieldColumns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
                    {canManage && <th scope="col"><span className="sr-only">Дії</span></th>}
                </tr></thead>
                <tbody>{items.map(participant => <tr key={participant.UserID} className={showAnswers ? "is-clickable" : undefined} tabIndex={showAnswers ? 0 : undefined} aria-label={showAnswers ? `Відповіді: ${personName(participant)}` : undefined} onClick={() => open(participant)} onKeyDown={event => onRowKey(event, participant)}>
                    <td><div className="event-participants-table__person">
                        {tab === "invitations" ? <><strong>{participant.Email || personName(participant)}</strong>{participant.Name && <small>{participant.Name}</small>}</>
                            : <><strong>{personName(participant)}</strong>{participant.Pseudonym && <small>Псевдонім: {participant.Pseudonym}</small>}{participant.Email && participant.Email !== personName(participant) && <small>{participant.Email}</small>}</>}
                    </div></td>
                    {teamMode && tab === "participants" && <td>{participant.TeamID ? <Link href="/manage/teams" onClick={stop}>{participant.TeamName || "У команді"}</Link> : <span className="event-participants-table__dim">Без команди</span>}</td>}
                    {teamMode && tab === "invitations" && <td>{participant.InvitedToTeam ? participant.InvitedTeamName || "Команда" : <span className="event-participants-table__dim">—</span>}</td>}
                    {tab === "applications" && <td><div className="event-participants-table__person"><span className={`event-manage-participants__status is-${participant.Status}`}>{statusNames[participant.Status]}</span><small>{date.format(new Date(participant.CreatedAt))} UTC</small></div></td>}
                    {tab === "invitations" && <td><div className="event-participants-table__person">{participant.InvitationExpired ? <span className="event-manage-participants__status is-3">Прострочено</span> : participant.InvitationSentAt ? <small>Надіслано {date.format(new Date(participant.InvitationSentAt))} UTC</small> : <span className="event-manage-participants__status is-1">Лист не надіслано</span>}</div></td>}
                    {showAnswers && fieldColumns.map(column => <td key={column.key} className="event-participants-table__answer">{formatAnswer(participant.Answers[column.key])}</td>)}
                    {canManage && <td onClick={stop}><div className="event-manage-participants__actions">
                        {tab === "participants" && !teamMode && participant.TeamID && <button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => setHidden(participant)}>{participant.Hidden ? "Показати в рейтингу" : "Приховати з рейтингу"}</button>}
                        {tab === "applications" && participant.Status === 1 && <><button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!!busyID} onClick={() => decide(participant, "approve")}>Підтвердити</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => decide(participant, "reject")}>Відхилити</button></>}
                        {tab === "invitations" && <><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID || participant.InvitationExpired} onClick={() => resend(participant)}>Надіслати ще раз</button><button className="ib-btn ib-btn--sm" type="button" disabled={!!busyID} onClick={() => revoke(participant)}>Відкликати</button></>}
                    </div></td>}
                </tr>)}</tbody>
            </table></div>}
            {(pageIndex > 0 || !!query.data.NextCursor) && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => index - 1)}>Назад</button><span>Сторінка {pageIndex + 1}</span><button className="ib-btn ib-btn--sm" type="button" disabled={!query.data.NextCursor} onClick={nextPage}>Далі</button></div>}
        </section>
        <Dialog open={opened !== null} onOpenChange={value => {if (!value) setOpened(null);}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto">
            <DialogHeader><DialogTitle>{opened ? personName(opened) : ""}</DialogTitle><DialogDescription>{[opened?.Pseudonym && `Псевдонім: ${opened.Pseudonym}`, opened?.Email, opened && !opened.Invited && `Подано ${date.format(new Date(opened.CreatedAt))} UTC`].filter(Boolean).join(" · ")}</DialogDescription></DialogHeader>
            {opened && <AnswersList fields={fields} answers={opened.Answers} />}
        </DialogContent></Dialog>
    </div>;
}
