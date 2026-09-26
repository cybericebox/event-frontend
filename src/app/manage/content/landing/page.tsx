"use client";

import {useMemo, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, Check, Eye, Plus, RotateCcw, Type} from "lucide-react";
import Link from "next/link";
import {getManageContent, getManageContentVariables, ManageApiError, putManageLanding} from "@/api/manage";
import {ContentBlocks} from "@/components/event/content/ContentBlocks";
import {LandingHero} from "@/components/event/content/LandingHero";
import {LandingBlockEditor} from "@/components/event/manage/LandingBlockEditor";
import {useManager} from "@/components/event/manage/ManagerShell";
import {validateLanding} from "@/components/event/manage/validateLanding";
import type {ContentBlock, ContentDocument} from "@/types/eventContent";

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
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const draft = edited?.eventID === eventID ? edited.draft : content.data?.Landing ?? null;
    const dirty = !!draft && !!content.data && JSON.stringify(draft) !== JSON.stringify(content.data.Landing);
    const catalog = useMemo(() => (variables.data ?? []).filter(variable => variable.audience === 0), [variables.data]);
    const validation = useMemo(() => draft && variables.data ? validateLanding(draft, catalog) : null, [draft, variables.data, catalog]);
    const publicValues = useMemo(() => Object.fromEntries(catalog.map(variable => [variable.name, content.data?.Variables[variable.name] ?? null])), [content.data?.Variables, catalog]);

    function change(next: ContentDocument) {
        setEdited({eventID, draft: next});
        setMessage("");
        setError("");
    }

    function updateBlock(index: number, block: ContentBlock) {
        if (!draft) return;
        change({blocks: draft.blocks.map((old, position) => position === index ? block : old)});
    }

    function moveBlock(index: number, direction: -1 | 1) {
        if (!draft || index + direction < 0 || index + direction >= draft.blocks.length) return;
        const blocks = [...draft.blocks];
        [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
        change({blocks});
    }

    function addBlock(type: "section" | "text") {
        if (!draft) return;
        const id = `block-${crypto.randomUUID()}`;
        const block: ContentBlock = type === "section" ? {id, type, label: ""} : {id, type, markdown: ""};
        change({blocks: [...draft.blocks, block]});
    }

    async function save() {
        if (!canManage || !draft || !dirty || validation || saving) return;
        setSaving(true); setError(""); setMessage("");
        try {
            await putManageLanding(eventID, draft);
            queryClient.setQueryData(["event-management-content", eventID], {...content.data!, Landing: draft});
            setEdited(null);
            setMessage("Головну сторінку збережено");
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            setError(status === 403 ? "Немає права змінювати сторінку." : status === 400 ? "Сервер відхилив вміст. Перевірте блоки та умови показу." : "Не вдалося зберегти сторінку. Повторіть запит.");
        } finally { setSaving(false); }
    }

    if (content.isError || variables.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити головну сторінку</h1><button className="ib-btn" onClick={() => void Promise.all([content.refetch(), variables.refetch()])}>Повторити</button></div>;
    if (content.isPending || variables.isPending || !draft) return <div className="event-manage-loading" role="status">Завантажуємо головну сторінку…</div>;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><h1>Головна сторінка</h1><p>Побудуйте сторінку з розділів і текстових блоків.</p></div>{event.Status !== 0 && event.Status !== 4 && <Link className="ib-btn" href="/">Відкрити сайт <ArrowUpRight size={16} /></Link>}</header>
        {!canManage && <div className="event-manage-notice" role="status">Доступний лише перегляд. Змінювати головну сторінку може менеджер події.</div>}
        {event.Status === 0 && <div className="event-manage-notice" role="status">Сайт ще не опубліковано. Попередній перегляд праворуч показує вміст до публікації.</div>}
        {error && <div className="event-manage-feedback event-manage-feedback--error" role="alert">{error}</div>}
        {message && <div className="event-manage-feedback" role="status"><Check size={16} />{message}</div>}

        <div className="event-manage-content__layout">
            <div className="event-content-editor">
                <div className="event-content-editor__top"><div><h2>Блоки сторінки</h2><p>Порядок блоків відповідає їхньому порядку на сайті.</p></div><span>{blockCountLabel(draft.blocks.length)}</span></div>
                {draft.blocks.length === 0 && <div className="event-content-editor__empty"><Type size={24} /><strong>Сторінка поки порожня</strong><span>Додайте розділ або текст, щоб почати.</span></div>}
                <div className="event-content-editor__stack">{draft.blocks.map((block, index) => <LandingBlockEditor key={block.id} block={block} index={index} count={draft.blocks.length} values={publicValues} catalog={catalog} canEdit={canManage && !saving} onUpdate={value => updateBlock(index, value)} onMove={direction => moveBlock(index, direction)} onDelete={() => change({blocks: draft.blocks.filter((_, position) => position !== index)})} />)}</div>
                {canManage && <div className="event-content-editor__add"><button className="ib-btn" type="button" onClick={() => addBlock("section")}><Plus size={16} /> Розділ</button><button className="ib-btn" type="button" onClick={() => addBlock("text")}><Plus size={16} /> Текст</button></div>}
                {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
                <div className="event-content-editor__footer"><span>{dirty ? "Є незбережені зміни" : "Зміни збережено"}</span><div>{dirty && canManage && <button className="ib-btn" type="button" onClick={() => {setEdited(null); setMessage(""); setError("");}}><RotateCcw size={16} /> Скасувати зміни</button>}<button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || !dirty || !!validation || saving} onClick={() => void save()}>{saving ? "Зберігаємо…" : "Зберегти сторінку"}</button></div></div>
            </div>
            <aside className="event-manage-content__preview" aria-label="Попередній перегляд головної сторінки"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>Той самий макет, що бачать гості.</p></div></div><div className="event-manage-content__preview-window"><div className="event-landing ib-blocks"><LandingHero event={event} preview /><ContentBlocks document={draft} variables={publicValues} /></div></div></aside>
        </div>
    </div>;
}
