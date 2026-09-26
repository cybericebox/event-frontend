"use client";

import {useMemo, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, Check, Eye, Plus, RotateCcw, Trash2, Type} from "lucide-react";
import {createManagePage, deleteManagePage, getManageContent, getManageContentVariables, getManagePage, ManageApiError, type ManagePageInput, updateManagePage} from "@/api/manage";
import {ContentBlocks} from "@/components/event/content/ContentBlocks";
import type {ContentBlock} from "@/types/eventContent";
import {LandingBlockEditor} from "./LandingBlockEditor";
import {useManager} from "./ManagerShell";
import {validateLanding} from "./validateLanding";

const emptyPage: ManagePageInput = {
    Slug: "", Title: "", Document: {blocks: []}, Visibility: 0, Navigation: 1, NavigationOrder: 0,
};

export function CustomPageEditor({slug}: {slug?: string}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const key = slug ?? "new";
    const isNew = !slug;
    const page = useQuery({queryKey: ["event-management-page", eventID, slug], queryFn: () => getManagePage(eventID, slug!), enabled: !isNew, retry: false, refetchOnWindowFocus: false});
    const content = useQuery({queryKey: ["event-management-content", eventID], queryFn: () => getManageContent(eventID), retry: false, refetchOnWindowFocus: false});
    const definitions = useQuery({queryKey: ["event-management-content-variables", eventID], queryFn: () => getManageContentVariables(eventID), retry: false, refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<{key: string; value: ManagePageInput} | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const saved: ManagePageInput = page.data ? {
        Slug: page.data.Slug, Title: page.data.Title, Document: page.data.Document,
        Visibility: page.data.Visibility, Navigation: page.data.Navigation, NavigationOrder: page.data.NavigationOrder,
    } : emptyPage;
    const draft = edited?.key === key ? edited.value : saved;
    const catalog = useMemo(() => (definitions.data ?? []).filter(item => item.audience <= draft.Visibility), [definitions.data, draft.Visibility]);
    const values = useMemo(() => Object.fromEntries(catalog.map(item => [item.name, content.data?.Variables[item.name] ?? null])), [catalog, content.data?.Variables]);
    const documentError = definitions.data ? validateLanding(draft.Document, catalog) : null;
    const validation = draft.Slug === "new" ? "Адреса new зарезервована для створення сторінки." :
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.Slug) || draft.Slug.length > 128 ? "Адреса сторінки: латинські літери, цифри й дефіси." :
        !draft.Title.trim() || draft.Title.length > 255 ? "Вкажіть назву сторінки до 255 символів." : documentError;
    const dirty = isNew || JSON.stringify(saved) !== JSON.stringify(draft);

    function change(next: ManagePageInput) {
        setEdited({key, value: next});
        setMessage("");
        setError("");
    }
    function updateBlock(index: number, block: ContentBlock) {
        change({...draft, Document: {blocks: draft.Document.blocks.map((old, position) => position === index ? block : old)}});
    }
    function moveBlock(index: number, direction: -1 | 1) {
        const blocks = [...draft.Document.blocks];
        if (index + direction < 0 || index + direction >= blocks.length) return;
        [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
        change({...draft, Document: {blocks}});
    }
    function addBlock(type: "section" | "text") {
        const block: ContentBlock = type === "section"
            ? {id: `block-${crypto.randomUUID()}`, type, label: ""}
            : {id: `block-${crypto.randomUUID()}`, type, markdown: ""};
        change({...draft, Document: {blocks: [...draft.Document.blocks, block]}});
    }

    async function save() {
        if (!canManage || validation || !dirty || saving) return;
        setSaving(true); setError(""); setMessage("");
        try {
            const payload: ManagePageInput = {...draft, Navigation: draft.Visibility === 2 ? 0 : draft.Navigation === 0 ? 0 : 1};
            const result = isNew ? await createManagePage(eventID, payload) : await updateManagePage(eventID, page.data!.ID, payload);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-management-pages", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-navigation-pages", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-management-page", eventID]}),
            ]);
            setEdited(null);
            if (isNew || result.Slug !== slug) router.replace(`/manage/content/pages/${result.Slug}`);
            else setMessage("Сторінку збережено");
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            setError(status === 400 ? "Сервер відхилив поля або змінні сторінки." : status === 409 ? "Така адреса сторінки вже зайнята." : "Не вдалося зберегти сторінку. Повторіть запит.");
        } finally { setSaving(false); }
    }

    async function remove() {
        if (!page.data || !canManage || !window.confirm("Видалити цю сторінку?")) return;
        setSaving(true); setError("");
        try {
            await deleteManagePage(eventID, page.data.ID);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-management-pages", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-navigation-pages", eventID]}),
            ]);
            router.replace("/manage/content/landing");
        } catch {
            setError("Не вдалося видалити сторінку. Повторіть спробу.");
            setSaving(false);
        }
    }

    if (page.isError || content.isError || definitions.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити сторінку</h1><button className="ib-btn" onClick={() => void Promise.all([page.refetch(), content.refetch(), definitions.refetch()])}>Повторити</button></div>;
    if ((!isNew && page.isPending) || content.isPending || definitions.isPending) return <div className="event-manage-loading" role="status">Завантажуємо редактор…</div>;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">Сторінки</p><h1>{isNew ? "Нова сторінка" : draft.Title}</h1><p>Той самий конструктор блоків, що й на головній сторінці.</p></div>{!isNew && <Link className="ib-btn" href={`/p/${draft.Slug}`} target="_blank">Відкрити <ArrowUpRight size={16} /></Link>}</header>
        {error && <div className="event-manage-feedback event-manage-feedback--error" role="alert">{error}</div>}
        {message && <div className="event-manage-feedback" role="status"><Check size={16} />{message}</div>}
        <div className="event-manage-content__layout">
            <div className="event-content-editor">
                <div className="event-manage-page-details" aria-label="Налаштування сторінки">
                    <h2>Налаштування сторінки</h2>
                    <label className="event-manage-field"><span>Назва сторінки</span><input className="event-manage-input" value={draft.Title} disabled={!canManage || saving} onChange={e => change({...draft, Title: e.target.value})} maxLength={255} /></label>
                    <label className="event-manage-field"><span>Адреса</span><div className="event-manage-page-slug"><span>/p/</span><input className="event-manage-input" value={draft.Slug} disabled={!canManage || saving} onChange={e => change({...draft, Slug: e.target.value.toLowerCase()})} maxLength={128} /></div></label>
                    <label className="event-manage-field"><span>Доступ</span><select className="event-manage-input" value={draft.Visibility} disabled={!canManage || saving} onChange={e => {const visibility = Number(e.target.value) as 0 | 1 | 2; change({...draft, Visibility: visibility, Navigation: visibility === 2 ? 0 : draft.Navigation});}}><option value={0}>Публічна</option><option value={1}>Підтверджені учасники</option><option value={2}>Лише модератори</option></select></label>
                    <label className="event-manage-field"><span>У навігації</span><select className="event-manage-input" value={draft.Visibility === 2 ? 0 : draft.Navigation === 0 ? 0 : 1} disabled={!canManage || saving || draft.Visibility === 2} onChange={e => change({...draft, Navigation: e.target.value === "1" ? 1 : 0})}><option value={1}>Показувати</option><option value={0}>Не показувати</option></select></label>
                    <label className="event-manage-field"><span>Порядок у навігації</span><input className="event-manage-input" type="number" value={draft.NavigationOrder} disabled={!canManage || saving || draft.Navigation === 0} onChange={e => change({...draft, NavigationOrder: Number(e.target.value)})} /></label>
                </div>
                <div className="event-content-editor__top"><div><h2>Блоки сторінки</h2><p>Порядок блоків відповідає порядку на сайті.</p></div><span>{draft.Document.blocks.length}</span></div>
                {draft.Document.blocks.length === 0 && <div className="event-content-editor__empty"><Type size={24} /><strong>Сторінка поки порожня</strong><span>Додайте розділ або текст, щоб почати.</span></div>}
                <div className="event-content-editor__stack">{draft.Document.blocks.map((block, index) => <LandingBlockEditor key={block.id} block={block} index={index} count={draft.Document.blocks.length} values={values} catalog={catalog} canEdit={canManage && !saving} onUpdate={value => updateBlock(index, value)} onMove={direction => moveBlock(index, direction)} onDelete={() => change({...draft, Document: {blocks: draft.Document.blocks.filter((_, position) => position !== index)}})} />)}</div>
                {canManage && <div className="event-content-editor__add"><button className="ib-btn" type="button" onClick={() => addBlock("section")}><Plus size={16} /> Розділ</button><button className="ib-btn" type="button" onClick={() => addBlock("text")}><Plus size={16} /> Текст</button></div>}
                {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                <div className="event-content-editor__footer"><span>{dirty ? "Є незбережені зміни" : "Зміни збережено"}</span><div>{dirty && !isNew && canManage && <button className="ib-btn" type="button" onClick={() => {setEdited(null); setError("");}}><RotateCcw size={16} /> Скасувати</button>}{!isNew && canManage && <button className="ib-btn event-content-editor__delete" type="button" disabled={saving} onClick={() => void remove()}><Trash2 size={16} /> Видалити</button>}<button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || !dirty || !!validation || saving} onClick={() => void save()}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div></div>
            </div>
            <aside className="event-manage-content__preview" aria-label="Попередній перегляд сторінки"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>Вміст для вибраної аудиторії.</p></div></div><div className="event-manage-content__preview-window"><ContentBlocks document={draft.Document} variables={values} title={draft.Title || "Нова сторінка"} /></div></aside>
        </div>
    </div>;
}
