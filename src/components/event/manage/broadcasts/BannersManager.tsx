"use client";

import {useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CircleHelp, Plus} from "lucide-react";
import {toast} from "react-hot-toast";
import {apiErrorMessage, ApiErrorCode} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    bannerAudiences, bannerInput, bannerLevels, BANNER_LABEL_MAX, BANNER_TEXT_MAX, createManageBanner, deleteManageBanner, getManageBanners, updateManageBanner,
    type ManageBanner,
} from "@/api/manageBanners";
import {DialogModal} from "@/components/event/DialogModal";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {SiteBanner} from "@/components/event/SiteBanners";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "../ManageFieldLabel";
import {useManager} from "../ManagerShell";
import {bannerFormInput, bannerToForm, bannerValidation, emptyBannerForm, type BannerForm} from "./bannerModel";
import {formatBroadcastTime} from "./BroadcastHistory";
import "./broadcasts.css";

function saveErrorMessage(error: unknown): string {
    const code = error instanceof ManageApiError ? error.code : undefined;
    return apiErrorMessage(code === ApiErrorCode.BannerInvalid ? code : undefined, t("manage.banners.error.save"));
}

// The live preview and the fields of one banner. The preview is the very
// component the site renders.
function BannerFormFields({form, onChange, disabled}: {form: BannerForm; onChange: (form: BannerForm) => void; disabled: boolean}) {
    const set = (patch: Partial<BannerForm>) => onChange({...form, ...patch});
    const levelOptions = bannerLevels.map(level => ({value: level, label: t(`manage.banners.level.${level}`)}));
    const audienceOptions = bannerAudiences.map(audience => ({value: audience, label: t(`manage.banners.audience.${audience}`)}));
    return <div className="event-banner-form">
        <div className="event-banner-preview">
            <ManageFieldLabel title={t("manage.banners.preview")} help={t("manage.banners.previewHelp")} />
            <SiteBanner banner={{Text: form.Text.trim() || t("manage.banners.previewText"), LinkURL: form.LinkURL, LinkLabel: form.LinkLabel, Level: form.Level, Dismissible: form.Dismissible}} onDismiss={() => undefined} />
        </div>
        <div className="event-manage-field">
            <ManageFieldLabel title={t("manage.banners.field.text")} help={t("manage.banners.field.textHelp", {max: BANNER_TEXT_MAX})} htmlFor="event-banner-text" required />
            <textarea id="event-banner-text" className="event-manage-input" rows={3} maxLength={BANNER_TEXT_MAX} value={form.Text} disabled={disabled} onChange={event => set({Text: event.target.value})} />
            <small className="event-manage-table__dim">{t("manage.banners.field.textCount", {count: [...form.Text].length, max: BANNER_TEXT_MAX})}</small>
        </div>
        <div className="event-banner-form__two">
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.linkUrl")} help={t("manage.banners.field.linkUrlHelp")} htmlFor="event-banner-link" />
                <input id="event-banner-link" className="event-manage-input" value={form.LinkURL} disabled={disabled} placeholder="/faq" onChange={event => set({LinkURL: event.target.value})} />
            </div>
            <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.banners.field.linkLabel")} help={t("manage.banners.field.linkLabelHelp")} htmlFor="event-banner-label" />
                <input id="event-banner-label" className="event-manage-input" value={form.LinkLabel} maxLength={BANNER_LABEL_MAX} disabled={disabled || !form.LinkURL.trim()} placeholder={t("siteBanner.more")} onChange={event => set({LinkLabel: event.target.value})} />
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
                <EventDateTimePicker id="event-banner-to" ariaLabel={t("manage.banners.field.to")} value={form.ActiveTo} onChange={ActiveTo => set({ActiveTo})} disabled={disabled} allowClear />
            </div>
        </div>
        <EventSwitch checked={form.Dismissible} disabled={disabled} onCheckedChange={Dismissible => set({Dismissible})} label={t("manage.banners.field.dismissible")} />
        <EventSwitch checked={form.IsActive} disabled={disabled} onCheckedChange={IsActive => set({IsActive})} label={t("manage.banners.field.active")} />
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
    const query = useQuery({queryKey: ["event-manage-banners", eventID], queryFn: () => getManageBanners(eventID), refetchOnWindowFocus: false});
    const [editing, setEditing] = useState<{banner: ManageBanner | null; form: BannerForm} | null>(null);
    const [removing, setRemoving] = useState<ManageBanner | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const toggleQueue = useRef<Promise<void>>(Promise.resolve());
    const toggling = useRef(0);
    const banners = query.data ?? [];
    const validation = editing ? bannerValidation(editing.form) : "";

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
        if (!editing || validation) return;
        const input = bannerFormInput(editing.form);
        const target = editing.banner;
        const done = await run(() => target ? updateManageBanner(eventID, target.ID, input) : createManageBanner(eventID, input), t("manage.banners.saved"), saveErrorMessage);
        if (done) setEditing(null);
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
            } catch {
                toggling.current -= 1;
                if (toggling.current === 0) await queryClient.invalidateQueries({queryKey: key});
                toast.error(t("manage.banners.error.save"));
            }
        });
    }

    async function remove() {
        if (!removing) return;
        const done = await run(() => deleteManageBanner(eventID, removing.ID), t("manage.banners.deleted"), () => t("manage.banners.error.delete"));
        if (done) setRemoving(null);
    }

    const create = canManage
        ? <button className="ib-btn ib-btn--primary" type="button" onClick={() => {setError(""); setEditing({banner: null, form: emptyBannerForm()});}}><Plus size={15} aria-hidden="true" /> {t("manage.banners.create")}</button>
        : <span className="event-broadcast-heading-actions">
            <button className="ib-btn ib-btn--primary" type="button" disabled><Plus size={15} aria-hidden="true" /> {t("manage.banners.create")}</button>
            <EventTooltip content={t("manage.banners.viewerCannotEdit")}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.banners.viewerCannotEditLabel")} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip>
        </span>;

    return <div className="event-manage-settings">
        <header className="event-manage-heading"><div><h1>{t("manage.banners.title")}</h1><p>{t("manage.banners.subtitle")}</p></div>{create}</header>
        <div className="event-banner-block" aria-busy={query.isPending}>
            {query.isPending ? <EventLoading event={event} label={t("manage.banners.loading")} />
                : query.isError ? <EventLoadError message={t("manage.banners.loadError")} error={query.error} onRetry={() => void query.refetch()} />
                    : banners.length === 0 ? <EmptyState message={t("manage.banners.empty")} />
                        : <ul className="event-banner-list">{banners.map(banner => <li key={banner.ID} className="event-banner-list__item">
                            <SiteBanner banner={banner} />
                            <div className="event-banner-list__meta">
                                <span className={`ib-tag ${banner.IsActive ? "ib-tag--ok" : ""}`.trim()}>{t(banner.IsActive ? "manage.banners.status.active" : "manage.banners.status.inactive")}</span>
                                <span>{t(`manage.banners.audience.${banner.Audience}`)}</span>
                                <span>{bannerWindow(banner)}</span>
                            </div>
                            {canManage && <div className="event-banner-list__actions">
                                <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => {setError(""); setEditing({banner, form: bannerToForm(banner)});}}>{t("manage.banners.edit")}</button>
                                <button className="ib-btn ib-btn--sm" type="button" onClick={() => toggle(banner)}>{t(banner.IsActive ? "manage.banners.deactivate" : "manage.banners.activate")}</button>
                                <button className="ib-btn ib-btn--sm" type="button" disabled={busy} onClick={() => {setError(""); setRemoving(banner);}}>{t("manage.banners.delete")}</button>
                            </div>}
                        </li>)}</ul>}
        </div>
        <DialogModal open={editing !== null} onClose={() => {if (!busy) setEditing(null);}} size="md" title={editing?.banner ? t("manage.banners.editTitle") : t("manage.banners.createTitle")}
            footer={<>
                <button className="ib-btn" type="button" disabled={busy} onClick={() => setEditing(null)}>{t("common.cancel")}</button>
                <EventButton className="ib-btn ib-btn--primary" type="button" busy={busy} disabled={!!validation} onClick={() => void save()}>{t("common.save")}</EventButton>
            </>}>
            {editing && <>
                <BannerFormFields form={editing.form} disabled={busy} onChange={form => setEditing({...editing, form})} />
                {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                {error && !validation && <p className="event-manage-validation" role="alert">{error}</p>}
            </>}
        </DialogModal>
        <ConfirmDialog open={removing !== null} onCancel={() => setRemoving(null)} tone="danger" title={t("manage.banners.deleteTitle")} description={t("manage.banners.deleteBody")}
            subject={removing?.Text} confirmLabel={t("manage.banners.delete")} busy={busy} error={removing ? error || undefined : undefined} onConfirm={() => void remove()} />
    </div>;
}
