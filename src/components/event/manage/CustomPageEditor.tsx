"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, Check, Eye, Plus, RotateCcw, Trash2, Type, X} from "lucide-react";
import {createManagePage, deleteManagePage, getManageContent, getManageContentVariables, getManagePage, ManageApiError, type ManagePage, type ManagePageInput, updateManagePage} from "@/api/manage";
import {ContentBlocks, contentBlockVisible} from "@/components/event/content/ContentBlocks";
import type {ContentBlock, PageBlockType} from "@/types/eventContent";
import {LandingBlockEditor} from "./LandingBlockEditor";
import {EventSelect} from "@/components/ui/EventSelect";
import {blockPalette, createPageBlock} from "./blockPalette";
import {useManager} from "./ManagerShell";
import {EventLoading} from "../EventLoading";
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
    const [selected, setSelected] = useState<{eventID: string; key: string; blockID: string} | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const existingPages = queryClient.getQueryData<ManagePage[]>(["event-management-pages", eventID]) ?? [];
    const defaultOrder = Math.max(0, ...existingPages.map(item => item.NavigationOrder)) + 1;
    const saved: ManagePageInput = page.data ? {
        Slug: page.data.Slug, Title: page.data.Title, Document: page.data.Document,
        Visibility: page.data.Visibility, Navigation: page.data.Navigation, NavigationOrder: page.data.NavigationOrder,
    } : {...emptyPage, NavigationOrder: defaultOrder};
    const draft = edited?.key === key ? edited.value : saved;
    const selectedBlockID = selected?.eventID === eventID && selected.key === key && draft.Document.blocks.some(block => block.id === selected.blockID) ? selected.blockID : null;
    const blockOrder = draft.Document.blocks.map(block => block.id).join("|");
    const catalog = useMemo(() => (definitions.data ?? []).filter(item => item.audience <= draft.Visibility), [definitions.data, draft.Visibility]);
    const values = useMemo(() => Object.fromEntries(catalog.map(item => [item.name, content.data?.Variables[item.name] ?? null])), [catalog, content.data?.Variables]);
    const selectedBlock = draft.Document.blocks.find(block => block.id === selectedBlockID);
    const selectedHidden = selectedBlock ? !contentBlockVisible(selectedBlock, values) : false;
    const documentError = definitions.data ? validateLanding(draft.Document, catalog) : null;
    const validation = draft.Slug === "new" ? "Адреса new зарезервована для створення сторінки." :
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.Slug) || draft.Slug.length > 128 ? "Адреса сторінки: латинські літери, цифри й дефіси." :
        !draft.Title.trim() || draft.Title.length > 255 ? "Вкажіть назву сторінки до 255 символів." : documentError;
    const dirty = isNew || JSON.stringify(saved) !== JSON.stringify(draft);

    useEffect(() => {
        if (!selectedBlockID || !previewRef.current) return;
        const container = previewRef.current;
        const target = container.querySelector<HTMLElement>("[data-preview-selected]");
        if (!target) return;
        container.scrollTo({top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 20, behavior: "smooth"});
    }, [selectedBlockID, blockOrder]);

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
    function reorderBlock(sourceID: string, targetID: string) {
        const blocks = [...draft.Document.blocks];
        const from = blocks.findIndex(block => block.id === sourceID);
        const to = blocks.findIndex(block => block.id === targetID);
        if (from < 0 || to < 0 || from === to) return;
        blocks.splice(to, 0, blocks.splice(from, 1)[0]);
        change({...draft, Document: {blocks}});
        setSelected({eventID, key, blockID: sourceID});
    }
    function addBlock(type: PageBlockType) {
        const block = createPageBlock(type);
        const blocks = [...draft.Document.blocks];
        const selectedIndex = blocks.findIndex(item => item.id === selectedBlockID);
        blocks.splice(selectedIndex < 0 ? blocks.length : selectedIndex + 1, 0, block);
        change({...draft, Document: {blocks}});
        setSelected({eventID, key, blockID: block.id});
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
    if ((!isNew && page.isPending) || content.isPending || definitions.isPending) return <EventLoading event={event} label="Завантажуємо редактор…" />;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">Сторінки</p><h1>{isNew ? "Нова сторінка" : draft.Title}</h1><p>Той самий конструктор блоків, що й на головній сторінці.</p></div>{!isNew && <Link className="ib-btn" href={`/p/${draft.Slug}`} target="_blank">Відкрити <ArrowUpRight size={16} /></Link>}</header>
        {error && <div className="event-manage-feedback event-manage-feedback--error" role="alert">{error}</div>}
        {message && <div className="event-manage-feedback" role="status"><Check size={16} />{message}</div>}
        <div className={`event-manage-content__layout${selectedBlockID ? "" : " event-manage-content__layout--single"}`}>
            <div className="event-content-editor">
                <div className="event-manage-page-details" aria-label="Налаштування сторінки">
                    <h2>Налаштування сторінки</h2>
                    <label className="event-manage-field"><span>Назва сторінки</span><input className="event-manage-input" value={draft.Title} disabled={!canManage || saving} onChange={e => change({...draft, Title: e.target.value})} maxLength={255} /></label>
                    <label className="event-manage-field"><span>Адреса</span><div className="event-manage-page-slug"><span>/p/</span><input className="event-manage-input" value={draft.Slug} disabled={!canManage || saving} onChange={e => change({...draft, Slug: e.target.value.toLowerCase()})} maxLength={128} /></div></label>
                    <div className="event-manage-field"><span>Доступ</span><EventSelect ariaLabel="Доступ до сторінки" value={String(draft.Visibility)} disabled={!canManage || saving} options={[{value: "0", label: "Публічна"}, {value: "1", label: "Підтверджені учасники"}, {value: "2", label: "Лише модератори"}]} onValueChange={value => {const visibility = Number(value) as 0 | 1 | 2; change({...draft, Visibility: visibility, Navigation: visibility === 2 ? 0 : draft.Navigation});}} /></div>
                    <div className="event-manage-field"><span>У навігації</span><EventSelect ariaLabel="Показ у навігації" value={draft.Visibility === 2 || draft.Navigation === 0 ? "0" : "1"} disabled={!canManage || saving || draft.Visibility === 2} options={[{value: "1", label: "Показувати"}, {value: "0", label: "Не показувати"}]} onValueChange={value => change({...draft, Navigation: value === "1" ? 1 : 0})} /></div>
                    <label className="event-manage-field"><span>Порядок у навігації</span><input className="event-manage-input" type="number" value={draft.NavigationOrder} disabled={!canManage || saving || draft.Navigation === 0} onChange={e => change({...draft, NavigationOrder: Number(e.target.value)})} /></label>
                </div>
                <div className="event-content-editor__top"><div><h2>Блоки сторінки</h2><p>Перетягніть блок за ручку або скористайтеся стрілками. Так само вони з’являться на сайті.</p></div><span>{draft.Document.blocks.length}</span></div>
                {draft.Document.blocks.length === 0 && <div className="event-content-editor__empty"><Type size={24} /><strong>Сторінка поки порожня</strong><span>Додайте перший блок, щоб почати.</span></div>}
                <div className="event-content-editor__stack">{draft.Document.blocks.map((block, index) => <LandingBlockEditor key={block.id} block={block} index={index} count={draft.Document.blocks.length} values={values} catalog={catalog} canEdit={canManage && !saving} selected={selectedBlockID === block.id} onSelect={() => setSelected({eventID, key, blockID: block.id})} onUpdate={value => updateBlock(index, value)} onMove={direction => moveBlock(index, direction)} onReorder={reorderBlock} onDelete={() => change({...draft, Document: {blocks: draft.Document.blocks.filter((_, position) => position !== index)}})} />)}</div>
                {canManage && <div className="event-content-editor__add" aria-label="Додати блок">{blockPalette.filter(item => item.type !== "hero" || !draft.Document.blocks.some(block => block.type === "hero")).map(item => <button className="ib-btn" type="button" key={item.type} onClick={() => addBlock(item.type)}><Plus size={16} /> {item.label}</button>)}</div>}
                {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                <div className="event-content-editor__footer"><span>{dirty ? "Є незбережені зміни" : "Зміни збережено"}</span><div>{dirty && !isNew && canManage && <button className="ib-btn" type="button" onClick={() => {setEdited(null); setError("");}}><RotateCcw size={16} /> Скасувати</button>}{!isNew && canManage && <button className="ib-btn event-content-editor__delete" type="button" disabled={saving} onClick={() => void remove()}><Trash2 size={16} /> Видалити</button>}<button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || !dirty || !!validation || saving} onClick={() => void save()}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div></div>
            </div>
            {selectedBlockID && <aside className="event-manage-content__preview" aria-label="Попередній перегляд сторінки"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>{selectedHidden ? "Вибраний блок зараз приховано умовами показу." : "Вибраний блок виділено в макеті всієї сторінки."}</p></div><button className="event-manage-content__preview-close" type="button" aria-label="Закрити попередній перегляд" onClick={() => setSelected(null)}><X size={17} /></button></div><div className="event-manage-content__preview-window" ref={previewRef}><ContentBlocks document={draft.Document} variables={values} title={draft.Title || "Нова сторінка"} selectedBlockId={selectedBlockID} coverImage={event.PreviewPicture} /></div></aside>}
        </div>
    </div>;
}
