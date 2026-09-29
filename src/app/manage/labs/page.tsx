"use client";

import {Fragment, useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {AlertTriangle, ChevronDown, Download, ListChecks, RotateCcw} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    DEPLOY_LEAD_RANGE, TEARDOWN_DELAY_RANGE, getManageLabs, getModeratorChallengeLab, getModeratorChallenges, getModeratorVPNConfig,
    isInfrastructureNotAllowed, putManageLabsSettings, recreateStand, standErrorMessage,
    type LabRuntime, type ManageLabs, type ManageStand,
} from "@/api/manageLabs";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {canRecreate, labStatusLabel, labStatusTone, orderStands, readinessLabel, standStatusLabel, standStatusTone, standTeamName, type StatusTone} from "@/components/event/manage/standStatus";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";

const timeFormat = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});
const formatTime = (value: string | null) => value ? timeFormat.format(new Date(value)) : null;

function StatusBadge({label, tone}: {label: string; tone: StatusTone}) {
    return <span className={`event-stands__status is-${tone}`}>{label}</span>;
}

function downloadConfig(config: string, eventTag: string) {
    const url = URL.createObjectURL(new Blob([config], {type: "text/plain"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventTag || "event"}-moderators.conf`;
    link.click();
    URL.revokeObjectURL(url);
}

function inRange(value: number, range: {min: number; max: number}): boolean {
    return Number.isInteger(value) && value >= range.min && value <= range.max;
}

function ScheduleSection({eventID, labs, canManage}: {eventID: string; labs: ManageLabs; canManage: boolean}) {
    const queryClient = useQueryClient();
    const [edit, setEdit] = useState<{lead: number; delay: number} | null>(null);
    const [saving, setSaving] = useState(false);
    const lead = edit?.lead ?? labs.DeployLeadMinutes;
    const delay = edit?.delay ?? labs.TeardownDelayMinutes;
    const dirty = lead !== labs.DeployLeadMinutes || delay !== labs.TeardownDelayMinutes;
    const valid = inRange(lead, DEPLOY_LEAD_RANGE) && inRange(delay, TEARDOWN_DELAY_RANGE);

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!canManage || !dirty || !valid || saving) return;
        setSaving(true);
        try {
            queryClient.setQueryData(["event-management-labs", eventID], await putManageLabsSettings(eventID, {DeployLeadMinutes: lead, TeardownDelayMinutes: delay}));
            setEdit(null);
            toast.success(t("manage.labs.schedule.saved"));
        } catch (failure) {toast.error(standErrorMessage(failure, t("manage.labs.schedule.saveFailed")));}
        finally {setSaving(false);}
    }

    return <form className="event-manage-section event-stands__schedule" onSubmit={save}>
        <dl className="event-stands__times">
            <div><dt>{t("manage.labs.schedule.deploy")}</dt><dd>{formatTime(labs.DeployAt) ?? t("manage.labs.schedule.deployPending")}</dd></div>
            <div><dt>{t("manage.labs.schedule.teardown")}</dt><dd>{formatTime(labs.TeardownAt) ?? t("manage.labs.schedule.teardownPending")}</dd></div>
            <div><dt>{t("manage.labs.schedule.challenges")}</dt><dd>{labs.ChallengesOpened ? t("manage.labs.schedule.challengesOpen") : t("manage.labs.schedule.challengesWaiting")}</dd></div>
        </dl>
        <div className="event-manage-fields-two">
            <div className="event-manage-field"><ManageFieldLabel htmlFor="stand-lead" title={t("manage.labs.schedule.lead")} help={t("manage.labs.schedule.leadHelp", DEPLOY_LEAD_RANGE)} /><input id="stand-lead" className="event-manage-input" type="number" min={DEPLOY_LEAD_RANGE.min} max={DEPLOY_LEAD_RANGE.max} value={Number.isNaN(lead) ? "" : lead} onChange={change => setEdit({lead: change.target.valueAsNumber, delay})} disabled={!canManage || saving} /></div>
            <div className="event-manage-field"><ManageFieldLabel htmlFor="stand-delay" title={t("manage.labs.schedule.delay")} help={t("manage.labs.schedule.delayHelp", TEARDOWN_DELAY_RANGE)} /><input id="stand-delay" className="event-manage-input" type="number" min={TEARDOWN_DELAY_RANGE.min} max={TEARDOWN_DELAY_RANGE.max} value={Number.isNaN(delay) ? "" : delay} onChange={change => setEdit({lead, delay: change.target.valueAsNumber})} disabled={!canManage || saving} /></div>
        </div>
        {dirty && !valid && <p className="event-manage-validation" role="alert">{t("manage.labs.schedule.invalid", {leadMin: DEPLOY_LEAD_RANGE.min, leadMax: DEPLOY_LEAD_RANGE.max, delayMin: TEARDOWN_DELAY_RANGE.min, delayMax: TEARDOWN_DELAY_RANGE.max})}</p>}
        {canManage && dirty && <div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={saving} onClick={() => setEdit(null)}>{t("common.cancel")}</button><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={saving || !valid} busy={saving}>{t("common.save")}</EventButton></div>}
    </form>;
}

function ModeratorChallengesDialog({eventID, open, onClose}: {eventID: string; open: boolean; onClose: () => void}) {
    const challenges = useQuery({queryKey: ["event-management-labs-moderator-challenges", eventID], queryFn: () => getModeratorChallenges(eventID), enabled: open, refetchOnWindowFocus: false});
    const [runtime, setRuntime] = useState<Record<string, LabRuntime | "loading" | "error">>({});

    async function loadLab(challengeID: string) {
        setRuntime(current => ({...current, [challengeID]: "loading"}));
        try {
            const value = await getModeratorChallengeLab(eventID, challengeID);
            setRuntime(current => ({...current, [challengeID]: value}));
        } catch {setRuntime(current => ({...current, [challengeID]: "error"}));}
    }

    return <Dialog open={open} onOpenChange={next => {if (!next) onClose();}}><DialogContent className="max-h-[90dvh] max-w-[min(640px,calc(100vw-24px))] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("manage.labs.moderators.title")}</DialogTitle><DialogDescription>{t("manage.labs.moderators.description")}</DialogDescription></DialogHeader>
        {challenges.isPending ? <EventLoading compact />
            : challenges.isError ? <EventLoadError compact message={standErrorMessage(challenges.error, t("manage.labs.moderators.loadFailed"))} onRetry={() => void challenges.refetch()} />
            : challenges.data.length === 0 ? <EmptyState compact message={t("manage.labs.moderators.empty")} />
            : <ul className="event-stands__challenges">{challenges.data.map(challenge => {
                const lab = runtime[challenge.ChallengeID];
                return <li key={challenge.ChallengeID}>
                    <div className="event-stands__challenge-head"><strong>{challenge.Name || challenge.ChallengeID.slice(0, 8)}</strong><small>{readinessLabel[challenge.Readiness]}</small></div>
                    {challenge.Lab ? <div className="event-stands__challenge-lab"><StatusBadge label={labStatusLabel[challenge.Lab.Status]} tone={labStatusTone[challenge.Lab.Status]} />{challenge.Lab.Status === "ready" && lab === undefined && <button className="ib-btn ib-btn--sm" type="button" onClick={() => void loadLab(challenge.ChallengeID)}>{t("manage.labs.moderators.showAddresses")}</button>}</div> : <small className="event-participants-table__dim">{t("manage.labs.moderators.noLab")}</small>}
                    {lab === "loading" && <EventLoading compact label={t("manage.labs.moderators.addressesLoading")} />}
                    {lab === "error" && <small className="event-stands__error">{t("manage.labs.moderators.labFailed")} <button className="ib-btn ib-btn--sm" type="button" onClick={() => void loadLab(challenge.ChallengeID)}>{t("common.retry")}</button></small>}
                    {lab && typeof lab === "object" && (lab.Access.length === 0 ? <small className="event-participants-table__dim">{t("manage.labs.moderators.noWeb", {cidr: lab.VPNCIDR || "—"})}</small> : <ul className="event-stands__access">{lab.Access.map(entry => <li key={`${entry.Device}-${entry.Port}`}><span>{entry.Device}:{entry.Port}</span>{entry.URL ? <a href={entry.URL} target="_blank" rel="noreferrer">{entry.URL}</a> : <span>{entry.Protocol}</span>}</li>)}</ul>)}
                </li>;
            })}</ul>}
    </DialogContent></Dialog>;
}

export default function ManageLabsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const labsQuery = useQuery({queryKey: ["event-management-labs", eventID], queryFn: () => getManageLabs(eventID), refetchInterval: 15_000, refetchOnWindowFocus: false, retry: (count, failure) => !isInfrastructureNotAllowed(failure) && count < 2});
    const [expanded, setExpanded] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<ManageStand | null>(null);
    const [busy, setBusy] = useState(false);
    const [challengesOpen, setChallengesOpen] = useState(false);

    async function recreate() {
        if (!confirm || busy || !canManage) return;
        setBusy(true);
        try {
            await recreateStand(eventID, confirm.TeamID);
            await queryClient.invalidateQueries({queryKey: ["event-management-labs", eventID]});
            toast.success(t("manage.labs.recreate.started"));
            setConfirm(null);
        } catch (failure) {toast.error(standErrorMessage(failure, t("manage.labs.recreate.failed")));}
        finally {setBusy(false);}
    }

    async function vpn() {
        if (busy) return;
        setBusy(true);
        try {downloadConfig(await getModeratorVPNConfig(eventID), event.Tag);}
        catch (failure) {toast.error(standErrorMessage(failure, t("manage.labs.vpnFailed")));}
        finally {setBusy(false);}
    }

    const heading = <header className="event-manage-heading"><div><h1>{t("manage.labs.title")}</h1><p>{t("manage.labs.subtitle")}</p></div></header>;
    if (labsQuery.isPending) return <EventLoading event={event} label={t("manage.labs.loading")} />;
    if (labsQuery.isError) {
        if (isInfrastructureNotAllowed(labsQuery.error)) return <div className="event-manage-settings event-stands">{heading}<div className="event-manage-notice">{t("manage.labs.notAllowed")}</div></div>;
        return <EventLoadError message={t("manage.labs.loadFailed")} onRetry={() => void labsQuery.refetch()} />;
    }
    const labs = labsQuery.data;
    const items = orderStands(labs.Items);
    const summary = [
        {label: t("manage.labs.summary.total"), value: labs.Summary.Total}, {label: t("manage.labs.summary.ready"), value: labs.Summary.Ready},
        {label: t("manage.labs.summary.creating"), value: labs.Summary.Creating}, {label: t("manage.labs.summary.failed"), value: labs.Summary.Failed},
        {label: t("manage.labs.summary.notDeployed"), value: labs.Summary.NotDeployed}, {label: t("manage.labs.summary.removed"), value: labs.Summary.Removed},
    ];

    return <div className="event-manage-settings event-stands">
        {heading}
        {!labs.LaboratoriesAvailable && <div className="event-manage-notice" role="status"><AlertTriangle size={18} aria-hidden="true" />{t("manage.labs.unavailable")}</div>}
        <ScheduleSection key={`${labs.DeployLeadMinutes}-${labs.TeardownDelayMinutes}`} eventID={eventID} labs={labs} canManage={canManage} />
        <div className="event-stands__summary" role="status">{summary.map(entry => <div key={entry.label}><span>{entry.label}</span><strong>{entry.value}</strong></div>)}</div>
        <section className="event-manage-section event-stands__table">
            {items.length === 0 ? <EmptyState message={t("manage.labs.empty")} /> : <div className="event-participants-table"><table>
                <thead><tr><th>{t("manage.labs.column.team")}</th><th>{t("manage.labs.column.status")}</th><th>{t("manage.labs.column.updated")}</th><th>{t("manage.labs.column.reason")}</th><th><span className="sr-only">{t("manage.labs.column.actions")}</span></th></tr></thead>
                <tbody>{items.map(stand => {
                    const open = expanded === stand.TeamID;
                    return <Fragment key={stand.TeamID}>
                        <tr>
                            <td><div className="event-participants-table__person"><strong>{standTeamName(stand)}</strong>{stand.Generation > 0 && <small>{t("manage.labs.generation", {count: stand.Generation})}</small>}</div></td>
                            <td><StatusBadge label={standStatusLabel[stand.Status]} tone={standStatusTone[stand.Status]} /></td>
                            <td className="event-participants-table__dim">{formatTime(stand.UpdatedAt) ?? "—"}</td>
                            <td>{stand.Labs.length > 0 ? <button className="event-stands__reason" type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : stand.TeamID)}><span>{stand.Reason || t("manage.labs.labCount", {count: stand.Labs.length})}</span><ChevronDown size={14} aria-hidden="true" /></button> : <span className="event-participants-table__dim">{stand.Reason || "—"}</span>}</td>
                            <td><div className="event-manage-participants__actions event-stands__actions">
                                {stand.Moderators && canManage && <><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void vpn()}><Download size={14} aria-hidden="true" />{t("manage.labs.vpnConfig")}</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => setChallengesOpen(true)}><ListChecks size={14} aria-hidden="true" />{t("manage.labs.challenges")}</button></>}
                                {canManage && canRecreate(stand.Status) && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setConfirm(stand)}><RotateCcw size={14} aria-hidden="true" />{t("manage.labs.recreate.confirm")}</button>}
                            </div></td>
                        </tr>
                        {open && <tr className="event-stands__labs"><td colSpan={5}><ul>{stand.Labs.map(lab => <li key={lab.ChallengeID}><span>{lab.ChallengeName || lab.ChallengeID.slice(0, 8)}</span><StatusBadge label={labStatusLabel[lab.Status]} tone={labStatusTone[lab.Status]} />{lab.Reason && <small className="event-stands__error">{lab.Reason}</small>}</li>)}</ul></td></tr>}
                    </Fragment>;
                })}</tbody>
            </table></div>}
        </section>
        <Dialog open={confirm !== null} onOpenChange={next => {if (!next && !busy) setConfirm(null);}}><DialogContent className="max-w-[min(480px,calc(100vw-24px))]">
            <DialogHeader><DialogTitle>{t("manage.labs.recreate.title")}</DialogTitle><DialogDescription>{t("manage.labs.recreate.description", {team: confirm ? standTeamName(confirm) : ""})}</DialogDescription></DialogHeader>
            <div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={busy} onClick={() => setConfirm(null)}>{t("common.cancel")}</button><EventButton className="ib-btn ib-btn--danger" type="button" disabled={busy} onClick={() => void recreate()} busy={busy}>{t("manage.labs.recreate.confirm")}</EventButton></div>
        </DialogContent></Dialog>
        <ModeratorChallengesDialog eventID={eventID} open={challengesOpen} onClose={() => setChallengesOpen(false)} />
    </div>;
}
