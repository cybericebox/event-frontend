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

const defaultBrand = "#211A52";
const colorPattern = /^#[0-9a-fA-F]{6}$/;

function ColorField({title, help, value, fallback, onChange, disabled, optional = false}: {
    title: string; help: string; value: string; fallback: string; onChange: (value: string) => void; disabled: boolean; optional?: boolean;
}) {
    return <div className="event-manage-field">
        <div className="event-brand-field__head"><span>{title}{!optional && <span className="event-field-required" aria-label="Обов’язкове поле">*</span>}</span><EventTooltip content={<span className="event-brand-tooltip-copy">{help}</span>}>{id => <button className="event-brand-help" type="button" aria-label={`Про поле «${title}»`} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>
        <div className="event-manage-color"><label className="event-color-picker"><span className="event-color-swatch" style={{backgroundColor: colorPattern.test(value) ? value : fallback}} /><input type="color" aria-label={`Обрати ${title.toLowerCase()}`} value={colorPattern.test(value) ? value : fallback} onChange={event => onChange(event.target.value)} disabled={disabled} /></label><input className="event-manage-input" aria-label={title} value={value} onChange={event => onChange(event.target.value)} placeholder={fallback} maxLength={7} disabled={disabled} />{value !== (optional ? "" : defaultBrand) && !disabled && <EventTooltip content={`Скинути ${title.toLowerCase()}`}>{id => <button className="event-brand-reset-icon" type="button" aria-label={`Скинути ${title.toLowerCase()}`} aria-describedby={id} onClick={() => onChange(optional ? "" : defaultBrand)}><RotateCcw size={15} /></button>}</EventTooltip>}</div>
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
            toast.success("Вигляд події збережено");
            router.refresh();
        } catch (error) {
            toast.error(error instanceof ManageApiError && error.status === 409 ? "Вигляд змінився в іншому місці. Оновіть сторінку." : "Не вдалося зберегти вигляд події.");
        } finally {setSaving(false);}
    }

    if (configQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || !configQuery.data) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити вигляд</h1><button className="ib-btn" onClick={() => void configQuery.refetch()}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-appearance" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Вигляд</h1><p>Логотип, іконка й кольори сайту події.</p></div></header>
        {!canManage && <p className="event-manage-notice">Доступний лише перегляд.</p>}
        <div className="event-manage-grid">
            <div className="event-manage-forms">
                <section className="event-manage-section">
                    <div className="event-manage-section__head"><h2>Зображення</h2><p>Файли стануть видимими на сайті після збереження.</p></div>
                    <BrandDraftField id="event-logo" title="Логотип" help="Показується в навігації та завантажувачі. Якщо його немає, використовується логотип платформи." hint="PNG, JPEG або WebP до 2 МБ" kind="logo" draft={logo} disabled={disabled} onFileSelected={file => {void offerPalette(file);}} />
                    <BrandDraftField id="event-favicon" title="Іконка" help="Значок на вкладці браузера. Якщо його немає, використовується іконка платформи." hint="PNG до 512 КБ · рекомендовано квадратне зображення 32 × 32 пікселі" kind="favicon" draft={favicon} disabled={disabled} />
                </section>
                <section className="event-manage-section">
                    <div className="event-manage-section__head event-brand-section-head"><div><h2>Кольори</h2><p>Похідні кольори для світлої та темної теми обчислюються автоматично.</p></div>{(brand.toUpperCase() !== defaultBrand || accent) && !disabled && <EventTooltip content="Скинути всю тему">{id => <button className="event-brand-reset-icon" type="button" aria-label="Скинути всю тему" aria-describedby={id} onClick={() => setEdit({eventID, brand: defaultBrand, accent: ""})}><RotateCcw size={16} /></button>}</EventTooltip>}</div>
                    <div className="event-manage-fields-two"><ColorField title="Брендовий колір" help={"Основний колір події.\nМає бути достатньо контрастним для білого тексту."} value={brand} fallback={defaultBrand} onChange={changeBrand} disabled={disabled} /><ColorField title="Акцентний колір" help={"Додатковий колір для посилань і виділень.\nЯкщо поле порожнє, використовується брендовий колір."} value={accent} fallback="#FFFFFF" onChange={changeAccent} disabled={disabled} optional /></div>
                    {invalidFormat ? <p className="event-manage-validation" role="alert">Вкажіть колір у форматі #RRGGBB.</p> : lowContrast ? <p className="event-manage-validation event-manage-validation--warning" role="status">Білий текст на цьому брендовому кольорі може бути погано читабельним.</p> : null}
                </section>
            </div>
            <aside className="event-manage-preview" aria-label="Попередній перегляд вигляду">
                <div className="event-manage-preview__head"><h2>Попередній перегляд</h2><p>Тут зміни видно одразу; на сайті — після збереження.</p></div>
                <div className="event-manage-preview__sample" style={previewStyle} data-theme="light"><div className="event-manage-preview__mass"><span className="event-brand-preview-logo">{logo.source && <img src={logo.source} alt="" />}{event.Name}</span><strong>Світла тема</strong></div><div className="event-manage-preview__body"><span className="ib-btn ib-btn--primary">Основна дія</span><span className="event-manage-preview__accent">Акцентний елемент</span></div></div>
                <div className="event-manage-preview__sample" style={previewStyle} data-theme="dark"><div className="event-manage-preview__body"><strong>Темна тема</strong><span className="event-manage-preview__accent">Акцентний елемент</span></div></div>
            </aside>
        </div>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !theme || logo.uploading || favicon.uploading}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
        <Dialog open={suggestion !== null} onOpenChange={open => {if (!open) setSuggestion(null);}}><DialogContent className="event-brand-palette-dialog"><DialogHeader><DialogTitle>Кольори з логотипа</DialogTitle><DialogDescription>Можна застосувати знайдені кольори до теми. Зміни набудуть чинності після збереження.</DialogDescription></DialogHeader>{suggestion && <div className="event-brand-palette-dialog__colors"><div><span>Брендовий колір</span><strong><i style={{backgroundColor: suggestion.brand}} />{suggestion.brand}</strong></div><div><span>Акцентний колір</span><strong><i style={{backgroundColor: suggestion.accent || "#FFFFFF"}} />{suggestion.accent || "Не визначено"}</strong></div></div>}<div className="event-brand-palette-dialog__actions"><button className="ib-btn" type="button" onClick={() => setSuggestion(null)}>Залишити поточні</button><button className="ib-btn ib-btn--primary" type="button" disabled={disabled} onClick={() => {if (suggestion && (whiteTextContrast(suggestion.brand) ?? 0) >= 4.5) setEdit({eventID, brand: suggestion.brand, accent: suggestion.accent}); setSuggestion(null);}}>Застосувати кольори</button></div></DialogContent></Dialog>
    </form>;
}
