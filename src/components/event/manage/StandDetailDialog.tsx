"use client";

import {useEffect, useRef, useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {RotateCcw, TriangleAlert} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    getStandDetail, resetStandDevice, setStandDeviceRescue, standErrorMessage,
    type LiveDevice, type StandDetailLab, type StandDetail,
} from "@/api/manageLabs";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {ManageDialog} from "@/components/event/manage/invites/ManageDialog";
import {agoText, deviceStateLabel, failureReasonLabel, queueLine, sizeText} from "@/components/event/labLive";
import {labStatusLabel, labStatusTone, standTeamName} from "@/components/event/manage/standStatus";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

function Failure({device}: {device: LiveDevice}) {
    const failure = device.Scheduling?.Failure;
    if (!failure) return null;
    return <div className="event-stands__failure" role="alert">
        <strong><TriangleAlert size={14} aria-hidden="true" />{t("lab.live.failure.title", {reason: failureReasonLabel(failure.Reason)})}</strong>
        {failure.RestartCount > 0 && <small>{t("lab.live.failure.restarts", {count: failure.RestartCount})}</small>}
        {failure.Message && <small className="event-stands__error">{t("lab.live.failure.message", {message: failure.Message})}</small>}
    </div>;
}

// Rescue answers at once and saves through a queue, so quick changes never race and nothing is
// disabled while a save is pending; a failure rolls the switch back and shows a toast.
function DeviceRow({eventID, teamID, challengeID, device, canManage}: {eventID: string; teamID: string; challengeID: string; device: LiveDevice; canManage: boolean}) {
    const snapshot = device.Snapshot;
    const [override, setOverride] = useState<boolean | null>(null);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const waiting = useRef(0);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [resetError, setResetError] = useState("");

    // The server caught up with the choice: show what it says again.
    const rescueNow = snapshot?.Rescue;
    useEffect(() => {
        if (waiting.current === 0 && override !== null && override === rescueNow) setOverride(null);
    }, [rescueNow, override]);
    const rescue = override ?? snapshot?.Rescue ?? false;

    function toggleRescue(enable: boolean) {
        setOverride(enable);
        waiting.current += 1;
        queue.current = queue.current.then(() => setStandDeviceRescue(eventID, teamID, challengeID, device.Name, enable)).then(
            () => {waiting.current -= 1;},
            failure => {
                waiting.current -= 1;
                if (waiting.current === 0) setOverride(null);
                toast.error(standErrorMessage(failure, t("manage.labs.detail.rescueFailed")));
            },
        );
    }

    async function reset() {
        setResetting(true);
        setResetError("");
        try {
            await resetStandDevice(eventID, teamID, challengeID, device.Name);
            setResetOpen(false);
            toast.success(t("manage.labs.detail.resetDone"));
        } catch (failure) {setResetError(standErrorMessage(failure, t("manage.labs.detail.resetFailed")));}
        finally {setResetting(false);}
    }

    return <li className="event-stands__device">
        <div className="event-stands__device-head">
            <strong>{device.Name}</strong>
            <span className={`event-stands__status is-${device.Ready ? "ok" : device.Scheduling?.Failure ? "danger" : "progress"}`}>{deviceStateLabel(device)}</span>
            {snapshot?.Warning && <span className="event-stands__status is-progress">{t("lab.live.snapshot.warning")}</span>}
        </div>
        <Failure device={device} />
        {snapshot && <div className="event-stands__snapshot">
            <small>{snapshot.LastSnapshotAt ? t("lab.live.snapshot.saved", {time: agoText(snapshot.LastSnapshotAt)}) : t("lab.live.snapshot.none")}</small>
            {snapshot.RestoredAt && <small>{t("lab.live.snapshot.restored", {time: agoText(snapshot.RestoredAt)})}</small>}
            {snapshot.SizeBytes > 0 && <small>{t("lab.live.snapshot.size", {size: sizeText(snapshot.SizeBytes)})}</small>}
            {snapshot.Warning && <small className="event-stands__error">{snapshot.Warning}</small>}
            {canManage && <div className="event-stands__device-actions">
                <EventSwitch checked={rescue} onCheckedChange={toggleRescue} label={t("lab.live.rescue")} />
                <EventTooltip content={t("lab.live.rescueHelp")}>{id => <span className="event-stands__help" tabIndex={0} aria-label={t("lab.live.rescueHelp")} aria-describedby={id}>?</span>}</EventTooltip>
                <button className="ib-btn ib-btn--sm" type="button" onClick={() => {setResetError(""); setResetOpen(true);}}><RotateCcw size={14} aria-hidden="true" />{t("lab.live.reset")}</button>
            </div>}
            {rescue && <p className="event-manage-notice" role="status">{t("lab.live.rescueBanner")}</p>}
        </div>}
        <ConfirmDialog open={resetOpen} tone="danger" busy={resetting} error={resetError} title={t("lab.live.resetTitle")} description={t("lab.live.resetDescription")}
            confirmLabel={t("lab.live.reset")} onCancel={() => setResetOpen(false)} onConfirm={() => void reset()} />
    </li>;
}

function LabBlock({eventID, teamID, lab, canManage}: {eventID: string; teamID: string; lab: StandDetailLab; canManage: boolean}) {
    const live = lab.Live;
    const queue = queueLine(live?.Queue);
    const warnings = [live?.ImageWarning, live?.GroupImageWarning].filter(Boolean).join(", ");
    return <li className="event-stands__lab-block">
        <div className="event-stands__challenge-head"><strong>{lab.ChallengeName || lab.ChallengeID.slice(0, 8)}</strong><span className={`event-stands__status is-${labStatusTone[lab.Status]}`}>{labStatusLabel[lab.Status]}</span></div>
        {lab.Reason && <small className="event-stands__error">{lab.Reason}</small>}
        {lab.LiveUnavailable && <small className="event-participants-table__dim">{t("manage.labs.detail.liveUnavailable")}</small>}
        {queue && <small role="status">{queue}</small>}
        {warnings && <small className="event-participants-table__dim">{t("lab.live.imageWarning", {images: warnings})}</small>}
        {live && live.Devices.length > 0 && <ul className="event-stands__devices">{live.Devices.map(device => <DeviceRow key={device.Name} eventID={eventID} teamID={teamID} challengeID={lab.ChallengeID} device={device} canManage={canManage} />)}</ul>}
    </li>;
}

export function StandDetailDialog({eventID, teamID, canManage, onClose}: {eventID: string; teamID: string | null; canManage: boolean; onClose: () => void}) {
    const detail = useQuery<StandDetail>({
        queryKey: ["event-management-stand-detail", eventID, teamID], queryFn: () => getStandDetail(eventID, teamID!),
        enabled: teamID !== null, refetchInterval: 10_000, refetchOnWindowFocus: false, retry: 1, placeholderData: keepPreviousData,
    });
    const data = detail.data?.TeamID === teamID ? detail.data : undefined;
    return <ManageDialog open={teamID !== null} onOpenChange={next => {if (!next) onClose();}} size="md"
        title={data ? t("manage.labs.detail.title", {team: standTeamName(data)}) : t("manage.labs.detail.titleShort")} description={t("manage.labs.detail.description")}
        footer={<button className="ib-btn" type="button" onClick={onClose}>{t("common.close")}</button>}>
        <div className="event-stands__detail">
            {detail.isError && !data ? <EventLoadError compact message={standErrorMessage(detail.error, t("manage.labs.detail.loadFailed"))} error={detail.error} onRetry={() => void detail.refetch()} />
                : !data ? <EventLoading compact />
                : data.Labs.length === 0 ? <EmptyState compact message={t("manage.labs.detail.empty")} />
                : <ul className="event-stands__challenges">{data.Labs.map(lab => <LabBlock key={lab.ChallengeID} eventID={eventID} teamID={data.TeamID} lab={lab} canManage={canManage} />)}</ul>}
        </div>
    </ManageDialog>;
}
