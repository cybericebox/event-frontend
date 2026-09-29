"use client";

import {useMemo, useState, type CSSProperties, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {CircleHelp, RotateCcw} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, ManageApiError, putManageAppearance} from "@/api/manage";
import {BrandDraftField, useBrandDraft} from "@/components/event/manage/BrandDraftField";
import {paletteFromLogo} from "@/components/event/manage/paletteFromLogo";
import {deriveTheme, whiteTextContrast} from "@/components/event/manage/deriveTheme";
import {useManager} from "@/components/event/manage/ManagerShell";
import {resolveEventLogoURL} from "@/components/event/EventBrandLogo";
import {EventLoading} from "@/components/event/EventLoading";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";

const defaultBrand = "#211A52";
const colorPattern = /^#[0-9a-fA-F]{6}$/;

function ColorField({title, help, value, fallback, onChange, disabled, optional = false}: {
    title: string; help: string; value: string; fallback: string; onChange: (value: string) => void; disabled: boolean; optional?: boolean;
}) {
    return <div className="event-manage-field">
        <div className="event-brand-field__head"><span>{title}{!optional && <span className="event-field-required" aria-label={t("common.required")}>*</span>}</span><EventTooltip content={<span className="event-brand-tooltip-copy">{help}</span>}>{id => <button className="event-brand-help" type="button" aria-label={t("manage.appearance.about", {title})} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>
        <div className="event-manage-color"><label className="event-color-picker"><span className="event-color-swatch" style={{backgroundColor: colorPattern.test(value) ? value : fallback}} /><input type="color" aria-label={t("manage.appearance.pick", {title: title.toLowerCase()})} value={colorPattern.test(value) ? value : fallback} onChange={event => onChange(event.target.value)} disabled={disabled} /></label><input className="event-manage-input" aria-label={title} value={value} onChange={event => onChange(event.target.value)} placeholder={fallback} maxLength={7} disabled={disabled} />{value !== (optional ? "" : defaultBrand) && !disabled && <EventTooltip content={t("manage.appearance.reset", {title: title.toLowerCase()})}>{id => <button className="event-brand-reset-icon" type="button" aria-label={t("manage.appearance.reset", {title: title.toLowerCase()})} aria-describedby={id} onClick={() => onChange(optional ? "" : defaultBrand)}><RotateCcw size={15} /></button>}</EventTooltip>}</div>
    </div>;
}

export default function ManageAppearancePage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; brand: string; accent: string} | null>(null);
    const [suggestion, setSuggestion] = useState<{brand: string; accent: string} | null>(null);
    const [saving, setSaving] = useState(false);
    const brand = edit?.eventID === eventID ? edit.brand : configQuery.data?.Theme.Brand ?? defaultBrand;
    const accent = edit?.eventID === eventID ? edit.accent : configQuery.data?.Theme.Accent ?? "";
    const logo = useBrandDraft(eventID, "logo", resolveEventLogoURL(event.LogoURL) ?? "", 2 << 20);
    const favicon = useBrandDraft(eventID, "favicon", resolveEventLogoURL(event.FaviconURL) ?? "", 512 << 10);
    const theme = useMemo(() => deriveTheme(brand, accent, configQuery.data?.Theme.Version ?? 1), [brand, accent, configQuery.data?.Theme.Version]);
    const invalidFormat = !colorPattern.test(brand.trim()) || (accent.trim() !== "" && !colorPattern.test(accent.trim()));
    const lowContrast = !invalidFormat && (whiteTextContrast(brand) ?? 0) < 4.5;
    const dirty = !!configQuery.data && (brand.toUpperCase() !== configQuery.data.Theme.Brand || accent.toUpperCase() !== configQuery.data.Theme.Accent || logo.dirty || favicon.dirty);
    const disabled = !canManage || saving;
    const previewStyle = theme ? {"--ev-brand": theme.Brand, "--ev-accent-light": theme.AccentLight, "--ev-accent-dark": theme.AccentDark, "--ev-accent-live": theme.AccentLive} as CSSProperties : undefined;
    const changeBrand = (value: string) => setEdit({eventID, brand: value, accent});
    const changeAccent = (value: string) => setEdit({eventID, brand, accent: value});
    async function offerPalette(file: File) {
        if (configQuery.data?.Theme.Brand.toUpperCase() !== defaultBrand || brand.toUpperCase() !== defaultBrand) return;
        const palette = await paletteFromLogo(file);
        if (palette && (whiteTextContrast(palette.brand) ?? 0) >= 4.5) setSuggestion(palette);
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!theme || logo.uploading || favicon.uploading) return;
        setSaving(true);
        try {
            const result = await putManageAppearance(eventID, {Brand: brand.trim(), Accent: accent.trim(), Logo: logo.change, Favicon: favicon.change});
            queryClient.setQueryData(["event-management-config", eventID], result.Config);
            queryClient.setQueryData<PublicEventInfo>(["event-manager-public-info"], current =>
                current?.EventID === eventID ? {...current, LogoURL: result.LogoURL, FaviconURL: result.FaviconURL, Theme: result.Config.Theme} : current
            );
            setEdit(null); logo.saved(resolveEventLogoURL(result.LogoURL) ?? ""); favicon.saved(resolveEventLogoURL(result.FaviconURL) ?? ""); setSuggestion(null);
            const root = document.documentElement;
            root.style.setProperty("--ev-brand", result.Config.Theme.Brand);
            root.style.setProperty("--ev-accent-light", result.Config.Theme.AccentLight);
            root.style.setProperty("--ev-accent-dark", result.Config.Theme.AccentDark);
            root.style.setProperty("--ev-accent-live", result.Config.Theme.AccentLive);
            toast.success(t("manage.appearance.saved"));
            router.refresh();
        } catch (error) {
            toast.error(error instanceof ManageApiError && error.status === 409 ? t("manage.appearance.conflict") : t("manage.appearance.saveFailed"));
        } finally {setSaving(false);}
    }

    if (configQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || !configQuery.data) return <div className="event-manage-error" role="alert"><h1>{t("manage.appearance.loadFailed")}</h1><button className="ib-btn" onClick={() => void configQuery.refetch()}>{t("common.retry")}</button></div>;

    return <form className="event-manage-settings event-manage-appearance" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>{t("manage.appearance.title")}</h1><p>{t("manage.appearance.lead")}</p></div></header>
        {!canManage && <p className="event-manage-notice">{t("manage.appearance.readOnly")}</p>}
        <div className="event-manage-grid">
            <div className="event-manage-forms">
                <section className="event-manage-section">
                    <div className="event-manage-section__head"><h2>{t("manage.appearance.images")}</h2><p>{t("manage.appearance.imagesLead")}</p></div>
                    <BrandDraftField id="event-logo" title={t("manage.appearance.logo")} help={t("manage.appearance.logoHelp")} hint={t("manage.appearance.logoHint")} kind="logo" draft={logo} disabled={disabled} onFileSelected={file => {void offerPalette(file);}} />
                    <BrandDraftField id="event-favicon" title={t("manage.appearance.favicon")} help={t("manage.appearance.faviconHelp")} hint={t("manage.appearance.faviconHint")} kind="favicon" draft={favicon} disabled={disabled} />
                </section>
                <section className="event-manage-section">
                    <div className="event-manage-section__head event-brand-section-head"><div><h2>{t("manage.appearance.colors")}</h2><p>{t("manage.appearance.colorsLead")}</p></div>{(brand.toUpperCase() !== defaultBrand || accent) && !disabled && <EventTooltip content={t("manage.appearance.resetAll")}>{id => <button className="event-brand-reset-icon" type="button" aria-label={t("manage.appearance.resetAll")} aria-describedby={id} onClick={() => setEdit({eventID, brand: defaultBrand, accent: ""})}><RotateCcw size={16} /></button>}</EventTooltip>}</div>
                    <div className="event-manage-fields-two"><ColorField title={t("manage.appearance.brand")} help={t("manage.appearance.brandHelp")} value={brand} fallback={defaultBrand} onChange={changeBrand} disabled={disabled} /><ColorField title={t("manage.appearance.accent")} help={t("manage.appearance.accentHelp")} value={accent} fallback="#FFFFFF" onChange={changeAccent} disabled={disabled} optional /></div>
                    {invalidFormat ? <p className="event-manage-validation" role="alert">{t("manage.appearance.invalidColor")}</p> : lowContrast ? <p className="event-manage-validation event-manage-validation--warning" role="status">{t("manage.appearance.lowContrast")}</p> : null}
                </section>
            </div>
            <aside className="event-manage-preview" aria-label={t("manage.appearance.previewLabel")}>
                <div className="event-manage-preview__head"><h2>{t("manage.appearance.preview")}</h2><p>{t("manage.appearance.previewLead")}</p></div>
                <div className="event-manage-preview__sample" style={previewStyle} data-theme="light"><div className="event-manage-preview__mass"><span className="event-brand-preview-logo">{logo.source && <img src={logo.source} alt="" />}{event.Name}</span><strong>{t("manage.appearance.lightTheme")}</strong></div><div className="event-manage-preview__body"><span className="ib-btn ib-btn--primary">{t("manage.appearance.primaryAction")}</span><span className="event-manage-preview__accent">{t("manage.appearance.accentElement")}</span></div></div>
                <div className="event-manage-preview__sample" style={previewStyle} data-theme="dark"><div className="event-manage-preview__body"><strong>{t("manage.appearance.darkTheme")}</strong><span className="event-manage-preview__accent">{t("manage.appearance.accentElement")}</span></div></div>
            </aside>
        </div>
        {(dirty || saving) && <div className="event-manage-savebar"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !theme || logo.uploading || favicon.uploading} busy={saving}>{t("common.save")}</EventButton></div>}
        <Dialog open={suggestion !== null} onOpenChange={open => {if (!open) setSuggestion(null);}}><DialogContent className="event-brand-palette-dialog"><DialogHeader><DialogTitle>{t("manage.appearance.paletteTitle")}</DialogTitle><DialogDescription>{t("manage.appearance.paletteBody")}</DialogDescription></DialogHeader>{suggestion && <div className="event-brand-palette-dialog__colors"><div><span>{t("manage.appearance.brand")}</span><strong><i style={{backgroundColor: suggestion.brand}} />{suggestion.brand}</strong></div><div><span>{t("manage.appearance.accent")}</span><strong><i style={{backgroundColor: suggestion.accent || "#FFFFFF"}} />{suggestion.accent || t("manage.appearance.undefined")}</strong></div></div>}<div className="event-brand-palette-dialog__actions"><button className="ib-btn" type="button" onClick={() => setSuggestion(null)}>{t("manage.appearance.keepCurrent")}</button><button className="ib-btn ib-btn--primary" type="button" disabled={disabled} onClick={() => {if (suggestion && (whiteTextContrast(suggestion.brand) ?? 0) >= 4.5) setEdit({eventID, brand: suggestion.brand, accent: suggestion.accent}); setSuggestion(null);}}>{t("manage.appearance.applyColors")}</button></div></DialogContent></Dialog>
    </form>;
}
