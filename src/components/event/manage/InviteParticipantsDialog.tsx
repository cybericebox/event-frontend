"use client";

import {useId, useState, type FormEvent} from "react";
import {toast} from "react-hot-toast";
import {sendInvitations, type InvitationResult} from "@/api/manageInvites";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {CsvField} from "./invites/CsvField";
import {EmailChipsInput} from "./invites/EmailChipsInput";
import {ManageDialog} from "./invites/ManageDialog";
import {addChips, validChips, type EmailChip} from "./invites/emailChips";
import {inviteColumns, parseInviteCsv, type CsvIssue} from "./invites/inviteCsv";

export const invitationLimit = 200;

export function invitationFailureText(result: InvitationResult): string {
    return t("manage.invites.result.line", {email: result.Email, reason: t(`manage.invites.result.${result.Code ?? "failed"}`)});
}

// «Запросити учасників» (or to one team): addresses as chips and/or a CSV with
// email, first_name, last_name; names prefill the pending accounts.
export function InviteParticipantsDialog({eventID, open, onOpenChange, onSent, team, initialEmails = []}: {
    eventID: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSent: () => Promise<void>;
    team?: {ID: string; Name: string} | null;
    initialEmails?: string[];
}) {
    const id = useId();
    const [chips, setChips] = useState<EmailChip[]>(() => addChips([], initialEmails.map(email => ({email}))));
    const [fileName, setFileName] = useState<string | null>(null);
    const [csvIssues, setCsvIssues] = useState<CsvIssue[]>([]);
    const [failures, setFailures] = useState<InvitationResult[]>([]);
    const [busy, setBusy] = useState(false);
    const valid = validChips(chips);
    const invalidCount = chips.length - valid.length;
    const canSend = !busy && valid.length > 0 && valid.length <= invitationLimit && invalidCount === 0;

    function reset() {
        setChips([]); setFileName(null); setCsvIssues([]); setFailures([]);
    }

    async function readFile(file: File | null) {
        setFailures([]);
        if (!file) {setFileName(null); setCsvIssues([]); return;}
        setFileName(file.name);
        try {
            const {entries, issues} = parseInviteCsv(await file.text());
            setCsvIssues(issues);
            setChips(current => addChips(current, entries));
        } catch {
            setCsvIssues([]);
            toast.error(t("manage.participants.invite.csvFailed"));
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSend) return;
        setBusy(true);
        try {
            const results = await sendInvitations(eventID, valid.map(chip => ({Email: chip.email, FirstName: chip.firstName, LastName: chip.lastName})), team?.ID);
            const failed = results.filter(result => result.Code);
            const failedEmails = new Set(failed.map(result => result.Email.toLowerCase()));
            const sent = results.length - failed.length;
            setFailures(failed);
            setChips(current => current.filter(chip => failedEmails.has(chip.email)));
            if (sent) {
                toast.success(t("manage.participants.invite.sent", {count: sent}));
                try {await onSent();} catch {toast.error(t("manage.participants.refreshFailed"));}
            }
            if (!failed.length) {reset(); onOpenChange(false);}
        } catch {toast.error(t("manage.participants.invite.sendFailed"));}
        finally {setBusy(false);}
    }

    const title = team ? t("manage.teams.invite.title", {name: team.Name}) : t("manage.participants.invite.title");
    return <ManageDialog open={open} onOpenChange={next => {if (!busy) {if (!next) reset(); onOpenChange(next);}}} title={title}
        description={team ? t("manage.invites.teamDescription") : t("manage.invites.description")} onSubmit={submit}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={() => {reset(); onOpenChange(false);}}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canSend} busy={busy}>{t("manage.participants.invite.send")}</EventButton></>}>
        <div className="ib-field">
            <label className="ib-field__label" htmlFor={`${id}-emails`}>{t("manage.participants.invite.emails")}<span className="ib-field__req" aria-label={t("common.required")}>*</span></label>
            <EmailChipsInput id={`${id}-emails`} chips={chips} onChange={next => {setChips(next); setFailures([]);}} disabled={busy} required placeholder={t("manage.invites.chips.placeholder")} describedBy={`${id}-hint ${id}-error`} />
            <p className="ib-field__hint" id={`${id}-hint`}>{t("manage.invites.chips.hint")} {t("manage.invites.counter", {count: valid.length, limit: invitationLimit})}</p>
            <p className="ib-field__error" id={`${id}-error`} role="alert">{invalidCount > 0 ? t("manage.invites.chips.invalid", {count: invalidCount}) : valid.length > invitationLimit ? t("manage.participants.invite.limit") : ""}</p>
        </div>
        <CsvField label={t("manage.invites.csv.label")} columns={inviteColumns} required={["email"]} examples={[[t("manage.invites.template.email"), t("manage.invites.template.firstName"), t("manage.invites.template.lastName")]]}
            templateName={t("manage.invites.template.inviteFile")} fileName={fileName} onFile={file => void readFile(file)} issues={csvIssues} disabled={busy} />
        {failures.length > 0 && <ul className="event-modal__issues" role="status">{failures.map(result => <li key={result.Email}>{invitationFailureText(result)}</li>)}</ul>}
    </ManageDialog>;
}
