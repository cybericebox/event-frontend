"use client";

import {useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {Eye, Plus} from "lucide-react";
import toast from "react-hot-toast";
import {ContentBlocks, contentBlockVisible} from "@/components/event/content/ContentBlocks";
import type {ContentBlock, ContentDocument, ContentValue, PageBlockType} from "@/types/eventContent";
import type {ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {PageBlockEditor} from "./PageBlockEditor";
import {blockPalette, createPageBlock, duplicatePageBlock} from "./blockPalette";
import {blockValidationIndex} from "./validatePageBlocks";
import {EditedDocumentContext} from "./useEventLinkOptions";
import {t, tPlural} from "@/i18n/t";
import {currentPreviewPhase, defaultPreviewRegistration, previewPageAccess, previewPhases, previewRegistrations, previewValues, previewViewers, type PreviewPhase, type PreviewRegistration, type PreviewViewer} from "./previewScenario";
import {EmptyState} from "@/components/ui/EmptyState";

const undoMilliseconds = 6000;

/**
 * The block list, palette and live preview shared by the landing and page
 * editors. The preview renders the edited draft; its viewer and phase switches
 * change only preview variables, never data.
 */
export function BlockStackEditor({editorKey, eventID, coverImage, document, catalog, values, validation, canEdit, landing = false, pageVisibility = 0, previewTitle, previewClassName, before, onChange}: {
    editorKey: string;
    eventID: string;
    coverImage: string;
    document: ContentDocument;
    catalog: ContentVariableDefinition[];
    values: Record<string, ContentValue>;
    validation: string | null;
    canEdit: boolean;
    landing?: boolean;
    pageVisibility?: 0 | 1 | 2;
    previewTitle: string;
    previewClassName?: string;
    before?: ReactNode;
    onChange: (update: (document: ContentDocument) => ContentDocument) => void;
}) {
    const [selected, setSelected] = useState<{key: string; blockID: string} | null>(null);
    const [viewer, setViewer] = useState<PreviewViewer>("guest");
    const [phase, setPhase] = useState<PreviewPhase | null>(null);
    // null follows the phase's registration window; reset on every phase change.
    const [registration, setRegistration] = useState<PreviewRegistration | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const selectedBlockID = selected?.key === editorKey && document.blocks.some(block => block.id === selected.blockID) ? selected.blockID : null;
    const blockOrder = document.blocks.map(block => block.id).join("|");
    const invalidBlockIndex = blockValidationIndex(validation);
    const activePhase = phase ?? currentPreviewPhase(values);
    const activeRegistration = activePhase === "after" ? "closed" : registration ?? defaultPreviewRegistration(values, activePhase);
    const shownValues = useMemo(() => previewValues(values, activePhase, viewer, activeRegistration), [values, activePhase, viewer, activeRegistration]);
    const selectedBlock = document.blocks.find(block => block.id === selectedBlockID);
    const selectedHidden = selectedBlock ? !contentBlockVisible(selectedBlock, shownValues) : false;
    const accessNotice = previewPageAccess(pageVisibility, viewer);
    const edited = useMemo(() => ({document, landing}), [document, landing]);

    useEffect(() => {
        if (!selectedBlockID || !previewRef.current) return;
        const container = previewRef.current;
        const target = container.querySelector<HTMLElement>("[data-preview-selected]");
        if (!target) return;
        container.scrollTo({top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 20, behavior: "smooth"});
    }, [selectedBlockID, blockOrder]);

    function select(blockID: string) {
        setSelected({key: editorKey, blockID});
    }
    function updateBlock(blockID: string, value: ContentBlock | ((current: ContentBlock) => ContentBlock)) {
        onChange(current => ({blocks: current.blocks.map(block => block.id === blockID ? typeof value === "function" ? value(block) : value : block)}));
    }
    function moveBlock(index: number, direction: -1 | 1) {
        onChange(current => {
            const blocks = [...current.blocks];
            if (index + direction < 0 || index + direction >= blocks.length) return current;
            [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
            return {blocks};
        });
    }
    function reorderBlock(sourceID: string, targetID: string) {
        onChange(current => {
            const blocks = [...current.blocks];
            const from = blocks.findIndex(block => block.id === sourceID);
            const to = blocks.findIndex(block => block.id === targetID);
            if (from < 0 || to < 0 || from === to) return current;
            blocks.splice(to, 0, blocks.splice(from, 1)[0]);
            return {blocks};
        });
        select(sourceID);
    }
    function insertAfter(block: ContentBlock, predecessorID: string | null) {
        onChange(current => {
            const blocks = [...current.blocks];
            const index = predecessorID ? blocks.findIndex(item => item.id === predecessorID) : -1;
            blocks.splice(index < 0 ? blocks.length : index + 1, 0, block);
            return {blocks};
        });
        select(block.id);
    }
    function addBlock(type: PageBlockType) {
        const created = createPageBlock(type, landing);
        insertAfter(type === "banner" && !coverImage ? {...created, imageSource: "custom"} : created, selectedBlockID);
    }
    function duplicateBlock(block: ContentBlock) {
        insertAfter(duplicatePageBlock(block), block.id);
        toast.success(t("manage.blocks.toast.duplicated"));
    }
    // Delete without a confirmation dialog: the toast offers to restore the block.
    function deleteBlock(block: ContentBlock, index: number) {
        onChange(current => ({blocks: current.blocks.filter(item => item.id !== block.id)}));
        toast(item => <span className="event-undo-toast"><span>{t("manage.blocks.toast.deleted")}</span><button className="ib-btn ib-btn--sm" type="button" onClick={() => {
            onChange(current => {
                if (current.blocks.some(existing => existing.id === block.id)) return current;
                const blocks = [...current.blocks];
                blocks.splice(Math.min(index, blocks.length), 0, block);
                return {blocks};
            });
            select(block.id);
            toast.dismiss(item.id);
        }}>{t("common.restore")}</button></span>, {id: `undo-${block.id}`, duration: undoMilliseconds});
    }

    return <EditedDocumentContext.Provider value={edited}><div className="event-manage-content__layout">
        <div className="event-content-editor">
            {before}
            <div className="event-content-editor__top"><div><h2>{t("manage.blocks.stack.title")}</h2><p>{t("manage.blocks.stack.hint")}</p></div><span>{tPlural("manage.blocks.count", document.blocks.length)}</span></div>
            {document.blocks.length === 0 && <EmptyState message={t("manage.blocks.stack.emptyMessage")} />}
            <div className="event-content-editor__stack">{document.blocks.map((block, index) => <PageBlockEditor key={block.id} eventID={eventID} coverImage={coverImage} block={block} index={index} count={document.blocks.length} anchorsInUse={document.blocks.filter(item => item.id !== block.id).flatMap(item => [item.id, item.anchor ?? ""])} values={values} catalog={catalog} canEdit={canEdit} selected={selectedBlockID === block.id} error={invalidBlockIndex === index ? validation ?? undefined : undefined}
                onSelect={() => select(block.id)} onUpdate={value => updateBlock(block.id, value)} onMove={direction => moveBlock(index, direction)} onReorder={reorderBlock} onDuplicate={() => duplicateBlock(block)} onDelete={() => deleteBlock(block, index)} />)}</div>
            {canEdit && <div className="event-content-editor__add" aria-label={t("manage.blocks.stack.add")}>{blockPalette.filter(item => item.type !== "hero" || !document.blocks.some(block => block.type === "hero")).map(item => <button className="ib-btn" type="button" key={item.type} onClick={() => addBlock(item.type)}><Plus size={16} /> {item.label}</button>)}</div>}
            {validation && invalidBlockIndex === null && <p className="event-manage-validation" role="alert">{validation}</p>}
        </div>

        <aside className="event-manage-content__preview" aria-label={t("manage.blocks.preview.aria")}>
            <div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>{t("manage.blocks.preview.title")}</h2><p>{selectedHidden ? t("manage.blocks.preview.selectedHidden") : t("manage.blocks.preview.hint")}</p></div></div>
            <div className="event-preview-switches">
                <div className="ib-seg ib-seg--sm" role="group" aria-label={t("manage.blocks.preview.viewer")}>{previewViewers.map(item => <button key={item.value} type="button" aria-pressed={viewer === item.value} onClick={() => setViewer(item.value)}>{item.label}</button>)}</div>
                <div className="ib-seg ib-seg--sm" role="group" aria-label={t("manage.blocks.preview.phase")}>{previewPhases.map(item => <button key={item.value} type="button" aria-pressed={activePhase === item.value} onClick={() => {setPhase(item.value); setRegistration(null);}}>{item.label}</button>)}</div>
                <div className="ib-seg ib-seg--sm" role="group" aria-label={t("manage.blocks.preview.registration")}>{previewRegistrations.map(item => <button key={item.value} type="button" aria-pressed={activeRegistration === item.value} disabled={activePhase === "after"} title={activePhase === "after" ? t("manage.blocks.preview.registrationAfter") : undefined} onClick={() => setRegistration(item.value)}>{item.label}</button>)}</div>
            </div>
            <div className="event-manage-content__preview-window" ref={previewRef}>
                {accessNotice ? <EmptyState message={t("manage.blocks.preview.accessNotice", {notice: accessNotice})} />
                    : <div className={previewClassName}>{document.blocks.length === 0 && <EmptyState message={t("manage.blocks.preview.empty")} />}<ContentBlocks document={document} variables={shownValues} title={previewTitle} selectedBlockId={selectedBlockID ?? undefined} coverImage={coverImage} eventID={eventID} preview previewViewer={viewer} /></div>}
            </div>
        </aside>
    </div></EditedDocumentContext.Provider>;
}
