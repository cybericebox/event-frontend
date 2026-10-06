"use client";

import {useCallback, useId, useMemo, useRef, useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {sendInvitations, type InvitationResult} from "@/api/manageInvites";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import {EventButton} from "@/components/ui/EventButton";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t, tPlural} from "@/i18n/t";
import {CsvField} from "./invites/CsvField";
import type {FilePickerHandle} from "@/components/ui/EventFilePicker";
import {EmailChipsInput} from "./invites/EmailChipsInput";
import {ManageDialog} from "./invites/ManageDialog";
import {addChips, validChips, type EmailChip} from "./invites/emailChips";
import {MissingFieldsSummary} from "./invites/MissingFieldsSummary";
import {buildSchema, exampleRow, fieldHelp, templateHeader} from "./invites/csvFields";
import {inviteColumns, parseInviteCsv, type CsvIssue} from "./invites/inviteCsv";

export const invitationLimit = 200;

export function invitationFailureText(result: InvitationResult): string {
    return t("manage.invites.result.line", {email: result.Email, reason: t(`manage.invites.result.${result.Code ?? "failed"}`)});
}

// «Запросити учасників» (or to one team), like «Створити команду»: «Вручну»
// takes addresses as chips, «З CSV-файлу» a file with email, first_name,
// last_name (names prefill the pending accounts). A file dropped on the dialog
// switches to the CSV mode.
export function InviteParticipantsDialog({eventID, open, onOpenChange, onSent, team, initialEmails = []}: {
    eventID: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSent: () => Promise<void>;
    team?: {ID: string; Name: string} | null;
    initialEmails?: string[];
}) {
    const id = useId();
    const [mode, setMode] = useState<"manual" | "csv">("manual");
    const [chips, setChips] = useState<EmailChip[]>(() => addChips([], initialEmails.map(email => ({email}))));
    const [csvChips, setCsvChips] = useState<EmailChip[]>([]);
    // The CSV carries the participant form's fields, so the template follows the form as it is now.
    const queryClient = useQueryClient();
    const formKey = ["event-management-participant-form", eventID];
    const formQuery = useQuery({queryKey: formKey, queryFn: () => getManageParticipantForm(eventID), enabled: open && mode === "csv", refetchOnWindowFocus: false});
    const schema = useMemo(() => buildSchema(formQuery.data, null, inviteColumns), [formQuery.data]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [csvIssues, setCsvIssues] = useState<CsvIssue[]>([]);
    const [failures, setFailures] = useState<InvitationResult[]>([]);
    const [busy, setBusy] = useState(false);
    const csvPicker = useRef<FilePickerHandle | null>(null);
    // A CSV dropped in manual mode waits here until the CSV field mounts.
    const droppedCsv = useRef<File[] | null>(null);
    const attachCsvPicker = useCallback((handle: FilePickerHandle | null) => {
        csvPicker.current = handle;
        if (handle && droppedCsv.current) {handle.take(droppedCsv.current); droppedCsv.current = null;}
    }, []);
    // Each mode sends its own addresses: typed chips or the parsed file.
    const active = mode === "manual" ? chips : csvChips;
    const valid = validChips(active);
    const invalidCount = active.length - valid.length;
    const canSend = !busy && valid.length > 0 && valid.length <= invitationLimit && invalidCount === 0;
    const named = valid.filter(chip => chip.firstName || chip.lastName).length;

    function reset() {
        setMode("manual"); setChips([]); setCsvChips([]); setFileName(null); setCsvIssues([]); setFailures([]);
    }

    function switchMode(next: "manual" | "csv") { setMode(next); setFailures([]); }

    // A file dropped anywhere on the dialog goes to the CSV field, switching to it.
    function dropCsv(files: File[]) {
        if (mode === "csv") {csvPicker.current?.take(files); return;}
        droppedCsv.current = files;
        switchMode("csv");
    }

    async function readFile(file: File | null) {
        setFailures([]);
        if (!file) {setFileName(null); setCsvIssues([]); setCsvChips([]); return;}
        setFileName(file.name);
        try {
            // A file dropped before the form arrived waits for it.
            const form = await queryClient.ensureQueryData({queryKey: formKey, queryFn: () => getManageParticipantForm(eventID)});
            const {entries, issues} = parseInviteCsv(await file.text(), buildSchema(form, null, inviteColumns));
            setCsvIssues(issues);
            setCsvChips(addChips([], entries));
        } catch {
            setCsvIssues([]);
            setCsvChips([]);
            toast.error(t("manage.participants.invite.csvFailed"));
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSend) return;
        setBusy(true);
        try {
            const results = await sendInvitations(eventID, valid.map(chip => ({Email: chip.email, FirstName: chip.firstName, LastName: chip.lastName, ...(chip.fields && Object.keys(chip.fields).length ? {Fields: chip.fields} : {})})), team?.ID);
            const failed = results.filter(result => result.Code);
            const failedEmails = new Set(failed.map(result => result.Email.toLowerCase()));
            const sent = results.length - failed.length;
            setFailures(failed);
            const keepFailed = (current: EmailChip[]) => current.filter(chip => failedEmails.has(chip.email));
            if (mode === "manual") setChips(keepFailed); else setCsvChips(keepFailed);
            if (sent) {
                toast.success(t("manage.participants.invite.sent", {count: sent}));
                try {await onSent();} catch {toast.error(t("manage.participants.refreshFailed"));}
            }
            if (!failed.length) {reset(); onOpenChange(false);}
        } catch (error) {
            toast.error(apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, t("manage.participants.invite.sendFailed"), error instanceof ManageApiError ? error.retryAfter : undefined));
        }
        finally {setBusy(false);}
    }

    const title = team ? t("manage.teams.invite.title", {name: team.Name}) : t("manage.participants.invite.title");
    return <ManageDialog open={open} onOpenChange={next => {if (!busy) {if (!next) reset(); onOpenChange(next);}}} title={title}
        description={team ? t("manage.invites.teamDescription") : t("manage.invites.description")} onSubmit={submit}
        fileDrop={{label: t("manage.invites.csv.dropOverlay"), onDrop: dropCsv, disabled: busy}}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={() => {reset(); onOpenChange(false);}}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canSend} busy={busy}>{t("manage.participants.invite.send")}</EventButton></>}>
        <div className="ib-seg event-modal__modes" role="group" aria-label={t("manage.invites.mode")}>
            <button type="button" aria-pressed={mode === "manual"} disabled={busy} onClick={() => switchMode("manual")}>{t("manage.invites.modeManual")}</button>
            <button type="button" aria-pressed={mode === "csv"} disabled={busy} onClick={() => switchMode("csv")}>{t("manage.invites.modeCsv")}</button>
        </div>
        {mode === "manual" ? <div className="ib-field">
            <label className="ib-field__label" htmlFor={`${id}-emails`}>{t("manage.participants.invite.emails")}<span className="ib-field__req" aria-label={t("common.required")}>*</span></label>
            <EmailChipsInput id={`${id}-emails`} chips={chips} onChange={next => {setChips(next); setFailures([]);}} disabled={busy} required placeholder={t("manage.invites.chips.placeholder")} describedBy={`${id}-hint ${id}-error`} />
            <p className="ib-field__hint" id={`${id}-hint`}>{t("manage.invites.chips.hintCounter", {count: valid.length, limit: invitationLimit})}</p>
            <p className="ib-field__error" id={`${id}-error`} role="alert">{invalidCount > 0 ? t("manage.invites.chips.invalid", {count: invalidCount}) : valid.length > invitationLimit ? t("manage.participants.invite.limit") : ""}</p>
        </div> : <>
            <CsvField label={t("manage.invites.csv.label")} columns={inviteColumns} required={["email"]} header={templateHeader(schema, "invite")} fieldLines={fieldHelp(schema)}
                examples={[[t("manage.invites.template.email"), t("manage.invites.template.firstName"), t("manage.invites.template.lastName"), ...exampleRow(schema.participant, true)]]}
                templateName={t("manage.invites.template.inviteFile")} pickerRef={attachCsvPicker} fileName={fileName} onFile={file => void readFile(file)} issues={csvIssues} disabled={busy || formQuery.isError} templateDisabled={formQuery.isPending} />
            {formQuery.isError && <EventLoadError compact message={t("manage.invites.csv.formsFailed")} error={formQuery.error} onRetry={() => void formQuery.refetch()} />}
            {fileName && csvChips.length > 0 && <p className="event-modal__summary" role="status">{tPlural("manage.invites.csv.summary", valid.length, {named, counter: t("manage.invites.counter", {count: valid.length, limit: invitationLimit})})}</p>}
            {fileName && csvIssues.length === 0 && <MissingFieldsSummary rows={valid.map(chip => ({name: chip.email, missing: chip.missing ?? []}))} />}
            {valid.length > invitationLimit && <p className="ib-field__error" role="alert">{t("manage.participants.invite.limit")}</p>}
        </>}
        {failures.length > 0 && <ul className="event-modal__issues" role="status">{failures.map(result => <li key={result.Email}>{invitationFailureText(result)}</li>)}</ul>}
    </ManageDialog>;
}
