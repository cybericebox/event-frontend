"use client";

import {useDraftDirty, useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CircleHelp, Pencil, Plus, Power, PowerOff, Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {toastFailure} from "@/components/ui/toastApiError";
import {apiErrorMessage, ApiErrorCode} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    ManageBannerFieldError, bannerAudiences, bannerInput, bannerLevels, BANNER_LABEL_MAX, BANNER_TEXT_MAX, createManageBanner, deleteManageBanner, getManageBanners, updateManageBanner,
    type ManageBanner,
} from "@/api/manageBanners";
import {DialogModal} from "@/components/event/DialogModal";
import {SiteBanner} from "@/components/event/SiteBanners";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {sameValue} from "../notifications/notificationModel";
import {ManageTable} from "../ManageTable";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {useManager} from "../ManagerShell";
import {bannerFormInput, bannerShowState, bannerToForm, bannerFieldErrors, emptyBannerForm, type BannerForm, type BannerErrors} from "./bannerModel";
import {formatBroadcastTime} from "./BroadcastHistory";
import "./broadcasts.css";

function saveErrorMessage(error: unknown): string {
    const code = error instanceof ManageApiError ? error.code : undefined;
    return apiErrorMessage(code === ApiErrorCode.BannerInvalid ? code : undefined, t("manage.banners.error.save"));
}

// The live preview and the fields of one banner. The preview is the very
// component the site renders.
function BannerFormFields({form, isNew, onChange, disabled, errors: allErrors}: {form: BannerForm; isNew: boolean; onChange: (form: BannerForm) => void; disabled: boolean; errors: BannerErrors}) {
    const set = (patch: Partial<BannerForm>) => onChange({...form, ...patch});
    // An empty new form is not a mistake yet: the missing text shows once the field is left.
    const [textLeft, setTextLeft] = useState(false);
    const errors = isNew && !textLeft && !form.Text.trim() ? {...allErrors, Text: undefined} : allErrors;
    const levelOptions = bannerLevels.map(level => ({value: level, label: t(`manage.banners.level.${level}`)}));
    const audienceOptions = bannerAudiences.map(audience => ({value: audience, label: t(`manage.banners.audience.${audience}`)}));
    return <div className="event-banner-form">
        <p className="event-manage-table__dim">{t("manage.banners.scopeHint")}</p>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.banners.field.text")} help={t("manage.banners.field.textHelp", {max: BANNER_TEXT_MAX})} htmlFor="event-banner-text" required />
            <textarea id="event-banner-text" aria-invalid={!!errors.Text || undefined} aria-describedby={errors.Text ? "event-banner-text-error" : undefined} className="event-manage-input" rows={3} maxLength={BANNER_TEXT_MAX} value={form.Text} disabled={disabled} onChange={event => set({Text: event.target.value})} onBlur={() => setTextLeft(true)} />
                {errors.Text && <p id="event-banner-text-error" className="event-manage-validation" role="alert">{errors.Text}</p>}
            <small className="event-manage-table__dim">{t("manage.banners.field.textCount", {count: [...form.Text].length, max: BANNER_TEXT_MAX})}</small>
        </div>
        <div className="event-banner-form__two">
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.linkUrl")} help={t("manage.banners.field.linkUrlHelp")} htmlFor="event-banner-link" />
                <input id="event-banner-link" aria-invalid={!!errors.LinkURL || undefined} aria-describedby={errors.LinkURL ? "event-banner-link-error" : undefined} className="event-manage-input" value={form.LinkURL} disabled={disabled} placeholder="/faq" onChange={event => set({LinkURL: event.target.value})} />
                {errors.LinkURL && <p id="event-banner-link-error" className="event-manage-validation" role="alert">{errors.LinkURL}</p>}
            </div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.linkLabel")} help={t("manage.banners.field.linkLabelHelp")} htmlFor="event-banner-label" />
                <input id="event-banner-label" aria-invalid={!!errors.LinkLabel || undefined} aria-describedby={errors.LinkLabel ? "event-banner-label-error" : undefined} className="event-manage-input" value={form.LinkLabel} maxLength={BANNER_LABEL_MAX} disabled={disabled || !form.LinkURL.trim()} placeholder={t("siteBanner.more")} onChange={event => set({LinkLabel: event.target.value})} />
                {errors.LinkLabel && <p id="event-banner-label-error" className="event-manage-validation" role="alert">{errors.LinkLabel}</p>}
            </div>
        </div>
        <div className="event-banner-form__two">
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.level")} help={t("manage.banners.field.levelHelp")} />
                <EventSelect ariaLabel={t("manage.banners.field.level")} value={form.Level} options={levelOptions} disabled={disabled} onValueChange={level => set({Level: level as BannerForm["Level"]})} />
            </div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.audience")} help={t("manage.banners.field.audienceHelp")} />
                <EventSelect ariaLabel={t("manage.banners.field.audience")} value={form.Audience} options={audienceOptions} disabled={disabled} onValueChange={audience => set({Audience: audience as BannerForm["Audience"]})} />
            </div>
        </div>
        <div className="event-banner-form__two">
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.from")} help={t("manage.banners.field.fromHelp")} htmlFor="event-banner-from" />
                <EventDateTimePicker id="event-banner-from" ariaLabel={t("manage.banners.field.from")} value={form.ActiveFrom} onChange={ActiveFrom => set({ActiveFrom})} disabled={disabled} allowClear />
            </div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.to")} help={t("manage.banners.field.toHelp")} htmlFor="event-banner-to" />
                <EventDateTimePicker id="event-banner-to" aria-invalid={!!errors.ActiveTo || undefined} aria-describedby={errors.ActiveTo ? "event-banner-to-error" : undefined} ariaLabel={t("manage.banners.field.to")} value={form.ActiveTo} onChange={ActiveTo => set({ActiveTo})} disabled={disabled} allowClear />
                {errors.ActiveTo && <p id="event-banner-to-error" className="event-manage-validation" role="alert">{errors.ActiveTo}</p>}
            </div>
        </div>
        <EventSwitch checked={form.Dismissible} disabled={disabled} onCheckedChange={Dismissible => set({Dismissible})} label={t("manage.banners.field.dismissible")} />
        <EventSwitch checked={form.IsActive} disabled={disabled} onCheckedChange={IsActive => set({IsActive})} label={t("manage.banners.field.active")} />
        <div className="event-banner-preview">
            <ManageFieldLabel title={t("manage.banners.preview")} help={t("manage.banners.previewHelp")} />
            <SiteBanner banner={{Text: form.Text.trim() || t("manage.banners.previewText"), LinkURL: form.LinkURL, LinkLabel: form.LinkLabel, Level: form.Level, Dismissible: form.Dismissible}} onDismiss={() => undefined} />
        </div>
    </div>;
}

function bannerWindow(banner: ManageBanner): string {
    if (!banner.ActiveFrom && !banner.ActiveTo) return t("manage.banners.window.always");
    if (banner.ActiveFrom && banner.ActiveTo) return t("manage.banners.window.range", {from: formatBroadcastTime(banner.ActiveFrom), to: formatBroadcastTime(banner.ActiveTo)});
    return banner.ActiveFrom ? t("manage.banners.window.from", {from: formatBroadcastTime(banner.ActiveFrom)}) : t("manage.banners.window.to", {to: formatBroadcastTime(banner.ActiveTo!)});
}

// «Банери»: the site banners of the event. Owners and moderators with write
// access create, edit, switch and delete them; viewers only read.
export function BannersManager() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const query = useQuery({queryKey: ["event-manage-banners", eventID], queryFn: () => getManageBanners(eventID), refetchOnWindowFocus: false, placeholderData: previous => previous});
    const [editing, setEditing] = useSessionDraftState<{banner: ManageBanner | null; form: BannerForm} | null>("banner-edit", null);
    const [removing, setRemoving] = useState<ManageBanner | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const [error, setError] = useState("");
    const [serverErrors, setServerErrors] = useState<{form: BannerForm; errors: BannerErrors} | null>(null);
    const toggleQueue = useRef<Promise<void>>(Promise.resolve());
    const toggling = useRef(0);
    const banners = query.data ?? [];
    const dirty = !!editing && (!editing.banner || !sameValue(bannerFormInput(editing.form), bannerFormInput(bannerToForm(editing.banner))));
    const changed = !!editing && !sameValue(bannerFormInput(editing.form), bannerFormInput(editing.banner ? bannerToForm(editing.banner) : emptyBannerForm()));
    useDraftDirty("banner-edit", changed, {preserveInput: true});
    const applicableServerErrors = editing && serverErrors ? Object.fromEntries(Object.entries(serverErrors.errors).filter(([field]) => editing.form[field as keyof BannerForm] === serverErrors.form[field as keyof BannerForm] && (field !== "ActiveTo" || editing.form.ActiveFrom === serverErrors.form.ActiveFrom))) : {};
    const fieldErrors = editing ? {...applicableServerErrors, ...bannerFieldErrors(editing.form)} : {};
    const validation = Object.values(fieldErrors).some(Boolean);

    async function run(action: () => Promise<unknown>, success: string, failure: (error: unknown) => string): Promise<boolean> {
        if (!canManage || busy) return false;
        setBusy(true);
        setError("");
        try {
            await action();
            await queryClient.invalidateQueries({queryKey: ["event-manage-banners", eventID]});
            toast.success(success);
            return true;
        } catch (failed) {
            setError(failure(failed));
            return false;
        } finally {setBusy(false);}
    }

    async function save() {
        if (!editing || validation || !dirty) return;
        const input = bannerFormInput(editing.form);
        const target = editing.banner;
        let saved: ManageBanner | undefined;
        const done = await run(async () => {saved = await (target ? updateManageBanner(eventID, target.ID, input) : createManageBanner(eventID, input));}, t("manage.banners.saved"), failed => {
            if (!(failed instanceof ManageBannerFieldError)) return saveErrorMessage(failed);
            const messages = {Text: t("manage.banners.validation.text"), LinkURL: t("manage.banners.validation.link"), LinkLabel: t("manage.banners.validation.label", {max: BANNER_LABEL_MAX}), ActiveTo: t("manage.banners.validation.window")};
            setServerErrors({form: editing.form, errors: {[failed.field]: messages[failed.field]}});
            return "";
        });
        if (done) setEditing(current => current === editing ? null : current ? {...current, banner: saved ?? current.banner} : null);
    }

    // «Вимкнути / Увімкнути»: the label flips at once, saves run one after another and block nothing.
    function toggle(banner: ManageBanner) {
        if (!canManage) return;
        const key = ["event-manage-banners", eventID];
        const active = !banner.IsActive;
        const patch = (next: Partial<ManageBanner>) => (rows: ManageBanner[] | undefined) => rows?.map(row => row.ID === banner.ID ? {...row, ...next} : row);
        queryClient.setQueryData<ManageBanner[]>(key, patch({IsActive: active}));
        toggling.current += 1;
        toggleQueue.current = toggleQueue.current.then(async () => {
            try {
                const saved = await updateManageBanner(eventID, banner.ID, {...bannerInput(banner), IsActive: active});
                toggling.current -= 1;
                // Apply the answer only when no newer change waits and it differs from what is shown.
                const shown = queryClient.getQueryData<ManageBanner[]>(key)?.find(row => row.ID === banner.ID);
                if (toggling.current === 0 && shown && JSON.stringify(saved) !== JSON.stringify(shown)) queryClient.setQueryData<ManageBanner[]>(key, patch(saved));
                toast.success(t(active ? "manage.banners.activated" : "manage.banners.deactivated"));
            } catch (failure) {
                toggling.current -= 1;
                if (toggling.current === 0) await queryClient.invalidateQueries({queryKey: key});
                toastFailure(failure, t("manage.banners.error.save"));
            }
        });
    }

    // Closing a form with changes asks first; an untouched one just closes.
    function requestClose() {
        if (busy) return;
        if (changed) setConfirmClose(true);
        else setEditing(null);
    }

    async function remove() {
        if (!removing) return;
        const done = await run(() => deleteManageBanner(eventID, removing.ID), t("manage.banners.deleted"), () => t("manage.banners.error.delete"));
        if (done) setRemoving(null);
    }

    const create = canManage
        ? <button className="ib-btn ib-btn--primary" type="button" onClick={() => {setError(""); setServerErrors(null); setEditing({banner: null, form: emptyBannerForm()});}}><Plus size={15} aria-hidden="true" /> {t("manage.banners.create")}</button>
        : <span className="event-broadcast-heading-actions">
            <button className="ib-btn ib-btn--primary" type="button" disabled><Plus size={15} aria-hidden="true" /> {t("manage.banners.create")}</button>
            <EventTooltip help content={t("manage.banners.viewerCannotEdit")}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.banners.viewerCannotEditLabel")} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
        </span>;

    return <div className="event-manage-settings">
        <header className="event-manage-heading"><div><h1>{t("manage.banners.title")}</h1><p>{t("manage.banners.subtitle")}</p></div>{create}</header>
        <ManageTable cards event={event} state={query.isPending ? "loading" : query.isError && !query.data ? "error" : banners.length ? "ready" : "empty"}
            label={t("manage.banners.title")} loadingLabel={t("manage.banners.loading")} emptyMessage={t("manage.banners.empty")} errorMessage={t("manage.banners.loadError")}
            error={query.error} onRetry={() => void query.refetch()}
            head={<tr><th>{t("manage.banners.field.text")}</th><th>{t("manage.banners.field.level")}</th><th>{t("manage.banners.table.window")}</th><th>{t("manage.banners.field.audience")}</th><th>{t("manage.banners.table.status")}</th>{canManage && <th className="event-manage-table__actions-col event-manage-table__sticky-end">{t("manage.banners.table.actions")}</th>}</tr>}>
            <tbody>{banners.map(banner => <tr key={banner.ID}>
                <td className="event-banner-table__text">{banner.Text}</td>
                <td><span className={`ib-tag${banner.Level === "critical" ? " ib-tag--danger" : banner.Level === "warning" ? " ib-tag--warn" : ""}`}>{t(`manage.banners.level.${banner.Level}`)}</span></td>
                <td>{bannerWindow(banner)}</td>
                <td>{t(`manage.banners.audience.${banner.Audience}`)}</td>
                <td>{(() => {const state = bannerShowState(banner); return <span className={`ib-tag ${state === "active" ? "ib-tag--ok" : state === "scheduled" ? "ib-tag--warn" : ""}`.trim()}>{t(`manage.banners.status.${state}`)}</span>;})()}</td>
                {canManage && <td className="event-manage-table__sticky-end"><div className="event-manage-table__actions">
                    <EventTooltip content={t("manage.banners.edit")}>{id => <button className="ib-icon-btn" type="button" aria-label={t("manage.banners.edit")} aria-describedby={id} onClick={() => {setError(""); setServerErrors(null); setEditing({banner, form: bannerToForm(banner)});}}><Pencil size={16} strokeWidth={2} aria-hidden="true" /></button>}</EventTooltip>
                    <EventTooltip content={t(banner.IsActive ? "manage.banners.deactivate" : "manage.banners.activate")}>{id => <button className="ib-icon-btn" type="button" aria-label={t(banner.IsActive ? "manage.banners.deactivate" : "manage.banners.activate")} aria-describedby={id} onClick={() => toggle(banner)}>{banner.IsActive ? <PowerOff size={16} strokeWidth={2} aria-hidden="true" /> : <Power size={16} strokeWidth={2} aria-hidden="true" />}</button>}</EventTooltip>
                    <EventTooltip content={t("manage.banners.delete")}>{id => <button className="ib-icon-btn" type="button" aria-label={t("manage.banners.delete")} aria-describedby={id} onClick={() => {setError(""); setRemoving(banner);}}><Trash2 size={16} strokeWidth={2} aria-hidden="true" /></button>}</EventTooltip>
                </div></td>}
            </tr>)}</tbody>
        </ManageTable>
        <DialogModal open={editing !== null} onClose={requestClose} size="md" title={editing?.banner ? t("manage.banners.editTitle") : t("manage.banners.createTitle")}
            footer={<>
                <button className="ib-btn" type="button" disabled={busy} onClick={requestClose}>{t("common.cancel")}</button>
                <EventButton saveDirty={dirty} className="ib-btn ib-btn--primary" type="button" busy={busy} busyLabel={t("common.busy.saving")} disabled={!!validation} onClick={() => void save()}>{t("common.save")}</EventButton>
            </>}>
            {editing && <>
                <BannerFormFields form={editing.form} isNew={!editing.banner} errors={fieldErrors} disabled={!canManage} onChange={form => setEditing({...editing, form})} />
                {error && !validation && <p className="event-manage-validation" role="alert">{error}</p>}
            </>}
        </DialogModal>
        <ConfirmDialog open={confirmClose} onCancel={() => setConfirmClose(false)} tone="danger" title={t("manage.banners.discardTitle")} description={t("manage.banners.discardBody")}
            confirmLabel={t("manage.banners.discardAction")} onConfirm={() => {setConfirmClose(false); setEditing(null);}} />
        <ConfirmDialog open={removing !== null} onCancel={() => setRemoving(null)} tone="danger" title={t("manage.banners.deleteTitle")} description={t("manage.banners.deleteBody")}
            subject={removing?.Text} confirmLabel={t("manage.banners.delete")} busy={busy} busyLabel={t("common.busy.deleting")} error={removing ? error || undefined : undefined} onConfirm={() => void remove()} />
    </div>;
}
