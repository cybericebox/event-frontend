import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";

// results-2026-09-29.csv — the export date in UTC, like the manage timestamps.
export function csvFileName(prefix: string, at: Date = new Date()): string {
    return `${prefix}-${at.toISOString().slice(0, 10)}.csv`;
}

function saveBlob(blob: Blob, fileName: string) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// Downloads a manage CSV export with the session cookie (a plain link would
// not carry credentials to the API origin).
export async function downloadManageCSV(eventID: string, path: string, fileName: string, mockRows: string[][]): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        const text = mockRows.map(row => row.map(cell => /[",\n]/.test(cell) ? `"${cell.replaceAll("\"", "\"\"")}"` : cell).join(",")).join("\n");
        saveBlob(new Blob(["﻿" + text], {type: "text/csv;charset=utf-8"}), fileName);
        return;
    }
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {credentials: "include", cache: "no-store", headers: {Accept: "text/csv"}});
    if (!response.ok) throw await manageApiError(response);
    saveBlob(await response.blob(), fileName);
}
