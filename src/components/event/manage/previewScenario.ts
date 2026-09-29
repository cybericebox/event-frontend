import type {ContentValue} from "@/types/eventContent";

export type PreviewViewer = "guest" | "participant" | "moderator";
export type PreviewPhase = "before" | "during" | "after";

export const previewViewers: {value: PreviewViewer; label: string}[] = [
    {value: "guest", label: "Гість"},
    {value: "participant", label: "Учасник"},
    {value: "moderator", label: "Модератор"},
];

export const previewPhases: {value: PreviewPhase; label: string}[] = [
    {value: "before", label: "До старту"},
    {value: "during", label: "Під час"},
    {value: "after", label: "Після фінішу"},
];

const hour = 3_600_000;

function time(value: ContentValue | undefined): number | null {
    const parsed = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

// The phase the real values describe; used as the preview's initial phase.
export function currentPreviewPhase(values: Record<string, ContentValue>, now = Date.now()): PreviewPhase {
    if (values["event.isFinished"] === true || values["event.phase"] === "finished") return "after";
    if (values["event.isStarted"] === true || values["event.phase"] === "started") return "during";
    const start = time(values["event.startAt"]);
    const finish = time(values["event.effectiveFinishAt"]) ?? time(values["event.finishAt"]);
    if (finish !== null && now >= finish) return "after";
    if (start !== null && now >= start) return "during";
    return "before";
}

/**
 * Preview-only variables for a phase. Real dates are kept when they already fit
 * the phase; otherwise start/finish are moved around `now` (keeping the event's
 * duration) so countdowns, conditions and the join window behave as they would.
 * Nothing here is saved.
 */
export function previewValues(values: Record<string, ContentValue>, phase: PreviewPhase, viewer: PreviewViewer, now = Date.now()): Record<string, ContentValue> {
    const realStart = time(values["event.startAt"]);
    const realFinish = time(values["event.effectiveFinishAt"]) ?? time(values["event.finishAt"]);
    const duration = realStart !== null && realFinish !== null && realFinish > realStart ? realFinish - realStart : 8 * hour;
    let start: number, finish: number;
    if (phase === "before") {
        start = realStart !== null && realStart > now ? realStart : now + 3 * 24 * hour;
        finish = realFinish !== null && realFinish > start ? realFinish : start + duration;
    } else if (phase === "during") {
        start = realStart !== null && realStart <= now ? realStart : now - hour;
        finish = realFinish !== null && realFinish > now ? realFinish : Math.max(start + duration, now + hour);
    } else {
        finish = realFinish !== null && realFinish <= now ? realFinish : now - hour;
        start = realStart !== null && realStart < finish ? realStart : finish - duration;
    }
    const iso = (value: number) => new Date(value).toISOString();
    const joinOpenByType = values["event.registration"] === undefined
        ? values["event.registrationOpen"] === true || currentPreviewPhase(values, now) !== "before"
        : values["event.registration"] !== "closed";
    const registrationOpen = phase === "before" ? joinOpenByType
        : phase === "during" ? joinOpenByType && values["event.joinPolicy"] !== "locked_at_start"
            : false;
    const next: Record<string, ContentValue> = {
        ...values,
        "event.phase": phase === "before" ? "published" : phase === "during" ? "started" : "finished",
        "event.isStarted": phase === "during",
        "event.isFinished": phase === "after",
        "event.runtimeOpen": phase === "during",
        "event.registrationOpen": registrationOpen,
        "event.startAt": iso(start),
        "event.finishAt": iso(finish),
        "event.effectiveFinishAt": iso(finish),
    };
    // Guests never get team-specific counts (the server sends 0).
    if (viewer === "guest" && "event.availableChallengeCount" in values) next["event.availableChallengeCount"] = 0;
    return next;
}

// Who may open a page with this visibility (0 public, 1 participants, 2 managers).
export function previewPageAccess(visibility: 0 | 1 | 2, viewer: PreviewViewer): string | null {
    if (visibility === 1 && viewer === "guest") return "Гість не бачить цю сторінку: вона лише для підтверджених учасників.";
    if (visibility === 2 && viewer !== "moderator") return "Сторінку бачать лише модератори події.";
    return null;
}
