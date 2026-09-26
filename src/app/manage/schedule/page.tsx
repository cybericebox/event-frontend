"use client";

import {useMemo, useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CalendarDays, Info} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageLifecycle, type ManageLifecycle} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";

type ScheduleDraft = {
    JoinPolicy: 0 | 1;
    PublishAt: string;
    StartAt: string;
    FinishAt: string;
    WithdrawAt: string;
    ScheduledEnd: boolean;
};

const statusNames: Record<ManageLifecycle["Status"], string> = {
    not_published: "Не опубліковано", published: "Опубліковано", started: "Триває",
    finished: "Завершено", withdrawn: "Закрито",
};

function localDateTime(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function toDraft(value: ManageLifecycle): ScheduleDraft {
    return {
        JoinPolicy: value.JoinPolicy,
        PublishAt: localDateTime(value.PublishAt),
        StartAt: localDateTime(value.StartAt),
        FinishAt: localDateTime(value.FinishAt),
        WithdrawAt: localDateTime(value.WithdrawAt),
        ScheduledEnd: !!value.FinishAt,
    };
}

function asTimestamp(value: string): number | null {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

export default function ManageSchedulePage() {
    const {event, canManage} = useManager();
    const queryClient = useQueryClient();
    const eventID = event.EventID;
    const lifecycle = useQuery({
        queryKey: ["event-management-lifecycle", eventID],
        queryFn: () => getManageLifecycle(eventID),
        refetchInterval: false, refetchOnWindowFocus: false,
    });
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchInterval: false, refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<{eventID: string; value: ScheduleDraft} | null>(null);
    const [saving, setSaving] = useState(false);

    const draft = edited?.eventID === eventID ? edited.value : lifecycle.data ? toDraft(lifecycle.data) : null;
    const setDraft = (value: ScheduleDraft) => setEdited({eventID, value});

    const validation = useMemo(() => {
        if (!draft) return "";
        const publish = asTimestamp(draft.PublishAt);
        const start = asTimestamp(draft.StartAt);
        const finish = asTimestamp(draft.FinishAt);
        const withdraw = asTimestamp(draft.WithdrawAt);
        if (publish === null || start === null) return "Вкажіть час публікації та початку.";
        if (start < publish) return "Початок має бути не раніше публікації.";
        if (draft.ScheduledEnd) {
            if (finish === null || withdraw === null) return "Для завершення за розкладом вкажіть обидва часи.";
            if (finish <= start) return "Завершення має бути після початку.";
            if (withdraw <= finish) return "Закриття доступу має бути після завершення.";
        }
        return "";
    }, [draft]);
    const dirty = !!draft && !!lifecycle.data && JSON.stringify(draft) !== JSON.stringify(toDraft(lifecycle.data));

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft || validation || !canManage || saving || config.data?.Participation === null) return;
        setSaving(true);
        try {
            const updated = await putManageLifecycle(eventID, {
                JoinPolicy: draft.JoinPolicy,
                PublishAt: new Date(draft.PublishAt).toISOString(),
                StartAt: new Date(draft.StartAt).toISOString(),
                FinishAt: draft.ScheduledEnd ? new Date(draft.FinishAt).toISOString() : null,
                WithdrawAt: draft.ScheduledEnd ? new Date(draft.WithdrawAt).toISOString() : null,
            });
            queryClient.setQueryData(["event-management-lifecycle", eventID], updated);
            setEdited(null);
            toast.success("Час події збережено");
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            toast.error(status === 409 ? "Розклад змінився в іншому місці. Оновіть сторінку." : status === 400 ? "Сервер відхилив розклад. Перевірте дати та доступність інфраструктури." : "Не вдалося зберегти розклад. Повторіть запит.");
        } finally { setSaving(false); }
    }

    if (lifecycle.isError || config.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити розклад</h1><button className="ib-btn" onClick={() => { void lifecycle.refetch(); void config.refetch(); }}>Повторити</button></div>;
    if (lifecycle.isPending || config.isPending || !draft) return <EventLoading event={event} />;
    if (!lifecycle.data) return null;

    return <div className="event-manage-settings event-manage-schedule">
        <header className="event-manage-heading"><div><h1>Публікація і час</h1><p>Усі дати вводяться за місцевим часом вашого пристрою.</p></div><span className="event-manage-status"><CalendarDays size={16} />{statusNames[lifecycle.data.Status]}</span></header>
        {!canManage && <div className="event-manage-notice" role="status"><Info size={18} />Доступний лише перегляд. Змінювати розклад може менеджер події.</div>}
        {!lifecycle.data.Configured && <div className="event-manage-notice" role="status"><Info size={18} />Подію ще не заплановано. Публікація почнеться у вказаний час після збереження.</div>}
        {config.data?.Participation === null && <div className="event-manage-notice" role="status"><Info size={18} />Спочатку виберіть <Link href="/manage/participation-settings">формат участі</Link>.</div>}
        {!lifecycle.data.Infrastructure.CanStart && <div className="event-manage-feedback event-manage-feedback--error" role="status">Інфраструктура поки не готова до старту{lifecycle.data.Infrastructure.Reason ? `: ${lifecycle.data.Infrastructure.Reason}` : "."} Перевірте її перед початком.</div>}
        <form className="event-manage-section" onSubmit={save}>
            <div className="event-manage-section__head"><h2>Ключові дати</h2><p>Спочатку сайт стане доступним гостям, потім відкриються завдання. Завершення й закриття доступу можна запланувати окремо.</p></div>
            <div className="event-manage-fields-two">
                <label className="event-manage-field"><span>Публікація</span><input className="event-manage-input" type="datetime-local" value={draft.PublishAt} onChange={event => setDraft({...draft, PublishAt: event.target.value})} disabled={!canManage || saving || lifecycle.data.Status !== "not_published"} required /><small>{lifecycle.data.Status === "not_published" ? "Гості побачать сайт події." : "Після першої публікації цей час зафіксовано."}</small></label>
                <label className="event-manage-field"><span>Початок</span><input className="event-manage-input" type="datetime-local" value={draft.StartAt} onChange={event => setDraft({...draft, StartAt: event.target.value})} disabled={!canManage || saving} required /><small>Відкриється проходження завдань.</small></label>
            </div>
            <label className="event-manage-check"><input type="checkbox" checked={draft.ScheduledEnd} onChange={event => setDraft({...draft, ScheduledEnd: event.target.checked})} disabled={!canManage || saving} /><span><strong>Запланувати завершення</strong><small>Якщо вимкнено, подія триватиме до ручного завершення.</small></span></label>
            <div className="event-manage-fields-two">
                <label className="event-manage-field"><span>Завершення</span><input className="event-manage-input" type="datetime-local" value={draft.FinishAt} onChange={event => setDraft({...draft, FinishAt: event.target.value})} disabled={!canManage || saving || !draft.ScheduledEnd} required={draft.ScheduledEnd} /><small>Проходження завдань закриється.</small></label>
                <label className="event-manage-field"><span>Закриття доступу</span><input className="event-manage-input" type="datetime-local" value={draft.WithdrawAt} onChange={event => setDraft({...draft, WithdrawAt: event.target.value})} disabled={!canManage || saving || !draft.ScheduledEnd} required={draft.ScheduledEnd} /><small>Сайт події перестане бути публічним.</small></label>
            </div>
            <div className="event-manage-section__head"><h2>Приєднання</h2><p>Спосіб реєстрації — відкрита, за схваленням або закрита — налаштовується в основних параметрах.</p></div>
            <div className="event-manage-choice-group" role="radiogroup" aria-label="Період приєднання">
                <label><input type="radio" name="join-policy" checked={draft.JoinPolicy === 0} onChange={() => setDraft({...draft, JoinPolicy: 0})} disabled={!canManage || saving} /><span><strong>До початку</strong><small>Реєстрація та зміна команди завершаться на старті.</small></span></label>
                <label><input type="radio" name="join-policy" checked={draft.JoinPolicy === 1} onChange={() => setDraft({...draft, JoinPolicy: 1})} disabled={!canManage || saving} /><span><strong>Протягом події</strong><small>Приєднання буде доступне до завершення.</small></span></label>
            </div>
            {validation && (draft.PublishAt || draft.StartAt || draft.FinishAt || draft.WithdrawAt) && <p className="event-manage-validation" role="alert">{validation}</p>}
            <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || config.data?.Participation === null || !!validation || (lifecycle.data.Configured && !dirty)}>{saving ? "Зберігаємо…" : "Зберегти розклад"}</button></div>
        </form>
    </div>;
}
