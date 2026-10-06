import {describe, expect, it} from "vitest";
import {actionWarning, currentPreviewPhase, defaultPreviewRegistration, previewPageAccess, previewValues} from "./previewScenario";

const now = Date.parse("2026-10-01T12:00:00Z");
const upcoming = {"event.startAt": "2026-10-03T09:00:00Z", "event.effectiveFinishAt": "2026-10-03T17:00:00Z", "event.registrationOpen": true, "event.registration": "open", "event.joinPolicy": "locked_at_start", "event.isStarted": false, "event.isFinished": false};

describe("preview scenario", () => {
    it("keeps real dates that already fit the phase", () => {
        const before = previewValues(upcoming, "before", "guest", undefined, now);
        expect(before["event.startAt"]).toBe("2026-10-03T09:00:00.000Z");
        expect(before["event.registrationOpen"]).toBe(true);
        expect(currentPreviewPhase(upcoming, now)).toBe("before");
    });

    it("moves the event around now for other phases and keeps its duration", () => {
        const during = previewValues(upcoming, "during", "participant", undefined, now);
        expect(Date.parse(String(during["event.startAt"]))).toBeLessThanOrEqual(now);
        expect(Date.parse(String(during["event.effectiveFinishAt"]))).toBeGreaterThan(now);
        expect(during["event.isStarted"]).toBe(true);
        expect(during["event.registrationOpen"]).toBe(false); // locked at start
        const after = previewValues(upcoming, "after", "participant", undefined, now);
        const start = Date.parse(String(after["event.startAt"]));
        const finish = Date.parse(String(after["event.effectiveFinishAt"]));
        expect(finish).toBeLessThanOrEqual(now);
        expect(finish - start).toBe(8 * 3_600_000);
        expect(after["event.isFinished"]).toBe(true);
        expect(after["event.registrationOpen"]).toBe(false);
    });

    it("ignores the real registration type and hides team counts from guests", () => {
        const closed = previewValues({...upcoming, "event.registration": "closed", "event.registrationOpen": false, "event.availableChallengeCount": 7}, "before", "guest", undefined, now);
        expect(closed["event.registrationOpen"]).toBe(true);
        expect(closed["event.registration"]).toBe("open");
        expect(closed["event.availableChallengeCount"]).toBe(0);
    });

    it("derives registration from the phase and lets the editor override it", () => {
        expect(defaultPreviewRegistration(upcoming, "before")).toBe("open");
        expect(defaultPreviewRegistration(upcoming, "during")).toBe("closed");
        expect(defaultPreviewRegistration({...upcoming, "event.joinPolicy": "rolling"}, "during")).toBe("open");
        expect(defaultPreviewRegistration(upcoming, "after")).toBe("closed");
        expect(previewValues(upcoming, "before", "guest", "closed", now)["event.registrationOpen"]).toBe(false);
        expect(previewValues(upcoming, "during", "guest", "open", now)["event.registrationOpen"]).toBe(true);
        expect(previewValues(upcoming, "after", "guest", "open", now)["event.registrationOpen"]).toBe(false);
    });

    it("does not leak the real lifecycle state", () => {
        // Really finished, withdrawn and not yet re-published: every phase still emulates a live event.
        const real = {...upcoming, "event.phase": "withdrawn", "event.isFinished": true, "event.isWithdrawn": true, "event.isPublished": false, "event.rosterOpen": false,
            "event.publishAt": "2026-10-02T00:00:00Z", "event.withdrawAt": "2026-09-30T00:00:00Z", "event.manualFinishAt": "2026-09-29T00:00:00Z",
            "event.startAt": "2026-09-20T09:00:00Z", "event.effectiveFinishAt": "2026-09-20T17:00:00Z"};
        const before = previewValues(real, "before", "guest", undefined, now);
        expect(before["event.phase"]).toBe("published");
        expect(before["event.isPublished"]).toBe(true);
        expect(before["event.isWithdrawn"]).toBe(false);
        expect(before["event.isFinished"]).toBe(false);
        expect(before["event.rosterOpen"]).toBe(true);
        expect(before["event.manualFinishAt"]).toBeNull();
        expect(before["event.withdrawAt"]).toBeNull();
        expect(Date.parse(String(before["event.publishAt"]))).toBeLessThanOrEqual(now);
        expect(Date.parse(String(before["event.startAt"]))).toBeGreaterThan(now);
        expect(before["event.registrationOpen"]).toBe(true);
        const after = previewValues(real, "after", "guest", undefined, now);
        expect(after["event.isFinished"]).toBe(true);
        expect(after["event.rosterOpen"]).toBe(false);
    });

    it("warns when a join button will never show on the real site", () => {
        const join = {kind: "join_event" as const};
        expect(actionWarning(join, upcoming)).toBeNull();
        expect(actionWarning(join, {...upcoming, "event.registration": "closed"})).toMatchObject({message: expect.stringContaining("Реєстрацію закрито"), href: "/manage/registration"});
        expect(actionWarning(join, {...upcoming, "event.phase": "finished", "event.isFinished": true})).toMatchObject({href: "/manage/schedule"});
        expect(actionWarning(join, {...upcoming, "event.phase": "started", "event.isStarted": true})).toMatchObject({href: "/manage/registration"});
        expect(actionWarning(join, {...upcoming, "event.phase": "started", "event.isStarted": true, "event.joinPolicy": "rolling"})).toBeNull();
    });

    it("warns when a link leads to a hidden scoreboard", () => {
        expect(actionWarning({kind: "link", href: "/scoreboard"}, {"event.scoreboardVisibility": "hidden"})).toMatchObject({href: "/manage/results-settings"});
        expect(actionWarning({kind: "link", href: "/scoreboard"}, {"event.scoreboardVisibility": "public"})).toBeNull();
        expect(actionWarning({kind: "link", href: "/rules"}, {"event.scoreboardVisibility": "hidden"})).toBeNull();
        expect(actionWarning(undefined, {})).toBeNull();
    });

    it("explains which viewers cannot open a page", () => {
        expect(previewPageAccess(0, "guest")).toBeNull();
        expect(previewPageAccess(1, "guest")).toContain("учасників");
        expect(previewPageAccess(1, "participant")).toBeNull();
        expect(previewPageAccess(2, "participant")).toContain("модератори");
        expect(previewPageAccess(2, "moderator")).toBeNull();
    });
});
