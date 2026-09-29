"use client";

import {useState, type FormEvent, type ReactNode} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {Copy} from "lucide-react";
import {apiErrorMessage} from "@/api/apiErrors";
import type {OwnTeam} from "@/api/clientAuth";
import {
    createEventTeam, disbandEventTeam, EventTeamError, getOwnTeamMembers, getSelfTeamFields, joinEventTeam, kickEventTeamMember,
    leaveEventTeam, regenerateEventTeamCode, renameEventTeam, TeamRole, transferEventTeamCaptain, updateOwnTeamFields, type TeamMember,
} from "@/api/eventTeams";
import {getOwnParticipantAnswers, ParticipantJoinError, putOwnParticipantAnswers, putSelfPseudonym, type ParticipantAnswers} from "@/api/participantForm";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {DialogModal} from "@/components/event/DialogModal";
import {EventBanner} from "@/components/event/EventBanner";
import {EventLoading} from "@/components/event/EventLoading";
import {StandStatusIcon, standStatusText, useEventVpn} from "@/components/event/vpn/EventVpn";
import {missingMembers, pluralUk} from "@/components/event/challenges/challengeBoardModel";
import {changedEditableAnswers, editableForm, formatAnswer, formFields, rosterLine} from "./participationModel";

function errorText(error: unknown, fallback: string): string {
    if (error instanceof EventTeamError || error instanceof ParticipantJoinError) return apiErrorMessage(error.code, fallback);
    return fallback;
}

function Section({title, note, children}: {title: string; note?: ReactNode; children: ReactNode}) {
    return <section className="event-part" aria-label={title}>
        <header className="event-part__head"><h2>{title}</h2>{note && <p>{note}</p>}</header>
        {children}
    </section>;
}

type Confirm = {title: string; text: string; action: string; danger?: boolean; run: () => Promise<void>} | null;

function ConfirmDialog({confirm, onClose}: {confirm: Confirm; onClose: () => void}) {
    const [busy, setBusy] = useState(false);
    return <DialogModal open={!!confirm} onClose={() => { if (!busy) onClose(); }} title={confirm?.title ?? ""}
        footer={<><button type="button" className="ib-btn" disabled={busy} onClick={onClose}>Скасувати</button>
            <button type="button" className={`ib-btn ${confirm?.danger ? "ib-btn--danger-solid" : "ib-btn--primary"}`} disabled={busy} onClick={async () => {
                if (!confirm) return;
                setBusy(true);
                try { await confirm.run(); onClose(); } finally { setBusy(false); }
            }}>{busy ? "Зачекайте…" : confirm?.action}</button></>}>
        <p>{confirm?.text}</p>
    </DialogModal>;
}

function FieldsEditor({form, answers, onCancel, onSave}: {form: ParticipantForm; answers: ParticipantAnswers; onCancel: () => void; onSave: (answers: ParticipantAnswers) => Promise<void>}) {
    const [draft, setDraft] = useState<ParticipantAnswers>(answers);
    const [busy, setBusy] = useState(false);
    return <form className="event-part__form" onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try { await onSave(draft); } finally { setBusy(false); }
    }}>
        <TeamFieldsInputs form={editableForm(form)} answers={draft} onChange={(key, value) => setDraft(current => ({...current, [key]: value}))} disabled={busy} />
        <div className="event-part__actions"><button type="submit" className="ib-btn ib-btn--primary" disabled={busy}>{busy ? "Зберігаємо…" : "Зберегти"}</button><button type="button" className="ib-btn" disabled={busy} onClick={onCancel}>Скасувати</button></div>
    </form>;
}

function FieldRows({form, answers, canEdit, onEdit}: {form: ParticipantForm; answers: Record<string, unknown>; canEdit: boolean; onEdit: () => void}) {
    const fields = formFields(form);
    if (!fields.length) return null;
    const anyEditable = canEdit && fields.some(field => field.editable);
    return <>
        <dl className="event-part__rows">{fields.map(field => <FieldRow key={field.key} label={field.label}><span className="event-part__field-value">{formatAnswer(answers[field.key])}</span></FieldRow>)}</dl>
        {anyEditable && <div className="event-part__actions"><button type="button" className="ib-btn ib-btn--sm" onClick={onEdit}>Змінити поля</button></div>}
    </>;
}

function FieldRow({label, children}: {label: string; children: ReactNode}) {
    return <><dt>{label}</dt><dd>{children}</dd></>;
}

function PseudonymRow({info, eventID}: {info: ParticipantEventInfo; eventID: string}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(info.Pseudonym ?? "");
    const [busy, setBusy] = useState(false);
    const save = async (next: string | null) => {
        setBusy(true);
        try {
            await putSelfPseudonym(next);
            await queryClient.invalidateQueries({queryKey: ["event-participant-info", eventID]});
            setEditing(false);
            toast.success(next ? "Псевдонім збережено" : "Псевдонім прибрано");
        } catch (error) {
            toast.error(errorText(error, "Не вдалося зберегти псевдонім."));
        } finally { setBusy(false); }
    };
    if (editing) return <FieldRow label="Псевдонім"><form className="event-part__inline" onSubmit={event => { event.preventDefault(); void save(value.trim() || null); }}>
        <input className="ib-input" value={value} onChange={event => setValue(event.target.value)} maxLength={32} minLength={2} aria-label="Псевдонім" disabled={busy} autoFocus />
        <button type="submit" className="ib-btn ib-btn--primary" disabled={busy}>Зберегти</button>
        <button type="button" className="ib-btn" disabled={busy} onClick={() => setEditing(false)}>Скасувати</button>
    </form></FieldRow>;
    return <FieldRow label="Псевдонім">
        <span className={info.Pseudonym ? undefined : "event-part__muted"}>{info.Pseudonym || "Не задано"}</span>
        <span className="event-part__end">{info.PseudonymEditable
            ? <><button type="button" className="ib-btn ib-btn--sm" onClick={() => { setValue(info.Pseudonym ?? ""); setEditing(true); }}>{info.Pseudonym ? "Змінити" : "Додати"}</button>
                {info.Pseudonym && <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" disabled={busy} onClick={() => void save(null)}>Прибрати</button>}</>
            : <span className="event-part__muted">Змінити після старту не можна</span>}</span>
    </FieldRow>;
}

function SelfSection({event, info, finished}: {event: PublicEventInfo; info: ParticipantEventInfo; finished: boolean}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const answers = useQuery({queryKey: ["event-own-answers", event.EventID], queryFn: () => getOwnParticipantAnswers(), retry: false, refetchOnWindowFocus: false});
    const save = async (draft: ParticipantAnswers) => {
        if (!answers.data) return;
        try {
            const changed = changedEditableAnswers(answers.data.Form, answers.data.Answers, draft);
            if (Object.keys(changed).length) queryClient.setQueryData(["event-own-answers", event.EventID], await putOwnParticipantAnswers(event.EventID, changed));
            setEditing(false);
            toast.success("Поля збережено");
        } catch (error) {
            toast.error(errorText(error, "Не вдалося зберегти поля."));
        }
    };
    return <Section title="Я" note="Так вас бачать інші учасники та організатори.">
        <dl className="event-part__rows">
            <FieldRow label="Ім’я">{info.RealName || "—"}</FieldRow>
            {info.AllowPseudonyms && <FieldRow label="Показуємо як">{info.DisplayName || info.RealName || "—"}</FieldRow>}
            {info.AllowPseudonyms && <PseudonymRow info={info} eventID={event.EventID} />}
            <FieldRow label="Статус">Участь підтверджено</FieldRow>
        </dl>
        {answers.data && formFields(answers.data.Form).length > 0 && <>
            <h3 className="event-part__subhead">Додаткові поля</h3>
            {editing
                ? <FieldsEditor form={answers.data.Form} answers={answers.data.Answers} onCancel={() => setEditing(false)} onSave={save} />
                : <FieldRows form={answers.data.Form} answers={answers.data.Answers} canEdit={answers.data.Editable && !finished} onEdit={() => setEditing(true)} />}
        </>}
        {answers.isError && <p className="event-part__note">Не вдалося завантажити додаткові поля.</p>}
    </Section>;
}

function NoTeam({event, started}: {event: PublicEventInfo; started: boolean}) {
    const queryClient = useQueryClient();
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [fields, setFields] = useState<ParticipantAnswers>({});
    const [createOpen, setCreateOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const fieldsQuery = useQuery({queryKey: ["event-team-fields", event.EventID], queryFn: () => getSelfTeamFields(), enabled: createOpen, refetchOnWindowFocus: false});
    const refresh = () => Promise.all([
        queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]}),
        queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]}),
    ]);
    if (started) return <p className="event-part__note">Склад команд заморожено після старту. Щоб потрапити до команди, зверніться до організаторів.</p>;
    const join = async (submit: FormEvent) => {
        submit.preventDefault();
        setBusy(true);
        setError("");
        try {
            await joinEventTeam(event.EventID, code.trim());
            await refresh();
        } catch (failure) {
            // JoinTeam: 404 = unknown code; 409 = full team or closed roster (U6).
            setError(failure instanceof EventTeamError && failure.status === 404 ? "Команду з таким кодом не знайдено. Перевірте код."
                : errorText(failure, "Приєднатися неможливо: команда заповнена або склад закрито."));
        } finally { setBusy(false); }
    };
    const create = async (submit: FormEvent) => {
        submit.preventDefault();
        setBusy(true);
        setError("");
        try {
            await createEventTeam(event.EventID, name.trim(), fields);
            setCreateOpen(false);
            await refresh();
        } catch (failure) {
            setError(errorText(failure, "Не вдалося створити команду. Перевірте назву й поля."));
        } finally { setBusy(false); }
    };
    return <>
        <div className="event-part__choice">
            <section><h3>Створити команду</h3><p>Ви станете капітаном і отримаєте код для учасників.</p><button type="button" className="ib-btn ib-btn--primary" onClick={() => { setError(""); setCreateOpen(true); }}>Створити команду</button></section>
            <section><h3>Приєднатися за кодом</h3><p>Код дає капітан команди.</p>
                <form className="event-part__inline" onSubmit={event => void join(event)}>
                    <input className="ib-input ib-input--mono" value={code} onChange={event => setCode(event.target.value)} aria-label="Код команди" placeholder="Код команди" required autoComplete="off" disabled={busy} />
                    <button type="submit" className="ib-btn" disabled={busy || !code.trim()}>Приєднатися</button>
                </form>
            </section>
        </div>
        {error && !createOpen && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
        <DialogModal open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} title="Створити команду" description="Назва видна в результатах.">
            <form className="event-part__form" onSubmit={event => void create(event)}>
                <label className="ib-field"><span className="ib-field__label">Назва команди</span><input className="ib-input" value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={64} disabled={busy} autoFocus /></label>
                {fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fields} onChange={(key, value) => setFields(current => ({...current, [key]: value}))} disabled={busy} />}
                {fieldsQuery.isError && <p className="ib-cmodal__msg is-error">Не вдалося завантажити поля команди.</p>}
                {error && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
                <div className="event-part__actions"><button type="submit" className="ib-btn ib-btn--primary" disabled={busy || fieldsQuery.isPending}>{busy ? "Створюємо…" : "Створити"}</button></div>
            </form>
        </DialogModal>
    </>;
}

function TeamSection({event, info, team, started, finished}: {event: PublicEventInfo; info: ParticipantEventInfo; team: OwnTeam; started: boolean; finished: boolean}) {
    const queryClient = useQueryClient();
    const members = useQuery({queryKey: ["event-team-members", event.EventID, team.ID], queryFn: () => getOwnTeamMembers(event.EventID), retry: false, refetchOnWindowFocus: false});
    const fieldsForm = useQuery({queryKey: ["event-team-fields", event.EventID], queryFn: () => getSelfTeamFields(), refetchOnWindowFocus: false});
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(team.Name);
    const [editingFields, setEditingFields] = useState(false);
    const own = members.data?.find(member => member.Own);
    const captain = own ? own.Role === TeamRole.Captain : false;
    const rosterOpen = !started;
    const refresh = () => Promise.all([
        queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]}),
        queryClient.invalidateQueries({queryKey: ["event-team-members", event.EventID]}),
        queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]}),
    ]);
    const run = (action: () => Promise<void>, done: string, fallback: string) => async () => {
        try {
            await action();
            await refresh();
            toast.success(done);
        } catch (error) {
            toast.error(errorText(error, fallback));
            throw error;
        }
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(team.JoinCode);
            toast.success("Код скопійовано");
        } catch { toast.error("Не вдалося скопіювати код."); }
    };
    const rename = async (submit: FormEvent) => {
        submit.preventDefault();
        try {
            await run(() => renameEventTeam(event.EventID, team.ID, name.trim()), "Команду перейменовано", "Не вдалося перейменувати команду.")();
            setRenaming(false);
        } catch { /* toast shown */ }
    };
    const memberActions = (member: TeamMember) => captain && rosterOpen && !member.Own && <>
        <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setConfirm({title: "Передати капітанство?", text: `${member.DisplayName} стане капітаном. Ви залишитеся в команді учасником.`, action: "Передати", run: run(() => transferEventTeamCaptain(event.EventID, team.ID, member.UserID), "Капітанство передано", "Не вдалося передати капітанство.")})}>Зробити капітаном</button>
        <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setConfirm({title: "Виключити з команди?", text: `${member.DisplayName} більше не буде в команді.`, action: "Виключити", danger: true, run: run(() => kickEventTeamMember(event.EventID, team.ID, member.UserID), "Учасника виключено", "Не вдалося виключити учасника.")})}>Виключити</button>
    </>;
    const min = team.MinTeamSize ?? info.MinTeamSize;
    const missing = missingMembers(team.MemberCount, min);
    const teamFieldForm = fieldsForm.data;
    return <Section title="Команда" note={rosterOpen ? "Склад можна змінювати до старту." : "Склад заморожено після старту — змінити його може лише модератор."}>
        {team.Admitted === false && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="warning" title={`Команду не допущено${missing ? `: потрібно ще ${missing} ${pluralUk(missing, "учасник", "учасники", "учасників")}` : ""}`} message="Без допуску завдання недоступні." /></div>}
        <dl className="event-part__rows">
            <FieldRow label="Назва">{renaming
                ? <form className="event-part__inline" onSubmit={event => void rename(event)}><input className="ib-input" value={name} onChange={event => setName(event.target.value)} minLength={3} maxLength={64} required aria-label="Назва команди" autoFocus /><button type="submit" className="ib-btn ib-btn--primary">Зберегти</button><button type="button" className="ib-btn" onClick={() => setRenaming(false)}>Скасувати</button></form>
                : <><span>{team.Name}</span>{captain && rosterOpen && <span className="event-part__end"><button type="button" className="ib-btn ib-btn--sm" onClick={() => { setName(team.Name); setRenaming(true); }}>Перейменувати</button></span>}</>}</FieldRow>
            <FieldRow label="Склад"><span>{rosterLine(team.MemberCount, team.MaxTeamSize ?? info.MaxTeamSize, min)}</span>{team.Admitted !== false && <span className="ib-tag ib-tag--ok">Допущено</span>}</FieldRow>
            {team.JoinCode && <FieldRow label="Код для приєднання"><span className="event-part__code" aria-label="Код приховано">••••••••</span>
                <span className="event-part__end"><button type="button" className="ib-btn ib-btn--sm" onClick={() => void copy()}><Copy aria-hidden="true" />Копіювати</button>
                    {captain && rosterOpen && <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setConfirm({title: "Створити новий код?", text: "Старий код перестане працювати.", action: "Новий код", run: run(() => regenerateEventTeamCode(event.EventID, team.ID), "Код оновлено", "Не вдалося оновити код.")})}>Новий код</button>}</span>
            </FieldRow>}
        </dl>
        <h3 className="event-part__subhead">Учасники</h3>
        {members.isPending ? <p className="event-part__note">Завантажуємо склад…</p> : members.isError ? <p className="event-part__note">Не вдалося завантажити склад команди.</p> :
            <table className="event-members"><thead><tr><th>Учасник</th><th>Роль</th><th><span className="ib-sr">Дії</span></th></tr></thead>
                <tbody>{members.data.map(member => <tr key={member.UserID} className={member.Own ? "is-own" : undefined}>
                    <td>{member.DisplayName}{member.Own && <span className="event-part__muted"> · ви</span>}</td>
                    <td>{member.Role === TeamRole.Captain ? <span className="ib-tag ib-tag--role">Капітан</span> : <span className="event-part__muted">Учасник</span>}</td>
                    <td className="is-actions">{memberActions(member)}</td>
                </tr>)}</tbody></table>}
        {teamFieldForm && formFields(teamFieldForm).length > 0 && <>
            <h3 className="event-part__subhead">Поля команди</h3>
            {editingFields
                ? <FieldsEditor form={teamFieldForm} answers={team.ExtraFields as ParticipantAnswers} onCancel={() => setEditingFields(false)} onSave={async draft => {
                    try {
                        await run(() => updateOwnTeamFields(event.EventID, team.ID, changedEditableAnswers(teamFieldForm, team.ExtraFields as ParticipantAnswers, draft)).then(() => undefined), "Поля команди збережено", "Не вдалося зберегти поля команди.")();
                        setEditingFields(false);
                    } catch { /* toast shown */ }
                }} />
                : <FieldRows form={teamFieldForm} answers={team.ExtraFields} canEdit={captain && !finished} onEdit={() => setEditingFields(true)} />}
        </>}
        {rosterOpen && own && <div className="event-part__actions">
            {captain
                ? <button type="button" className="ib-btn ib-btn--danger" onClick={() => setConfirm({title: "Розпустити команду?", text: "Усі учасники залишаться без команди. Дію не можна скасувати.", action: "Розпустити", danger: true, run: run(() => disbandEventTeam(event.EventID, team.ID), "Команду розпущено", "Не вдалося розпустити команду.")})}>Розпустити команду</button>
                : <button type="button" className="ib-btn ib-btn--danger" onClick={() => setConfirm({title: "Вийти з команди?", text: "Повернутися можна буде лише за кодом команди до старту.", action: "Вийти", danger: true, run: run(() => leaveEventTeam(event.EventID), "Ви вийшли з команди", "Не вдалося вийти з команди.")})}>Вийти з команди</button>}
        </div>}
        <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </Section>;
}

function VpnSection() {
    const vpn = useEventVpn();
    if (!vpn.available) return null;
    const text = vpn.status ? standStatusText[vpn.status] : null;
    return <Section title="VPN" note="Потрібен для завдань з інфраструктурою.">
        <div className={`event-vpn-stand is-${vpn.status ?? "unknown"}`} role="status"><StandStatusIcon status={vpn.status} /><div><b>{text?.title ?? "Перевіряємо стенд…"}</b>{text && <span>{text.note}</span>}</div></div>
        <div className="event-part__actions"><button type="button" className="ib-btn ib-btn--primary" onClick={vpn.openVpn}>Налаштувати VPN</button></div>
    </Section>;
}

export function ParticipationPage() {
    const access = useParticipantContext();
    const [now] = useState(() => Date.now());
    if (!access) return <div className="event-participation"><div className="ib-board__empty"><b>Моя участь</b>Сторінка доступна після підтвердження участі.<br /><Link className="ib-btn ib-btn--primary" href="/join">Приєднатися</Link></div></div>;
    const {event, participantInfo: info, ownTeam} = access;
    if (!info) return <EventLoading label="Завантажуємо…" />;
    const started = Date.parse(event.StartTime) <= now;
    const finished = !!event.FinishTime && Date.parse(event.FinishTime) <= now;
    const teamMode = event.Participation === 1;
    return <div className="event-participation">
        <header className="ib-page-header"><div className="ib-page-header__top"><div className="ib-page-header__heading">
            <h1 className="ib-page-header__title">Моя участь</h1>
            <p className="ib-page-header__sub">{event.Name}{finished ? " · подію завершено" : started ? " · подія триває" : ""}</p>
        </div></div></header>
        <SelfSection event={event} info={info} finished={finished} />
        {teamMode && (ownTeam
            ? <TeamSection event={event} info={info} team={ownTeam} started={started} finished={finished} />
            : <Section title="Команда" note="Завдання доступні лише учасникам команди."><NoTeam event={event} started={started} /></Section>)}
        <VpnSection />
    </div>;
}
