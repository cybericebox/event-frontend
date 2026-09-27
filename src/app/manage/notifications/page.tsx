"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Bell, RotateCcw} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    createManageInAppTemplate, customizeManageInAppTemplate, getManageInAppTemplates, getManageNotificationSubscriptions,
    publishManageInAppTemplate, putManageNotificationSubscription, resetManageInAppTemplate,
    resetManageNotificationSubscription, rollbackManageInAppTemplate, signalLabels,
    updateManageInAppTemplate, type ManageInAppTemplate, type ManageInAppTemplateInput,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {NotificationMessageCard} from "@/components/event/NotificationMessageCard";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";

const signals = Object.keys(signalLabels);
const groups = [...new Set(signals.map(signal => signalLabels[signal].group))];
const statusLabels = {draft: "Чернетка", published: "Опублікована", unpublished: "Попередня версія"};

function templateInput(template: ManageInAppTemplate): ManageInAppTemplateInput {
    return {
        NotificationType: template.NotificationType, Title: template.Title, Body: template.Body,
        Link: template.Link, Icon: template.Icon, Tone: template.Tone, AccentColor: template.AccentColor,
        Surface: template.Surface, AutoDismissMs: template.AutoDismissMs,
        Actions: template.Actions, Dismissible: template.Dismissible,
    };
}

function orderedTemplates(items: ManageInAppTemplate[], signal: string) {
    return items.filter(item => item.NotificationType === signal).sort((a, b) => {
        const rank = (item: ManageInAppTemplate) => item.Status === "draft" ? 0 : item.Status === "published" ? 1 : 2;
        return rank(a) - rank(b) || b.UpdatedAt.localeCompare(a.UpdatedAt);
    });
}

function previewText(value: string, eventName: string) {
    return value.replaceAll("{{.event_name}}", eventName);
}

export default function ManageNotificationsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-in-app-templates", eventID], queryFn: () => getManageInAppTemplates(eventID), refetchOnWindowFocus: false});
    const [signal, setSignal] = useState(signals[0]);
    const [selectedTemplateID, setSelectedTemplateID] = useState("");
    const [drafts, setDrafts] = useState<Record<string, ManageInAppTemplateInput>>({});
    const [busy, setBusy] = useState(false);
    const versions = orderedTemplates(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === selectedTemplateID) ?? versions[0];
    const subscription = subscriptions.data?.find(item => item.SignalType === signal && item.Channel === "in_app");
    const saved = template ? templateInput(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
    const valid = !!draft?.Title.trim() && !!draft.Body.trim();
    const editable = !!(canManage && template?.Source === "event" && template.Status === "draft" && !busy);

    async function run(action: () => Promise<unknown>, success: string, failure: string) {
        if (busy || !canManage) return;
        setBusy(true);
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-manage-in-app-templates", eventID]}),
            ]);
            toast.success(success);
        } catch {toast.error(failure);}
        finally {setBusy(false);}
    }

    async function mutateTemplate(action: () => Promise<ManageInAppTemplate>, success: string) {
        await run(async () => {
            const result = await action();
            setSelectedTemplateID(result.ID);
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
        }, success, "Не вдалося оновити шаблон. Перевірте дані й повторіть спробу.");
    }

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label="Завантажуємо сповіщення…" />;
    if (subscriptions.isError || templates.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити сповіщення</h1><button className="ib-btn" type="button" onClick={() => {void subscriptions.refetch(); void templates.refetch();}}>Повторити</button></div>;

    return <div className="event-manage-content event-manage-notifications">
        <header className="event-manage-heading"><div><h1>Сповіщення на сайті</h1><p>Виберіть подію, налаштуйте показ сповіщення й текст, який побачить учасник.</p></div></header>
        <div className="event-manage-notifications__layout">
            <nav className="event-manage-section event-manage-notifications__list" aria-label="Події сповіщень">
                {groups.map(group => <div className="event-manage-notifications__group" key={group}><h2>{group}</h2>{signals.filter(item => signalLabels[item].group === group).map(item => {
                    const enabled = subscriptions.data.some(entry => entry.SignalType === item && entry.Channel === "in_app" && entry.Enabled);
                    return <button className={`event-manage-notifications__item${signal === item ? " is-selected" : ""}`} type="button" key={item} aria-current={signal === item ? "true" : undefined} onClick={() => {setSignal(item); setSelectedTemplateID("");}}><span>{signalLabels[item].title}</span><small>{enabled ? "Увімкнено" : "Вимкнено"}</small></button>;
                })}</div>)}
            </nav>
            <div className="event-manage-notifications__main">
                <section className="event-manage-section">
                    <div className="event-manage-section__head"><h2>{signalLabels[signal].title}</h2><p>{signalLabels[signal].description}</p></div>
                    {subscription ? <div className="event-manage-notifications__delivery"><div><ManageFieldLabel title="Показувати на сайті" help="Коли подія спрацює, сповіщення отримає учасник, якого вона стосується. Вимкнення не видаляє шаблон." /><small>{subscription.Source === "event" ? "Налаштування цієї події" : "Загальне налаштування платформи"}</small></div><div className="event-manage-notifications__delivery-actions"><label className="event-manage-form__switch"><input type="checkbox" checked={subscription.Enabled} disabled={!canManage || busy} onChange={event => void run(() => putManageNotificationSubscription(eventID, {...subscription, Enabled: event.target.checked}), "Показ сповіщення оновлено", "Не вдалося змінити показ сповіщення.")} /><span>{subscription.Enabled ? "Увімкнено" : "Вимкнено"}</span></label>{subscription.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void run(() => resetManageNotificationSubscription(eventID, signal, "in_app"), "Повернуто загальне налаштування", "Не вдалося скинути налаштування.")} title="Повернути налаштування платформи"><RotateCcw size={15} /> Скинути</button>}</div></div> : <p className="event-manage-notifications__empty">Для цього типу немає налаштування показу.</p>}
                </section>
                <section className="event-manage-section">
                    <div className="event-manage-notifications__template-head"><div className="event-manage-section__head"><h2>Текст сповіщення</h2><p>Зміни чернетки стануть видимими після публікації шаблону.</p></div>{template?.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy || dirty} onClick={() => void run(async () => {await resetManageInAppTemplate(eventID, signal); setSelectedTemplateID("");}, "Повернуто шаблон платформи", "Не вдалося повернути шаблон платформи.")}><RotateCcw size={15} /> Повернути типовий</button>}</div>
                    {versions.length > 1 && <div className="event-manage-notifications__versions" aria-label="Версії шаблону">{versions.map(item => <button className={`event-manage-notifications__version${template?.ID === item.ID ? " is-selected" : ""}`} type="button" key={item.ID} onClick={() => setSelectedTemplateID(item.ID)}>{statusLabels[item.Status]} · {new Date(item.UpdatedAt).toLocaleDateString("uk-UA")}</button>)}</div>}
                    {template && draft ? <>
                        <div className="event-manage-notifications__state"><span>{template.Source === "platform" ? "Типовий шаблон платформи" : statusLabels[template.Status]}</span>{template.Source === "platform" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => customizeManageInAppTemplate(eventID, template), "Створено чернетку для події")}>Налаштувати для події</button>}{template.Source === "event" && template.Status === "published" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => rollbackManageInAppTemplate(eventID, template), "Створено чернетку з опублікованої версії")}>Редагувати копію</button>}{template.Source === "event" && template.Status === "unpublished" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => rollbackManageInAppTemplate(eventID, template), "Створено чернетку з попередньої версії")}>Відновити як чернетку</button>}</div>
                        <div className="event-manage-notifications__editor"><div className="event-manage-notifications__fields"><label className="event-manage-field"><span>Заголовок<span className="event-field-required">*</span></span><input className="event-manage-input" value={draft.Title} disabled={!editable} maxLength={200} onChange={e => setDrafts(current => ({...current, [template.ID]: {...draft, Title: e.target.value}}))} /></label><label className="event-manage-field"><span>Текст<span className="event-field-required">*</span></span><textarea className="event-manage-input" rows={5} value={draft.Body} disabled={!editable} onChange={e => setDrafts(current => ({...current, [template.ID]: {...draft, Body: e.target.value}}))} /></label><label className="event-manage-field"><ManageFieldLabel title="Посилання" help="Якщо вказати адресу сторінки події, натискання на сповіщення відкриє її. Залиште поле порожнім, якщо перехід не потрібен." /><input className="event-manage-input" value={draft.Link} disabled={!editable} onChange={e => setDrafts(current => ({...current, [template.ID]: {...draft, Link: e.target.value}}))} placeholder="Без переходу" /></label></div><div className="event-manage-notifications__preview"><h3>Попередній вигляд</h3><NotificationMessageCard icon={draft.Icon} tone={draft.Tone} accentColor={draft.AccentColor} title={previewText(draft.Title || "Заголовок сповіщення", event.Name)} body={previewText(draft.Body || "Текст сповіщення", event.Name)} /><small>Інші змінні заповняться під час надсилання.</small></div></div>
                        {editable && <div className="event-manage-notifications__footer">{dirty && <span>Є незбережені зміни</span>}<div><button className="ib-btn" type="button" disabled={!dirty || !valid || busy} onClick={() => void mutateTemplate(() => updateManageInAppTemplate(eventID, template.ID, draft), "Чернетку збережено")}>Зберегти чернетку</button><button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !valid || busy} onClick={() => void mutateTemplate(() => publishManageInAppTemplate(eventID, template), "Шаблон опубліковано")}>Опублікувати</button></div></div>}
                    </> : <div className="event-manage-notifications__empty"><Bell size={22} /><p>Для цього типу ще немає шаблону на сайті.</p>{canManage && <button className="ib-btn" type="button" disabled={busy} onClick={() => void mutateTemplate(() => createManageInAppTemplate(eventID, {NotificationType: signal, Title: signalLabels[signal].title, Body: signalLabels[signal].description, Link: "", Icon: "bell", Tone: "info", AccentColor: "", Surface: "inbox", AutoDismissMs: 5000, Actions: [], Dismissible: true}), "Створено чернетку")}>Створити шаблон</button>}</div>}
                </section>
            </div>
        </div>
    </div>;
}
