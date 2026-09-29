"use client";

import {useRef} from "react";
import {X} from "lucide-react";
import {t} from "@/i18n/t";
import "./invites.css";

// DS file picker: a button, the chosen file name and a clear action instead
// of the browser's native control.
export function FilePicker({id, fileName, onFile, accept, disabled = false, describedBy}: {
    id: string;
    fileName: string | null;
    onFile: (file: File | null) => void;
    accept?: string;
    disabled?: boolean;
    describedBy?: string;
}) {
    const input = useRef<HTMLInputElement>(null);
    return <div className="event-file-picker">
        <input ref={input} id={id} className="event-file-picker__input" type="file" accept={accept} disabled={disabled} tabIndex={-1} aria-hidden="true"
            onChange={event => {const file = event.target.files?.[0] ?? null; event.target.value = ""; onFile(file);}} />
        <button className="ib-btn ib-btn--sm" type="button" disabled={disabled} aria-describedby={describedBy} onClick={() => input.current?.click()}>{t("manage.invites.file.choose")}</button>
        <span className={`event-file-picker__name${fileName ? "" : " is-empty"}`}>{fileName ?? t("manage.invites.file.none")}</span>
        {fileName && <button className="ib-icon-btn ib-icon-btn--sm" type="button" disabled={disabled} aria-label={t("manage.invites.file.clear", {name: fileName})} onClick={() => onFile(null)}><X size={16} /></button>}
    </div>;
}
