import type {ContentValue} from "@/types/eventContent";
import {t} from "@/i18n/t";

export type PreviewViewer = "guest" | "participant" | "moderator";
export type PreviewPhase = "before" | "during" | "after";
export type PreviewRegistration = "open" | "closed";

export const previewViewers: {value: PreviewViewer; label: string}[] = [
    {value: "guest", label: t("manage.editor.preview.guest")},
    {value: "participant", label: t("manage.editor.preview.participant")},
    {value: "moderator", label: t("manage.editor.preview.moderator")},
];

export const previewPhases: {value: PreviewPhase; label: string}[] = [
    {value: "before", label: t("manage.editor.preview.before")},
    {value: "during", label: t("manage.editor.preview.during")},
    {value: "after", label: t("manage.editor.preview.after")},
];

export const previewRegistrations: {value: PreviewRegistration; label: string}[] = [
    {value: "open", label: t("manage.editor.preview.registrationOpen")},
    {value: "closed", label: t("manage.editor.preview.registrationClosed")},
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
 * Whether registration is open in the emulated phase when the editor has not
 * picked it. It follows the registration window only (the lifecycle rule) and
 * ignores the event's real registration type, so a closed registration does not
 * hide join buttons from the preview: before the start the window is open,
 * during the event only with the rolling join policy, after the finish never.
 */
export function defaultPreviewRegistration(values: Record<string, ContentValue>, phase: PreviewPhase): PreviewRegistration {
    if (phase === "before") return "open";
    if (phase === "during") return values["event.joinPolicy"] === "rolling" ? "open" : "closed";
    return "closed";
}

/**
 * Preview-only variables for a viewer, phase and registration state. Nothing
 * is read from the event's real current state: the phase flags, the lifecycle
 * dates and the registration window are all emulated. Real dates are kept when
 * they already fit the phase; otherwise start/finish are moved around `now`
 * (keeping the event's duration) so countdowns, conditions and the join window
 * behave as they would. After the finish registration is always closed.
 * Nothing here is saved.
 */
export function previewValues(values: Record<string, ContentValue>, phase: PreviewPhase, viewer: PreviewViewer, registration: PreviewRegistration = defaultPreviewRegistration(values, phase), now = Date.now()): Record<string, ContentValue> {
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
    // The event is published in every phase and not withdrawn yet.
    const realPublish = time(values["event.publishAt"]);
    const publish = realPublish !== null && realPublish <= Math.min(now, start) ? realPublish : Math.min(now, start) - hour;
    const realWithdraw = time(values["event.withdrawAt"]);
    const iso = (value: number) => new Date(value).toISOString();
    const registrationOpen = phase !== "after" && registration === "open";
    const next: Record<string, ContentValue> = {
        ...values,
        "event.phase": phase === "before" ? "published" : phase === "during" ? "started" : "finished",
        "event.isPublished": true,
        "event.isStarted": phase === "during",
        "event.isFinished": phase === "after",
        "event.isWithdrawn": false,
        "event.runtimeOpen": phase === "during",
        "event.rosterOpen": phase === "before",
        "event.registrationOpen": registrationOpen,
        "event.publishAt": iso(publish),
        "event.startAt": iso(start),
        "event.finishAt": iso(finish),
        "event.effectiveFinishAt": iso(finish),
        "event.manualFinishAt": null,
        "event.withdrawAt": realWithdraw !== null && realWithdraw > Math.max(now, finish) ? iso(realWithdraw) : null,
    };
    // An emulated open registration needs a registration type that admits joining.
    if (registrationOpen && values["event.registration"] === "closed") next["event.registration"] = "open";
    // Guests never get team-specific counts (the server sends 0).
    if (viewer === "guest" && "event.availableChallengeCount" in values) next["event.availableChallengeCount"] = 0;
    return next;
}

// Who may open a page with this visibility (0 public, 1 participants, 2 managers).
export function previewPageAccess(visibility: 0 | 1 | 2, viewer: PreviewViewer): string | null {
    if (visibility === 1 && viewer === "guest") return t("manage.editor.preview.guestDenied");
    if (visibility === 2 && viewer !== "moderator") return t("manage.editor.preview.moderatorsOnly");
    return null;
}

export type ActionWarning = {message: string; href: string; link: string};

/**
 * Why an action button configured in the editor will never show (or lead
 * nowhere) on the real site, judged by the event's REAL settings and state.
 * The preview emulates these away, so the editor warns next to the button.
 */
export function actionWarning(action: {kind?: "link" | "join_event"; href?: string} | undefined, values: Record<string, ContentValue>): ActionWarning | null {
    if (!action) return null;
    if (action.kind === "join_event") {
        const registration = {href: "/manage/registration", link: t("manage.blocks.action.warning.registrationLink")};
        if (values["event.registration"] === "closed") return {message: t("manage.blocks.action.warning.registrationClosed"), ...registration};
        const phase = values["event.phase"];
        if (phase === "finished" || phase === "withdrawn" || values["event.isFinished"] === true || values["event.isWithdrawn"] === true) return {message: t("manage.blocks.action.warning.finished"), href: "/manage/schedule", link: t("manage.blocks.action.warning.scheduleLink")};
        if ((phase === "started" || values["event.isStarted"] === true) && values["event.joinPolicy"] === "locked_at_start") return {message: t("manage.blocks.action.warning.windowPassed"), ...registration};
        return null;
    }
    const path = (action.href ?? "").split(/[?#]/)[0];
    if (path === "/scoreboard" && values["event.scoreboardVisibility"] === "hidden") return {message: t("manage.blocks.action.warning.scoreboardHidden"), href: "/manage/results-settings", link: t("manage.blocks.action.warning.resultsLink")};
    return null;
}
