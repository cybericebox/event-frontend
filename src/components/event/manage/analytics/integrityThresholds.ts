import {clampThresholds, integrityLevels, type IntegrityThresholds} from "@/api/manageAnalyticsIntegrity";

// The moderator's thresholds are remembered per event in this browser (a
// convenience only: the server holds no per-event setting, and the defaults
// are the fallback whenever storage is unavailable or the value is stale).
const storageKey = (eventID: string) => `event-analytics-integrity-v2:${eventID}`;

const isNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

export function loadThresholds(eventID: string): IntegrityThresholds | null {
    try {
        const raw = window.localStorage.getItem(storageKey(eventID));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<IntegrityThresholds> | null;
        const floors = parsed?.FloorSeconds as Record<string, unknown> | undefined;
        if (!parsed || !floors || !integrityLevels.every(level => isNumber(floors[level]))) return null;
        if (!isNumber(parsed.BruteForceAttempts) || !isNumber(parsed.BruteForceWindowSeconds) || !isNumber(parsed.FollowGapSeconds)) return null;
        return clampThresholds(parsed as IntegrityThresholds);
    } catch {
        return null;
    }
}

export function saveThresholds(eventID: string, thresholds: IntegrityThresholds | null) {
    try {
        if (thresholds) window.localStorage.setItem(storageKey(eventID), JSON.stringify(thresholds));
        else window.localStorage.removeItem(storageKey(eventID));
    } catch {
        // Storage can be blocked; the thresholds then last for the visit only.
    }
}
