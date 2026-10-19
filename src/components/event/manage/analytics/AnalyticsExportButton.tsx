"use client";

import {useState} from "react";
import {toastFailure} from "@/components/ui/toastApiError";
import {Download} from "lucide-react";
import {analyticsExportPath, type AnalyticsPeriod} from "@/api/manageAnalytics";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";
import {EventButton} from "@/components/ui/EventButton";
import {useCanExport} from "@/components/event/manage/managerContext";
import {t} from "@/i18n/t";

// The CSV export of a section for the chosen period. `section` is the API path
// segment (`analytics/<section>/export.csv`) and the file name prefix.
export function AnalyticsExportButton({eventID, section, period, disabled = false}: {eventID: string; section: string; period: AnalyticsPeriod; disabled?: boolean}) {
    const canExport = useCanExport();
    const [busy, setBusy] = useState(false);
    async function download() {
        setBusy(true);
        try {await downloadManageCSV(eventID, analyticsExportPath(section, period), csvFileName(`analytics-${section}`));}
        catch (failure) {toastFailure(failure, t("manage.analytics.exportFailed"));}
        finally {setBusy(false);}
    }
    if (!canExport) return null;
    return <EventButton className="ib-btn" type="button" disabled={disabled || busy} busy={busy} busyLabel={t("common.busy.downloading")} onClick={() => void download()}><Download size={16} aria-hidden="true" /> {t("manage.analytics.export")}</EventButton>;
}
