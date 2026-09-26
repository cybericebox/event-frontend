"use client";

import {useEffect, useRef, useState, type ChangeEvent, type DragEvent} from "react";
import {CircleHelp, ImagePlus, Pencil, Trash2} from "lucide-react";
import {toast} from "react-hot-toast";
import {uploadManageBrandDraft, type BrandAssetChange} from "@/api/manage";
import {EventTooltip} from "@/components/ui/EventTooltip";

type Kind = "preview" | "logo" | "favicon";
type Draft = {action: "keep" | "remove" | "replace"; fileID?: string; previewURL?: string};

export function useBrandDraft(eventID: string, kind: Kind, currentURL: string, maxBytes: number) {
    const [draft, setDraft] = useState<Draft>({action: "keep"});
    const [savedURL, setSavedURL] = useState<{eventID: string; url: string} | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => () => { if (draft.previewURL) URL.revokeObjectURL(draft.previewURL); }, [draft.previewURL]);

    async function select(file?: File): Promise<boolean> {
        if (!file || uploading) return false;
        const validType = kind === "favicon" ? file.type === "image/png" : ["image/png", "image/jpeg", "image/webp"].includes(file.type);
        if (!validType || file.size > maxBytes || file.size === 0) {
            setError(kind === "favicon" ? "Оберіть PNG розміром до 512 КБ." : `Оберіть PNG, JPEG або WebP розміром до ${Math.round(maxBytes / (1 << 20))} МБ.`);
            return false;
        }
        setUploading(true); setError("");
        try {
            const fileID = await uploadManageBrandDraft(eventID, kind, file);
            setDraft({action: "replace", fileID, previewURL: URL.createObjectURL(file)});
            return true;
        } catch {
            toast.error("Не вдалося завантажити файл. Спробуйте ще раз.");
            return false;
        } finally {
            setUploading(false);
        }
    }

    function reset() { setDraft({action: "remove"}); setError(""); }
    function saved(url: string) { setSavedURL({eventID, url}); setDraft({action: "keep"}); setError(""); }
    const source = draft.action === "replace" ? draft.previewURL ?? "" : draft.action === "remove" ? "" : savedURL?.eventID === eventID ? savedURL.url : currentURL;
    const change: BrandAssetChange = {Action: draft.action, ...(draft.action === "replace" ? {FileID: draft.fileID} : {})};
    return {source, change, dirty: draft.action !== "keep", uploading, error, select, reset, saved};
}

export type BrandDraftControl = ReturnType<typeof useBrandDraft>;

export function BrandDraftField({id, title, help, hint, kind, draft, disabled, onFileSelected}: {
    id: string; title: string; help: string; hint: string; kind: Kind; draft: BrandDraftControl; disabled: boolean; onFileSelected?: (file: File) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (file) void draft.select(file).then(accepted => {if (accepted) onFileSelected?.(file);});
        event.target.value = "";
    }
    function handleDrop(event: DragEvent<HTMLButtonElement>) {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (!disabled && !draft.uploading && file) void draft.select(file).then(accepted => {if (accepted) onFileSelected?.(file);});
    }
    return <div className="event-brand-field">
        <div className="event-brand-field__head"><span id={`${id}-label`}>{title}</span><EventTooltip content={<span className="event-brand-tooltip-copy">{help}{"\n\n"}{hint.replace(" · ", "\n")}</span>}>{tooltipID => <button className="event-brand-help" type="button" aria-label={`Про поле «${title}»`} aria-describedby={tooltipID}><CircleHelp size={15} /></button>}</EventTooltip></div>
        <input ref={inputRef} id={id} type="file" hidden accept={kind === "favicon" ? "image/png" : "image/png,image/jpeg,image/webp"} onChange={handleChange} disabled={disabled || draft.uploading} />
        {draft.source ? <div className={`event-brand-current event-brand-current--${kind}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Local blob and event media proxy need immediate draft preview. */}
            <img src={draft.source} alt={title} />
            {!disabled && <div className="event-brand-current__actions">
                <EventTooltip content={`Змінити ${title.toLowerCase()}`}>{tooltipID => <button className="ib-btn event-brand-change" type="button" aria-label={`Змінити ${title.toLowerCase()}`} aria-describedby={tooltipID} disabled={draft.uploading} onClick={() => inputRef.current?.click()}><Pencil size={16} /></button>}</EventTooltip>
                <EventTooltip content="Прибрати зображення після збереження">{tooltipID => <button className="ib-btn event-brand-remove" type="button" aria-label={`Прибрати ${title.toLowerCase()}`} aria-describedby={tooltipID} disabled={draft.uploading} onClick={draft.reset}><Trash2 size={16} /></button>}</EventTooltip>
            </div>}
        </div> : <button className={`event-brand-drop event-brand-drop--${kind}`} type="button" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={handleDrop} disabled={disabled || draft.uploading}>
            <ImagePlus size={22} aria-hidden="true" />
            <span className="event-brand-drop__action"><strong>{draft.uploading ? "Завантаження…" : "Прикріпити зображення"}</strong><small>або перетягніть сюди</small></span>
        </button>}
        {draft.error && <small className="event-brand-field__error" role="alert">{draft.error}</small>}
    </div>;
}
