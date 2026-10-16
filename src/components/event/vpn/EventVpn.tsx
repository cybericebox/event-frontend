"use client";

import {VpnCommand} from "./VpnCommand";
import {useParticipantPreview} from "../ParticipantPreview";
import {eventVpnFileName} from "@/utils/wireguard";
import {createContext, useContext, useMemo, useState, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {ArrowUpRight, ChevronDown, Download, Shield, ShieldAlert, ShieldCheck, ShieldEllipsis, ShieldOff} from "lucide-react";
import {getVPNStatus, issueVPNConfig, VPNApiError} from "@/api/vpn";
import {getManageLabs, getModeratorVPNConfig, getModeratorVPNStatus, getOwnStandStatus, type StandStatus} from "@/api/manageLabs";
import {DialogModal} from "@/components/event/DialogModal";
import {richMessage} from "@/components/event/challenges/richMessage";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {wireguardInstallUrl} from "@/utils/origins";
import {EventTooltip} from "@/components/ui/EventTooltip";

import {getPreviewBoard, getPreviewLab, getPreviewVPNConfig, previewBoardKey} from "@/api/participantPreview";
import type {PreviewLab} from "@/api/participantPreview";

type VpnContextValue = {available: boolean; status: StandStatus | null; ready: boolean; connected: boolean | null; openVpn: () => void};
const VpnContext = createContext<VpnContextValue>({available: false, status: null, ready: false, connected: null, openVpn: () => {}});
export const useEventVpn = () => useContext(VpnContext);

// Participant wording: no failure reasons (they stay with the moderators).
export function standStatusText(status: StandStatus): {title: string; note: string} {
    return {title: t(`vpn.stand.${status}.title`), note: t(`vpn.stand.${status}.note`)};
}

export function StandStatusIcon({status}: {status: StandStatus | null}) {
    if (status === "ready") return <ShieldCheck aria-hidden="true" />;
    if (status === "failed") return <ShieldAlert aria-hidden="true" />;
    if (status === "removed") return <ShieldOff aria-hidden="true" />;
    return <ShieldEllipsis aria-hidden="true" />;
}

function downloadText(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], {type: "text/plain;charset=utf-8"}));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function VpnModal({eventID, eventTag, moderators, vpnReady, connected, open, onClose, previewSelectionID, previewLab}: {previewSelectionID?: string; previewLab?: PreviewLab; eventID: string; eventTag: string; moderators: boolean; connected: boolean | null; vpnReady: boolean; open: boolean; onClose: () => void}) {
    const preview = useParticipantPreview(eventID);
    const [issuing, setIssuing] = useState(false);
    const [error, setError] = useState("");
    const probe = useQuery({queryKey: ["event-vpn-status", eventID, moderators], queryFn: () => moderators ? getModeratorVPNStatus(eventID) : getVPNStatus(eventID), enabled: !preview.active && open && vpnReady, retry: false, refetchOnWindowFocus: false});
    const download = async () => {
        if (!vpnReady || issuing) return;
        setIssuing(true);
        setError("");
        try {
            downloadText(preview.active ? await getPreviewVPNConfig(eventID, previewSelectionID ?? "") : moderators ? await getModeratorVPNConfig(eventID) : await issueVPNConfig(eventID), eventVpnFileName(eventTag));
        } catch (failure) {
            setError(failure instanceof VPNApiError && failure.status === 404 ? t("vpn.error.notReady") : t("vpn.error.failed"));
        } finally {
            setIssuing(false);
        }
    };
    const probeData = preview.active ? (previewLab?.VPNProbeURL ? {ProbeURL: previewLab.VPNProbeURL, GatewayIP: new URL(previewLab.VPNProbeURL).hostname} : undefined) : probe.data;
    return <DialogModal open={open} onClose={onClose} title={t("vpn.modal.title")}
        footer={vpnReady ? <EventButton type="button" className="ib-btn ib-btn--primary" onClick={() => void download()} busy={issuing}><Download aria-hidden="true" />{t("vpn.modal.download")}</EventButton> : <button type="button" className="ib-btn ib-btn--primary" onClick={onClose}>{t("vpn.modal.acknowledge")}</button>}>
        <VpnConnectionStatus ready={vpnReady} connected={connected} />
        {!vpnReady && <div className="event-vpn-wait"><p>{t(preview.active ? "vpn.group.previewWait" : "vpn.group.wait")}</p><p className="event-vpn-note">{t("vpn.group.waitNext")}</p></div>}
        {vpnReady && <>
        {connected === null && <p className="event-vpn-note">{t("vpn.connection.unknown")}</p>}
        <details className="ib-accordion__item event-vpn-instructions" open={connected !== true}>
            <summary className="ib-accordion__q">{t("vpn.instructions")}<ChevronDown className="ib-accordion__icon" aria-hidden="true" /></summary>
            <div className="event-vpn-instructions__body">
        <ol className="event-vpn-steps">
            <li>{richMessage(t("vpn.steps.install"), {link: <a className="ib-link" href={wireguardInstallUrl} target="_blank" rel="noopener noreferrer">{t("vpn.software")}</a>})}</li>
            <li>{t("vpn.steps.download")}</li>
            <li><div className="event-vpn-methods">
                <div><strong>{t("vpn.steps.app")}</strong><p>{t("vpn.steps.import")}</p></div>
                <div><strong>{t("vpn.steps.terminal")}</strong><p>{t("vpn.steps.terminalFolder")}</p>
                    <VpnCommand value={t("vpn.steps.command", {filename: eventVpnFileName(eventTag)})} />
                </div>
            </div></li>
            {probeData && <li>{richMessage(t("vpn.steps.checkProbe"), {
                link: <a className="ib-link" href={probeData.ProbeURL} target="_blank" rel="noopener noreferrer">{t("vpn.steps.probePage")} <ArrowUpRight className="event-inline-icon" aria-hidden="true" /></a>,
                ping: probeData.GatewayIP ? <VpnCommand value={t("vpn.steps.pingCommand", {gateway: probeData.GatewayIP})} inline /> : null,
            })}</li>}
        </ol>
        <p className="event-vpn-note">{t("vpn.file.private")}</p>
            </div>
        </details>
        </>}
        {error && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
    </DialogModal>;
}

// VPN is shown only when the event has infrastructure tasks; it never blocks anything.
export function EventVpnProvider({eventID, eventTag, enabled, moderators = false, children}: {eventID: string; eventTag: string; enabled: boolean; moderators?: boolean; children: ReactNode}) {
    const [open, setOpen] = useState(false);
    const preview = useParticipantPreview(eventID);
    const board = useQuery({queryKey: previewBoardKey(eventID), queryFn: () => getPreviewBoard(eventID), enabled: preview.active && enabled, retry: false, refetchInterval: 10000});
    const selectionID = board.data?.Challenges.find(item => item.PreviewDynamic && item.PreviewRunID)?.PreviewSelectionID;
    const available = enabled && (!preview.active || board.data?.Challenges.some(item => item.PreviewDynamic && (item.PreviewCanStart === true || !!item.PreviewRunID)) === true);
    const previewRuntime = useQuery({queryKey: ["event-preview-vpn-lab", eventID, selectionID], queryFn: () => getPreviewLab(eventID, selectionID!), enabled: preview.active && enabled && !!selectionID, retry: false, refetchInterval: 10000});
    const own = useQuery({queryKey: ["event-own-stand", eventID], queryFn: () => getOwnStandStatus(eventID), enabled: enabled && !preview.active && !moderators, retry: false, refetchInterval: 30000, refetchOnWindowFocus: false});
    const labs = useQuery({queryKey: ["event-management-labs", eventID], queryFn: () => getManageLabs(eventID), enabled: enabled && !preview.active && moderators, retry: false, refetchInterval: 30000, refetchOnWindowFocus: false});
    const status: StandStatus | null = preview.active ? !selectionID ? "not_deployed" : previewRuntime.data?.Ready ? "ready" : previewRuntime.isError || previewRuntime.data?.Phase === "failed" ? "failed" : "creating" : moderators ? labs.data?.Items.find(item => item.Moderators)?.Status ?? null : own.data?.Status ?? null;
    const ready = preview.active ? previewRuntime.data?.Ready === true && !previewRuntime.data.Expired && !previewRuntime.data.Removing : moderators ? labs.data?.ModeratorVPNReady === true : own.data?.VPNReady === true;
    const connection = useQuery({queryKey: ["event-vpn-status", eventID, moderators], queryFn: () => moderators ? getModeratorVPNStatus(eventID) : getVPNStatus(eventID), enabled: enabled && !preview.active && ready, retry: false, refetchInterval: 30000, refetchOnWindowFocus: true});
    const connected = preview.active ? ready ? previewRuntime.data?.VPNConnected ?? null : null : ready && !connection.isError ? connection.data?.Connected ?? null : null;
    const value = useMemo(() => ({available, status, ready, connected, openVpn: () => setOpen(true)}), [available, status, ready, connected]);
    return <VpnContext.Provider value={value}>
        {children}
        {available && <VpnModal eventID={eventID} eventTag={eventTag} moderators={moderators} vpnReady={ready} connected={connected} open={open} onClose={() => setOpen(false)} previewSelectionID={selectionID} previewLab={previewRuntime.data} />}
    </VpnContext.Provider>;
}

// Header entry: the icon itself carries the state (no dot indicators in the DS); the short label sits beside it.
export function VpnHeaderButton() {
    const {available, ready, connected, openVpn} = useEventVpn();
    if (!available) return null;
    const state = vpnConnectionState(ready, connected);
    const label = t(ready && connected === null ? "vpn.header.unknown" : `vpn.header.${state}`);
    return <EventTooltip content={label} placement="bottom" silent>{() => <button type="button" className={`ib-btn ib-btn--sm ib-btn--ghost event-pin event-vpn-button is-${state}`} aria-label={label} onClick={openVpn}>
        <VpnConnectionIcon ready={ready} connected={connected} /><span className="event-pin__label">{t("nav.pin.vpn")}</span>
    </button>}</EventTooltip>;
}

export function vpnConnectionState(ready: boolean, connected: boolean | null): "pending" | "available" | "connected" {
    return !ready ? "pending" : connected === true ? "connected" : "available";
}

function VpnConnectionIcon({ready, connected}: {ready: boolean; connected: boolean | null}) {
    return ready && connected === true ? <ShieldCheck aria-hidden="true" /> : ready ? <Shield aria-hidden="true" /> : <ShieldEllipsis aria-hidden="true" />;
}

export function VpnConnectionStatus({ready, connected}: {ready: boolean; connected: boolean | null}) {
    return <div className={`event-vpn-connection-state is-${vpnConnectionState(ready, connected)}`} role="status"><VpnConnectionIcon ready={ready} connected={connected} /><strong>{t(!ready ? "vpn.group.pending" : connected === true ? "vpn.connection.connected" : connected === false ? "vpn.group.ready" : "vpn.group.available")}</strong></div>;
}
