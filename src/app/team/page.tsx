"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Copy, Network, Users} from "lucide-react";
import {createEventTeam, EventTeamError, getSelfTeamFields, joinEventTeam} from "@/api/eventTeams";
import {apiErrorMessage} from "@/api/apiErrors";
import type {ParticipantAnswers} from "@/api/participantForm";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useParticipantContext} from "@/components/event/ParticipantShell";

export default function TeamPage() {
    const access = useParticipantContext();
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [fieldAnswers, setFieldAnswers] = useState<ParticipantAnswers>({});
    const [joinCode, setJoinCode] = useState("");
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");
    const fieldsQuery = useQuery({queryKey: ["event-team-fields", access?.event.EventID], queryFn: () => getSelfTeamFields(access!.event.EventID), enabled: !!access && access.event.Participation === 1, refetchOnWindowFocus: false});

    if (!access) return <div className="event-team-page"><h1>Участь у події</h1><p>Ця сторінка доступна після підтвердження участі.</p><Link className="ib-btn" href="/">На головну</Link></div>;

    const {event, participantInfo, ownTeam} = access;
    const personal = event.Participation === 0;
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setPending(true);
        setMessage("");
        try {
            await joinEventTeam(event.EventID, joinCode.trim());
            await queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]});
        } catch (error) {
            // JoinTeam: 404 = unknown code, 409 = team full or roster closed.
            setMessage(error instanceof EventTeamError && error.status === 404 ? "Команду з таким кодом не знайдено. Перевірте код і спробуйте ще раз."
                : error instanceof EventTeamError && error.status === 409 ? apiErrorMessage(error.code, "Приєднатися неможливо: команда вже заповнена або склад команд закрито.")
                : "Не вдалося приєднатися. Перевірте код і повторіть спробу.");
        } finally {
            setPending(false);
        }
    };

    const create = async (e: FormEvent) => {
        e.preventDefault();
        if (fieldsQuery.isPending || fieldsQuery.isError) return;
        setPending(true);
        setMessage("");
        try {
            await createEventTeam(event.EventID, name.trim(), fieldAnswers);
            setCreateOpen(false);
            setName(""); setFieldAnswers({});
            await queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]});
        } catch (error) {
            setMessage(error instanceof EventTeamError ? apiErrorMessage(error.code, error.status === 409 ? "Створити команду зараз неможливо." : "Не вдалося створити команду. Перевірте додаткові поля.") : "Не вдалося створити команду. Перевірте додаткові поля.");
        } finally {setPending(false);}
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
            {!personal && Object.keys(ownTeam.ExtraFields).length > 0 && <section className="event-vpn-card"><h2>Додаткові поля команди</h2>{Object.entries(ownTeam.ExtraFields).map(([key, value]) => {
                const field = fieldsQuery.data?.Document.blocks.find(block => block.type === "field" && block.key === key);
                return <p key={key}><strong>{field?.label ?? key}:</strong> {Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? value ? "Так" : "Ні" : String(value)}</p>;
            })}</section>}
            {participantInfo.UseVPN && <section className="event-vpn-card"><h2>Підготуйте VPN</h2><p>Перевірте підключення до групи лабораторій заздалегідь. Окремі завдання відкриються за розкладом.</p><Link className="ib-btn ib-btn--primary" href="/vpn"><Network size={17} />Підключення VPN</Link></section>}
        </> : personal ? <section className="event-vpn-state"><h2>Готуємо вашу участь</h2><p>Особиста лабораторна група з’явиться після завершення реєстрації.</p><button className="ib-btn" onClick={() => void queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]})}>Оновити</button></section> : <section className="event-vpn-card">
            <h2>Приєднайтеся до команди</h2><p>Створіть команду або введіть код запрошення. Після вступу стане доступною підготовка VPN, якщо лабораторії заплановано.</p>
            <form className="event-team-form" onSubmit={event => void submit(event)}>
                <label>Код запрошення<input className="event-manage-input" value={joinCode} onChange={event => setJoinCode(event.target.value)} required autoComplete="off" /></label>
                <button className="ib-btn ib-btn--primary" type="submit" disabled={pending}>{pending ? "Зберігаємо…" : "Приєднатися"}</button>
            </form>
            <button className="ib-btn" type="button" onClick={() => setCreateOpen(true)}>Створити команду</button>
        </section>}
        <Dialog open={createOpen} onOpenChange={open => {if (!pending) setCreateOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-[min(520px,calc(100vw-24px))] overflow-y-auto"><DialogHeader><DialogTitle>Створити команду</DialogTitle><DialogDescription>Вкажіть назву та заповніть додаткові поля команди.</DialogDescription></DialogHeader>{fieldsQuery.isError ? <p role="alert">Не вдалося завантажити додаткові поля. <button className="ib-btn" type="button" onClick={() => void fieldsQuery.refetch()}>Повторити</button></p> : <form className="grid gap-4" onSubmit={event => void create(event)}><label className="event-manage-field">Назва команди<input className="event-manage-input" value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={64} disabled={pending} /></label>{fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fieldAnswers} onChange={(key, value) => setFieldAnswers(current => ({...current, [key]: value}))} disabled={pending} />}<button className="ib-btn ib-btn--primary" type="submit" disabled={pending || fieldsQuery.isPending}>{pending ? "Створюємо…" : "Створити команду"}</button></form>}</DialogContent></Dialog>
        {message && <p className="event-vpn-feedback" role="status">{message}</p>}
    </div>;
}
