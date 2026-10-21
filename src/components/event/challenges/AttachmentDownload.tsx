"use client";

import {useId, useState} from "react";
import {Download} from "lucide-react";
import {BusyMark} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {formatFileSize} from "./challengeBoardModel";

// A real attachment download: cookies accompany cross-origin API requests and only
// a temporary blob URL reaches the browser download target.
export async function downloadAttachment(url: string, filename: string): Promise<void> {
    const response = await fetch(url, {credentials: "include", cache: "no-store"});
    if (!response.ok) throw new Error(String(response.status));
    const href = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = href; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function AttachmentDownload({url, name, size}: {url: string; name: string; size: number}) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const errorID = useId();
    return <>
        <button type="button" className={`ib-cmodal__file${busy ? " is-busy" : ""}`} disabled={busy} aria-busy={busy || undefined} aria-describedby={failed ? errorID : undefined} onClick={() => {
            if (busy) return;
            setBusy(true); setFailed(false);
            void downloadAttachment(url, name).catch(() => setFailed(true)).finally(() => setBusy(false));
        }}><span className="ib-cmodal__file-icon" aria-hidden="true">{busy ? <BusyMark /> : <Download />}</span><span className="ib-cmodal__file-text"><span>{name}</span><span className="ib-cmodal__size"><span aria-hidden={busy || undefined}>{formatFileSize(size)}</span><span className="ib-cmodal__download-status" aria-hidden={!busy || undefined} role={busy ? "status" : undefined}>{t("common.busy.downloading")}</span></span></span></button>
        {failed && <p id={errorID} role="alert" className="ib-cmodal__msg is-error">{t("challenges.file.failed")}</p>}
    </>;
}
