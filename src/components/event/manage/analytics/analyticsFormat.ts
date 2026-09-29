import {t} from "@/i18n/t";

// Shared value formatting of the stands and report sections. A missing value
// is an em dash, never a zero.
const none = "—";
const decimal = new Intl.NumberFormat("uk-UA", {maximumFractionDigits: 1});
const wholeNumber = new Intl.NumberFormat("uk-UA");

export const formatCount = (value: number) => wholeNumber.format(value);

// 95 → «1 хв 35 с», 3700 → «1 год 1 хв».
export function formatDuration(seconds: number | null): string {
    if (seconds === null) return none;
    const total = Math.max(0, Math.round(seconds));
    if (total < 60) return t("manage.analytics.time.seconds", {s: total});
    const minutes = Math.floor(total / 60);
    if (total < 3600) {
        const rest = total % 60;
        return rest === 0 ? t("manage.analytics.time.minutes", {m: minutes}) : t("manage.analytics.time.minutesSeconds", {m: minutes, s: rest});
    }
    const hours = Math.floor(total / 3600);
    const restMinutes = Math.floor((total % 3600) / 60);
    return restMinutes === 0 ? t("manage.analytics.time.hours", {h: hours}) : t("manage.analytics.time.hoursMinutes", {h: hours, m: restMinutes});
}

export function formatBytes(bytes: number): string {
    const units = [["manage.analytics.unit.gib", 1024 ** 3], ["manage.analytics.unit.mib", 1024 ** 2], ["manage.analytics.unit.kib", 1024]] as const;
    for (const [key, scale] of units) if (bytes >= scale) return t(key, {value: decimal.format(bytes / scale)});
    return t("manage.analytics.unit.b", {value: wholeNumber.format(bytes)});
}

// Millicores as cores.
export const formatCpu = (millicores: number) => t("manage.analytics.unit.cpu", {value: decimal.format(millicores / 1000)});

const dateTime = new Intl.DateTimeFormat("uk-UA", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"});
export const formatDateTime = (iso: string | null) => iso ? dateTime.format(new Date(iso)) : none;

export const noValue = none;
