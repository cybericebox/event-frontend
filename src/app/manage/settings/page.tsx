"use client";

import {useMemo, useState, type CSSProperties, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, Check, Info} from "lucide-react";
import Link from "next/link";
import {getManageConfig, getManageLifecycle, getManageName, ManageApiError, putManageConfig, putManageName, putManageTheme, uploadManageLogo, removeManageLogo, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {deriveTheme} from "@/components/event/manage/deriveTheme";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";

type ConfigDraft = ManageConfigInput;
type Section = "name" | "config" | "theme" | "logo";

const registrationOptions = [{value: 0, label: "Закрита"}, {value: 1, label: "За схваленням"}, {value: 2, label: "Відкрита"}];
const visibilityOptions = [{value: 0, label: "Приховано"}, {value: 1, label: "Учасникам"}, {value: 2, label: "Усім"}];
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const defaultBrand = "#211A52";

function asInput(config: ManageConfig): ConfigDraft {
    return {
        Participation: config.Participation,
        Registration: config.Registration,
        ScoreboardVisibility: config.ScoreboardVisibility,
        ParticipantsVisibility: config.ParticipantsVisibility,
        PreviewDescription: config.PreviewDescription,
        PreviewPicture: config.PreviewPicture,
        MaxTeamSize: config.MaxTeamSize,
        MinTeamSize: config.MinTeamSize,
        MaxTeams: config.MaxTeams,
        DynamicLabsPlanned: config.DynamicLabsPlanned,
    };
}

function numberOrNull(value: string): number | null {
    return value === "" ? null : Number(value);
}

function errorText(error: unknown): string {
    if (error instanceof ManageApiError) {
        if (error.status === 403) return "Немає права змінювати цю подію. Оновіть сторінку, щоб перевірити доступ.";
        if (error.status === 400) return "Сервер відхилив значення. Перевірте поля і спробуйте ще раз.";
        if (error.status === 409) return "Налаштування змінилися в іншому місці. Оновіть сторінку перед повторним збереженням.";
    }
    return "Не вдалося зберегти. Перевірте з’єднання і спробуйте ще раз.";
}

export default function ManageSettingsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const [nameEdit, setNameEdit] = useState<{eventID: string; value: string} | null>(null);
    const [configEdit, setConfigEdit] = useState<{eventID: string; value: ConfigDraft} | null>(null);
    const [themeEdit, setThemeEdit] = useState<{eventID: string; brand: string; accent: string} | null>(null);
    const [saving, setSaving] = useState<Section | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const nameQuery = useQuery({queryKey: ["event-management-name", eventID], queryFn: () => getManageName(eventID), enabled: !!eventID, refetchInterval: false, refetchOnWindowFocus: false});
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), enabled: !!eventID, refetchInterval: false, refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), enabled: !!eventID, refetchInterval: false, refetchOnWindowFocus: false});

    const nameDraft = nameEdit?.eventID === eventID ? nameEdit.value : nameQuery.data?.Name ?? "";
    const configDraft = configEdit?.eventID === eventID ? configEdit.value : configQuery.data ? asInput(configQuery.data) : null;
    const brandDraft = themeEdit?.eventID === eventID ? themeEdit.brand : configQuery.data?.Theme.Brand ?? defaultBrand;
    const accentDraft = themeEdit?.eventID === eventID ? themeEdit.accent : configQuery.data?.Theme.Accent ?? "";
    const setNameDraft = (value: string) => setNameEdit({eventID, value});
    const setConfigDraft = (value: ConfigDraft) => setConfigEdit({eventID, value});
    const setBrandDraft = (brand: string) => setThemeEdit({eventID, brand, accent: accentDraft});
    const setAccentDraft = (accent: string) => setThemeEdit({eventID, brand: brandDraft, accent});

    const previewTheme = useMemo(() => deriveTheme(brandDraft, accentDraft, configQuery.data?.Theme.Version ?? 1), [brandDraft, accentDraft, configQuery.data?.Theme.Version]);
    const nameDirty = !!nameQuery.data && nameDraft.trim() !== nameQuery.data.Name;
    const configDirty = !!configQuery.data && !!configDraft && JSON.stringify(configDraft) !== JSON.stringify(asInput(configQuery.data));
    const themeDirty = !!configQuery.data && (brandDraft.toUpperCase() !== configQuery.data.Theme.Brand || accentDraft.toUpperCase() !== configQuery.data.Theme.Accent);
    const validTeamLimits = !!configDraft && configDraft.MaxTeamSize >= 1 && (!configDraft.MinTeamSize || configDraft.MinTeamSize <= configDraft.MaxTeamSize) && (!configDraft.MaxTeams || configDraft.MaxTeams >= 1);
    const validPicture = !configDraft?.PreviewPicture || /^https:\/\/[^/]+/.test(configDraft.PreviewPicture);
    const previewStyle = previewTheme ? {
        "--ev-brand": previewTheme.Brand,
        "--ev-accent-light": previewTheme.AccentLight,
        "--ev-accent-dark": previewTheme.AccentDark,
        "--ev-accent-live": previewTheme.AccentLive,
    } as CSSProperties : undefined;

    async function save(section: Section, request: () => Promise<unknown>) {
        setSaving(section); setError(""); setMessage("");
        try {
            await request();
            setMessage("Зміни збережено");
            router.refresh();
        } catch (failure) {
            setError(errorText(failure));
        } finally {
            setSaving(null);
        }
    }

    async function saveName(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await save("name", async () => {
            const updated = await putManageName(eventID, nameDraft.trim());
            queryClient.setQueryData(["event-management-name", eventID], updated);
            setNameEdit(null);
        });
    }

    async function saveConfig(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!configDraft) return;
        await save("config", async () => {
            const updated = await putManageConfig(eventID, configDraft);
            queryClient.setQueryData(["event-management-config", eventID], updated);
            setConfigEdit(null);
        });
    }

    async function saveTheme(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!previewTheme) return;
        await save("theme", async () => {
            const updated = await putManageTheme(eventID, {Brand: brandDraft.trim(), Accent: accentDraft.trim()});
            queryClient.setQueryData(["event-management-config", eventID], updated);
            setThemeEdit(null);
            const root = document.documentElement;
            root.style.setProperty("--ev-brand", updated.Theme.Brand);
            root.style.setProperty("--ev-accent-light", updated.Theme.AccentLight);
            root.style.setProperty("--ev-accent-dark", updated.Theme.AccentDark);
            root.style.setProperty("--ev-accent-live", updated.Theme.AccentLive);
        });
    }

    async function uploadLogo(file: File | undefined) {
        if (!file) return;
        await save("logo", async () => {
            await uploadManageLogo(eventID, file);
            window.location.reload();
        });
    }

    async function resetLogo() {
        await save("logo", async () => {
            await removeManageLogo(eventID);
            window.location.reload();
        });
    }

    if (!eventID || nameQuery.isPending || configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} label="Завантажуємо налаштування події…" />;
    if (nameQuery.isError || configQuery.isError || lifecycleQuery.isError || !configDraft || !configQuery.data || !lifecycleQuery.data) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити налаштування</h1><p>Перевірте з’єднання і повторіть запит.</p><button className="ib-btn" onClick={() => { void nameQuery.refetch(); void configQuery.refetch(); void lifecycleQuery.refetch(); }}>Повторити</button></div>;
    const participationLocked = lifecycleQuery.data.Configured && lifecycleQuery.data.Status !== "not_published";

    return <div className="event-manage-settings">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">Керування подією</p><h1>Основні налаштування</h1><p>Назва, участь і вигляд сайту події.</p></div><Link className="ib-btn" href="/">Переглянути сайт <ArrowUpRight size={16} /></Link></header>
        {!canManage && <div className="event-manage-notice" role="status"><Info size={18} />Доступний лише перегляд. Змінювати налаштування може менеджер події.</div>}
        {error && <div className="event-manage-feedback event-manage-feedback--error" role="alert">{error}</div>}
        {message && <div className="event-manage-feedback" role="status"><Check size={16} />{message}</div>}

        <div className="event-manage-grid">
            <div className="event-manage-forms">
                <form className="event-manage-section" onSubmit={saveName}>
                    <div className="event-manage-section__head"><div><h2>Назва</h2><p>Відображається на сайті та в навігації.</p></div></div>
                    <label className="event-manage-field"><span>Публічна назва</span><input className="event-manage-input" value={nameDraft} onChange={event => setNameDraft(event.target.value)} maxLength={255} required disabled={!canManage || saving !== null} /></label>
                    <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || !nameDirty || !nameDraft.trim() || saving !== null}>{saving === "name" ? "Зберігаємо…" : "Зберегти назву"}</button></div>
                </form>

                <section className="event-manage-section" aria-labelledby="event-logo-title">
                    <div className="event-manage-section__head"><div><h2 id="event-logo-title">Логотип події</h2><p>Показується на сайті та під час завантаження. Якщо його немає, використовується логотип платформи.</p></div></div>
                    <div className="event-manage-logo-preview"><EventBrandLogo event={event} size={72} /><span>{event.LogoURL ? "Логотип події" : "Логотип платформи"}</span></div>
                    <div className="event-manage-section__actions event-manage-logo-actions">
                        <label className={`ib-btn${!canManage || saving !== null ? " is-disabled" : ""}`}>
                            Завантажити логотип
                            <input className="event-manage-visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" disabled={!canManage || saving !== null} onChange={change => {void uploadLogo(change.target.files?.[0]); change.target.value = "";}} />
                        </label>
                        <button className="ib-btn" type="button" disabled={!canManage || !event.LogoURL || saving !== null} onClick={() => void resetLogo()}>Скинути до логотипа платформи</button>
                    </div>
                    <small>PNG, JPEG або WebP до 2 МБ.</small>
                </section>

                <form className="event-manage-section" onSubmit={saveConfig}>
                    <div className="event-manage-section__head"><div><h2>Участь і видимість</h2><p>Визначте спосіб участі та те, що бачать відвідувачі.</p></div></div>
                    <div className="event-manage-fields-two">
                        <div className="event-manage-field"><span>Формат участі <span aria-label="Обов’язкове поле">*</span></span><EventSelect ariaLabel="Формат участі" value={String(configDraft.Participation ?? "")} options={[{value: "", label: "Оберіть формат"}, {value: "0", label: "Особистий"}, {value: "1", label: "Командний"}]} onValueChange={value => setConfigDraft({...configDraft, Participation: value === "" ? null : Number(value) as 0 | 1})} disabled={!canManage || participationLocked || saving !== null} /><small>{participationLocked ? "Після публікації формат участі зафіксовано." : "Формат можна змінювати до публікації."}</small></div>
                        <div className="event-manage-field"><span>Реєстрація <span aria-label="Обов’язкове поле">*</span></span><EventSelect ariaLabel="Реєстрація" value={String(configDraft.Registration)} options={registrationOptions.map(option => ({value: String(option.value), label: option.label}))} onValueChange={value => setConfigDraft({...configDraft, Registration: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving !== null} /></div>
                        <div className="event-manage-field"><span>Результати <span aria-label="Обов’язкове поле">*</span></span><EventSelect ariaLabel="Видимість результатів" value={String(configDraft.ScoreboardVisibility)} options={visibilityOptions.map(option => ({value: String(option.value), label: option.label}))} onValueChange={value => setConfigDraft({...configDraft, ScoreboardVisibility: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving !== null} /></div>
                        <div className="event-manage-field"><span>Список учасників <span aria-label="Обов’язкове поле">*</span></span><EventSelect ariaLabel="Видимість учасників" value={String(configDraft.ParticipantsVisibility)} options={visibilityOptions.map(option => ({value: String(option.value), label: option.label}))} onValueChange={value => setConfigDraft({...configDraft, ParticipantsVisibility: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving !== null} /></div>
                    </div>
                    <label className="event-manage-field"><span>Короткий опис</span><textarea className="event-manage-input" value={configDraft.PreviewDescription} onChange={event => setConfigDraft({...configDraft, PreviewDescription: event.target.value})} maxLength={1000} rows={3} disabled={!canManage || saving !== null} /><small>Для прев’ю та списку подій. Повний вміст головної налаштовується окремо.</small></label>
                    <label className="event-manage-field"><span>Посилання на зображення прев’ю</span><input className="event-manage-input" type="url" value={configDraft.PreviewPicture} onChange={event => setConfigDraft({...configDraft, PreviewPicture: event.target.value})} placeholder="https://…" disabled={!canManage || saving !== null} /><small>Лише захищене посилання HTTPS.</small></label>
                    {configDraft.Participation === 1 && <div className="event-manage-fields-three">
                        <label className="event-manage-field"><span>Максимум у команді</span><input className="event-manage-input" type="number" min={1} value={configDraft.MaxTeamSize} onChange={event => setConfigDraft({...configDraft, MaxTeamSize: Number(event.target.value)})} disabled={!canManage || participationLocked || saving !== null} /></label>
                        <label className="event-manage-field"><span>Мінімум у команді</span><input className="event-manage-input" type="number" min={1} max={configDraft.MaxTeamSize} value={configDraft.MinTeamSize ?? ""} onChange={event => setConfigDraft({...configDraft, MinTeamSize: numberOrNull(event.target.value)})} placeholder="Без обмеження" disabled={!canManage || participationLocked || saving !== null} /></label>
                        <label className="event-manage-field"><span>Кількість команд</span><input className="event-manage-input" type="number" min={1} value={configDraft.MaxTeams ?? ""} onChange={event => setConfigDraft({...configDraft, MaxTeams: numberOrNull(event.target.value)})} placeholder="Без обмеження" disabled={!canManage || saving !== null} /></label>
                    </div>}
                    <label className="event-manage-field"><span>Динамічні лабораторії</span><span className="event-manage-check"><input type="checkbox" checked={configDraft.DynamicLabsPlanned} onChange={event => setConfigDraft({...configDraft, DynamicLabsPlanned: event.target.checked})} disabled={!canManage || saving !== null} /><span>Плануються динамічні лабораторії</span></span><small>Для лабораторій буде підготовлено VPN та інтернет-шлюз. Учасники з командою зможуть перевірити VPN до старту; завдання можна додати пізніше.</small></label>
                    <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || !configDirty || !validTeamLimits || !validPicture || saving !== null}>{saving === "config" ? "Зберігаємо…" : "Зберегти параметри"}</button></div>
                </form>

                <form className="event-manage-section" onSubmit={saveTheme}>
                    <div className="event-manage-section__head"><div><h2>Кольори події</h2><p>Уся палітра сайту обчислюється з бренду та необов’язкового акценту.</p></div></div>
                    <div className="event-manage-fields-two">
                        <div className="event-manage-field"><label className="event-manage-field__label"><span>Брендовий колір</span><span className="event-manage-color"><input type="color" aria-label="Обрати брендовий колір" value={colorPattern.test(brandDraft) ? brandDraft : defaultBrand} onChange={event => setBrandDraft(event.target.value)} disabled={!canManage || saving !== null} /><input className="event-manage-input" value={brandDraft} onChange={event => setBrandDraft(event.target.value)} placeholder={defaultBrand} maxLength={7} disabled={!canManage || saving !== null} /></span><small>Колір має залишатися читабельним із білим текстом.</small></label><button className="event-manage-field__reset" type="button" onClick={() => setBrandDraft(defaultBrand)} disabled={!canManage || saving !== null || brandDraft.toUpperCase() === defaultBrand}>Скинути брендовий колір</button></div>
                        <div className="event-manage-field"><label className="event-manage-field__label"><span>Акцент</span><span className="event-manage-color"><input type="color" aria-label="Обрати акцент" value={colorPattern.test(accentDraft) ? accentDraft : "#5CCB7C"} onChange={event => setAccentDraft(event.target.value)} disabled={!canManage || saving !== null} /><input className="event-manage-input" value={accentDraft} onChange={event => setAccentDraft(event.target.value)} placeholder="Необов’язково" maxLength={7} disabled={!canManage || saving !== null} /></span><small>Якщо порожньо, використовується брендовий колір.</small></label><button className="event-manage-field__reset" type="button" onClick={() => setAccentDraft("")} disabled={!canManage || saving !== null || !accentDraft}>Скинути акцент</button></div>
                    </div>
                    {!previewTheme && <p className="event-manage-validation" role="alert">Введіть кольори у форматі #RRGGBB. Бренд має мати достатній контраст із білим.</p>}
                    <div className="event-manage-section__actions"><button className="ib-btn" type="button" onClick={() => setThemeEdit({eventID, brand: defaultBrand, accent: ""})} disabled={!canManage || saving !== null || (brandDraft.toUpperCase() === defaultBrand && !accentDraft)}>Скинути всю тему</button><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || !themeDirty || !previewTheme || saving !== null}>{saving === "theme" ? "Зберігаємо…" : "Зберегти кольори"}</button></div>
                </form>
            </div>
            <aside className="event-manage-preview" aria-label="Попередній перегляд кольорів">
                <div className="event-manage-preview__head"><h2>Попередній перегляд</h2><p>Тема змінюється відразу; на сайті — після збереження.</p></div>
                <div className="event-manage-preview__sample" style={previewStyle} data-theme="light"><div className="event-manage-preview__mass"><span>CyberICEBox / Подія</span><strong>{nameDraft || "Назва події"}</strong><span>Місце для короткого опису</span></div><div className="event-manage-preview__body"><span>Світла тема</span><span className="ib-btn ib-btn--primary">Дія події</span><span className="event-manage-preview__accent">Акцентний елемент</span></div></div>
                <div className="event-manage-preview__sample" style={previewStyle} data-theme="dark"><div className="event-manage-preview__body"><span>Темна тема</span><strong>{nameDraft || "Назва події"}</strong><span className="event-manage-preview__accent">Акцентний елемент</span></div></div>
                <p className="event-manage-preview__note">Контраст акценту для світлої, темної та Live-теми розраховується з вибраних кольорів.</p>
            </aside>
        </div>
    </div>;
}
