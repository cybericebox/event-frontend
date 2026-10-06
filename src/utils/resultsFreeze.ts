import {t} from "@/i18n/t";
type FreezeTimes = {FrozenAt: string | null; FinishAt: string | null};

// Whole minutes between the freeze and the finish, or null without both.
export function freezeLeadMinutes(freeze: FreezeTimes): number | null {
    if (!freeze.FrozenAt || !freeze.FinishAt) return null;
    return Math.max(0, Math.round((Date.parse(freeze.FinishAt) - Date.parse(freeze.FrozenAt)) / 60000));
}

export function frozenBannerTitle(freeze: FreezeTimes): string {
    const minutes = freezeLeadMinutes(freeze);
    return minutes === null ? t("shell.freeze.title") : t("shell.freeze.titleLead", {minutes});
}

export function clockLabel(value: string | number | Date, timeZone?: string): string {
    return new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit", timeZone}).format(new Date(value));
}

// «з 17:30» for the banner meta; the viewer's local time.
export function frozenSinceLabel(freeze: FreezeTimes, timeZone?: string): string | null {
    return freeze.FrozenAt ? t("shell.freeze.since", {time: clockLabel(freeze.FrozenAt, timeZone)}) : null;
}

// Freeze start for the settings hint: finish − minutes.
export function freezeStartAt(finishAt: string | null | undefined, minutes: number): Date | null {
    if (!finishAt || !Number.isFinite(minutes) || minutes <= 0) return null;
    return new Date(Date.parse(finishAt) - minutes * 60000);
}

// Milliseconds until the next freeze boundary (start or finish), for a reload.
export function nextFreezeBoundary(freeze: FreezeTimes, now: number): number | null {
    const upcoming = [freeze.FrozenAt, freeze.FinishAt].filter((value): value is string => !!value).map(value => Date.parse(value) - now).filter(delta => delta > 0);
    return upcoming.length ? Math.min(...upcoming) : null;
}
