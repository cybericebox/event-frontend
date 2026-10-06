"use client";

import {useState} from "react";
import {toast} from "react-hot-toast";
import {Download} from "lucide-react";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";

// The CSV of one table of a section, in a block heading. `path` is the API path
// under /manage (with its query), `name` the file name prefix.
export function CsvButton({eventID, path, name, disabled = false}: {eventID: string; path: string; name: string; disabled?: boolean}) {
    const [busy, setBusy] = useState(false);
    async function download() {
        setBusy(true);
        try {await downloadManageCSV(eventID, path, csvFileName(name));}
        catch {toast.error(t("manage.analytics.exportFailed"));}
        finally {setBusy(false);}
    }
    return <EventButton className="ib-btn ib-btn--sm" type="button" disabled={disabled || busy} busy={busy} onClick={() => void download()}><Download size={14} aria-hidden="true" /> {t("manage.analytics.export")}</EventButton>;
}
