import {t} from "@/i18n/t";

export const dateDisplayOptions = [
    {value: "date-time", label: t("content.date.format.dateTime")},
    {value: "date", label: t("content.date.format.date")},
    {value: "time", label: t("content.date.format.time")},
    {value: "short", label: t("content.date.format.short")},
    {value: "custom", label: t("content.date.format.custom")},
] as const;

export type DateDisplayFormat = typeof dateDisplayOptions[number]["value"];

export function validDatePattern(pattern: string): boolean {
    return pattern.length > 0 && pattern.length <= 80 && !/[\r\n<>]/.test(pattern) && /yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|H|mm|m|ss|s/.test(pattern);
}

// Page content (landing, schedule, any date in a block) is the same text for every visitor and is rendered on the
// server: dates are written in the event's zone, never the zone of the server or of the browser, so the server HTML
// and the hydrated page match (no React #418, no time jumping by the zone offset) and «14:00» means Kyiv time.
export const EVENT_TIME_ZONE = "Europe/Kyiv";

const formats = {
    "date-time": new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: EVENT_TIME_ZONE}),
    date: new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeZone: EVENT_TIME_ZONE}),
    time: new Intl.DateTimeFormat("uk-UA", {timeStyle: "short", timeZone: EVENT_TIME_ZONE}),
};
const numericParts = new Intl.DateTimeFormat("en-GB", {year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23", timeZone: EVENT_TIME_ZONE});
const monthLong = new Intl.DateTimeFormat("uk-UA", {month: "long", timeZone: EVENT_TIME_ZONE});
const monthShort = new Intl.DateTimeFormat("uk-UA", {month: "short", timeZone: EVENT_TIME_ZONE});
// With a day number the month is in the genitive: «21 жовтня», alone the nominative: «жовтень 2026».
const dayMonthLong = new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long", timeZone: EVENT_TIME_ZONE});

// The calendar fields of a moment in the event's zone (one formatToParts call).
function eventParts(date: Date) {
    const parts = new Map(numericParts.formatToParts(date).map(item => [item.type, Number(item.value)]));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? 0;
    return {year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), second: part("second")};
}

function monthName(date: Date, withDay: boolean): string {
    return withDay ? dayMonthLong.formatToParts(date).find(item => item.type === "month")?.value ?? monthLong.format(date) : monthLong.format(date);
}

export function formatDateTime(value: string, format: DateDisplayFormat = "date-time", pattern = ""): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    if (format === "date-time" || format === "date" || format === "time") return formats[format].format(date);
    const pad = (part: number) => String(part).padStart(2, "0");
    const {year, month, day, hour, minute, second} = eventParts(date);
    if (format === "short") return `${pad(day)}.${pad(month)}.${year} ${pad(hour)}:${pad(minute)}`;
    if (!validDatePattern(pattern)) return "—";
    const parts: Record<string, string> = {
        yyyy: String(year), yy: pad(year % 100),
        MMMM: monthName(date, /(^|[^d])d{1,2}([^d]|$)/.test(pattern.replace(/\[[^\]]*\]/g, ""))),
        MMM: monthShort.format(date),
        MM: pad(month), M: String(month),
        dd: pad(day), d: String(day),
        HH: pad(hour), H: String(hour),
        mm: pad(minute), m: String(minute),
        ss: pad(second), s: String(second),
    };
    return pattern.replace(/\[[^\]]*\]|yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|H|mm|m|ss|s/g, token => token.startsWith("[") ? token.slice(1, -1) : parts[token]);
}
