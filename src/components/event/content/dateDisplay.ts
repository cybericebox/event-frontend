export const dateDisplayOptions = [
    {value: "date-time", label: "Дата й час"},
    {value: "date", label: "Лише дата"},
    {value: "time", label: "Лише час"},
    {value: "short", label: "Коротко: 30.09.2026 01:17"},
    {value: "custom", label: "Свій формат"},
] as const;

export type DateDisplayFormat = typeof dateDisplayOptions[number]["value"];

export function validDatePattern(pattern: string): boolean {
    return pattern.length > 0 && pattern.length <= 80 && !/[\r\n<>]/.test(pattern) && /yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|H|mm|m|ss|s/.test(pattern);
}

export function formatDateTime(value: string, format: DateDisplayFormat = "date-time", pattern = ""): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    if (format === "date-time") return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"}).format(date);
    if (format === "date") return new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium"}).format(date);
    if (format === "time") return new Intl.DateTimeFormat("uk-UA", {timeStyle: "short"}).format(date);
    const pad = (part: number) => String(part).padStart(2, "0");
    if (format === "short") return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (!validDatePattern(pattern)) return "—";
    const month = date.getMonth() + 1;
    const parts: Record<string, string> = {
        yyyy: String(date.getFullYear()), yy: pad(date.getFullYear() % 100),
        MMMM: new Intl.DateTimeFormat("uk-UA", {month: "long"}).format(date),
        MMM: new Intl.DateTimeFormat("uk-UA", {month: "short"}).format(date),
        MM: pad(month), M: String(month),
        dd: pad(date.getDate()), d: String(date.getDate()),
        HH: pad(date.getHours()), H: String(date.getHours()),
        mm: pad(date.getMinutes()), m: String(date.getMinutes()),
        ss: pad(date.getSeconds()), s: String(date.getSeconds()),
    };
    return pattern.replace(/\[[^\]]*\]|yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|H|mm|m|ss|s/g, token => token.startsWith("[") ? token.slice(1, -1) : parts[token]);
}
