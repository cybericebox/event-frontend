"use client";

import {useEffect, useMemo, useState, type CSSProperties, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, Check, Info} from "lucide-react";
import Link from "next/link";
import {getManageConfig, getManageLifecycle, getManageName, ManageApiError, putManageConfig, putManageName, putManageTheme, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {deriveTheme} from "@/components/event/manage/deriveTheme";
import {useManager} from "@/components/event/manage/ManagerShell";

type ConfigDraft = ManageConfigInput;
type Section = "name" | "config" | "theme";

const registrationOptions = [{value: 0, label: "Закрита"}, {value: 1, label: "За схваленням"}, {value: 2, label: "Відкрита"}];
const visibilityOptions = [{value: 0, label: "Приховано"}, {value: 1, label: "Учасникам"}, {value: 2, label: "Усім"}];
const colorPattern = /^#[0-9a-fA-F]{6}$/;

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
    const [nameDraft, setNameDraft] = useState("");
    const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);
    const [brandDraft, setBrandDraft] = useState("");
    const [accentDraft, setAccentDraft] = useState("");
    const [saving, setSaving] = useState<Section | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const nameQuery = useQuery({queryKey: ["event-management-name", eventID], queryFn: () => getManageName(eventID), enabled: !!eventID, refetchInterval: false, refetchOnWindowFocus: false});
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), enabled: !!eventID, refetchInterval: false, refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), enabled: !!eventID, refetchInterval: false, refetchOnWindowFocus: false});

    useEffect(() => { if (nameQuery.data) setNameDraft(nameQuery.data.Name); }, [nameQuery.data]);
    useEffect(() => {
        if (configQuery.data) {
            setConfigDraft(asInput(configQuery.data));
            setBrandDraft(configQuery.data.Theme.Brand);
            setAccentDraft(configQuery.data.Theme.Accent);
        }
    }, [configQuery.data]);

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
        });
    }

    async function saveConfig(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!configDraft) return;
        await save("config", async () => {
            const updated = await putManageConfig(eventID, configDraft);
            queryClient.setQueryData(["event-management-config", eventID], updated);
        });
    }

    async function saveTheme(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!previewTheme) return;
        await save("theme", async () => {
            const updated = await putManageTheme(eventID, {Brand: brandDraft.trim(), Accent: accentDraft.trim()});
            queryClient.setQueryData(["event-management-config", eventID], updated);
            const root = document.documentElement;
            root.style.setProperty("--ev-brand", updated.Theme.Brand);
            root.style.setProperty("--ev-accent-light", updated.Theme.AccentLight);
            root.style.setProperty("--ev-accent-dark", updated.Theme.AccentDark);
            root.style.setProperty("--ev-accent-live", updated.Theme.AccentLive);
        });
    }

    if (!eventID || nameQuery.isPending || configQuery.isPending || lifecycleQuery.isPending) return <div className="event-manage-loading" role="status">Завантажуємо налаштування події…</div>;
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

                <form className="event-manage-section" onSubmit={saveConfig}>
                    <div className="event-manage-section__head"><div><h2>Участь і видимість</h2><p>Визначте спосіб участі та те, що бачать відвідувачі.</p></div></div>
                    <div className="event-manage-fields-two">
                        <label className="event-manage-field"><span>Формат участі</span><select className="event-manage-input" value={configDraft.Participation ?? ""} onChange={event => setConfigDraft({...configDraft, Participation: event.target.value === "" ? null : Number(event.target.value) as 0 | 1})} disabled={!canManage || participationLocked || saving !== null}><option value="">Оберіть формат</option><option value="0">Особистий</option><option value="1">Командний</option></select><small>{participationLocked ? "Після публікації формат участі зафіксовано." : "Формат можна змінювати до публікації."}</small></label>
                        <label className="event-manage-field"><span>Реєстрація</span><select className="event-manage-input" value={configDraft.Registration} onChange={event => setConfigDraft({...configDraft, Registration: Number(event.target.value) as 0 | 1 | 2})} disabled={!canManage || saving !== null}>{registrationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="event-manage-field"><span>Результати</span><select className="event-manage-input" value={configDraft.ScoreboardVisibility} onChange={event => setConfigDraft({...configDraft, ScoreboardVisibility: Number(event.target.value) as 0 | 1 | 2})} disabled={!canManage || saving !== null}>{visibilityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="event-manage-field"><span>Список учасників</span><select className="event-manage-input" value={configDraft.ParticipantsVisibility} onChange={event => setConfigDraft({...configDraft, ParticipantsVisibility: Number(event.target.value) as 0 | 1 | 2})} disabled={!canManage || saving !== null}>{visibilityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    </div>
                    <label className="event-manage-field"><span>Короткий опис</span><textarea className="event-manage-input" value={configDraft.PreviewDescription} onChange={event => setConfigDraft({...configDraft, PreviewDescription: event.target.value})} maxLength={1000} rows={3} disabled={!canManage || saving !== null} /><small>Для прев’ю та списку подій. Повний вміст головної налаштовується окремо.</small></label>
                    <label className="event-manage-field"><span>Посилання на зображення прев’ю</span><input className="event-manage-input" type="url" value={configDraft.PreviewPicture} onChange={event => setConfigDraft({...configDraft, PreviewPicture: event.target.value})} placeholder="https://…" disabled={!canManage || saving !== null} /><small>Лише захищене посилання HTTPS.</small></label>
                    {configDraft.Participation === 1 && <div className="event-manage-fields-three">
                        <label className="event-manage-field"><span>Максимум у команді</span><input className="event-manage-input" type="number" min={1} value={configDraft.MaxTeamSize} onChange={event => setConfigDraft({...configDraft, MaxTeamSize: Number(event.target.value)})} disabled={!canManage || participationLocked || saving !== null} /></label>
                        <label className="event-manage-field"><span>Мінімум у команді</span><input className="event-manage-input" type="number" min={1} max={configDraft.MaxTeamSize} value={configDraft.MinTeamSize ?? ""} onChange={event => setConfigDraft({...configDraft, MinTeamSize: numberOrNull(event.target.value)})} placeholder="Без обмеження" disabled={!canManage || participationLocked || saving !== null} /></label>
                        <label className="event-manage-field"><span>Кількість команд</span><input className="event-manage-input" type="number" min={1} value={configDraft.MaxTeams ?? ""} onChange={event => setConfigDraft({...configDraft, MaxTeams: numberOrNull(event.target.value)})} placeholder="Без обмеження" disabled={!canManage || saving !== null} /></label>
                    </div>}
                    <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || !configDirty || !validTeamLimits || !validPicture || saving !== null}>{saving === "config" ? "Зберігаємо…" : "Зберегти параметри"}</button></div>
                </form>

                <form className="event-manage-section" onSubmit={saveTheme}>
                    <div className="event-manage-section__head"><div><h2>Кольори події</h2><p>Уся палітра сайту обчислюється з бренду та необов’язкового акценту.</p></div></div>
                    <div className="event-manage-fields-two">
                        <label className="event-manage-field"><span>Брендовий колір</span><span className="event-manage-color"><input type="color" aria-label="Обрати брендовий колір" value={colorPattern.test(brandDraft) ? brandDraft : "#211A52"} onChange={event => setBrandDraft(event.target.value)} disabled={!canManage || saving !== null} /><input className="event-manage-input" value={brandDraft} onChange={event => setBrandDraft(event.target.value)} placeholder="#211A52" maxLength={7} disabled={!canManage || saving !== null} /></span><small>Колір має залишатися читабельним із білим текстом.</small></label>
                        <label className="event-manage-field"><span>Акцент</span><span className="event-manage-color"><input type="color" aria-label="Обрати акцент" value={colorPattern.test(accentDraft) ? accentDraft : "#5CCB7C"} onChange={event => setAccentDraft(event.target.value)} disabled={!canManage || saving !== null} /><input className="event-manage-input" value={accentDraft} onChange={event => setAccentDraft(event.target.value)} placeholder="Необов’язково" maxLength={7} disabled={!canManage || saving !== null} /></span><small>Якщо порожньо, використовується брендовий колір.</small></label>
                    </div>
                    {!previewTheme && <p className="event-manage-validation" role="alert">Введіть кольори у форматі #RRGGBB. Бренд має мати достатній контраст із білим.</p>}
                    <div className="event-manage-section__actions"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || !themeDirty || !previewTheme || saving !== null}>{saving === "theme" ? "Зберігаємо…" : "Зберегти кольори"}</button></div>
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
