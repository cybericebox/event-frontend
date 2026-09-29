"use client";

import {useRef, useState, type DragEvent, type KeyboardEvent} from "react";
import {FileText, Upload, X} from "lucide-react";
import {BusyMark} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import "@/styles/file-picker.css";

// Whether a file matches an `accept` list (".csv", "text/csv", "image/*"),
// the same rule the browser applies to the native picker.
export function acceptsFile(file: File, accept: string | undefined): boolean {
    const rules = (accept ?? "").split(",").map(rule => rule.trim().toLowerCase()).filter(Boolean);
    if (!rules.length) return true;
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return rules.some(rule => rule.startsWith(".") ? name.endsWith(rule) : rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule);
}

export function formatFileSize(bytes: number): string {
    const number = (value: number) => new Intl.NumberFormat("uk-UA", {maximumFractionDigits: 1}).format(value);
    if (bytes < 1024) return t("ui.filePicker.sizeB", {size: bytes});
    if (bytes < 1024 * 1024) return t("ui.filePicker.sizeKB", {size: number(bytes / 1024)});
    return t("ui.filePicker.sizeMB", {size: number(bytes / 1024 / 1024)});
}

// DS file picker: a dashed drop zone («Перетягніть файл сюди або» + «Обрати
// файл») that opens the native picker on click, Enter or Space, and checks a
// dropped or picked file against `accept` and `maxBytes` before handing it on.
// With a file it shows the name, size and a remove button. `compact` is the
// one-line variant for dialogs.
export function EventFilePicker({id, fileName, fileSize, onFile, accept, maxBytes, hint, error, busy = false, compact = false, disabled = false, describedBy}: {
    id: string;
    fileName: string | null;
    fileSize?: number;
    onFile: (file: File | null) => void;
    accept?: string;
    maxBytes?: number;
    // The allowed formats and size, under the prompt.
    hint?: string;
    // A rejection from the caller (e.g. the server), shown like our own.
    error?: string | null;
    busy?: boolean;
    compact?: boolean;
    disabled?: boolean;
    describedBy?: string;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [over, setOver] = useState(false);
    const [problem, setProblem] = useState<{text: string; blocking: boolean} | null>(null);
    const inactive = disabled || busy;
    const hintID = `${id}-hint`;
    const errorID = `${id}-error`;
    const shownError = problem?.blocking ? problem.text : error ?? null;
    const describe = [describedBy, hint ? hintID : null, shownError || problem ? errorID : null].filter(Boolean).join(" ") || undefined;

    function take(files: FileList | File[] | null) {
        const list = Array.from(files ?? []);
        const file = list[0];
        if (!file) return;
        if (!acceptsFile(file, accept)) {setProblem({text: t("ui.filePicker.wrongType"), blocking: true}); return;}
        if (maxBytes !== undefined && file.size > maxBytes) {setProblem({text: t("ui.filePicker.tooLarge", {max: formatFileSize(maxBytes)}), blocking: true}); return;}
        setProblem(list.length > 1 ? {text: t("ui.filePicker.onlyOne"), blocking: false} : null);
        onFile(file);
    }

    function open() { if (!inactive) input.current?.click(); }
    function key(event: KeyboardEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        open();
    }
    function dragOver(event: DragEvent<HTMLDivElement>) {
        if (inactive) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
    }
    function dragLeave(event: DragEvent<HTMLDivElement>) {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    }
    function drop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setOver(false);
        if (!inactive) take(event.dataTransfer.files);
    }

    const zoneClass = `event-file-drop${compact ? " is-compact" : ""}${over ? " is-over" : ""}${fileName ? " has-file" : ""}${inactive ? " is-disabled" : ""}${shownError ? " is-invalid" : ""}`;
    return <div className="event-file-picker">
        <input ref={input} id={id} className="event-file-picker__input" type="file" accept={accept} disabled={inactive} tabIndex={-1} aria-hidden="true"
            onChange={event => {const files = event.target.files; take(files ? Array.from(files) : null); event.target.value = "";}} />
        {fileName
            ? <div className={zoneClass} onDragOver={dragOver} onDragEnter={dragOver} onDragLeave={dragLeave} onDrop={drop} aria-describedby={describe}>
                <FileText className="event-file-drop__icon" size={compact ? 18 : 22} aria-hidden="true" />
                <span className="event-file-drop__file"><span className="event-file-drop__name">{fileName}</span>{fileSize !== undefined && <span className="event-file-drop__size">{formatFileSize(fileSize)}</span>}</span>
                {busy ? <span className="event-file-drop__busy" role="status" aria-label={t("ui.filePicker.busy")}><BusyMark /></span>
                    : <button className="ib-icon-btn ib-icon-btn--sm" type="button" disabled={disabled} aria-label={t("ui.filePicker.clear", {name: fileName})} onClick={() => {setProblem(null); onFile(null);}}><X size={16} /></button>}
            </div>
            : <div className={zoneClass} role="button" tabIndex={inactive ? -1 : 0} aria-disabled={inactive || undefined} aria-label={t("ui.filePicker.choose")} aria-describedby={describe}
                onClick={open} onKeyDown={key} onDragOver={dragOver} onDragEnter={dragOver} onDragLeave={dragLeave} onDrop={drop}>
                {busy ? <span className="event-file-drop__busy" role="status" aria-label={t("ui.filePicker.busy")}><BusyMark /></span> : <Upload className="event-file-drop__icon" size={compact ? 18 : 22} aria-hidden="true" />}
                <span className="event-file-drop__prompt">{t("ui.filePicker.drop")} <span className="ib-btn ib-btn--sm" aria-hidden="true">{t("ui.filePicker.choose")}</span></span>
                {hint && <small className="event-file-drop__hint" id={hintID}>{hint}</small>}
            </div>}
        {fileName && hint && <small className="event-file-drop__hint" id={hintID}>{hint}</small>}
        {(shownError || problem) && <p className={`event-file-picker__message${shownError ? " is-error" : ""}`} id={errorID} role={shownError ? "alert" : "status"}>{shownError ?? problem?.text}</p>}
    </div>;
}
