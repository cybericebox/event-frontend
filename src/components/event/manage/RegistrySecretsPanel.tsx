"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {apiErrorText} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    checkRegistrySecret, createRegistrySecret, deleteRegistrySecret, emptyRegistrySecretForm, listRegistrySecrets, registrySecretErrors, registrySecretForm, registrySecretInput,
    registryCheckText, registryRetryText, updateRegistrySecret, type RegistrySecret, type RegistrySecretForm,
} from "@/api/manageRegistries";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventButton} from "@/components/ui/EventButton";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {PasswordInput} from "@/components/ui/PasswordInput";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {useManager} from "./ManagerShell";

function errorText(error: unknown, fallback: string) {
    return apiErrorText(error, fallback);
}

// null = the form is closed; "new" = adding; a secret = editing it.
type Editing = "new" | RegistrySecret | null;

export function RegistrySecretsPanel() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const queryKey = ["event-manage-registry-secrets", eventID];
    const query = useQuery({queryKey, queryFn: () => listRegistrySecrets(eventID), refetchOnWindowFocus: false});
    const [editing, setEditing] = useState<Editing>(null);
    const [form, setForm] = useState<RegistrySecretForm>(emptyRegistrySecretForm);
    const [touched, setTouched] = useState(false);
    // Only the save button is busy while saving; the fields stay editable.
    const [saving, setSaving] = useState(false);
    // A rejected save stays in the form: the token one sits at the token field.
    const [saveError, setSaveError] = useState<{message: string; token: boolean} | null>(null);
    const [removal, setRemoval] = useState<RegistrySecret | null>(null);
    // The dialog keeps its text while it closes.
    const [lastRemoval, setLastRemoval] = useState<RegistrySecret | null>(null);
    const [removing, setRemoving] = useState(false);
    const [removalError, setRemovalError] = useState("");
    // The secrets being checked now: only their own «Перевірити зараз» button is busy.
    const [checking, setChecking] = useState<ReadonlySet<string>>(new Set());
    const [checkError, setCheckError] = useState<{id: string; message: string} | null>(null);

    if (query.isPending) return <EventLoading event={event} label={t("manage.registries.loading")} />;
    if (query.isError) return <EventLoadError message={t("manage.registries.loadError")} error={query.error} onRetry={() => void query.refetch()} />;

    const secrets = query.data;
    const saved = editing && editing !== "new" ? editing : null;
    const errors = editing ? registrySecretErrors(form, saved) : {};
    const invalid = Object.keys(errors).length > 0;

    function open(next: Editing) {
        setEditing(next);
        setForm(registrySecretForm(next && next !== "new" ? next : null));
        setTouched(false);
        setSaveError(null);
    }

    function change(patch: Partial<RegistrySecretForm>) {
        setForm(current => ({...current, ...patch}));
        setTouched(true);
        setSaveError(null);
    }

    // Updates the one row with the new result; nothing else on the page moves.
    function putSecret(result: RegistrySecret) {
        queryClient.setQueryData<RegistrySecret[]>(queryKey, current => (current ?? []).map(item => item.ID === result.ID ? result : item));
    }

    async function check(id: string, announce: boolean) {
        if (checking.has(id)) return;
        setChecking(current => new Set(current).add(id));
        if (announce) setCheckError(null);
        try {
            putSecret(await checkRegistrySecret(eventID, id));
        } catch (error) {
            if (announce) setCheckError({id, message: errorText(error, t("manage.registries.check.error"))});
        } finally {
            setChecking(current => { const next = new Set(current); next.delete(id); return next; });
        }
    }

    async function save(submit: FormEvent<HTMLFormElement>) {
        submit.preventDefault();
        if (!canManage || saving || !editing || invalid) return;
        setSaving(true);
        setSaveError(null);
        try {
            const input = registrySecretInput(form);
            const result = saved ? await updateRegistrySecret(eventID, saved.ID, input) : await createRegistrySecret(eventID, input);
            queryClient.setQueryData<RegistrySecret[]>(queryKey, current => {
                const list = current ?? [];
                return list.some(item => item.ID === result.ID) ? list.map(item => item.ID === result.ID ? result : item) : [...list, result];
            });
            // The availability warnings depend on the secrets.
            void queryClient.invalidateQueries({queryKey: ["event-image-availability", eventID]});
            setEditing(null);
            setForm(emptyRegistrySecretForm);
            toast.success(t("manage.registries.saved"));
            // A new or changed credential is checked at once, so its status is not the old one's.
            void check(result.ID, false);
        } catch (error) {setSaveError({message: errorText(error, t("manage.registries.saveError")), token: error instanceof ManageApiError && (error.code === 2815 || error.code === 2825)});}
        finally {setSaving(false);}
    }

    async function remove() {
        if (!canManage || removing || !removal) return;
        const target = removal;
        setRemoving(true);
        try {
            await deleteRegistrySecret(eventID, target.ID);
            queryClient.setQueryData<RegistrySecret[]>(queryKey, current => (current ?? []).filter(item => item.ID !== target.ID));
            void queryClient.invalidateQueries({queryKey: ["event-image-availability", eventID]});
            if (saved?.ID === target.ID) setEditing(null);
            setRemoval(null);
            toast.success(t("manage.registries.deleted"));
        } catch (error) {setRemovalError(errorText(error, t("manage.registries.deleteError")));}
        finally {setRemoving(false);}
    }

    return <div className="event-manage-mail__panel">
        {!canManage && <p className="event-manage-notice">{t("common.viewOnly")}</p>}
        <section className="event-manage-section" aria-labelledby="registries-title">
            <div className="event-manage-section__head"><h2 id="registries-title">{t("manage.registries.list.title")}</h2></div>
            {secrets.length === 0 ? <EmptyState compact message={t("manage.registries.empty")} /> : <ul className="event-registry-list" aria-label={t("manage.registries.list.title")}>
                {secrets.map(secret => <li key={secret.ID} className="event-registry-list__row">
                    <div className="event-registry-list__main">
                        <strong>{secret.Host}</strong>
                        <small>{[
                            secret.RepositoryPrefix ? t("manage.registries.row.prefix", {prefix: secret.RepositoryPrefix}) : t("manage.registries.row.anyRepository"),
                            t("manage.registries.row.username", {username: secret.Username}),
                        ].join(" · ")}</small>
                        <small className={`event-registry-list__status${secret.Check.State === "broken" ? " event-registry-list__status--broken" : ""}`} data-state={secret.Check.State || "unknown"}>
                            {registryCheckText(secret.Check)}
                        </small>
                        {registryRetryText(secret.Check) && <small>{registryRetryText(secret.Check)}</small>}
                        {checkError?.id === secret.ID && <small className="event-manage-feedback event-manage-feedback--error" role="alert">{checkError.message}</small>}
                    </div>
                    {canManage && <div className="event-registry-list__actions">
                        <EventButton className="ib-btn ib-btn--sm" type="button" busy={checking.has(secret.ID)} onClick={() => void check(secret.ID, true)}>{t("manage.registries.check.now")}</EventButton>
                        <button className="ib-btn ib-btn--sm" type="button" onClick={() => open(secret)}>{t("common.edit")}</button>
                        <button className="ib-btn ib-btn--sm ib-btn--ghost" type="button" onClick={() => {setRemovalError(""); setRemoval(secret); setLastRemoval(secret);}}>{t("manage.registries.delete")}</button>
                    </div>}
                </li>)}
            </ul>}
            {canManage && !editing && <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="button" onClick={() => open("new")}>{t("common.add")}</button></div>}
        </section>

        {canManage && editing && <form className="event-manage-section" onSubmit={save} aria-labelledby="registry-form-title">
            <div className="event-manage-section__head"><h2 id="registry-form-title">{t(saved ? "manage.registries.form.edit" : "manage.registries.form.new")}</h2><p>{t("manage.registries.form.intro")}</p></div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="registry-host" title={t("manage.registries.field.host")} help={t("manage.registries.field.hostHelp")} required />
                    <input id="registry-host" className="event-manage-input" value={form.host} placeholder={t("manage.registries.field.hostPlaceholder")} autoComplete="off" spellCheck={false} aria-invalid={(touched && !!errors.host) || undefined} onChange={input => change({host: input.target.value})} />
                    {touched && errors.host && <p className="event-manage-validation" role="alert">{errors.host}</p>}
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="registry-prefix" title={t("manage.registries.field.prefix")} help={t("manage.registries.field.prefixHelp")} />
                    <input id="registry-prefix" className="event-manage-input" value={form.prefix} placeholder={t("manage.registries.field.prefixPlaceholder")} autoComplete="off" spellCheck={false} onChange={input => change({prefix: input.target.value})} />
                </div>
            </div>
            <div className="event-manage-fields-two">
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="registry-username" title={t("manage.registries.field.username")} help={t("manage.registries.field.usernameHelp")} required />
                    <input id="registry-username" className="event-manage-input" value={form.username} autoComplete="off" data-1p-ignore data-lpignore="true" spellCheck={false} aria-invalid={(touched && !!errors.username) || undefined} onChange={input => change({username: input.target.value})} />
                    {touched && errors.username && <p className="event-manage-validation" role="alert">{errors.username}</p>}
                </div>
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="registry-token" title={t("manage.registries.field.token")} help={t("manage.registries.field.tokenHelp")} required={!saved} />
                    <PasswordInput writeOnly id="registry-token" value={form.token} autoComplete="off" data-1p-ignore data-lpignore="true" placeholder={saved ? t("manage.registries.field.tokenSaved") : ""} aria-invalid={(!!errors.token && (touched || !!saved)) || undefined} onChange={input => change({token: input.target.value})} />
                    {saveError?.token ? <p className="event-manage-validation" role="alert">{saveError.message}</p> : errors.token && (touched || saved) ? <p className="event-manage-validation" role="alert">{errors.token}</p> : saved && <small>{t("manage.registries.field.tokenKeep")}</small>}
                </div>
            </div>
            {saveError && !saveError.token && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{saveError.message}</p>}
            <div className="event-manage-section__actions">
                <button className="ib-btn" type="button" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
                <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={saving || invalid} busy={saving}>{t("common.save")}</EventButton>
            </div>
        </form>}

        <ConfirmDialog open={!!removal} onCancel={() => setRemoval(null)} tone="danger" busy={removing} error={removalError}
            title={t("manage.registries.deleteTitle", {host: (removal ?? lastRemoval)?.Host ?? ""})} description={t("manage.registries.deleteDescription")}
            subject={(removal ?? lastRemoval) ? [(removal ?? lastRemoval)!.RepositoryPrefix, (removal ?? lastRemoval)!.Username].filter(Boolean).join(" · ") : undefined}
            confirmLabel={t("manage.registries.delete")} onConfirm={() => void remove()} />
    </div>;
}
