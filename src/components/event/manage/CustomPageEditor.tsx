"use client";

import {useEffect, useId, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, ChevronDown, Eye, Plus, RotateCcw, Trash2, Type} from "lucide-react";
import toast from "react-hot-toast";
import {createManagePage, deleteManagePage, getManageContent, getManageContentVariables, getManagePage, getManagePages, ManageApiError, type ManagePageInput, putManagePageOrder, updateManagePage} from "@/api/manage";
import {ContentBlocks, contentBlockVisible} from "@/components/event/content/ContentBlocks";
import type {ContentBlock, PageBlockType} from "@/types/eventContent";
import {FieldLabel, LandingBlockEditor} from "./LandingBlockEditor";
import {EventSelect} from "@/components/ui/EventSelect";
import {blockPalette, createPageBlock} from "./blockPalette";
import {useManager} from "./ManagerShell";
import {EventLoading} from "../EventLoading";
import {validateLanding} from "./validatePageBlocks";

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
    const pages = useQuery({queryKey: ["event-management-pages", eventID], queryFn: () => getManagePages(eventID), retry: false, refetchOnWindowFocus: false});
    const content = useQuery({queryKey: ["event-management-content", eventID], queryFn: () => getManageContent(eventID), retry: false, refetchOnWindowFocus: false});
    const definitions = useQuery({queryKey: ["event-management-content-variables", eventID], queryFn: () => getManageContentVariables(eventID), retry: false, refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<{key: string; value: ManagePageInput} | null>(null);
    const [selected, setSelected] = useState<{eventID: string; key: string; blockID: string} | null>(null);
    const [afterChoice, setAfterChoice] = useState<{key: string; pageID: string} | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(true);
    const detailsID = useId();
    const previewRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);

    const existingPages = pages.data ?? [];
    const orderedPages = [...existingPages].filter(item => item.Navigation !== 0).sort((a, b) => a.NavigationOrder - b.NavigationOrder || a.Slug.localeCompare(b.Slug));
    const otherPages = orderedPages.filter(item => item.ID !== page.data?.ID);
    const currentIndex = orderedPages.findIndex(item => item.ID === page.data?.ID);
    const savedAfterPageID = currentIndex < 0 ? otherPages.at(-1)?.ID ?? "first" : currentIndex === 0 ? "first" : orderedPages[currentIndex - 1].ID;
    const afterPageID = afterChoice?.key === key ? afterChoice.pageID : savedAfterPageID;
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
    const documentError = definitions.data ? validateLanding(draft.Document, catalog, event.PreviewPicture ?? "") : null;
    const validation = draft.Slug === "new" ? "Адреса new зарезервована для створення сторінки." :
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.Slug) || draft.Slug.length > 128 ? "Адреса сторінки: латинські літери, цифри й дефіси." :
        !draft.Title.trim() || draft.Title.length > 255 ? "Вкажіть назву сторінки до 255 символів." : documentError;
    const dirty = isNew || JSON.stringify(saved) !== JSON.stringify(draft) || afterPageID !== savedAfterPageID;

    useEffect(() => {
        if (!selectedBlockID || !previewRef.current) return;
        const container = previewRef.current;
        const target = container.querySelector<HTMLElement>("[data-preview-selected]");
        if (!target) return;
        container.scrollTo({top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 20, behavior: "smooth"});
    }, [selectedBlockID, blockOrder]);

    function change(next: ManagePageInput) {
        setEdited({key, value: next});
    }
    function updateBlock(blockID: string, value: ContentBlock | ((current: ContentBlock) => ContentBlock)) {
        setEdited(previous => {
            const current = previous?.key === key ? previous.value : saved;
            return {key, value: {...current, Document: {blocks: current.Document.blocks.map(block => block.id === blockID ? typeof value === "function" ? value(block) : value : block)}}};
        });
    }
    function moveBlock(index: number, direction: -1 | 1) {
        const blocks = [...draft.Document.blocks];
        if (index + direction < 0 || index + direction >= blocks.length) return;
        [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
        change({...draft, Document: {blocks}});
        setDetailsOpen(false);
    }
    function reorderBlock(sourceID: string, targetID: string) {
        const blocks = [...draft.Document.blocks];
        const from = blocks.findIndex(block => block.id === sourceID);
        const to = blocks.findIndex(block => block.id === targetID);
        if (from < 0 || to < 0 || from === to) return;
        blocks.splice(to, 0, blocks.splice(from, 1)[0]);
        change({...draft, Document: {blocks}});
        setSelected({eventID, key, blockID: sourceID});
        setDetailsOpen(false);
    }
    function addBlock(type: PageBlockType) {
        const created = createPageBlock(type);
        const block = type === "banner" && !event.PreviewPicture ? {...created, imageSource: "custom"} : created;
        const blocks = [...draft.Document.blocks];
        const selectedIndex = blocks.findIndex(item => item.id === selectedBlockID);
        blocks.splice(selectedIndex < 0 ? blocks.length : selectedIndex + 1, 0, block);
        change({...draft, Document: {blocks}});
        setSelected({eventID, key, blockID: block.id});
        setDetailsOpen(false);
    }

    function selectBlock(blockID: string) {
        setSelected({eventID, key, blockID});
        setDetailsOpen(false);
    }

    async function save() {
        if (!canManage || validation || !dirty || saving) return;
        setSaving(true);
        let stored = false;
        try {
            const payload: ManagePageInput = {...draft, Navigation: draft.Visibility === 2 ? 0 : draft.Navigation === 0 ? 0 : 1};
            const result = isNew ? await createManagePage(eventID, payload) : await updateManagePage(eventID, page.data!.ID, payload);
            stored = true;
            const ids = otherPages.map(item => item.ID);
            if (payload.Navigation !== 0) {
                const insertion = afterPageID === "first" ? 0 : otherPages.findIndex(item => item.ID === afterPageID) + 1;
                if (insertion < 0 || (afterPageID !== "first" && insertion === 0)) throw new Error("Navigation predecessor is unavailable");
                ids.splice(insertion, 0, result.ID);
            }
            await putManagePageOrder(eventID, ids);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-management-pages", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-navigation-pages", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-management-page", eventID]}),
            ]);
            setEdited(null);
            setAfterChoice(null);
            toast.success(isNew ? "Сторінку створено" : "Сторінку збережено");
            if (isNew || result.Slug !== slug) router.replace(`/manage/content/pages/${result.Slug}`);
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            if (stored && isNew && draft.Slug) router.replace(`/manage/content/pages/${draft.Slug}`);
            toast.error(stored ? "Сторінку збережено, але порядок навігації не оновився. Повторіть збереження." : status === 400 ? "Сервер відхилив поля або змінні сторінки." : status === 409 ? "Така адреса сторінки вже зайнята." : "Не вдалося зберегти сторінку. Повторіть запит.");
        } finally { setSaving(false); }
    }

    async function remove() {
        if (!page.data || !canManage || !window.confirm("Видалити цю сторінку?")) return;
        setSaving(true);
        try {
            await deleteManagePage(eventID, page.data.ID);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-management-pages", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-navigation-pages", eventID]}),
            ]);
            toast.success("Сторінку видалено");
            router.replace("/manage/content/landing");
        } catch {
            toast.error("Не вдалося видалити сторінку. Повторіть спробу.");
            setSaving(false);
        }
    }

    if (page.isError || pages.isError || content.isError || definitions.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити сторінку</h1><button className="ib-btn" onClick={() => void Promise.all([page.refetch(), pages.refetch(), content.refetch(), definitions.refetch()])}>Повторити</button></div>;
    if ((!isNew && page.isPending) || pages.isPending || content.isPending || definitions.isPending) return <EventLoading event={event} label="Завантажуємо редактор…" />;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">Сторінки</p><h1>{isNew ? "Нова сторінка" : draft.Title}</h1><p>Той самий конструктор блоків, що й на головній сторінці.</p></div>{!isNew && <Link className="ib-btn" href={`/p/${draft.Slug}`} target="_blank">Відкрити <ArrowUpRight size={16} /></Link>}</header>
        <div className="event-manage-content__layout">
            <div className="event-content-editor">
                <div className={`event-manage-page-details${detailsOpen ? "" : " is-collapsed"}`} aria-label="Налаштування сторінки">
                    <button className="event-manage-page-details__toggle" type="button" aria-expanded={detailsOpen} aria-controls={detailsID} onClick={() => setDetailsOpen(open => !open)}><span><strong>Налаштування сторінки</strong><small>{draft.Title || "Нова сторінка"} · {draft.Visibility === 2 ? "Лише модератори" : draft.Visibility === 1 ? "Підтверджені учасники" : "Публічна"}</small></span><ChevronDown size={18} aria-hidden="true" /></button>
                    {detailsOpen && <div className="event-manage-page-details__fields" id={detailsID}>
                    <label className="event-manage-field"><FieldLabel label="Назва сторінки" required help="Назва додаткової сторінки.\n• Показується як заголовок сторінки.\n• Якщо навігацію ввімкнено, також стає назвою пункту меню.\nНе більше 255 символів." /><input className="event-manage-input" value={draft.Title} required disabled={!canManage || saving} onChange={e => change({...draft, Title: e.target.value})} maxLength={255} /></label>
                    <label className="event-manage-field"><FieldLabel label="Адреса" required help="Частина адреси сторінки після /p/.\n• Латинські літери, цифри та дефіси.\n• Не більше 128 символів.\nПісля зміни старе посилання перестане працювати." /><div className="event-manage-page-slug"><span>/p/</span><input className="event-manage-input" value={draft.Slug} required disabled={!canManage || saving} onChange={e => change({...draft, Slug: e.target.value.toLowerCase()})} maxLength={128} /></div></label>
                    <div className="event-manage-field"><FieldLabel label="Доступ" required help="Хто може відкрити сторінку.\n• Публічна — усі відвідувачі.\n• Підтверджені учасники — лише учасники події.\n• Лише модератори — сторінка не з’являється в меню сайту." /><EventSelect ariaLabel="Доступ до сторінки" value={String(draft.Visibility)} disabled={!canManage || saving} options={[{value: "0", label: "Публічна"}, {value: "1", label: "Підтверджені учасники"}, {value: "2", label: "Лише модератори"}]} onValueChange={value => {const visibility = Number(value) as 0 | 1 | 2; change({...draft, Visibility: visibility, Navigation: visibility === 2 ? 0 : draft.Navigation});}} /></div>
                    <div className="event-manage-field"><FieldLabel label="У навігації" required help="Чи показувати посилання на сторінку в меню події.\n• Показувати — пункт видно тим, хто має доступ до сторінки.\n• Не показувати — сторінка відкривається за прямим посиланням.\nДля сторінки лише модераторів пункт меню недоступний." /><EventSelect ariaLabel="Показ у навігації" value={draft.Visibility === 2 || draft.Navigation === 0 ? "0" : "1"} disabled={!canManage || saving || draft.Visibility === 2} options={[{value: "1", label: "Показувати"}, {value: "0", label: "Не показувати"}]} onValueChange={value => change({...draft, Navigation: value === "1" ? 1 : 0})} /></div>
                    <div className="event-manage-field"><FieldLabel label="Після якої сторінки" required={draft.Navigation !== 0 && draft.Visibility !== 2} help="Місце серед додаткових сторінок у меню події.\n• Першою — перед іншими додатковими сторінками.\n• Після сторінки — безпосередньо після обраної.\nСтандартні вкладки події стоять перед додатковими сторінками." /><EventSelect ariaLabel="Після якої сторінки в навігації" value={afterPageID} disabled={!canManage || saving || draft.Navigation === 0 || draft.Visibility === 2} options={[{value: "first", label: "Першою серед додаткових"}, ...otherPages.map(item => ({value: item.ID, label: `Після «${item.Title}»`}))]} onValueChange={pageID => setAfterChoice({key, pageID})} /></div>
                    </div>}
                </div>
                <div className="event-content-editor__top"><div><h2>Блоки сторінки</h2><p>Перетягніть блок за ручку або скористайтеся стрілками. Так само вони з’являться на сайті.</p></div><span>{draft.Document.blocks.length}</span></div>
                {draft.Document.blocks.length === 0 && <div className="event-content-editor__empty"><Type size={24} /><strong>Сторінка поки порожня</strong><span>Додайте перший блок, щоб почати.</span></div>}
                <div className="event-content-editor__stack">{draft.Document.blocks.map((block, index) => <LandingBlockEditor key={block.id} eventID={eventID} coverImage={event.PreviewPicture ?? ""} block={block} index={index} count={draft.Document.blocks.length} values={values} catalog={catalog} canEdit={canManage && !saving} selected={selectedBlockID === block.id} onSelect={() => selectBlock(block.id)} onUpdate={value => updateBlock(block.id, value)} onMove={direction => moveBlock(index, direction)} onReorder={reorderBlock} onDelete={() => change({...draft, Document: {blocks: draft.Document.blocks.filter((_, position) => position !== index)}})} />)}</div>
                {canManage && <div className="event-content-editor__add" aria-label="Додати блок">{blockPalette.filter(item => item.type !== "hero" || !draft.Document.blocks.some(block => block.type === "hero")).map(item => <button className="ib-btn" type="button" key={item.type} onClick={() => addBlock(item.type)}><Plus size={16} /> {item.label}</button>)}</div>}
                {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                <div className="event-content-editor__footer"><span>{dirty ? "Є незбережені зміни" : "Зміни збережено"}</span><div>{dirty && !isNew && canManage && <button className="ib-btn" type="button" onClick={() => {setEdited(null); setAfterChoice(null);}}><RotateCcw size={16} /> Скасувати</button>}{!isNew && canManage && <button className="ib-btn event-content-editor__delete" type="button" disabled={saving} onClick={() => void remove()}><Trash2 size={16} /> Видалити</button>}<button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || !dirty || !!validation || saving} onClick={() => void save()}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div></div>
            </div>

            <aside className="event-manage-content__preview" aria-label="Попередній перегляд сторінки"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>{selectedHidden ? "Вибраний блок зараз приховано умовами показу." : "Вся сторінка у поточному порядку блоків."}</p></div></div><div className="event-manage-content__preview-window" ref={previewRef}><ContentBlocks document={draft.Document} variables={values} title={draft.Title || "Нова сторінка"} selectedBlockId={selectedBlockID ?? undefined} coverImage={event.PreviewPicture ?? ""} /></div></aside>
        </div>
    </div>;
}
