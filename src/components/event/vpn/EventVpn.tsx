"use client";

import {createContext, useContext, useMemo, useState, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {ArrowUpRight, Download, ShieldAlert, ShieldCheck, ShieldEllipsis, ShieldOff} from "lucide-react";
import {getVPNStatus, issueVPNConfig, VPNApiError} from "@/api/vpn";
import {getManageLabs, getModeratorVPNConfig, getOwnStandStatus, type StandStatus} from "@/api/manageLabs";
import {DialogModal} from "@/components/event/DialogModal";

type VpnContextValue = {available: boolean; status: StandStatus | null; openVpn: () => void};
const VpnContext = createContext<VpnContextValue>({available: false, status: null, openVpn: () => {}});
export const useEventVpn = () => useContext(VpnContext);

// Participant wording: no failure reasons (they stay with the moderators).
export const standStatusText: Record<StandStatus, {title: string; note: string}> = {
    not_deployed: {title: "Стенд ще не розгорнуто", note: "Розгортання почнеться автоматично незадовго до старту."},
    creating: {title: "Стенд готується", note: "Завдання з інфраструктурою відкриються, щойно стенди будуть готові."},
    ready: {title: "Стенд готовий", note: "Підключіться до VPN, щоб працювати із сервісами завдань."},
    failed: {title: "Стенд тимчасово недоступний", note: "Організатори вже знають і відновлюють його."},
    removed: {title: "Стенд вимкнено", note: "Подію завершено, стенд видалено."},
};

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

function VpnModal({eventID, moderators, status, open, onClose}: {eventID: string; moderators: boolean; status: StandStatus | null; open: boolean; onClose: () => void}) {
    const [issuing, setIssuing] = useState(false);
    const [error, setError] = useState("");
    const probe = useQuery({queryKey: ["event-vpn-status", eventID], queryFn: () => getVPNStatus(eventID), enabled: open && !moderators && status === "ready", retry: false, refetchOnWindowFocus: false});
    const text = status ? standStatusText[status] : null;
    const download = async () => {
        setIssuing(true);
        setError("");
        try {
            downloadText(moderators ? await getModeratorVPNConfig(eventID) : await issueVPNConfig(eventID), moderators ? "cybericebox-moderators.conf" : "cybericebox-vpn.conf");
        } catch (failure) {
            setError(failure instanceof VPNApiError && failure.status === 404 ? "Стенд ще готується. Спробуйте трохи пізніше." : "Не вдалося отримати конфігурацію. Повторіть запит.");
        } finally {
            setIssuing(false);
        }
    };
    return <DialogModal open={open} onClose={onClose} title="Підключення VPN" description={moderators ? "Конфігурація команди модераторів для перевірки завдань." : "Частина завдань доступна лише через VPN вашої команди."}
        footer={<><button type="button" className="ib-btn" onClick={onClose}>Закрити</button><button type="button" className="ib-btn ib-btn--primary" disabled={issuing} onClick={() => void download()}><Download aria-hidden="true" />{issuing ? "Готуємо файл…" : "Завантажити конфіг"}</button></>}>
        <div className={`event-vpn-stand is-${status ?? "unknown"}`} role="status">
            <StandStatusIcon status={status} />
            <div><b>{text?.title ?? "Перевіряємо стенд…"}</b>{text && <span>{text.note}</span>}</div>
        </div>
        <ol className="event-vpn-steps">
            <li>Встановіть WireGuard: <a className="ib-link" href="https://www.wireguard.com/install/" target="_blank" rel="noopener noreferrer">wireguard.com/install</a>.</li>
            <li>Завантажте конфіг. Він особистий — не передавайте його іншим.</li>
            <li>Імпортуйте файл у WireGuard і ввімкніть тунель.</li>
            <li>Перевірте підключення{probe.data ? <>: відкрийте <a className="ib-link" href={probe.data.ProbeURL} target="_blank" rel="noopener noreferrer">сторінку перевірки <ArrowUpRight className="event-inline-icon" aria-hidden="true" /></a> або виконайте <code>ping {probe.data.GatewayIP}</code>.</> : " — адреса сервісу є у вікні завдання."}</li>
        </ol>
        <p className="event-vpn-note">Статус підключення система не перевіряє: VPN може працювати на іншому пристрої чи в іншому браузері.</p>
        {error && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
    </DialogModal>;
}

// VPN is shown only when the event has infrastructure tasks; it never blocks anything.
export function EventVpnProvider({eventID, enabled, moderators = false, children}: {eventID: string; enabled: boolean; moderators?: boolean; children: ReactNode}) {
    const [open, setOpen] = useState(false);
    const own = useQuery({queryKey: ["event-own-stand", eventID], queryFn: () => getOwnStandStatus(eventID), enabled: enabled && !moderators, retry: false, refetchInterval: 30000, refetchOnWindowFocus: false});
    const labs = useQuery({queryKey: ["event-management-labs", eventID], queryFn: () => getManageLabs(eventID), enabled: enabled && moderators, retry: false, refetchInterval: 30000, refetchOnWindowFocus: false});
    const status = moderators ? labs.data?.Items.find(item => item.Moderators)?.Status ?? null : own.data ?? null;
    const value = useMemo(() => ({available: enabled, status, openVpn: () => setOpen(true)}), [enabled, status]);
    return <VpnContext.Provider value={value}>
        {children}
        {enabled && <VpnModal eventID={eventID} moderators={moderators} status={status} open={open} onClose={() => setOpen(false)} />}
    </VpnContext.Provider>;
}

// Header entry: the icon itself carries the state (no dot indicators in the DS).
export function VpnHeaderButton() {
    const {available, status, openVpn} = useEventVpn();
    if (!available) return null;
    const label = `VPN: ${status ? standStatusText[status].title.toLocaleLowerCase("uk") : "перевіряємо стенд"}`;
    return <button type="button" className={`ib-icon-btn event-vpn-button is-${status ?? "unknown"}`} aria-label={label} title={label} onClick={openVpn}>
        <StandStatusIcon status={status} />
    </button>;
}
