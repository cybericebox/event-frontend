"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    defaultPortByTLSMode, deleteEventMailSMTP, getEventMailSettings, mailSettingsError, mailSettingsForm,
    mailSettingsInput, mailTransportLabel, putEventMailSettings, putEventMailSMTP, smtpError, smtpForm, smtpInput,
    testEventMailSMTP, tlsModeOptions, type EventMailSettings, type MailSettingsForm, type MailTestResult,
    type MailTLSMode, type SMTPForm,
} from "@/api/manageMail";
import {EventLoading} from "@/components/event/EventLoading";
import {DialogModal} from "@/components/event/DialogModal";
import {EventSelect} from "@/components/ui/EventSelect";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {useManager} from "./ManagerShell";

function errorText(error: unknown, fallback: string) {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}

export function MailSettingsPanel() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const queryKey = ["event-manage-mail", eventID];
    const query = useQuery({queryKey, queryFn: () => getEventMailSettings(eventID), refetchOnWindowFocus: false});
    const [settingsDraft, setSettingsDraft] = useState<MailSettingsForm | null>(null);
    const [smtpDraft, setSMTPDraft] = useState<SMTPForm | null>(null);
    const [busy, setBusy] = useState<"settings" | "smtp" | "test" | "reset" | null>(null);
    const [test, setTest] = useState<MailTestResult | null>(null);
    const [confirmReset, setConfirmReset] = useState(false);

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо налаштування пошти…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити налаштування пошти</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    const settings = query.data;
    const savedSettings = mailSettingsForm(settings);
    const settingsForm = settingsDraft ?? savedSettings;
    const settingsDirty = JSON.stringify(settingsForm) !== JSON.stringify(savedSettings);
    const settingsValidation = mailSettingsError(settingsForm);
    const savedSMTP = smtpForm(settings.SMTP);
    const form = smtpDraft ?? savedSMTP;
    const smtpDirty = JSON.stringify(form) !== JSON.stringify(savedSMTP);
    const smtpValidation = smtpError(form);
    const disabled = !canManage || busy !== null;
    const hours = Number(settingsForm.startReminderHours);
    const canTest = canManage && ((!smtpDirty && !!settings.SMTP) || !smtpValidation);

    function applied(next: EventMailSettings) {
        queryClient.setQueryData(queryKey, next);
    }

    function changeSMTP(patch: Partial<SMTPForm>) {
        setSMTPDraft({...form, ...patch});
        setTest(null);
    }

    function changeTLS(value: string) {
        const tlsMode = value as MailTLSMode;
        const other = tlsMode === "tls" ? "starttls" : "tls";
        // Follow the mode with its usual port unless a custom port was typed.
        const port = !form.port.trim() || form.port.trim() === String(defaultPortByTLSMode[other]) ? String(defaultPortByTLSMode[tlsMode]) : form.port;
        changeSMTP({tlsMode, port});
    }

    async function saveSettings(submit: FormEvent<HTMLFormElement>) {
        submit.preventDefault();
        if (disabled || !settingsDirty || settingsValidation) return;
        setBusy("settings");
        try {
            applied(await putEventMailSettings(eventID, mailSettingsInput(settingsForm)));
            setSettingsDraft(null);
            toast.success("Налаштування пошти збережено");
        } catch (error) {toast.error(errorText(error, "Не вдалося зберегти налаштування пошти."));}
        finally {setBusy(null);}
    }

    async function saveSMTP(submit: FormEvent<HTMLFormElement>) {
        submit.preventDefault();
        if (disabled || !smtpDirty || smtpValidation) return;
        setBusy("smtp");
        try {
            applied(await putEventMailSMTP(eventID, smtpInput(form)));
            setSMTPDraft(null);
            toast.success("SMTP події збережено");
        } catch (error) {toast.error(errorText(error, "Не вдалося зберегти SMTP."));}
        finally {setBusy(null);}
    }

    async function runTest() {
        if (disabled) return;
        // Typed values are tested as-is (an empty password means the stored one);
        // an untouched form with a stored SMTP tests the stored settings ({}).
        if (!canTest) return;
        const input = !smtpDirty && settings.SMTP ? null : smtpInput(form);
        setBusy("test");
        setTest(null);
        try {setTest(await testEventMailSMTP(eventID, input));}
        catch (error) {toast.error(errorText(error, "Не вдалося перевірити підключення."));}
        finally {setBusy(null);}
    }

    async function resetSMTP() {
        if (disabled) return;
        setBusy("reset");
        try {
            applied(await deleteEventMailSMTP(eventID));
            setSMTPDraft(null);
            setTest(null);
            setConfirmReset(false);
            toast.success("Листи йдуть через платформний SMTP");
        } catch (error) {toast.error(errorText(error, "Не вдалося вимкнути SMTP події."));}
        finally {setBusy(null);}
    }

    return <div className="event-manage-mail__panel">
        {!canManage && <p className="event-manage-notice">Доступний лише перегляд.</p>}
        <section className="event-manage-section" aria-labelledby="mail-sender-title">
            <div className="event-manage-section__head"><h2 id="mail-sender-title">Відправник</h2><p>Так листи учасникам виглядають у поштовій скриньці.</p></div>
            <dl className="event-manage-mail__facts">
                <div><dt>Від</dt><dd>{settings.SenderName} <span>&lt;{settings.SenderAddress}&gt;</span></dd></div>
                <div><dt>Відповідь на</dt><dd>{settings.ReplyTo || "—"}</dd></div>
            </dl>
            {!settings.PlatformConfigured && !settings.SMTP && <p className="event-manage-feedback event-manage-feedback--error" role="alert">Платформну пошту не налаштовано. Без власного SMTP листи не надсилаються.</p>}
        </section>

        <form className="event-manage-section" onSubmit={saveSettings} aria-labelledby="mail-contact-title">
            <div className="event-manage-section__head"><h2 id="mail-contact-title">Контакт і нагадування</h2></div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-contact" title="Контактна пошта" help="Адреса для відповідей учасників (Reply-To). Якщо поле порожнє, відповіді йдуть у підтримку платформи." />
                    <input id="mail-contact" className="event-manage-input" type="email" value={settingsForm.contactEmail} placeholder="Підтримка платформи" disabled={disabled} maxLength={254} onChange={change => setSettingsDraft({...settingsForm, contactEmail: change.target.value})} />
                    <small>Порожньо — адреса підтримки платформи.</small>
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-reminder" title="Нагадування про старт" help="За скільки годин до початку надіслати учасникам нагадування. 0 — не надсилати." />
                    <input id="mail-reminder" className="event-manage-input" type="number" inputMode="numeric" min={0} max={168} step={1} value={settingsForm.startReminderHours} disabled={disabled} onChange={change => setSettingsDraft({...settingsForm, startReminderHours: change.target.value})} />
                    <small>{!settingsValidation && hours === 0 ? "Вимкнено" : "Годин до старту, від 0 до 168"}</small>
                </div>
            </div>
            {settingsDirty && settingsValidation && <p className="event-manage-validation" role="alert">{settingsValidation}</p>}
            {canManage && settingsDirty && <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !!settingsValidation}>{busy === "settings" ? "Зберігаємо…" : "Зберегти"}</button></div>}
        </form>

        <form className="event-manage-section" onSubmit={saveSMTP} aria-labelledby="mail-smtp-title">
            <div className="event-manage-section__head"><h2 id="mail-smtp-title">Власний SMTP</h2><p>{settings.SMTP ? `Листи учасникам йдуть через ${settings.SMTP.Host}:${settings.SMTP.Port}.` : "Не налаштовано — листи йдуть через платформний SMTP."} Якщо SMTP події не відповідає, лист повторно надсилається через платформний.</p></div>
            <div className="event-manage-mail__smtp">
                <div className="event-manage-field event-manage-mail__host">
                    <ManageFieldLabel htmlFor="mail-smtp-host" title="Хост" help="Адреса SMTP-сервера, наприклад smtp.example.com." />
                    <input id="mail-smtp-host" className="event-manage-input" value={form.host} placeholder="smtp.example.com" autoComplete="off" spellCheck={false} disabled={disabled} onChange={change => changeSMTP({host: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-port" title="Порт" help="Зазвичай 587 для STARTTLS і 465 для TLS." />
                    <input id="mail-smtp-port" className="event-manage-input" type="number" inputMode="numeric" min={1} max={65535} value={form.port} disabled={disabled} onChange={change => changeSMTP({port: change.target.value})} />
                </div>
                <label className="event-manage-field">Шифрування<EventSelect ariaLabel="Шифрування" value={form.tlsMode} options={tlsModeOptions} disabled={disabled} onValueChange={changeTLS} /></label>
            </div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-username" title="Користувач" help="Логін для автентифікації на SMTP-сервері." />
                    <input id="mail-smtp-username" className="event-manage-input" value={form.username} autoComplete="off" spellCheck={false} disabled={disabled} onChange={change => changeSMTP({username: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-password" title="Пароль" help="Пароль не показується після збереження. Порожнє поле залишає збережений пароль." />
                    <input id="mail-smtp-password" className="event-manage-input" type="password" value={form.password} autoComplete="new-password" placeholder={settings.SMTP?.PasswordSet && !form.clearPassword ? "Пароль збережено" : ""} disabled={disabled || form.clearPassword} onChange={change => changeSMTP({password: change.target.value})} />
                    {settings.SMTP?.PasswordSet && <div className="event-manage-mail__password">
                        <small>{form.clearPassword ? "Пароль буде видалено після збереження." : "Пароль збережено. Залиште поле порожнім, щоб не змінювати."}</small>
                        {canManage && <button className="ib-btn ib-btn--sm ib-btn--ghost" type="button" disabled={disabled} onClick={() => changeSMTP({clearPassword: !form.clearPassword, password: ""})}>{form.clearPassword ? "Залишити пароль" : "Видалити пароль"}</button>}
                    </div>}
                </div>
            </div>
            {smtpDirty && smtpValidation && <p className="event-manage-validation" role="alert">{smtpValidation}</p>}
            {test && <div className={`event-manage-mail__result${test.Sent ? "" : " is-error"}`} role="status">
                <strong>{test.Sent ? "Підключення працює" : "Не вдалося надіслати"}</strong>
                <span>{test.Sent ? `Тестовий лист надіслано на ${test.Recipient}${test.Transport ? ` · ${mailTransportLabel(test.Transport)}` : ""}.` : test.Error || "Сервер не прийняв лист."}</span>
            </div>}
            {canManage && <div className="event-manage-section__actions event-manage-mail__actions">
                {settings.SMTP && <button className="ib-btn" type="button" disabled={disabled} onClick={() => setConfirmReset(true)}>Використовувати платформний SMTP</button>}
                <button className="ib-btn" type="button" disabled={disabled || !canTest} onClick={() => void runTest()}>{busy === "test" ? "Перевіряємо…" : "Перевірити підключення"}</button>
                <button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !smtpDirty || !!smtpValidation}>{busy === "smtp" ? "Зберігаємо…" : "Зберегти"}</button>
            </div>}
        </form>

        <DialogModal open={confirmReset} onClose={() => {if (busy !== "reset") setConfirmReset(false);}} title="Використовувати платформний SMTP?" description="Налаштування SMTP події та збережений пароль буде видалено. Листи учасникам надсилатиме платформа."
            footer={<><button className="ib-btn" type="button" disabled={busy === "reset"} onClick={() => setConfirmReset(false)}>Скасувати</button><button className="ib-btn ib-btn--primary" type="button" disabled={busy === "reset"} onClick={() => void resetSMTP()}>{busy === "reset" ? "Перемикаємо…" : "Перейти на платформний"}</button></>}>
            <p className="event-manage-mail__hint">Відправник і контактна пошта не зміняться.</p>
        </DialogModal>
    </div>;
}
