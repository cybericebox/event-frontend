"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Mail, RotateCcw, Send} from "lucide-react";
import {toast} from "react-hot-toast";
import {
    createManageEmailTemplate, customizeManageEmailTemplate, getManageEmailTemplates,
    getManageEmailImageURL, uploadManageEmailImage,
    previewManageEmailTemplate, publishManageEmailTemplate, resetManageEmailTemplate,
    rollbackManageEmailTemplate, sendManageEmailTemplateTest, updateManageEmailTemplate,
    type ManageEmailTemplate, type ManageEmailTemplateInput,
} from "@/api/manageEmailTemplates";
import {
    getManageNotificationSubscriptions, putManageNotificationSubscription,
    resetManageNotificationSubscription, channelSignals, signalGroups, signalLabel,
} from "@/api/manageNotifications";
import {EventLoading} from "@/components/event/EventLoading";
import {EmailBlocksEditor} from "@/components/event/manage/EmailBlocksEditor";
import {EmailStylingEditor} from "@/components/event/manage/EmailStylingEditor";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {emailRichText, emailRichTextBlock} from "@/components/event/manage/emailBlocks";

const statuses = {draft: "Чернетка", published: "Опублікована", unpublished: "Попередня версія"};

function inputOf(template: ManageEmailTemplate): ManageEmailTemplateInput {
    return {NotificationType: template.NotificationType, Subject: template.Subject, Preheader: template.Preheader, Body: template.Body, Styling: template.Styling};
}

function versionsOf(items: ManageEmailTemplate[], signal: string) {
    return items.filter(item => item.NotificationType === signal).sort((a, b) => {
        const rank = (item: ManageEmailTemplate) => item.Status === "draft" ? 0 : item.Status === "published" ? 1 : 2;
        return rank(a) - rank(b) || b.UpdatedAt.localeCompare(a.UpdatedAt);
    });
}

export default function ManageEmailPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const subscriptions = useQuery({queryKey: ["event-manage-notification-subscriptions", eventID], queryFn: () => getManageNotificationSubscriptions(eventID), refetchOnWindowFocus: false});
    const templates = useQuery({queryKey: ["event-manage-email-templates", eventID], queryFn: () => getManageEmailTemplates(eventID), refetchOnWindowFocus: false});
    const [selectedSignal, setSignal] = useState("");
    const signals = channelSignals(subscriptions.data ?? [], "email");
    const signal = signals.includes(selectedSignal) ? selectedSignal : signals[0] ?? "";
    const label = signalLabel(signal);
    const [testResult, setTestResult] = useState<{templateID: string; message: string} | null>(null);
    const [testing, setTesting] = useState(false);
    const [selectedTemplateID, setSelectedTemplateID] = useState("");
    const [drafts, setDrafts] = useState<Record<string, ManageEmailTemplateInput>>({});
    const [previewDraft, setPreviewDraft] = useState<{templateID: string; input: ManageEmailTemplateInput} | null>(null);
    const [busy, setBusy] = useState(false);
    const versions = versionsOf(templates.data ?? [], signal);
    const template = versions.find(item => item.ID === selectedTemplateID) ?? versions[0];
    const subscription = subscriptions.data?.find(item => item.SignalType === signal && item.Channel === "email");
    const saved = template ? inputOf(template) : null;
    const draft = template ? drafts[template.ID] ?? saved : null;
    const dirty = !!(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
    const validation = !draft?.Subject.trim() ? "Додайте тему листа."
        : !draft.Body.length || !draft.Body.some(block => block.type === "rich_text" && emailRichText(block).trim() || block.type === "button" || block.type === "image" || block.type === "preset") ? "Додайте вміст листа."
        : draft.Body.some(block => block.type === "button" && (!String(block.label ?? "").trim() || !String(block.url ?? "").trim())) ? "Заповніть текст і посилання кожної кнопки."
        : "";
    const valid = !validation;
    const editable = !!(canManage && template?.Source === "event" && template.Status === "draft" && !busy);
    const previewInput = template && draft ? previewDraft?.templateID === template.ID ? previewDraft.input : saved : null;
    const previewStale = !!(dirty && (!previewDraft || previewDraft.templateID !== template?.ID || JSON.stringify(previewDraft.input) !== JSON.stringify(draft)));
    const preview = useQuery({
        queryKey: ["event-manage-email-preview", eventID, template?.ID, previewInput && JSON.stringify(previewInput)],
        queryFn: () => previewManageEmailTemplate(eventID, previewInput!),
        enabled: !!previewInput, retry: false, refetchOnWindowFocus: false,
    });

    function change(input: ManageEmailTemplateInput) {
        if (!template) return;
        setDrafts(current => ({...current, [template.ID]: input}));
    }

    async function addImage(file: File) {
        if (!template || !editable) return;
        const target = template;
        setBusy(true);
        try {
            const uploaded = await uploadManageEmailImage(eventID, target.ID, file);
            setDrafts(current => {
                const input = current[target.ID] ?? inputOf(target);
                return {...current, [target.ID]: {...input, Body: [...input.Body, {type: "image", file_id: uploaded.FileID, alt: file.name.replace(/\.[^.]+$/, ""), width_pct: 100}]}};
            });
            toast.success("Зображення додано до чернетки");
        } catch {toast.error("Не вдалося додати зображення. Використайте PNG, JPEG або GIF до 10 МБ.");}
        finally {setBusy(false);}
    }

    async function run(action: () => Promise<unknown>, success: string, failure: string) {
        if (!canManage || busy) return;
        setBusy(true);
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-manage-notification-subscriptions", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-manage-email-templates", eventID]}),
            ]);
            toast.success(success);
        } catch {toast.error(failure);}
        finally {setBusy(false);}
    }

    async function sendTest(target: ManageEmailTemplate) {
        if (!canManage || testing) return;
        setTesting(true);
        try {
            const result = await sendManageEmailTemplateTest(eventID, target.ID);
            setTestResult({templateID: target.ID, message: `Надіслано на ${result.Recipient}. Результат — у журналі відправлення.`});
        } catch {toast.error("Не вдалося надіслати тестовий лист.");}
        finally {setTesting(false);}
    }

    async function mutateTemplate(action: () => Promise<ManageEmailTemplate>, success: string) {
        await run(async () => {
            const result = await action();
            setSelectedTemplateID(result.ID);
            setPreviewDraft(null);
            setDrafts(current => {const next = {...current}; delete next[result.ID]; return next;});
        }, success, "Не вдалося оновити шаблон листа. Перевірте дані й повторіть спробу.");
    }

    if (subscriptions.isPending || templates.isPending) return <EventLoading event={event} label="Завантажуємо електронні листи…" />;
    if (subscriptions.isError || templates.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити електронні листи</h1><button className="ib-btn" type="button" onClick={() => {void subscriptions.refetch(); void templates.refetch();}}>Повторити</button></div>;
    if (!signals.length) return <div className="event-manage-content event-manage-notifications event-manage-email"><header className="event-manage-heading"><div><h1>Електронні листи</h1></div></header><section className="event-manage-section"><p className="event-challenge-manager__empty">Для цієї події немає електронних листів.</p></section></div>;

    return <div className="event-manage-content event-manage-notifications event-manage-email">
        <header className="event-manage-heading"><div><h1>Електронні листи</h1><p>Керуйте надсиланням і вмістом листів для учасників події.</p></div></header>
        <div className="event-manage-notifications__layout">
            <nav className="event-manage-section event-manage-notifications__list" aria-label="Події для електронних листів">{signalGroups(signals).map(({group, signals: items}) => <div className="event-manage-notifications__group" key={group}><h2>{group}</h2>{items.map(item => {
                const row = subscriptions.data.find(entry => entry.SignalType === item && entry.Channel === "email");
                return <button className={`event-manage-notifications__item${signal === item ? " is-selected" : ""}`} type="button" key={item} aria-current={signal === item ? "true" : undefined} onClick={() => {setSignal(item); setSelectedTemplateID(""); setPreviewDraft(null);}}><span>{signalLabel(item).title}</span><small>{row?.Required ? "Обовʼязкове" : row?.Enabled ? "Увімкнено" : "Вимкнено"}</small></button>;
            })}</div>)}</nav>
            <div className="event-manage-notifications__main">
                <section className="event-manage-section"><div className="event-manage-section__head"><h2>{label.title}</h2>{label.description && <p>{label.description}</p>}</div>{subscription?.Required ? <div className="event-manage-notifications__delivery"><div><ManageFieldLabel title="Надсилати лист" help="Лист із запрошенням надсилається завжди, його не можна вимкнути. Шаблон листа можна налаштувати." /><small>Надсилається завжди</small></div><div className="event-manage-notifications__delivery-actions"><span className="event-manage-notifications__required">Обовʼязкове</span></div></div> : subscription ? <div className="event-manage-notifications__delivery"><div><ManageFieldLabel title="Надсилати лист" help="Коли подія спрацює, лист отримає учасник, якого вона стосується. Вимкнення не видаляє шаблон листа." /><small>{subscription.Source === "event" ? "Налаштування цієї події" : "Загальне налаштування платформи"}</small></div><div className="event-manage-notifications__delivery-actions"><label className="event-manage-form__switch"><input type="checkbox" checked={subscription.Enabled} disabled={!canManage || busy} onChange={e => void run(() => putManageNotificationSubscription(eventID, {...subscription, Enabled: e.target.checked}), "Надсилання листа оновлено", "Не вдалося змінити надсилання листа.")} /><span>{subscription.Enabled ? "Увімкнено" : "Вимкнено"}</span></label>{subscription.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void run(() => resetManageNotificationSubscription(eventID, signal, "email"), "Повернуто загальне налаштування", "Не вдалося скинути налаштування.")}><RotateCcw size={15} /> Скинути</button>}</div></div> : <p className="event-manage-notifications__empty">Для цього типу немає налаштування надсилання.</p>}</section>
                <section className="event-manage-section"><div className="event-manage-notifications__template-head"><div className="event-manage-section__head"><h2>Шаблон листа</h2><p>Чернетка не впливає на вже опублікований лист. Вона почне діяти після публікації.</p></div>{template?.Source === "event" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy || dirty} onClick={() => void run(async () => {await resetManageEmailTemplate(eventID, signal); setSelectedTemplateID(""); setPreviewDraft(null);}, "Повернуто шаблон платформи", "Не вдалося повернути типовий шаблон.")}><RotateCcw size={15} /> Повернути типовий</button>}</div>
                    {versions.length > 1 && <div className="event-manage-notifications__versions" aria-label="Версії шаблону">{versions.map(item => <button className={`event-manage-notifications__version${template?.ID === item.ID ? " is-selected" : ""}`} type="button" key={item.ID} onClick={() => {setSelectedTemplateID(item.ID); setPreviewDraft(null);}}>{statuses[item.Status]} · {new Date(item.UpdatedAt).toLocaleDateString("uk-UA")}</button>)}</div>}
                    {template && draft ? <><div className="event-manage-notifications__state"><span>{template.Source === "platform" ? "Типовий шаблон платформи" : statuses[template.Status]}</span>{template.Source === "platform" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => customizeManageEmailTemplate(eventID, template), "Створено чернетку для події")}>Налаштувати для події</button>}{template.Source === "event" && template.Status !== "draft" && canManage && <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => void mutateTemplate(() => rollbackManageEmailTemplate(eventID, template), "Створено чернетку з вибраної версії")}>{template.Status === "published" ? "Редагувати копію" : "Відновити як чернетку"}</button>}</div>
                        <div className="event-manage-fields-two"><div className="event-manage-field"><ManageFieldLabel title="Тема листа" help="Рядок, який учасник побачить у списку вхідних листів. Можна використати змінну {{.event_name}} для назви події." htmlFor="event-email-subject" required /><input className="event-manage-input" id="event-email-subject" value={draft.Subject} disabled={!editable} onChange={e => change({...draft, Subject: e.target.value})} /></div><div className="event-manage-field"><ManageFieldLabel title="Короткий опис" help="Показується після теми в деяких поштових програмах. Поле можна залишити порожнім." htmlFor="event-email-preheader" /><input className="event-manage-input" id="event-email-preheader" value={draft.Preheader} disabled={!editable} onChange={e => change({...draft, Preheader: e.target.value})} placeholder="Необов’язково" /></div></div>
                        <EmailBlocksEditor blocks={draft.Body} disabled={!editable} onChange={blocks => change({...draft, Body: blocks})} onUploadImage={addImage} imageURL={fileID => getManageEmailImageURL(eventID, fileID)} />
                        {editable && validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                        <EmailStylingEditor styling={draft.Styling} disabled={!editable} onChange={styling => change({...draft, Styling: styling})} />
                        <div className="event-email-preview"><div className="event-email-preview__head"><div><h3>Попередній вигляд листа</h3><p>Змінні показано на прикладі. Після редагування натисніть «Оновити вигляд».</p></div><button className="ib-btn ib-btn--sm" type="button" disabled={preview.isFetching || !valid} onClick={() => setPreviewDraft({templateID: template.ID, input: draft})}>Оновити вигляд</button></div>{previewStale && <p className="event-email-preview__stale">Зміни ще не відображено в перегляді.</p>}{preview.isPending || preview.isFetching ? <p>Готуємо попередній вигляд…</p> : preview.isError ? <div className="event-manage-feedback event-manage-feedback--error" role="alert">Не вдалося показати лист. Перевірте його вміст і повторіть спробу.</div> : <iframe title="Попередній вигляд електронного листа" sandbox="" srcDoc={preview.data.HTML} />}</div>
                        {canManage && <div className="event-email-test"><div><strong>Тестовий лист</strong><p>{dirty ? "Буде надіслано збережену версію шаблону, без незбережених змін." : "Лист із прикладами змінних прийде на вашу адресу."}</p>{testResult?.templateID === template.ID && <p className="event-email-test__result" role="status">{testResult.message}</p>}</div><button className="ib-btn ib-btn--sm" type="button" disabled={testing || busy} onClick={() => void sendTest(template)}><Send size={15} /> {testing ? "Надсилаємо…" : "Надіслати тест собі"}</button></div>}
                        {editable && <div className="event-manage-notifications__footer">{dirty && <span>Є незбережені зміни</span>}<div><button className="ib-btn" type="button" disabled={!dirty || !valid || busy} onClick={() => void mutateTemplate(() => updateManageEmailTemplate(eventID, template.ID, draft), "Чернетку листа збережено")}>Зберегти чернетку</button><button className="ib-btn ib-btn--primary" type="button" disabled={dirty || !valid || busy} onClick={() => void mutateTemplate(() => publishManageEmailTemplate(eventID, template), "Шаблон листа опубліковано")}>Опублікувати</button></div></div>}
                    </> : <div className="event-manage-notifications__empty"><Mail size={22} /><p>Для цього типу ще немає шаблону листа.</p>{canManage && <button className="ib-btn" type="button" disabled={busy} onClick={() => void mutateTemplate(() => createManageEmailTemplate(eventID, {NotificationType: signal, Subject: label.title, Preheader: "", Body: [emailRichTextBlock(label.description || label.title)], Styling: {}}), "Створено чернетку листа")}>Створити шаблон</button>}</div>}
                </section>
            </div>
        </div>
    </div>;
}
