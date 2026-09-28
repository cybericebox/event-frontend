"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {ArrowUpRight, Check, Copy, Download, Network} from "lucide-react";
import {getVPNStatus, issueVPNConfig, VPNApiError} from "@/api/vpn";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {EventLoading} from "@/components/event/EventLoading";

export default function VPNPage() {
    const [issuing, setIssuing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [actionError, setActionError] = useState("");
    const access = useParticipantContext();
    const eventID = access?.event.EventID;
    const status = useQuery({queryKey: ["event-vpn-status", eventID], queryFn: () => getVPNStatus(eventID!), enabled: !!eventID && access?.participantInfo.UseVPN === true && !!access.ownTeam, retry: false, refetchOnWindowFocus: false});

    const download = async () => {
        if (!eventID) return;
        setIssuing(true);
        setActionError("");
        try {
            const config = await issueVPNConfig(eventID);
            const url = URL.createObjectURL(new Blob([config], {type: "text/plain;charset=utf-8"}));
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "cybericebox-vpn.conf";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            setActionError(error instanceof VPNApiError && error.status === 404 ? "Група лабораторій ще готується. Спробуйте трохи пізніше." : "Не вдалося отримати конфігурацію. Повторіть запит.");
        } finally {
            setIssuing(false);
        }
    };

    const copyPing = async () => {
        if (!status.data) return;
        try {
            await navigator.clipboard.writeText(`ping ${status.data.GatewayIP}`);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setActionError("Не вдалося скопіювати команду. Виділіть її вручну.");
        }
    };

    const intro = <header className="event-vpn-heading"><span className="event-vpn-icon"><Network size={25} /></span><div><p className="event-manage-eyebrow">Підготовка до лабораторій</p><h1>Підключення VPN</h1><p>Налаштуйте тунель і перевірте його до початку роботи із завданнями.</p></div></header>;

    if (!access) return <div className="event-vpn-page">{intro}<div className="event-vpn-state" role="alert"><h2>Підтвердьте участь</h2><p>VPN доступний після підтвердження участі в події.</p><Link className="ib-btn" href="/">На головну</Link></div></div>;
    if (!access.participantInfo.UseVPN) return <div className="event-vpn-page">{intro}<div className="event-vpn-state"><h2>VPN не заплановано</h2><p>Для цієї події підключення до лабораторій зараз не потрібне.</p></div></div>;
    if (!access.ownTeam) return <div className="event-vpn-page">{intro}<div className="event-vpn-state">{access.event.Participation === 1 ? <><h2>Спочатку приєднайтеся до команди</h2><p>Особиста VPN-конфігурація доступна після вступу до команди.</p><Link className="ib-btn ib-btn--primary" href="/team">Моя команда</Link></> : <><h2>Готуємо вашу участь</h2><p>VPN-конфігурація з’явиться після завершення реєстрації.</p></>}</div></div>;
    if (status.isPending) return <EventLoading label="Готуємо перевірочний шлюз…" />;
    if (status.isError) {
        const preparing = status.error instanceof VPNApiError && status.error.status === 404;
        return <div className="event-vpn-page">{intro}<div className="event-vpn-state" role="status"><h2>{preparing ? "Група лабораторій готується" : "Не вдалося отримати адресу шлюзу"}</h2><p>{preparing ? "VPN-сервер ще запускається. Спробуйте повторити перевірку трохи пізніше." : "Перевірте з’єднання із сайтом і повторіть запит."}</p><button className="ib-btn" onClick={() => void status.refetch()}>Повторити</button></div></div>;
    }

    return <div className="event-vpn-page">
        {intro}
        <div className="event-vpn-card">
            <h2>Особиста конфігурація</h2>
            <p>Завантажте файл, імпортуйте його в WireGuard та увімкніть тунель. Файл призначений лише для вас.</p>
            <button className="ib-btn ib-btn--primary" type="button" disabled={issuing} onClick={() => void download()}><Download size={17} />{issuing ? "Готуємо файл…" : "Завантажити конфігурацію"}</button>
        </div>
        <div className="event-vpn-card">
            <h2>Перевірка підключення</h2>
            <p>Після ввімкнення тунелю відкрийте сторінку перевірки. Вона доступна лише через VPN.</p>
            <a className="ib-btn ib-btn--primary" href={status.data.ProbeURL} target="_blank" rel="noopener noreferrer">Перевірити VPN <ArrowUpRight size={17} /></a>
            <div className="event-vpn-command"><span>Для ручної перевірки</span><code>ping {status.data.GatewayIP}</code><button type="button" aria-label="Скопіювати команду ping" onClick={() => void copyPing()}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
        </div>
        {actionError && <p className="event-vpn-feedback" role="alert">{actionError}</p>}
    </div>;
}
