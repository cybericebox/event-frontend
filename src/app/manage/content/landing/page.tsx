"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, Eye, Plus, RotateCcw, Type} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import {getManageContent, getManageContentVariables, ManageApiError, putManageLanding} from "@/api/manage";
import {ContentBlocks, contentBlockVisible} from "@/components/event/content/ContentBlocks";
import {PageBlockEditor} from "@/components/event/manage/PageBlockEditor";
import {blockPalette, createPageBlock} from "@/components/event/manage/blockPalette";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {blockValidationIndex, validateLanding} from "@/components/event/manage/validatePageBlocks";
import type {ContentBlock, ContentDocument, PageBlockType} from "@/types/eventContent";

function blockCountLabel(count: number): string {
    if (count % 10 === 1 && count % 100 !== 11) return `${count} блок`;
    if ([2, 3, 4].includes(count % 10) && (count % 100 < 12 || count % 100 > 14)) return `${count} блоки`;
    return `${count} блоків`;
}

export default function ManageLandingPage() {
    const {event, canManage} = useManager();
    const queryClient = useQueryClient();
    const eventID = event.EventID;
    const content = useQuery({
        queryKey: ["event-management-content", eventID],
        queryFn: () => getManageContent(eventID),
        refetchInterval: false, refetchOnWindowFocus: false,
    });
    const variables = useQuery({
        queryKey: ["event-management-content-variables", eventID],
        queryFn: () => getManageContentVariables(eventID),
        refetchInterval: false, refetchOnWindowFocus: false,
    });
    const [edited, setEdited] = useState<{eventID: string; draft: ContentDocument} | null>(null);
    const [selected, setSelected] = useState<{eventID: string; blockID: string} | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);

    const draft = edited?.eventID === eventID ? edited.draft : content.data?.Landing ?? null;
    const selectedBlockID = selected?.eventID === eventID && draft?.blocks.some(block => block.id === selected.blockID) ? selected.blockID : null;
    const blockOrder = draft?.blocks.map(block => block.id).join("|") ?? "";
    const dirty = !!draft && !!content.data && JSON.stringify(draft) !== JSON.stringify(content.data.Landing);
    const catalog = useMemo(() => (variables.data ?? []).filter(variable => variable.audience === 0), [variables.data]);
    const validation = useMemo(() => draft && variables.data ? validateLanding(draft, catalog, event.PreviewPicture ?? "") : null, [draft, variables.data, catalog, event.PreviewPicture]);
    const invalidBlockIndex = blockValidationIndex(validation);
    const publicValues = useMemo(() => Object.fromEntries(catalog.map(variable => [variable.name, content.data?.Variables[variable.name] ?? null])), [content.data?.Variables, catalog]);
    const selectedBlock = draft?.blocks.find(block => block.id === selectedBlockID);
    const selectedHidden = selectedBlock ? !contentBlockVisible(selectedBlock, publicValues) : false;

    useEffect(() => {
        if (!selectedBlockID || !previewRef.current) return;
        const container = previewRef.current;
        const target = container.querySelector<HTMLElement>("[data-preview-selected]");
        if (!target) return;
        container.scrollTo({top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 20, behavior: "smooth"});
    }, [selectedBlockID, blockOrder]);

    function change(next: ContentDocument) {
        setEdited({eventID, draft: next});
    }

    function updateBlock(blockID: string, value: ContentBlock | ((current: ContentBlock) => ContentBlock)) {
        setEdited(previous => {
            const current = previous?.eventID === eventID ? previous.draft : content.data?.Landing;
            if (!current) return previous;
            return {eventID, draft: {blocks: current.blocks.map(block => block.id === blockID ? typeof value === "function" ? value(block) : value : block)}};
        });
    }

    function moveBlock(index: number, direction: -1 | 1) {
        if (!draft || index + direction < 0 || index + direction >= draft.blocks.length) return;
        const blocks = [...draft.blocks];
        [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
        change({blocks});
    }

    function reorderBlock(sourceID: string, targetID: string) {
        if (!draft) return;
        const blocks = [...draft.blocks];
        const from = blocks.findIndex(block => block.id === sourceID);
        const to = blocks.findIndex(block => block.id === targetID);
        if (from < 0 || to < 0 || from === to) return;
        blocks.splice(to, 0, blocks.splice(from, 1)[0]);
        change({blocks});
        setSelected({eventID, blockID: sourceID});
    }

    function addBlock(type: PageBlockType) {
        if (!draft) return;
        const created = createPageBlock(type, true);
        const block = type === "banner" && !event.PreviewPicture ? {...created, imageSource: "custom"} : created;
        const blocks = [...draft.blocks];
        const selectedIndex = blocks.findIndex(item => item.id === selectedBlockID);
        blocks.splice(selectedIndex < 0 ? blocks.length : selectedIndex + 1, 0, block);
        change({blocks});
        setSelected({eventID, blockID: block.id});
    }

    async function save() {
        if (!canManage || !draft || !dirty || validation || saving) return;
        setSaving(true);
        try {
            await putManageLanding(eventID, draft);
            queryClient.setQueryData(["event-management-content", eventID], {...content.data!, Landing: draft});
            setEdited(null);
            toast.success("Головну сторінку збережено");
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            toast.error(status === 403 ? "Немає права змінювати сторінку." : status === 400 ? "Сервер відхилив вміст. Перевірте блоки та умови показу." : "Не вдалося зберегти сторінку. Повторіть запит.");
        } finally { setSaving(false); }
    }

    if (content.isError || variables.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити головну сторінку</h1><button className="ib-btn" onClick={() => void Promise.all([content.refetch(), variables.refetch()])}>Повторити</button></div>;
    if (content.isPending || variables.isPending || !draft) return <EventLoading event={event} label="Завантажуємо головну сторінку…" />;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><h1>Головна сторінка</h1><p>Побудуйте сторінку з блоків у потрібному порядку.</p></div>{event.Status !== 0 && event.Status !== 4 && <Link className="ib-btn" href="/">Відкрити сайт <ArrowUpRight size={16} /></Link>}</header>
        {!canManage && <div className="event-manage-notice" role="status">Доступний лише перегляд. Змінювати головну сторінку може менеджер події.</div>}
        {event.Status === 0 && <div className="event-manage-notice" role="status">Сайт ще не опубліковано. Попередній перегляд праворуч показує сторінку до публікації.</div>}

        <div className="event-manage-content__layout">
            <div className="event-content-editor">
                <div className="event-content-editor__top"><div><h2>Блоки сторінки</h2><p>Перетягніть блок за ручку або скористайтеся стрілками. Так само вони з’являться на сайті.</p></div><span>{blockCountLabel(draft.blocks.length)}</span></div>
                {draft.blocks.length === 0 && <div className="event-content-editor__empty"><Type size={24} /><strong>Сторінка поки порожня</strong><span>Додайте перший блок, щоб почати.</span></div>}
                <div className="event-content-editor__stack">{draft.blocks.map((block, index) => <PageBlockEditor key={block.id} eventID={eventID} coverImage={event.PreviewPicture ?? ""} block={block} index={index} count={draft.blocks.length} values={publicValues} catalog={catalog} canEdit={canManage && !saving} selected={selectedBlockID === block.id} error={invalidBlockIndex === index ? validation ?? undefined : undefined} onSelect={() => setSelected({eventID, blockID: block.id})} onUpdate={value => updateBlock(block.id, value)} onMove={direction => moveBlock(index, direction)} onReorder={reorderBlock} onDelete={() => change({blocks: draft.blocks.filter((_, position) => position !== index)})} />)}</div>
                {canManage && <div className="event-content-editor__add" aria-label="Додати блок">{blockPalette.filter(item => item.type !== "hero" || !draft.blocks.some(block => block.type === "hero")).map(item => <button className="ib-btn" type="button" key={item.type} onClick={() => addBlock(item.type)}><Plus size={16} /> {item.label}</button>)}</div>}
                {validation && invalidBlockIndex === null && <p className="event-manage-validation" role="alert">{validation}</p>}
                <div className="event-content-editor__footer"><span>{dirty ? "Є незбережені зміни" : "Зміни збережено"}</span><div>{dirty && canManage && <button className="ib-btn" type="button" onClick={() => setEdited(null)}><RotateCcw size={16} /> Скасувати зміни</button>}<button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || !dirty || !!validation || saving} onClick={() => void save()}>{saving ? "Зберігаємо…" : "Зберегти сторінку"}</button></div></div>
            </div>

            <aside className="event-manage-content__preview" aria-label="Попередній перегляд головної сторінки"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>{selectedHidden ? "Вибраний блок зараз приховано умовами показу." : "Вся сторінка у поточному порядку блоків."}</p></div></div><div className="event-manage-content__preview-window" ref={previewRef}><div className="event-landing ib-blocks">{draft.blocks.length === 0 && <div className="event-content-editor__empty">Додайте блок, щоб побачити сторінку.</div>}<ContentBlocks document={draft} variables={publicValues} title={event.Name} selectedBlockId={selectedBlockID ?? undefined} coverImage={event.PreviewPicture ?? ""} eventID={eventID} preview /></div></div></aside>
        </div>
    </div>;
}
