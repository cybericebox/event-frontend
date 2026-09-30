"use client";

import {eventVpnFileName} from "@/utils/wireguard";
import {createContext, useContext, useMemo, useState, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {ArrowUpRight, Download, ShieldAlert, ShieldCheck, ShieldEllipsis, ShieldOff} from "lucide-react";
import {getVPNStatus, issueVPNConfig, VPNApiError} from "@/api/vpn";
import {getManageLabs, getModeratorVPNConfig, getOwnStandStatus, type StandStatus} from "@/api/manageLabs";
import {DialogModal} from "@/components/event/DialogModal";
import {richMessage} from "@/components/event/challenges/richMessage";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {EventTooltip} from "@/components/ui/EventTooltip";

type VpnContextValue = {available: boolean; status: StandStatus | null; openVpn: () => void};
const VpnContext = createContext<VpnContextValue>({available: false, status: null, openVpn: () => {}});
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

function VpnModal({eventID, eventTag, moderators, status, open, onClose}: {eventID: string; eventTag: string; moderators: boolean; status: StandStatus | null; open: boolean; onClose: () => void}) {
    const [issuing, setIssuing] = useState(false);
    const [error, setError] = useState("");
    const probe = useQuery({queryKey: ["event-vpn-status", eventID], queryFn: () => getVPNStatus(eventID), enabled: open && !moderators && status === "ready", retry: false, refetchOnWindowFocus: false});
    const text = status ? standStatusText(status) : null;
    const download = async () => {
        setIssuing(true);
        setError("");
        try {
            downloadText(moderators ? await getModeratorVPNConfig(eventID) : await issueVPNConfig(eventID), eventVpnFileName(eventTag));
        } catch (failure) {
            setError(failure instanceof VPNApiError && failure.status === 404 ? t("vpn.error.notReady") : t("vpn.error.failed"));
        } finally {
            setIssuing(false);
        }
    };
    return <DialogModal open={open} onClose={onClose} title={t("vpn.modal.title")} description={moderators ? t("vpn.modal.descriptionModerators") : t("vpn.modal.description")}
        footer={<><button type="button" className="ib-btn" onClick={onClose}>{t("common.close")}</button><EventButton type="button" className="ib-btn ib-btn--primary" disabled={issuing} onClick={() => void download()} busy={issuing}><Download aria-hidden="true" />{t("vpn.modal.download")}</EventButton></>}>
        <div className={`event-vpn-stand is-${status ?? "unknown"}`} role="status">
            <StandStatusIcon status={status} />
            <div><b>{text?.title ?? t("vpn.modal.checkingStand")}</b>{text && <span>{text.note}</span>}</div>
        </div>
        <ol className="event-vpn-steps">
            <li>{richMessage(t("vpn.steps.install"), {link: <a className="ib-link" href="https://www.wireguard.com/install/" target="_blank" rel="noopener noreferrer">wireguard.com/install</a>})}</li>
            <li>{t("vpn.steps.download")}</li>
            <li>{t("vpn.steps.import")}</li>
            <li>{probe.data ? richMessage(t("vpn.steps.checkProbe"), {
                link: <a className="ib-link" href={probe.data.ProbeURL} target="_blank" rel="noopener noreferrer">{t("vpn.steps.probePage")} <ArrowUpRight className="event-inline-icon" aria-hidden="true" /></a>,
                ping: <code>ping {probe.data.GatewayIP}</code>,
            }) : t("vpn.steps.checkTask")}</li>
        </ol>
        <p className="event-vpn-note">{t("vpn.note")}</p>
        {error && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
    </DialogModal>;
}

// VPN is shown only when the event has infrastructure tasks; it never blocks anything.
export function EventVpnProvider({eventID, eventTag, enabled, moderators = false, children}: {eventID: string; eventTag: string; enabled: boolean; moderators?: boolean; children: ReactNode}) {
    const [open, setOpen] = useState(false);
    const own = useQuery({queryKey: ["event-own-stand", eventID], queryFn: () => getOwnStandStatus(eventID), enabled: enabled && !moderators, retry: false, refetchInterval: 30000, refetchOnWindowFocus: false});
    const labs = useQuery({queryKey: ["event-management-labs", eventID], queryFn: () => getManageLabs(eventID), enabled: enabled && moderators, retry: false, refetchInterval: 30000, refetchOnWindowFocus: false});
    const status = moderators ? labs.data?.Items.find(item => item.Moderators)?.Status ?? null : own.data ?? null;
    const value = useMemo(() => ({available: enabled, status, openVpn: () => setOpen(true)}), [enabled, status]);
    return <VpnContext.Provider value={value}>
        {children}
        {enabled && <VpnModal eventID={eventID} eventTag={eventTag} moderators={moderators} status={status} open={open} onClose={() => setOpen(false)} />}
    </VpnContext.Provider>;
}

// Header entry: the icon itself carries the state (no dot indicators in the DS); the short label sits beside it.
export function VpnHeaderButton() {
    const {available, status, openVpn} = useEventVpn();
    if (!available) return null;
    const label = t("vpn.header.label", {status: status ? standStatusText(status).title.toLocaleLowerCase() : t("vpn.header.checking")});
    return <EventTooltip content={label} placement="bottom" silent>{() => <button type="button" className={`ib-btn ib-btn--sm ib-btn--ghost event-pin event-vpn-button is-${status ?? "unknown"}`} aria-label={label} onClick={openVpn}>
        <StandStatusIcon status={status} /><span className="event-pin__label">{t("nav.pin.vpn")}</span>
    </button>}</EventTooltip>;
}
