import {zoneLabel} from "@/components/ui/dateTimePicker";

// Every timestamp the UI shows is in the viewer's own time zone (no timeZone
// option, so Intl uses the browser's). UTC stays only in exports and API params.
const dateTime = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});

// «29 вер. 2026 р., 17:30» in the viewer's zone.
export function formatDateTime(value: string | number | Date): string {
    return dateTime.format(new Date(value));
}

// Short zone name, e.g. «GMT+3», for a column header or a caption.
export function zoneOffset(at: Date = new Date()): string {
    return zoneLabel(at).offset;
}
