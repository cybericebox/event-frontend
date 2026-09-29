"use client";

import {useCallback, useId, useMemo, useRef, useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {createManageTeams, type BatchTeam, type BatchTeamIssue, type BatchTeamsResult} from "@/api/manageInvites";
import {getManageParticipants} from "@/api/manageParticipants";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import {getManageTeamFields} from "@/api/manageTeamFields";
import type {ParticipantAnswers} from "@/api/participantForm";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {CsvField} from "./invites/CsvField";
import type {FilePickerHandle} from "@/components/ui/EventFilePicker";
import {EmailChipsInput} from "./invites/EmailChipsInput";
import {ManageDialog} from "./invites/ManageDialog";
import {addChips, chipName, validChips, type EmailChip} from "./invites/emailChips";
import {MissingFieldsSummary} from "./invites/MissingFieldsSummary";
import {buildSchema, exampleRow, fieldHelp, templateHeader} from "./invites/csvFields";
import {parseTeamCsv, teamColumns, type CsvIssue, type TeamDraft} from "./invites/inviteCsv";
import {invitationLimit} from "./InviteParticipantsDialog";

type Mode = "manual" | "csv";

function issueMessage(issue: BatchTeamIssue, teamName: string): string {
    return t(`manage.teams.batch.issue.${issue.Code}`, {email: issue.Email, team: teamName});
}

// Row of the CSV the server issue points at: the member's row, else the
// team's first row; whole-batch issues have none.
function csvIssueText(issue: BatchTeamIssue, teams: TeamDraft[]): string {
    const team = teams[issue.Team];
    const message = issueMessage(issue, team?.name ?? "");
    const row = team ? (team.members.find(member => member.email === issue.Email)?.row ?? team.row) : null;
    return row ? t("manage.invites.csv.row", {row, message}) : message;
}

function failure(error: unknown, fallback: string): string {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}

function doneText(result: BatchTeamsResult): string {
    return t("manage.teams.batch.done", {teams: result.Teams.length, assigned: result.Assigned, invited: result.Invited});
}

// «Створити команду»: one team by hand (members as chips, existing
// participants can be picked) or many from a CSV (team, email, first_name,
// last_name, captain). Members join at once; people who are not participants
// yet are invited and stay «очікує підтвердження» until they accept.
export function CreateTeamDialog({eventID, open, onOpenChange, onCreated}: {
    eventID: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => Promise<void>;
}) {
    const id = useId();
    const [mode, setMode] = useState<Mode>("manual");
    const csvPicker = useRef<FilePickerHandle | null>(null);
    // A CSV dropped in manual mode waits here until the CSV field mounts.
    const droppedCsv = useRef<File[] | null>(null);
    const attachCsvPicker = useCallback((handle: FilePickerHandle | null) => {
        csvPicker.current = handle;
        if (handle && droppedCsv.current) {handle.take(droppedCsv.current); droppedCsv.current = null;}
    }, []);

    // A file dropped anywhere on the dialog goes to the CSV field, switching to it.
    function dropCsv(files: File[]) {
        if (mode === "csv") {csvPicker.current?.take(files); return;}
        droppedCsv.current = files;
        setMode("csv"); setServerIssues([]);
    }
    const [name, setName] = useState("");
    const [chips, setChips] = useState<EmailChip[]>([]);
    const [captain, setCaptain] = useState("");
    const [pick, setPick] = useState("");
    const [fieldAnswers, setFieldAnswers] = useState<ParticipantAnswers>({});
    const [fileName, setFileName] = useState<string | null>(null);
    const [csvIssues, setCsvIssues] = useState<CsvIssue[]>([]);
    const [csvTeams, setCsvTeams] = useState<TeamDraft[]>([]);
    const [preview, setPreview] = useState<BatchTeamsResult | null>(null);
    const [serverIssues, setServerIssues] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const fieldsQuery = useQuery({queryKey: ["event-management-team-fields", eventID], queryFn: () => getManageTeamFields(eventID), enabled: open, refetchOnWindowFocus: false});
    // The CSV carries the team and participant form fields: the template follows the forms as they are now.
    const queryClient = useQueryClient();
    const participantFormKey = ["event-management-participant-form", eventID];
    const teamFieldsKey = ["event-management-team-fields", eventID];
    const participantFormQuery = useQuery({queryKey: participantFormKey, queryFn: () => getManageParticipantForm(eventID), enabled: open && mode === "csv", refetchOnWindowFocus: false});
    const schema = useMemo(() => buildSchema(participantFormQuery.data, fieldsQuery.data, teamColumns), [participantFormQuery.data, fieldsQuery.data]);
    const participantsQuery = useQuery({
        queryKey: ["event-management-team-dialog-participants", eventID],
        queryFn: () => getManageParticipants(eventID, {kind: "participants"}, null, 100),
        enabled: open && mode === "manual", refetchOnWindowFocus: false,
    });
    const members = validChips(chips);
    const invalidCount = chips.length - members.length;
    const chosen = new Set(chips.map(chip => chip.email));
    const available = (participantsQuery.data?.Items ?? []).filter(person => !person.TeamID && person.Email && !chosen.has(person.Email.toLowerCase()));
    const captainValue = members.some(chip => chip.email === captain) ? captain : "";
    const people = csvTeams.reduce((sum, team) => sum + team.members.length, 0);
    const canCreateManual = !busy && name.trim().length >= 3 && members.length > 0 && invalidCount === 0 && !!captainValue && members.length <= invitationLimit;
    const canCreateCsv = !busy && !!preview && preview.Issues.length === 0 && csvIssues.length === 0;

    function reset() {
        setMode("manual"); setName(""); setChips([]); setCaptain(""); setPick(""); setFieldAnswers({});
        setFileName(null); setCsvIssues([]); setCsvTeams([]); setPreview(null); setServerIssues([]);
    }

    function close() {
        if (busy) return;
        reset();
        onOpenChange(false);
    }

    function addParticipant(userID: string) {
        const person = available.find(item => item.UserID === userID);
        setPick("");
        if (person) setChips(current => addChips(current, [{email: person.Email, firstName: person.Name}]));
    }

    async function readFile(file: File | null) {
        setPreview(null); setServerIssues([]);
        if (!file) {setFileName(null); setCsvIssues([]); setCsvTeams([]); return;}
        setFileName(file.name);
        let parsed: ReturnType<typeof parseTeamCsv>;
        try {
            // A file dropped before the forms arrived waits for them.
            const [participantForm, teamForm] = await Promise.all([
                queryClient.ensureQueryData({queryKey: participantFormKey, queryFn: () => getManageParticipantForm(eventID)}),
                queryClient.ensureQueryData({queryKey: teamFieldsKey, queryFn: () => getManageTeamFields(eventID)}),
            ]);
            parsed = parseTeamCsv(await file.text(), buildSchema(participantForm, teamForm, teamColumns));
        }
        catch {toast.error(t("manage.participants.invite.csvFailed")); return;}
        setCsvIssues(parsed.issues);
        setCsvTeams(parsed.teams);
        if (parsed.issues.length || parsed.teams.length === 0) return;
        setBusy(true);
        try {
            const result = await createManageTeams(eventID, toBatch(parsed.teams), true, true);
            setPreview(result);
            setServerIssues(result.Issues.map(issue => csvIssueText(issue, parsed.teams)));
        } catch (error) {toast.error(failure(error, t("manage.teams.batch.previewFailed")));}
        finally {setBusy(false);}
    }

    function toBatch(teams: TeamDraft[]): BatchTeam[] {
        return teams.map(team => ({Name: team.name, CaptainEmail: team.captainEmail, Members: team.members.map(member => ({Email: member.email, FirstName: member.firstName, LastName: member.lastName, ...(member.fields && Object.keys(member.fields).length ? {Fields: member.fields} : {})})), ...(Object.keys(team.fields).length ? {Fields: team.fields} : {})}));
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mode === "manual" ? !canCreateManual : !canCreateCsv) return;
        const teams: BatchTeam[] = mode === "manual"
            ? [{Name: name.trim(), CaptainEmail: captainValue, Members: members.map(chip => ({Email: chip.email, FirstName: chip.firstName, LastName: chip.lastName})), Fields: fieldAnswers}]
            : toBatch(csvTeams);
        setBusy(true);
        try {
            const result = await createManageTeams(eventID, teams, false, mode === "csv");
            if (result.Issues.length) {
                setPreview(mode === "csv" ? result : null);
                setServerIssues(result.Issues.map(issue => mode === "csv" ? csvIssueText(issue, csvTeams) : issueMessage(issue, name.trim())));
                return;
            }
            toast.success(doneText(result));
            if (result.NotSent.length) toast.error(t("manage.teams.batch.notSent", {count: result.NotSent.length}));
            try {await onCreated();} catch {toast.error(t("manage.teams.createdNoRefresh"));}
            reset();
            onOpenChange(false);
        } catch (error) {toast.error(failure(error, t("manage.teams.createFailed")));}
        finally {setBusy(false);}
    }

    return <ManageDialog open={open} onOpenChange={next => {if (!next) close(); else onOpenChange(true);}} title={t("manage.teams.newTitle")} description={t("manage.teams.batch.description")} onSubmit={submit} size="md"
        fileDrop={{label: t("manage.invites.csv.dropOverlay"), onDrop: dropCsv, disabled: busy}}
        footer={<><button className="ib-btn" type="button" disabled={busy} onClick={close}>{t("common.cancel")}</button>
            <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={mode === "manual" ? !canCreateManual : !canCreateCsv} busy={busy}>{mode === "manual" ? t("manage.teams.create") : t("manage.teams.batch.createAll", {count: csvTeams.length})}</EventButton></>}>
        <div className="ib-seg event-modal__modes" role="group" aria-label={t("manage.teams.batch.mode")}>
            <button type="button" aria-pressed={mode === "manual"} disabled={busy} onClick={() => {setMode("manual"); setServerIssues([]);}}>{t("manage.teams.batch.modeManual")}</button>
            <button type="button" aria-pressed={mode === "csv"} disabled={busy} onClick={() => {setMode("csv"); setServerIssues([]);}}>{t("manage.teams.batch.modeCsv")}</button>
        </div>
        {mode === "manual" ? <>
            <div className="ib-field">
                <label className="ib-field__label" htmlFor={`${id}-name`}>{t("manage.teams.name")}<span className="ib-field__req" aria-label={t("common.required")}>*</span></label>
                <input id={`${id}-name`} className="ib-input" value={name} onChange={event => {setName(event.target.value); setServerIssues([]);}} minLength={3} maxLength={64} required disabled={busy} placeholder={t("manage.teams.namePlaceholder")} />
            </div>
            <div className="ib-field">
                <label className="ib-field__label" htmlFor={`${id}-members`}>{t("manage.teams.batch.members")}<span className="ib-field__req" aria-label={t("common.required")}>*</span></label>
                <EmailChipsInput id={`${id}-members`} chips={chips} onChange={next => {setChips(next); setServerIssues([]);}} disabled={busy} required placeholder={t("manage.invites.chips.placeholder")} describedBy={`${id}-members-hint ${id}-members-error`} />
                <p className="ib-field__hint" id={`${id}-members-hint`}>{t("manage.teams.batch.membersHint")}</p>
                <p className="ib-field__error" id={`${id}-members-error`} role="alert">{invalidCount > 0 ? t("manage.invites.chips.invalid", {count: invalidCount}) : ""}</p>
                {available.length > 0 && <EventSelect ariaLabel={t("manage.teams.batch.pickParticipant")} value={pick} placeholder={t("manage.teams.batch.pickParticipant")} options={available.map(person => ({value: person.UserID, label: person.Name ? `${person.Name} · ${person.Email}` : person.Email}))} onValueChange={addParticipant} disabled={busy} />}
            </div>
            <div className="ib-field">
                <span className="ib-field__label" id={`${id}-captain`}>{t("manage.teams.captain")}<span className="ib-field__req" aria-label={t("common.required")}>*</span></span>
                <EventSelect ariaLabel={t("manage.teams.captain")} value={captainValue} placeholder={members.length ? t("manage.teams.batch.chooseCaptain") : t("manage.teams.batch.addMembersFirst")} options={members.map(chip => ({value: chip.email, label: chipName(chip) ? `${chipName(chip)} · ${chip.email}` : chip.email}))} onValueChange={setCaptain} disabled={busy || members.length === 0} />
                <p className="ib-field__hint">{t("manage.teams.batch.pendingNote")}</p>
            </div>
            {fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fieldAnswers} onChange={(key, value) => setFieldAnswers(current => ({...current, [key]: value}))} disabled={busy} />}
        </> : <>
            <CsvField label={t("manage.teams.batch.csv")} columns={teamColumns} required={["team", "email", "captain"]} header={templateHeader(schema, "team")} fieldLines={fieldHelp(schema)}
                examples={[
                    [t("manage.invites.template.team"), ...exampleRow(schema.team, true), t("manage.invites.template.email"), t("manage.invites.template.firstName"), t("manage.invites.template.lastName"), t("manage.invites.template.captain"), ...exampleRow(schema.participant, true)],
                    [t("manage.invites.template.team"), ...exampleRow(schema.team, false), t("manage.invites.template.email2"), t("manage.invites.template.firstName2"), t("manage.invites.template.lastName2"), "", ...exampleRow(schema.participant, true)],
                ]}
                templateName={t("manage.invites.template.teamFile")} pickerRef={attachCsvPicker} fileName={fileName} onFile={file => void readFile(file)} issues={csvIssues} disabled={busy || participantFormQuery.isError || fieldsQuery.isError} templateDisabled={participantFormQuery.isPending || fieldsQuery.isPending} />
            {(participantFormQuery.isError || fieldsQuery.isError) && <p className="ib-field__error" role="alert">{t("manage.invites.csv.formsFailed")}</p>}
            <p className="ib-field__hint">{t("manage.teams.batch.captainMarks")}</p>
            {preview && preview.Issues.length === 0 && <p className="event-modal__summary" role="status">{t("manage.teams.batch.preview", {teams: csvTeams.length, people, invites: preview.Invited})}</p>}
            {preview && preview.Issues.length === 0 && <MissingFieldsSummary rows={[...csvTeams.map(team => ({name: team.name, missing: team.missing})), ...csvTeams.flatMap(team => team.members.map(member => ({name: member.email, missing: member.missing ?? []})))]} />}
        </>}
        {serverIssues.length > 0 && <ul className="event-modal__issues" role="alert">{serverIssues.map((text, index) => <li key={index}>{text}</li>)}</ul>}
    </ManageDialog>;
}
