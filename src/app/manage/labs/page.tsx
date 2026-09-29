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
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {canRecreate, labStatusLabel, labStatusTone, orderStands, readinessLabel, standStatusLabel, standStatusTone, standTeamName, type StatusTone} from "@/components/event/manage/standStatus";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";

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
            toast.success("Розклад стендів збережено");
        } catch (failure) {toast.error(standErrorMessage(failure, "Не вдалося зберегти розклад стендів."));}
        finally {setSaving(false);}
    }

    return <form className="event-manage-section event-stands__schedule" onSubmit={save}>
        <dl className="event-stands__times">
            <div><dt>Розгортання</dt><dd>{formatTime(labs.DeployAt) ?? "Після налаштування розкладу події"}</dd></div>
            <div><dt>Видалення</dt><dd>{formatTime(labs.TeardownAt) ?? "Після завершення події"}</dd></div>
            <div><dt>Завдання зі стендом</dt><dd>{labs.ChallengesOpened ? "Відкриті" : "Чекають на готовність усіх стендів"}</dd></div>
        </dl>
        <div className="event-manage-fields-two">
            <div className="event-manage-field"><ManageFieldLabel htmlFor="stand-lead" title="Розгортати за, хв" help={`Стенди всіх допущених команд і команди модераторів створюються автоматично за стільки хвилин до старту.\n\nВід ${DEPLOY_LEAD_RANGE.min} до ${DEPLOY_LEAD_RANGE.max}.`} /><input id="stand-lead" className="event-manage-input" type="number" min={DEPLOY_LEAD_RANGE.min} max={DEPLOY_LEAD_RANGE.max} value={Number.isNaN(lead) ? "" : lead} onChange={change => setEdit({lead: change.target.valueAsNumber, delay})} disabled={!canManage || saving} /></div>
            <div className="event-manage-field"><ManageFieldLabel htmlFor="stand-delay" title="Видаляти через, хв" help={`Стенди видаляються автоматично через стільки хвилин після завершення події. Видалення остаточне.\n\nВід ${TEARDOWN_DELAY_RANGE.min} до ${TEARDOWN_DELAY_RANGE.max}.`} /><input id="stand-delay" className="event-manage-input" type="number" min={TEARDOWN_DELAY_RANGE.min} max={TEARDOWN_DELAY_RANGE.max} value={Number.isNaN(delay) ? "" : delay} onChange={change => setEdit({lead, delay: change.target.valueAsNumber})} disabled={!canManage || saving} /></div>
        </div>
        {dirty && !valid && <p className="event-manage-validation" role="alert">Розгортання — від {DEPLOY_LEAD_RANGE.min} до {DEPLOY_LEAD_RANGE.max} хв, видалення — від {TEARDOWN_DELAY_RANGE.min} до {TEARDOWN_DELAY_RANGE.max} хв.</p>}
        {canManage && dirty && <div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={saving} onClick={() => setEdit(null)}>Скасувати</button><button className="ib-btn ib-btn--primary" type="submit" disabled={saving || !valid}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
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
        <DialogHeader><DialogTitle>Завдання команди модераторів</DialogTitle><DialogDescription>Готовність завдань і лабораторій для перевірки. Лабораторії доступні через VPN-конфіг команди модераторів.</DialogDescription></DialogHeader>
        {challenges.isPending ? <p className="event-participants-table__dim">Завантажуємо…</p>
            : challenges.isError ? <div className="event-manage-notice" role="alert">{standErrorMessage(challenges.error, "Не вдалося завантажити завдання.")}<button className="ib-btn ib-btn--sm" type="button" onClick={() => void challenges.refetch()}>Повторити</button></div>
            : challenges.data.length === 0 ? <p className="event-participants-table__dim">Завдань ще немає.</p>
            : <ul className="event-stands__challenges">{challenges.data.map(challenge => {
                const lab = runtime[challenge.ChallengeID];
                return <li key={challenge.ChallengeID}>
                    <div className="event-stands__challenge-head"><strong>{challenge.Name || challenge.ChallengeID.slice(0, 8)}</strong><small>{readinessLabel[challenge.Readiness]}</small></div>
                    {challenge.Lab ? <div className="event-stands__challenge-lab"><StatusBadge label={labStatusLabel[challenge.Lab.Status]} tone={labStatusTone[challenge.Lab.Status]} />{challenge.Lab.Status === "ready" && lab === undefined && <button className="ib-btn ib-btn--sm" type="button" onClick={() => void loadLab(challenge.ChallengeID)}>Показати адреси</button>}</div> : <small className="event-participants-table__dim">Без лабораторії</small>}
                    {lab === "loading" && <small className="event-participants-table__dim">Завантажуємо адреси…</small>}
                    {lab === "error" && <small className="event-stands__error">Не вдалося отримати стан лабораторії. <button className="ib-btn ib-btn--sm" type="button" onClick={() => void loadLab(challenge.ChallengeID)}>Повторити</button></small>}
                    {lab && typeof lab === "object" && (lab.Access.length === 0 ? <small className="event-participants-table__dim">Вебадрес немає. Підмережа VPN: {lab.VPNCIDR || "—"}</small> : <ul className="event-stands__access">{lab.Access.map(entry => <li key={`${entry.Device}-${entry.Port}`}><span>{entry.Device}:{entry.Port}</span>{entry.URL ? <a href={entry.URL} target="_blank" rel="noreferrer">{entry.URL}</a> : <span>{entry.Protocol}</span>}</li>)}</ul>)}
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
            toast.success("Стенд перестворюється");
            setConfirm(null);
        } catch (failure) {toast.error(standErrorMessage(failure, "Не вдалося перестворити стенд."));}
        finally {setBusy(false);}
    }

    async function vpn() {
        if (busy) return;
        setBusy(true);
        try {downloadConfig(await getModeratorVPNConfig(eventID), event.Tag);}
        catch (failure) {toast.error(standErrorMessage(failure, "Не вдалося отримати VPN-конфіг."));}
        finally {setBusy(false);}
    }

    const heading = <header className="event-manage-heading"><div><h1>Стенди</h1><p>Лабораторії команд для завдань з інфраструктурою. Створюються й видаляються автоматично за розкладом.</p></div></header>;
    if (labsQuery.isPending) return <EventLoading event={event} label="Завантажуємо стенди…" />;
    if (labsQuery.isError) {
        if (isInfrastructureNotAllowed(labsQuery.error)) return <div className="event-manage-settings event-stands">{heading}<div className="event-manage-notice">Для цієї події завдання з інфраструктурою не дозволені, тому стенди не створюються.</div></div>;
        return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити стенди</h1><button className="ib-btn" type="button" onClick={() => void labsQuery.refetch()}>Повторити</button></div>;
    }
    const labs = labsQuery.data;
    const items = orderStands(labs.Items);
    const summary = [
        {label: "Усього", value: labs.Summary.Total}, {label: "Готово", value: labs.Summary.Ready},
        {label: "Створюється", value: labs.Summary.Creating}, {label: "Помилка", value: labs.Summary.Failed},
        {label: "Не розгорнуто", value: labs.Summary.NotDeployed}, {label: "Видалено", value: labs.Summary.Removed},
    ];

    return <div className="event-manage-settings event-stands">
        {heading}
        {!labs.LaboratoriesAvailable && <div className="event-manage-notice" role="status"><AlertTriangle size={18} aria-hidden="true" />Інфраструктура зараз недоступна. Стенди створяться, щойно вона відновиться.</div>}
        <ScheduleSection key={`${labs.DeployLeadMinutes}-${labs.TeardownDelayMinutes}`} eventID={eventID} labs={labs} canManage={canManage} />
        <div className="event-stands__summary" role="status">{summary.map(entry => <div key={entry.label}><span>{entry.label}</span><strong>{entry.value}</strong></div>)}</div>
        <section className="event-manage-section event-stands__table">
            {items.length === 0 ? <p className="event-challenge-manager__empty">Стенди з’являться за розкладом для допущених команд.</p> : <div className="event-participants-table"><table>
                <thead><tr><th>Команда</th><th>Статус</th><th>Оновлено</th><th>Причина</th><th><span className="sr-only">Дії</span></th></tr></thead>
                <tbody>{items.map(stand => {
                    const open = expanded === stand.TeamID;
                    return <Fragment key={stand.TeamID}>
                        <tr>
                            <td><div className="event-participants-table__person"><strong>{standTeamName(stand)}</strong>{stand.Generation > 0 && <small>Перестворено: {stand.Generation}</small>}</div></td>
                            <td><StatusBadge label={standStatusLabel[stand.Status]} tone={standStatusTone[stand.Status]} /></td>
                            <td className="event-participants-table__dim">{formatTime(stand.UpdatedAt) ?? "—"}</td>
                            <td>{stand.Labs.length > 0 ? <button className="event-stands__reason" type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : stand.TeamID)}><span>{stand.Reason || `Лабораторій: ${stand.Labs.length}`}</span><ChevronDown size={14} aria-hidden="true" /></button> : <span className="event-participants-table__dim">{stand.Reason || "—"}</span>}</td>
                            <td><div className="event-manage-participants__actions event-stands__actions">
                                {stand.Moderators && canManage && <><button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void vpn()}><Download size={14} aria-hidden="true" />VPN-конфіг</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => setChallengesOpen(true)}><ListChecks size={14} aria-hidden="true" />Завдання</button></>}
                                {canManage && canRecreate(stand.Status) && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => setConfirm(stand)}><RotateCcw size={14} aria-hidden="true" />Перестворити</button>}
                            </div></td>
                        </tr>
                        {open && <tr className="event-stands__labs"><td colSpan={5}><ul>{stand.Labs.map(lab => <li key={lab.ChallengeID}><span>{lab.ChallengeName || lab.ChallengeID.slice(0, 8)}</span><StatusBadge label={labStatusLabel[lab.Status]} tone={labStatusTone[lab.Status]} />{lab.Reason && <small className="event-stands__error">{lab.Reason}</small>}</li>)}</ul></td></tr>}
                    </Fragment>;
                })}</tbody>
            </table></div>}
        </section>
        <Dialog open={confirm !== null} onOpenChange={next => {if (!next && !busy) setConfirm(null);}}><DialogContent className="max-w-[min(480px,calc(100vw-24px))]">
            <DialogHeader><DialogTitle>Перестворити стенд?</DialogTitle><DialogDescription>Лабораторії команди «{confirm ? standTeamName(confirm) : ""}» буде видалено й створено заново. До готовності нових лабораторій команда не матиме до них доступу. Видані VPN-конфіги залишаються чинними.</DialogDescription></DialogHeader>
            <div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={busy} onClick={() => setConfirm(null)}>Скасувати</button><button className="ib-btn ib-btn--danger" type="button" disabled={busy} onClick={() => void recreate()}>{busy ? "Перестворюємо…" : "Перестворити"}</button></div>
        </DialogContent></Dialog>
        <ModeratorChallengesDialog eventID={eventID} open={challengesOpen} onClose={() => setChallengesOpen(false)} />
    </div>;
}
