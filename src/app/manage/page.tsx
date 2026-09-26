"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, CalendarDays, Check, FileText, UsersRound} from "lucide-react";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, putManageLifecycle, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";

function localDateTime(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function ManageIndex() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const client = useQueryClient();
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchInterval: false, refetchOnWindowFocus: false});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchInterval: false, refetchOnWindowFocus: false});
    const [participationDraft, setParticipationDraft] = useState<0 | 1 | undefined>();
    const [maxTeamSizeDraft, setMaxTeamSizeDraft] = useState<string | null>(null);
    const [minTeamSizeDraft, setMinTeamSizeDraft] = useState<string | null>(null);
    const [registrationDraft, setRegistrationDraft] = useState<0 | 1 | 2 | null>(null);
    const [publishAtDraft, setPublishAtDraft] = useState<string | null>(null);
    const [startAtDraft, setStartAtDraft] = useState<string | null>(null);
    const [joinPolicyDraft, setJoinPolicyDraft] = useState<0 | 1 | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (config.isPending || lifecycle.isPending) return <div className="event-manage-loading" role="status">Перевіряємо готовність події…</div>;
    if (config.isError || lifecycle.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося перевірити налаштування</h1><button className="ib-btn" onClick={() => { void config.refetch(); void lifecycle.refetch(); }}>Повторити</button></div>;

    const participation = participationDraft ?? config.data.Participation;
    const maxTeamSize = maxTeamSizeDraft ?? (config.data.Participation === 1 ? String(config.data.MaxTeamSize) : "");
    const minTeamSize = minTeamSizeDraft ?? (config.data.Participation === 1 ? String(config.data.MinTeamSize ?? "") : "");
    const registration = registrationDraft ?? config.data.Registration;
    const publishAt = publishAtDraft ?? localDateTime(lifecycle.data.PublishAt);
    const startAt = startAtDraft ?? localDateTime(lifecycle.data.StartAt);
    const joinPolicy = joinPolicyDraft ?? lifecycle.data.JoinPolicy;
    const configured = config.data.Participation !== null && lifecycle.data.Configured;
    const completedSteps = Number(config.data.Participation !== null) + Number(lifecycle.data.Configured);
    const locked = lifecycle.data.Configured && lifecycle.data.Status !== "not_published";
    const publishTime = Date.parse(publishAt);
    const startTime = Date.parse(startAt);
    const maxSize = Number(maxTeamSize);
    const minSize = minTeamSize === "" ? null : Number(minTeamSize);
    const validTeamSize = participation !== 1 || (maxTeamSize !== "" && Number.isInteger(maxSize) && maxSize > 0 &&
        (minSize === null || (Number.isInteger(minSize) && minSize > 0 && minSize <= maxSize)));
    const valid = participation !== null && validTeamSize && Number.isFinite(publishTime) && Number.isFinite(startTime) && startTime >= publishTime;

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canManage || !valid || saving || participation === null) return;
        setSaving(true);
        setError("");
        try {
            const current = config.data!;
            if (current.Participation !== participation || (participation === 1 && (current.MaxTeamSize !== maxSize || current.MinTeamSize !== minSize)) || current.Registration !== registration) {
                const input: ManageConfigInput = {
                    Participation: participation, Registration: registration,
                    ScoreboardVisibility: current.ScoreboardVisibility, ParticipantsVisibility: current.ParticipantsVisibility,
                    PreviewDescription: current.PreviewDescription, PreviewPicture: current.PreviewPicture,
                    MaxTeamSize: participation === 1 ? maxSize : current.MaxTeamSize,
                    MinTeamSize: participation === 1 ? minSize : current.MinTeamSize,
                    MaxTeams: current.MaxTeams,
                    UseVPN: current.UseVPN,
                };
                client.setQueryData(["event-management-config", eventID], await putManageConfig(eventID, input));
            }
            client.setQueryData(["event-management-lifecycle", eventID], await putManageLifecycle(eventID, {
                JoinPolicy: joinPolicy, PublishAt: new Date(publishTime).toISOString(),
                StartAt: new Date(startTime).toISOString(), FinishAt: null, WithdrawAt: null,
            }));
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            setError(status === 409 ? "Налаштування змінилися в іншому місці. Оновіть сторінку й повторіть." : status === 400 ? "Сервер відхилив розклад. Перевірте дати та формат участі." : "Не вдалося завершити підготовку. Збережений формат участі залишився в налаштуваннях.");
        } finally { setSaving(false); }
    }

    return <div className="event-manage-setup">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">Керування подією</p><h1>{configured ? "Огляд події" : "Підготовка події"}</h1><p>{configured ? "Основні параметри готові. Далі підготуйте сторінки й наповнення." : "Оберіть формат участі та заплануйте публікацію перед відкриттям реєстрації."}</p></div><Link className="ib-btn" href="/">Переглянути сайт <ArrowUpRight size={16} /></Link></header>
        <div className="event-manage-setup__summary" role="status">
            <div><span className="event-manage-setup__summary-label">Перший запуск</span><strong>{configured ? "Подію підготовлено" : "Спочатку визначте правила участі"}</strong><p>{configured ? "Тепер можна наповнити головну сторінку й переглянути сайт очима відвідувача." : "Два рішення потрібні, щоб запланувати подію. Контент, завдання й вигляд сайту можна налаштувати пізніше."}</p></div>
            <div className="event-manage-setup__summary-progress"><b>{completedSteps}<span>/2</span></b><span>обов’язкових кроків</span><div className="event-manage-setup__progress-track"><span style={{width: `${completedSteps * 50}%`}} /></div></div>
        </div>
        <div className="event-manage-setup__steps" aria-label="Етапи підготовки">
            <div className={`event-manage-setup__step${config.data.Participation === null ? " is-current" : " is-complete"}`}><span className="event-manage-setup__step-number">01</span><UsersRound size={20} /><div><strong>Формат участі</strong><span>{config.data.Participation === null ? "Виберіть особисту або командну участь" : config.data.Participation === 1 ? `Команди · до ${config.data.MaxTeamSize} осіб` : "Особиста участь"}</span></div>{config.data.Participation !== null && <Check size={18} />}</div>
            <div className={`event-manage-setup__step${lifecycle.data.Configured ? " is-complete" : config.data.Participation !== null ? " is-current" : ""}`}><span className="event-manage-setup__step-number">02</span><CalendarDays size={20} /><div><strong>Публікація і початок</strong><span>{lifecycle.data.Configured ? "Розклад збережено" : "Заплануйте відкриття події"}</span></div>{lifecycle.data.Configured && <Check size={18} />}</div>
            <Link className="event-manage-setup__step" href="/manage/content/landing"><span className="event-manage-setup__step-number">→</span><FileText size={20} /><div><strong>Головна сторінка</strong><span>Наступний крок після збереження</span></div><ArrowUpRight size={18} /></Link>
        </div>
        {!configured && <form className="event-manage-section event-manage-setup__form" onSubmit={save}>
            <div className="event-manage-section__head"><h2>Обов’язкові параметри</h2><p>До публікації реєстрація недоступна. Після першої публікації формат участі й розмір команди фіксуються.</p></div>
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Формат участі">
                <label><input type="radio" name="participation" checked={participation === 0} onChange={() => setParticipationDraft(0)} disabled={!canManage || locked || saving} /><span><strong>Особиста участь</strong><small>Кожен учасник проходить завдання самостійно.</small></span></label>
                <label><input type="radio" name="participation" checked={participation === 1} onChange={() => { setParticipationDraft(1); if (config.data.Participation !== 1) setMaxTeamSizeDraft(""); }} disabled={!canManage || locked || saving} /><span><strong>Командна участь</strong><small>Учасники об’єднуються в команди.</small></span></label>
            </div>
            {participation === 1 && <div className="event-manage-fields-two">
                <label className="event-manage-field"><span>Максимум учасників у команді</span><input className="event-manage-input" type="number" min={1} step={1} value={maxTeamSize} onChange={event => setMaxTeamSizeDraft(event.target.value)} disabled={!canManage || locked || saving} required /><small>Виберіть розмір команди до планування публікації.</small></label>
                <label className="event-manage-field"><span>Мінімум учасників у команді</span><input className="event-manage-input" type="number" min={1} max={maxTeamSize || undefined} step={1} value={minTeamSize} onChange={event => setMinTeamSizeDraft(event.target.value)} disabled={!canManage || locked || saving} placeholder="Без мінімуму" /><small>Необов’язково; після публікації теж фіксується.</small></label>
            </div>}
            <label className="event-manage-field"><span>Реєстрація після публікації</span><select className="event-manage-input" value={registration} onChange={event => setRegistrationDraft(Number(event.target.value) as 0 | 1 | 2)} disabled={!canManage || saving}><option value={0}>Закрита</option><option value={1}>За схваленням</option><option value={2}>Відкрита</option></select><small>Цей режим можна змінити пізніше. До публікації реєстрація закрита незалежно від вибору.</small></label>
            <div className="event-manage-fields-two">
                <label className="event-manage-field"><span>Публікація</span><input className="event-manage-input" type="datetime-local" value={publishAt} onChange={event => setPublishAtDraft(event.target.value)} disabled={!canManage || saving} required /><small>З цього часу сайт і реєстрація можуть бути доступні відвідувачам.</small></label>
                <label className="event-manage-field"><span>Початок</span><input className="event-manage-input" type="datetime-local" value={startAt} onChange={event => setStartAtDraft(event.target.value)} disabled={!canManage || saving} required /><small>Після початку можна проходити завдання.</small></label>
            </div>
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Період приєднання">
                <label><input type="radio" name="join-policy" checked={joinPolicy === 0} onChange={() => setJoinPolicyDraft(0)} disabled={!canManage || saving} /><span><strong>До початку</strong><small>Приєднання закриється на старті.</small></span></label>
                <label><input type="radio" name="join-policy" checked={joinPolicy === 1} onChange={() => setJoinPolicyDraft(1)} disabled={!canManage || saving} /><span><strong>Протягом події</strong><small>Приєднання можливе до завершення.</small></span></label>
            </div>
            {error && <p className="event-manage-validation" role="alert">{error}</p>}
            {publishAt && startAt && startTime < publishTime && <p className="event-manage-validation" role="alert">Початок має бути не раніше публікації.</p>}
            {participation === 1 && minSize !== null && minSize > maxSize && <p className="event-manage-validation" role="alert">Мінімум у команді не може перевищувати максимум.</p>}
            <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || !valid || saving}>{saving ? "Зберігаємо…" : "Зберегти й запланувати"}</button></div>
        </form>}
        {configured && <div className="event-manage-setup__links"><Link className="ib-btn" href="/manage/settings">Основні налаштування</Link><Link className="ib-btn" href="/manage/schedule">Розклад</Link><Link className="ib-btn ib-btn--primary" href="/manage/content/landing">Конструктор головної</Link></div>}
    </div>;
}
