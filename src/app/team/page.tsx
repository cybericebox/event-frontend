"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQueryClient} from "@tanstack/react-query";
import {Copy, Network, Users} from "lucide-react";
import {createEventTeam, EventTeamError, joinEventTeam} from "@/api/eventTeams";
import {useParticipantContext} from "@/components/event/ParticipantShell";

export default function TeamPage() {
    const access = useParticipantContext();
    const queryClient = useQueryClient();
    const [mode, setMode] = useState<"join" | "create">("join");
    const [name, setName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");

    if (!access) return <div className="event-team-page"><h1>Участь у події</h1><p>Ця сторінка доступна після підтвердження участі.</p><Link className="ib-btn" href="/">На головну</Link></div>;

    const {event, participantInfo, ownTeam} = access;
    const personal = event.Participation === 0;
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setPending(true);
        setMessage("");
        try {
            if (mode === "create") await createEventTeam(event.EventID, name.trim());
            else await joinEventTeam(event.EventID, joinCode.trim());
            await queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]});
        } catch (error) {
            setMessage(error instanceof EventTeamError && error.status === 409 ? "Таку назву вже зайнято або приєднання неможливе." : "Не вдалося зберегти. Перевірте дані й повторіть спробу.");
        } finally {
            setPending(false);
        }
    };

    const copyCode = async () => {
        if (!ownTeam?.JoinCode) return;
        try {
            await navigator.clipboard.writeText(ownTeam.JoinCode);
            setMessage("Код скопійовано.");
        } catch {
            setMessage("Не вдалося скопіювати код.");
        }
    };

    return <div className="event-team-page">
        <header className="event-team-heading"><span className="event-vpn-icon"><Users size={25} /></span><div><p className="event-manage-eyebrow">Участь у події</p><h1>{personal ? "Моя участь" : "Моя команда"}</h1></div></header>
        {ownTeam ? <>
            <section className="event-vpn-card"><h2>{personal ? "Участь підтверджено" : "Назва команди"}</h2>{!personal && <><p className="event-team-name">{ownTeam.Name}</p><p>Учасників: {ownTeam.MemberCount}</p></>}
                {!personal && ownTeam.JoinCode && <div className="event-vpn-command"><span>Код для приєднання</span><code>••••••••</code><button type="button" aria-label="Скопіювати код для приєднання" onClick={() => void copyCode()}><Copy size={17} /></button></div>}
            </section>
            {participantInfo.UseVPN && <section className="event-vpn-card"><h2>Підготуйте VPN</h2><p>Перевірте підключення до групи лабораторій заздалегідь. Окремі завдання відкриються за розкладом.</p><Link className="ib-btn ib-btn--primary" href="/vpn"><Network size={17} />Підключення VPN</Link></section>}
        </> : personal ? <section className="event-vpn-state"><h2>Готуємо вашу участь</h2><p>Особиста лабораторна група з’явиться після завершення реєстрації.</p><button className="ib-btn" onClick={() => void queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]})}>Оновити</button></section> : <section className="event-vpn-card">
            <h2>Приєднайтеся до команди</h2><p>Створіть команду або введіть код запрошення. Після вступу стане доступною підготовка VPN, якщо лабораторії заплановано.</p>
            <div className="event-team-tabs"><button type="button" aria-pressed={mode === "join"} onClick={() => setMode("join")}>Приєднатися</button><button type="button" aria-pressed={mode === "create"} onClick={() => setMode("create")}>Створити команду</button></div>
            <form className="event-team-form" onSubmit={event => void submit(event)}>
                {mode === "join" ? <label>Код запрошення<input className="event-manage-input" value={joinCode} onChange={event => setJoinCode(event.target.value)} required autoComplete="off" /></label> : <label>Назва команди<input className="event-manage-input" value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={50} /></label>}
                <button className="ib-btn ib-btn--primary" type="submit" disabled={pending}>{pending ? "Зберігаємо…" : mode === "join" ? "Приєднатися" : "Створити команду"}</button>
            </form>
        </section>}
        {message && <p className="event-vpn-feedback" role="status">{message}</p>}
    </div>;
}
