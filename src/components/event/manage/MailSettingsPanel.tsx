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
import {t} from "@/i18n/t";
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

    if (query.isPending) return <EventLoading event={event} label={t("manage.mail.settings.loading")} />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.mail.settings.loadError")}</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>{t("common.retry")}</button></div>;

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
            toast.success(t("manage.mail.settings.saved"));
        } catch (error) {toast.error(errorText(error, t("manage.mail.settings.saveError")));}
        finally {setBusy(null);}
    }

    async function saveSMTP(submit: FormEvent<HTMLFormElement>) {
        submit.preventDefault();
        if (disabled || !smtpDirty || smtpValidation) return;
        setBusy("smtp");
        try {
            applied(await putEventMailSMTP(eventID, smtpInput(form)));
            setSMTPDraft(null);
            toast.success(t("manage.mail.smtp.saved"));
        } catch (error) {toast.error(errorText(error, t("manage.mail.smtp.saveError")));}
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
        catch (error) {toast.error(errorText(error, t("manage.mail.smtp.testError")));}
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
            toast.success(t("manage.mail.smtp.resetDone"));
        } catch (error) {toast.error(errorText(error, t("manage.mail.smtp.resetError")));}
        finally {setBusy(null);}
    }

    return <div className="event-manage-mail__panel">
        {!canManage && <p className="event-manage-notice">{t("common.viewOnly")}</p>}
        <section className="event-manage-section" aria-labelledby="mail-sender-title">
            <div className="event-manage-section__head"><h2 id="mail-sender-title">{t("manage.mail.sender.title")}</h2><p>{t("manage.mail.sender.intro")}</p></div>
            <dl className="event-manage-mail__facts">
                <div><dt>{t("manage.mail.sender.from")}</dt><dd>{settings.SenderName} <span>&lt;{settings.SenderAddress}&gt;</span></dd></div>
                <div><dt>{t("manage.mail.sender.replyTo")}</dt><dd>{settings.ReplyTo || "—"}</dd></div>
            </dl>
            {!settings.PlatformConfigured && !settings.SMTP && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{t("manage.mail.sender.notConfigured")}</p>}
        </section>

        <form className="event-manage-section" onSubmit={saveSettings} aria-labelledby="mail-contact-title">
            <div className="event-manage-section__head"><h2 id="mail-contact-title">{t("manage.mail.contact.title")}</h2></div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-contact" title={t("manage.mail.contact.email")} help={t("manage.mail.contact.emailHelp")} />
                    <input id="mail-contact" className="event-manage-input" type="email" value={settingsForm.contactEmail} placeholder={t("manage.mail.contact.emailPlaceholder")} disabled={disabled} maxLength={254} onChange={change => setSettingsDraft({...settingsForm, contactEmail: change.target.value})} />
                    <small>{t("manage.mail.contact.emailHint")}</small>
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-reminder" title={t("manage.mail.contact.reminder")} help={t("manage.mail.contact.reminderHelp")} />
                    <input id="mail-reminder" className="event-manage-input" type="number" inputMode="numeric" min={0} max={168} step={1} value={settingsForm.startReminderHours} disabled={disabled} onChange={change => setSettingsDraft({...settingsForm, startReminderHours: change.target.value})} />
                    <small>{t(!settingsValidation && hours === 0 ? "manage.mail.contact.reminderOff" : "manage.mail.contact.reminderHint")}</small>
                </div>
            </div>
            {settingsDirty && settingsValidation && <p className="event-manage-validation" role="alert">{settingsValidation}</p>}
            {canManage && settingsDirty && <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !!settingsValidation}>{t(busy === "settings" ? "common.saving" : "common.save")}</button></div>}
        </form>

        <form className="event-manage-section" onSubmit={saveSMTP} aria-labelledby="mail-smtp-title">
            <div className="event-manage-section__head"><h2 id="mail-smtp-title">{t("manage.mail.smtp.title")}</h2><p>{settings.SMTP ? t("manage.mail.smtp.via", {host: settings.SMTP.Host, port: settings.SMTP.Port}) : t("manage.mail.smtp.notConfigured")} {t("manage.mail.smtp.fallbackNote")}</p></div>
            <div className="event-manage-mail__smtp">
                <div className="event-manage-field event-manage-mail__host">
                    <ManageFieldLabel htmlFor="mail-smtp-host" title={t("manage.mail.smtp.host")} help={t("manage.mail.smtp.hostHelp")} />
                    <input id="mail-smtp-host" className="event-manage-input" value={form.host} placeholder="smtp.example.com" autoComplete="off" spellCheck={false} disabled={disabled} onChange={change => changeSMTP({host: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-port" title={t("manage.mail.smtp.port")} help={t("manage.mail.smtp.portHelp")} />
                    <input id="mail-smtp-port" className="event-manage-input" type="number" inputMode="numeric" min={1} max={65535} value={form.port} disabled={disabled} onChange={change => changeSMTP({port: change.target.value})} />
                </div>
                <label className="event-manage-field">{t("manage.mail.smtp.encryption")}<EventSelect ariaLabel={t("manage.mail.smtp.encryption")} value={form.tlsMode} options={tlsModeOptions} disabled={disabled} onValueChange={changeTLS} /></label>
            </div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-username" title={t("manage.mail.smtp.username")} help={t("manage.mail.smtp.usernameHelp")} />
                    <input id="mail-smtp-username" className="event-manage-input" value={form.username} autoComplete="off" spellCheck={false} disabled={disabled} onChange={change => changeSMTP({username: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-password" title={t("manage.mail.smtp.password")} help={t("manage.mail.smtp.passwordHelp")} />
                    <input id="mail-smtp-password" className="event-manage-input" type="password" value={form.password} autoComplete="new-password" placeholder={settings.SMTP?.PasswordSet && !form.clearPassword ? t("manage.mail.smtp.passwordSaved") : ""} disabled={disabled || form.clearPassword} onChange={change => changeSMTP({password: change.target.value})} />
                    {settings.SMTP?.PasswordSet && <div className="event-manage-mail__password">
                        <small>{t(form.clearPassword ? "manage.mail.smtp.passwordWillClear" : "manage.mail.smtp.passwordKeep")}</small>
                        {canManage && <button className="ib-btn ib-btn--sm ib-btn--ghost" type="button" disabled={disabled} onClick={() => changeSMTP({clearPassword: !form.clearPassword, password: ""})}>{t(form.clearPassword ? "manage.mail.smtp.keepPassword" : "manage.mail.smtp.clearPassword")}</button>}
                    </div>}
                </div>
            </div>
            {smtpDirty && smtpValidation && <p className="event-manage-validation" role="alert">{smtpValidation}</p>}
            {test && <div className={`event-manage-mail__result${test.Sent ? "" : " is-error"}`} role="status">
                <strong>{t(test.Sent ? "manage.mail.smtp.testOk" : "manage.mail.smtp.testFailed")}</strong>
                <span>{test.Sent ? (test.Transport ? t("manage.mail.smtp.testSentVia", {recipient: test.Recipient, transport: mailTransportLabel(test.Transport)}) : t("manage.mail.smtp.testSent", {recipient: test.Recipient})) : test.Error || t("manage.mail.smtp.testRejected")}</span>
            </div>}
            {canManage && <div className="event-manage-section__actions event-manage-mail__actions">
                {settings.SMTP && <button className="ib-btn" type="button" disabled={disabled} onClick={() => setConfirmReset(true)}>{t("manage.mail.smtp.usePlatform")}</button>}
                <button className="ib-btn" type="button" disabled={disabled || !canTest} onClick={() => void runTest()}>{t(busy === "test" ? "manage.mail.smtp.testing" : "manage.mail.smtp.test")}</button>
                <button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !smtpDirty || !!smtpValidation}>{t(busy === "smtp" ? "common.saving" : "common.save")}</button>
            </div>}
        </form>

        <DialogModal open={confirmReset} onClose={() => {if (busy !== "reset") setConfirmReset(false);}} title={t("manage.mail.smtp.resetTitle")} description={t("manage.mail.smtp.resetDescription")}
            footer={<><button className="ib-btn" type="button" disabled={busy === "reset"} onClick={() => setConfirmReset(false)}>{t("common.cancel")}</button><button className="ib-btn ib-btn--primary" type="button" disabled={busy === "reset"} onClick={() => void resetSMTP()}>{t(busy === "reset" ? "manage.mail.smtp.switching" : "manage.mail.smtp.switch")}</button></>}>
            <p className="event-manage-mail__hint">{t("manage.mail.smtp.resetHint")}</p>
        </DialogModal>
    </div>;
}
