"use client";

import {useState} from "react";
import {Download} from "lucide-react";
import {EventButton} from "@/components/ui/EventButton";
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
    return <>
        <EventButton className="ib-cmodal__file" busy={busy} busyLabel={t("common.busy.downloading")} onClick={() => {
            if (busy) return;
            setBusy(true); setFailed(false);
            void downloadAttachment(url, name).catch(() => setFailed(true)).finally(() => setBusy(false));
        }}><Download aria-hidden="true" /><span>{name}</span><span className="ib-cmodal__size">{formatFileSize(size)}</span></EventButton>
        {failed && <p role="alert" className="ib-cmodal__msg is-error">{t("challenges.file.failed")}</p>}
    </>;
}
