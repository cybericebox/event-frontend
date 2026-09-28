"use client";

import {useEffect, useId, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, ChevronDown, Eye, Plus, RotateCcw, Trash2, Type} from "lucide-react";
import toast from "react-hot-toast";
import {createManagePage, deleteManagePage, getManageConfig, getManageContent, getManageContentVariables, getManagePage, getManagePages, ManageApiError, type ManagePageInput, putManagePageOrder, updateManagePage} from "@/api/manage";
import {ContentBlocks, contentBlockVisible} from "@/components/event/content/ContentBlocks";
import type {ContentBlock, PageBlockType} from "@/types/eventContent";
import {FieldLabel, PageBlockEditor} from "./PageBlockEditor";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {blockPalette, createPageBlock} from "./blockPalette";
import {useManager} from "./ManagerShell";
import {EventLoading} from "../EventLoading";
import {blockValidationIndex, validateLanding} from "./validatePageBlocks";
import {reservedPageSlugs} from "../content/pageSlugs";
import {beforeChallenges, comparePageOrder} from "../content/pageNavigationOrder";

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
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), retry: false, refetchOnWindowFocus: false});
    const content = useQuery({queryKey: ["event-management-content", eventID], queryFn: () => getManageContent(eventID), retry: false, refetchOnWindowFocus: false});
    const definitions = useQuery({queryKey: ["event-management-content-variables", eventID], queryFn: () => getManageContentVariables(eventID), retry: false, refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<{key: string; value: ManagePageInput} | null>(null);
    const [selected, setSelected] = useState<{eventID: string; key: string; blockID: string} | null>(null);
    const [afterChoice, setAfterChoice] = useState<{key: string; predecessor: string} | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(true);
    const detailsID = useId();
    const previewRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const existingPages = pages.data ?? [];
    const orderedPages = [...existingPages].filter(item => item.Navigation !== 0).sort(comparePageOrder);
    const otherPages = orderedPages.filter(item => item.ID !== page.data?.ID);
    const currentIndex = orderedPages.findIndex(item => item.ID === page.data?.ID);
    const currentPage = currentIndex < 0 ? null : orderedPages[currentIndex];
    const previousPage = currentIndex <= 0 ? null : orderedPages[currentIndex - 1];
    const savedPredecessor = !currentPage ? (config.data?.ScoreboardVisibility ? otherPages.filter(item => item.NavigationOrder >= 0).at(-1)?.ID ?? "results" : otherPages.filter(item => item.NavigationOrder < 0).at(-1)?.ID ?? "challenges")
        : beforeChallenges(currentPage.NavigationOrder)
            ? previousPage && beforeChallenges(previousPage.NavigationOrder) ? previousPage.ID : "first"
            : currentPage.NavigationOrder < 0
                ? previousPage && previousPage.NavigationOrder < 0 && !beforeChallenges(previousPage.NavigationOrder) ? previousPage.ID : "challenges"
                : previousPage && previousPage.NavigationOrder >= 0 ? previousPage.ID : "results";
    const predecessor = afterChoice?.key === key ? afterChoice.predecessor : savedPredecessor;
    const saved: ManagePageInput = page.data ? {
        Slug: page.data.Slug, Title: page.data.Title, Document: page.data.Document,
        Visibility: page.data.Visibility, Navigation: page.data.Navigation, NavigationOrder: page.data.NavigationOrder,
    } : emptyPage;
    const draft = edited?.key === key ? edited.value : saved;
    const selectedBlockID = selected?.eventID === eventID && selected.key === key && draft.Document.blocks.some(block => block.id === selected.blockID) ? selected.blockID : null;
    const blockOrder = draft.Document.blocks.map(block => block.id).join("|");
    const catalog = useMemo(() => (definitions.data ?? []).filter(item => item.audience <= draft.Visibility), [definitions.data, draft.Visibility]);
    const values = useMemo(() => Object.fromEntries(catalog.map(item => [item.name, content.data?.Variables[item.name] ?? null])), [catalog, content.data?.Variables]);
    const selectedBlock = draft.Document.blocks.find(block => block.id === selectedBlockID);
    const selectedHidden = selectedBlock ? !contentBlockVisible(selectedBlock, values) : false;
    const documentError = definitions.data ? validateLanding(draft.Document, catalog, event.PreviewPicture ?? "") : null;
    const invalidBlockIndex = blockValidationIndex(documentError);
    const slugError = reservedPageSlugs.has(draft.Slug) ? `Адреса /${draft.Slug} зарезервована для системної сторінки.` :
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.Slug) || draft.Slug.length > 128 ? "Адреса сторінки: латинські літери, цифри й дефіси." :
        null;
    const titleError = !draft.Title.trim() || draft.Title.length > 255 ? "Вкажіть назву сторінки до 255 символів." : null;
    const validation = slugError ?? titleError ?? documentError;
    const dirty = isNew || JSON.stringify(saved) !== JSON.stringify(draft) || predecessor !== savedPredecessor;

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
            let challengesPosition = otherPages.filter(item => beforeChallenges(item.NavigationOrder)).length;
            let resultsPosition = otherPages.filter(item => item.NavigationOrder < 0).length;
            if (payload.Navigation !== 0) {
                const insertion = predecessor === "first" ? 0 : predecessor === "challenges" ? challengesPosition : predecessor === "results" ? resultsPosition : otherPages.findIndex(item => item.ID === predecessor) + 1;
                if (insertion < 0 || (predecessor !== "first" && predecessor !== "challenges" && predecessor !== "results" && insertion === 0)) throw new Error("Navigation predecessor is unavailable");
                ids.splice(insertion, 0, result.ID);
                const precedingPage = otherPages.find(item => item.ID === predecessor);
                if (predecessor === "first" || (precedingPage && beforeChallenges(precedingPage.NavigationOrder))) challengesPosition++;
                if (predecessor === "first" || predecessor === "challenges" || (precedingPage && precedingPage.NavigationOrder < 0)) resultsPosition++;
            }
            await putManagePageOrder(eventID, ids, challengesPosition, resultsPosition);
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
        if (!page.data || !canManage) return;
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

    if (page.isError || pages.isError || config.isError || content.isError || definitions.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити сторінку</h1><button className="ib-btn" onClick={() => void Promise.all([page.refetch(), pages.refetch(), config.refetch(), content.refetch(), definitions.refetch()])}>Повторити</button></div>;
    if ((!isNew && page.isPending) || pages.isPending || config.isPending || content.isPending || definitions.isPending) return <EventLoading event={event} label="Завантажуємо редактор…" />;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">Сторінки</p><h1>{isNew ? "Нова сторінка" : draft.Title}</h1><p>Той самий конструктор блоків, що й на головній сторінці.</p></div><div className="event-manage-heading__actions">{page.data ? <EventTooltip content="Відкрити збережену сторінку на сайті">{tipID => <Link className="ib-btn event-manage-icon-action" href={`/${page.data.Slug}`} target="_blank" aria-label="Відкрити сторінку" aria-describedby={tipID}><ArrowUpRight size={17} /></Link>}</EventTooltip> : <EventTooltip content="Збережіть сторінку, щоб відкрити її на сайті">{tipID => <button className="ib-btn event-manage-icon-action" type="button" aria-label="Відкрити сторінку" aria-describedby={tipID} disabled><ArrowUpRight size={17} /></button>}</EventTooltip>}{!isNew && canManage && <EventTooltip content="Видалити цю сторінку">{tipID => <button className="ib-btn ib-btn--danger event-manage-icon-action" type="button" aria-label="Видалити сторінку" aria-describedby={tipID} disabled={saving} onClick={() => setDeleteOpen(true)}><Trash2 size={17} /></button>}</EventTooltip>}</div></header>
        <div className="event-manage-content__layout">
            <div className="event-content-editor">
                <div className={`event-manage-page-details${detailsOpen ? "" : " is-collapsed"}`} aria-label="Налаштування сторінки">
                    <button className="event-manage-page-details__toggle" type="button" aria-expanded={detailsOpen} aria-controls={detailsID} onClick={() => setDetailsOpen(open => !open)}><span><strong>Налаштування сторінки</strong><small>{draft.Title || "Нова сторінка"} · {draft.Visibility === 2 ? "Лише модератори" : draft.Visibility === 1 ? "Підтверджені учасники" : "Публічна"}</small></span><ChevronDown size={18} aria-hidden="true" /></button>
                    {detailsOpen && <div className="event-manage-page-details__fields" id={detailsID}>
                    <div className="event-manage-field"><FieldLabel label="Назва сторінки" required help="Назва додаткової сторінки.\n• Показується у вкладці браузера.\n• Якщо навігацію ввімкнено, також стає назвою пункту меню.\n• На самій сторінці не виводиться — заголовки задають блоки.\nНе більше 255 символів." /><input className={`event-manage-input${titleError ? " is-invalid" : ""}`} aria-label="Назва сторінки" aria-invalid={!!titleError} aria-describedby={titleError ? `${detailsID}-title-error` : undefined} value={draft.Title} required disabled={!canManage || saving} onChange={e => change({...draft, Title: e.target.value})} maxLength={255} />{titleError && <p className="event-content-editor__field-error" id={`${detailsID}-title-error`} role="alert">{titleError}</p>}</div>
                    <div className="event-manage-field"><FieldLabel label="Адреса" required help="Частина адреси сторінки після /.\n• Латинські літери, цифри та дефіси.\n• Не більше 128 символів.\n• Системні адреси зайняті.\nПісля зміни старе посилання перестане працювати." /><div className="event-manage-page-slug"><span>/</span><input className={`event-manage-input${slugError ? " is-invalid" : ""}`} aria-label="Адреса сторінки" aria-invalid={!!slugError} aria-describedby={slugError ? `${detailsID}-slug-error` : undefined} value={draft.Slug} required disabled={!canManage || saving} onChange={e => change({...draft, Slug: e.target.value.toLowerCase()})} maxLength={128} /></div>{slugError && <p className="event-content-editor__field-error" id={`${detailsID}-slug-error`} role="alert">{slugError}</p>}</div>
                    <div className="event-manage-field"><FieldLabel label="Доступ" required help="Хто може відкрити сторінку.\n• Публічна — усі відвідувачі.\n• Підтверджені учасники — лише учасники події.\n• Лише модератори — сторінка не з’являється в меню сайту." /><EventSelect ariaLabel="Доступ до сторінки" value={String(draft.Visibility)} disabled={!canManage || saving} options={[{value: "0", label: "Публічна"}, {value: "1", label: "Підтверджені учасники"}, {value: "2", label: "Лише модератори"}]} onValueChange={value => {const visibility = Number(value) as 0 | 1 | 2; change({...draft, Visibility: visibility, Navigation: visibility === 2 ? 0 : draft.Navigation});}} /></div>
                    <div className="event-manage-field"><FieldLabel label="У навігації" required help="Чи показувати посилання на сторінку в меню події.\n• Показувати — пункт видно тим, хто має доступ до сторінки.\n• Не показувати — сторінка відкривається за прямим посиланням.\nДля сторінки лише модераторів пункт меню недоступний." /><EventSelect ariaLabel="Показ у навігації" value={draft.Visibility === 2 || draft.Navigation === 0 ? "0" : "1"} disabled={!canManage || saving || draft.Visibility === 2} options={[{value: "1", label: "Показувати"}, {value: "0", label: "Не показувати"}]} onValueChange={value => change({...draft, Navigation: value === "1" ? 1 : 0})} /></div>
                    <div className="event-manage-field"><FieldLabel label="Після якої сторінки" required={draft.Navigation !== 0 && draft.Visibility !== 2} help="Визначає місце сторінки в меню цієї події.\n• Першою — перед стандартними й додатковими сторінками.\n• Після «Завдання» — перед результатами.\n• Після «Результати» — якщо їх показ увімкнено для цієї події.\n• Після додаткової сторінки — безпосередньо за нею.\nНедоступні позиції мають пояснення у списку." /><EventSelect ariaLabel="Після якої сторінки в навігації" value={predecessor} disabled={!canManage || saving || draft.Navigation === 0 || draft.Visibility === 2} options={[{value: "first", label: "Першою"}, {value: "challenges", label: "Після «Завдання»"}, {value: "results", label: "Після «Результати»", disabled: config.data?.ScoreboardVisibility === 0, disabledReason: config.data?.ScoreboardVisibility === 0 ? "Показ результатів вимкнено для цієї події." : undefined}, ...existingPages.filter(item => item.ID !== page.data?.ID).map(item => ({value: item.ID, label: `Після «${item.Title}»`, disabled: item.Navigation === 0, disabledReason: item.Visibility === 2 ? "Ця сторінка доступна лише модераторам і не показується в меню." : item.Navigation === 0 ? "Цю сторінку вимкнено в навігації." : undefined}))]} onValueChange={value => setAfterChoice({key, predecessor: value})} /></div>
                    </div>}
                </div>
                <div className="event-content-editor__top"><div><h2>Блоки сторінки</h2><p>Перетягніть блок за ручку або скористайтеся стрілками. Так само вони з’являться на сайті.</p></div><span>{draft.Document.blocks.length}</span></div>
                {draft.Document.blocks.length === 0 && <div className="event-content-editor__empty"><Type size={24} /><strong>Сторінка поки порожня</strong><span>Додайте перший блок, щоб почати.</span></div>}
                <div className="event-content-editor__stack">{draft.Document.blocks.map((block, index) => <PageBlockEditor key={block.id} eventID={eventID} coverImage={event.PreviewPicture ?? ""} block={block} index={index} count={draft.Document.blocks.length} values={values} catalog={catalog} canEdit={canManage && !saving} selected={selectedBlockID === block.id} error={invalidBlockIndex === index ? documentError ?? undefined : undefined} onSelect={() => selectBlock(block.id)} onUpdate={value => updateBlock(block.id, value)} onMove={direction => moveBlock(index, direction)} onReorder={reorderBlock} onDelete={() => change({...draft, Document: {blocks: draft.Document.blocks.filter((_, position) => position !== index)}})} />)}</div>
                {canManage && <div className="event-content-editor__add" aria-label="Додати блок">{blockPalette.filter(item => item.type !== "hero" || !draft.Document.blocks.some(block => block.type === "hero")).map(item => <button className="ib-btn" type="button" key={item.type} onClick={() => addBlock(item.type)}><Plus size={16} /> {item.label}</button>)}</div>}
                {documentError && invalidBlockIndex === null && <p className="event-manage-validation" role="alert">{documentError}</p>}
                <div className="event-content-editor__footer"><span>{dirty ? "Є незбережені зміни" : "Зміни збережено"}</span><div>{dirty && !isNew && canManage && <button className="ib-btn" type="button" onClick={() => {setEdited(null); setAfterChoice(null);}}><RotateCcw size={16} /> Скасувати</button>}<button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || !dirty || !!validation || saving} onClick={() => void save()}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div></div>
            </div>

            <aside className="event-manage-content__preview" aria-label="Попередній перегляд сторінки"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>{selectedHidden ? "Вибраний блок зараз приховано умовами показу." : "Вся сторінка у поточному порядку блоків."}</p></div></div><div className="event-manage-content__preview-window" ref={previewRef}><ContentBlocks document={draft.Document} variables={values} title={draft.Title || "Нова сторінка"} selectedBlockId={selectedBlockID ?? undefined} coverImage={event.PreviewPicture ?? ""} eventID={eventID} preview /></div></aside>
        </div>
        <Dialog open={deleteOpen} onOpenChange={open => {if (!saving) setDeleteOpen(open);}}><DialogContent className="event-page-delete-dialog"><DialogHeader><DialogTitle>Видалити сторінку «{page.data?.Title}»?</DialogTitle><DialogDescription>Сторінка зникне із сайту та навігації. Усі її блоки буде видалено. Цю дію не можна скасувати.</DialogDescription></DialogHeader><div className="event-page-delete-dialog__actions"><button className="ib-btn" type="button" disabled={saving} onClick={() => setDeleteOpen(false)}>Залишити сторінку</button><button className="ib-btn ib-btn--danger-solid" type="button" disabled={saving} onClick={() => void remove()}>{saving ? "Видаляємо…" : "Видалити сторінку"}</button></div></DialogContent></Dialog>
    </div>;
}
