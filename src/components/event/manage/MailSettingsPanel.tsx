"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    defaultPortByTLSMode, deleteEventMailSMTP, getEventMailSettings, identityError, identityForm, identityInput,
    mailTransportLabel, maxMailNameLength, withLimitSource, withSource, putEventMailIdentity, putEventMailSMTP, smtpError, smtpForm, smtpInput,
    testEventMailSMTP, tlsModeOptions, type EventMailSettings, type IdentityForm, type MailTestResult,
    type MailTLSMode, type SMTPForm,
} from "@/api/manageMail";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {useManager} from "./ManagerShell";
import {EventButton} from "@/components/ui/EventButton";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {PasswordInput} from "@/components/ui/PasswordInput";
import {EventNumberInput} from "@/components/ui/EventNumberInput";

function errorText(error: unknown, fallback: string) {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}

export function MailSettingsPanel() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const queryKey = ["event-manage-mail", eventID];
    const query = useQuery({queryKey, queryFn: () => getEventMailSettings(eventID), refetchOnWindowFocus: false});
    const [identityDraft, setIdentityDraft] = useState<IdentityForm | null>(null);
    const [smtpDraft, setSMTPDraft] = useState<SMTPForm | null>(null);
    const [busy, setBusy] = useState<"identity" | "smtp" | "test" | "reset" | null>(null);
    const [test, setTest] = useState<MailTestResult | null>(null);
    const [confirmReset, setConfirmReset] = useState(false);
    const [resetError, setResetError] = useState("");

    if (query.isPending) return <EventLoading event={event} label={t("manage.mail.settings.loading")} />;
    if (query.isError) return <EventLoadError message={t("manage.mail.settings.loadError")} error={query.error} onRetry={() => void query.refetch()} />;

    const settings = query.data;
    const savedIdentity = identityForm(settings.Identity);
    const idForm = identityDraft ?? savedIdentity;
    const identityDirty = JSON.stringify(idForm) !== JSON.stringify(savedIdentity);
    const identityInvalid = identityError(idForm);
    const inherited = settings.Inherited;
    const savedSMTP = smtpForm(settings.SMTP);
    const form = smtpDraft ?? savedSMTP;
    const smtpDirty = JSON.stringify(form) !== JSON.stringify(savedSMTP);
    const smtpValidation = smtpError(form);
    const disabled = !canManage || busy !== null;
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

    async function saveIdentity(submit: FormEvent<HTMLFormElement>) {
        submit.preventDefault();
        if (disabled || !identityDirty || identityInvalid) return;
        setBusy("identity");
        try {
            applied(await putEventMailIdentity(eventID, identityInput(idForm)));
            setIdentityDraft(null);
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
        } catch (error) {setResetError(errorText(error, t("manage.mail.smtp.resetError")));}
        finally {setBusy(null);}
    }

    return <div className="event-manage-mail__panel">
        {!canManage && <p className="event-manage-notice">{t("common.viewOnly")}</p>}
        <form className="event-manage-section" onSubmit={saveIdentity} aria-labelledby="mail-sender-title">
            <div className="event-manage-section__head"><h2 id="mail-sender-title">{t("manage.mail.sender.title")}</h2><p>{t("manage.mail.sender.intro")}</p></div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-sender-name" title={t("manage.mail.identity.name")} help={withSource(t("manage.mail.sender.nameHelp"), settings.InheritedSources.SenderName)} />
                    <input id="mail-sender-name" className="event-manage-input" value={idForm.senderName} placeholder={inherited.Sender.Name} disabled={disabled} maxLength={maxMailNameLength} aria-invalid={identityInvalid === "senderName"} onChange={change => setIdentityDraft({...idForm, senderName: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-sender-address" title={t("manage.mail.identity.address")} help={withSource(t("manage.mail.sender.addressHelp"), settings.InheritedSources.SenderAddress)} />
                    <input id="mail-sender-address" className="event-manage-input" type="email" value={idForm.senderAddress} placeholder={inherited.Sender.Address} disabled={disabled} maxLength={254} aria-invalid={identityInvalid === "senderAddress"} onChange={change => setIdentityDraft({...idForm, senderAddress: change.target.value})} />
                </div>
            </div>
            <div className="event-manage-section__head"><h2 id="mail-replyto-title">{t("manage.mail.replyTo.title")}</h2><p>{t("manage.mail.replyTo.intro")}</p></div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-replyto-name" title={t("manage.mail.identity.name")} help={withSource(t("manage.mail.replyTo.nameHelp"), settings.InheritedSources.ReplyToName)} />
                    <input id="mail-replyto-name" className="event-manage-input" value={idForm.replyToName} placeholder={inherited.ReplyTo.Name} disabled={disabled} maxLength={maxMailNameLength} aria-invalid={identityInvalid === "replyToName"} onChange={change => setIdentityDraft({...idForm, replyToName: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-replyto-address" title={t("manage.mail.identity.address")} help={withSource(t("manage.mail.replyTo.addressHelp"), settings.InheritedSources.ReplyToAddress)} />
                    <input id="mail-replyto-address" className="event-manage-input" type="email" value={idForm.replyToAddress} placeholder={inherited.ReplyTo.Address} disabled={disabled} maxLength={254} aria-invalid={identityInvalid === "replyToAddress"} onChange={change => setIdentityDraft({...idForm, replyToAddress: change.target.value})} />
                </div>
            </div>
            <small>{t("manage.mail.identity.inheritHint")}</small>
            <small data-testid="mail-tracking-note">{t(settings.TrackEngagement ? "manage.mail.tracking.on" : "manage.mail.tracking.off")}</small>
            {!settings.PlatformConfigured && !settings.SMTP && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{t("manage.mail.sender.notConfigured")}</p>}
            {identityDirty && identityInvalid && <p className="event-manage-validation" role="alert">{t(`manage.mail.validation.${identityInvalid}`)}</p>}
            {canManage && identityDirty && <div className="event-manage-section__actions"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !!identityInvalid} busy={busy === "identity"}>{t("common.save")}</EventButton></div>}
        </form>

        <form className="event-manage-section" onSubmit={saveSMTP} aria-labelledby="mail-smtp-title">
            <div className="event-manage-section__head"><h2 id="mail-smtp-title">{t("manage.mail.smtp.title")}</h2><p>{settings.SMTP ? t("manage.mail.smtp.via", {host: settings.SMTP.Host, port: settings.SMTP.Port}) : t("manage.mail.smtp.notConfigured")} {t("manage.mail.smtp.fallbackNote")}</p></div>
            <div className="event-manage-mail__smtp">
                <div className="event-manage-field event-manage-mail__host">
                    <ManageFieldLabel htmlFor="mail-smtp-host" title={t("manage.mail.smtp.host")} help={t("manage.mail.smtp.hostHelp")} required />
                    <input id="mail-smtp-host" className="event-manage-input" value={form.host} placeholder="smtp.example.com" autoComplete="off" spellCheck={false} disabled={disabled} onChange={change => changeSMTP({host: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-port" title={t("manage.mail.smtp.port")} help={t("manage.mail.smtp.portHelp")} required />
                    <input id="mail-smtp-port" className="event-manage-input" type="number" inputMode="numeric" min={1} max={65535} value={form.port} disabled={disabled} onChange={change => changeSMTP({port: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel title={t("manage.mail.smtp.encryption")} help={t("manage.mail.smtp.encryptionHelp")} />
                    <EventSelect ariaLabel={t("manage.mail.smtp.encryption")} value={form.tlsMode} options={tlsModeOptions} disabled={disabled} onValueChange={changeTLS} />
                </div>
            </div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-username" title={t("manage.mail.smtp.username")} help={t("manage.mail.smtp.usernameHelp")} />
                    <input id="mail-smtp-username" className="event-manage-input" value={form.username} autoComplete="off" spellCheck={false} disabled={disabled} onChange={change => changeSMTP({username: change.target.value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-password" title={t("manage.mail.smtp.password")} help={t("manage.mail.smtp.passwordHelp")} />
                    <PasswordInput id="mail-smtp-password" value={form.password} autoComplete="new-password" placeholder={settings.SMTP?.PasswordSet && !form.clearPassword ? t("manage.mail.smtp.passwordSaved") : ""} disabled={disabled || form.clearPassword} onChange={change => changeSMTP({password: change.target.value})} />
                    {settings.SMTP?.PasswordSet && <div className="event-manage-mail__password">
                        <small>{t(form.clearPassword ? "manage.mail.smtp.passwordWillClear" : "manage.mail.smtp.passwordKeep")}</small>
                        {canManage && <button className="ib-btn ib-btn--sm ib-btn--ghost" type="button" disabled={disabled} onClick={() => changeSMTP({clearPassword: !form.clearPassword, password: ""})}>{t(form.clearPassword ? "manage.mail.smtp.keepPassword" : "manage.mail.smtp.clearPassword")}</button>}
                    </div>}
                </div>
            </div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-max-per-second" title={t("manage.mail.smtp.maxPerSecond")} help={withLimitSource(t("manage.mail.smtp.maxPerSecondHelp"), settings.Limits.PerSecondSource)} />
                    <EventNumberInput id="mail-smtp-max-per-second" decimal value={form.maxPerSecond} placeholder={t("manage.mail.smtp.limitPlaceholder")} disabled={disabled} onChange={value => changeSMTP({maxPerSecond: value})} />
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="mail-smtp-daily-quota" title={t("manage.mail.smtp.dailyQuota")} help={withLimitSource(t("manage.mail.smtp.dailyQuotaHelp"), settings.Limits.DailyQuotaSource)} />
                    <EventNumberInput id="mail-smtp-daily-quota" value={form.dailyQuota} placeholder={t("manage.mail.smtp.limitPlaceholder")} disabled={disabled} onChange={value => changeSMTP({dailyQuota: value})} />
                    {settings.Limits.DailyQuota > 0 && <small data-testid="mail-quota-used">{t("manage.mail.smtp.quotaUsed", {used: settings.Limits.Used24h, limit: settings.Limits.DailyQuota})}</small>}
                </div>
            </div>
            {smtpDirty && smtpValidation && <p className="event-manage-validation" role="alert">{smtpValidation}</p>}
            {test && <div className={`event-manage-mail__result${test.Sent ? "" : " is-error"}`} role="status">
                <strong>{t(test.Sent ? "manage.mail.smtp.testOk" : "manage.mail.smtp.testFailed")}</strong>
                <span>{test.Sent ? (test.Transport ? t("manage.mail.smtp.testSentVia", {recipient: test.Recipient, transport: mailTransportLabel(test.Transport)}) : t("manage.mail.smtp.testSent", {recipient: test.Recipient})) : test.Error || t("manage.mail.smtp.testRejected")}</span>
            </div>}
            {canManage && <div className="event-manage-section__actions event-manage-mail__actions">
                {settings.SMTP && <button className="ib-btn" type="button" disabled={disabled} onClick={() => {setResetError(""); setConfirmReset(true);}}>{t("manage.mail.smtp.usePlatform")}</button>}
                <EventButton className="ib-btn" type="button" disabled={disabled || !canTest} onClick={() => void runTest()} busy={busy === "test"}>{t("manage.mail.smtp.test")}</EventButton>
                <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !smtpDirty || !!smtpValidation} busy={busy === "smtp"}>{t("common.save")}</EventButton>
            </div>}
        </form>

        <ConfirmDialog open={confirmReset} onCancel={() => setConfirmReset(false)} tone="danger" busy={busy === "reset"} error={resetError}
            title={t("manage.mail.smtp.resetTitle")} description={t("manage.mail.smtp.resetDescription")}
            confirmLabel={t("manage.mail.smtp.switch")} onConfirm={() => void resetSMTP()}>
            <p className="event-manage-mail__hint">{t("manage.mail.smtp.resetHint")}</p>
        </ConfirmDialog>
    </div>;
}
