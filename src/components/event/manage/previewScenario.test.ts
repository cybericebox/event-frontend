import {describe, expect, it} from "vitest";
import {currentPreviewPhase, previewPageAccess, previewValues} from "./previewScenario";

const now = Date.parse("2026-10-01T12:00:00Z");
const upcoming = {"event.startAt": "2026-10-03T09:00:00Z", "event.effectiveFinishAt": "2026-10-03T17:00:00Z", "event.registrationOpen": true, "event.registration": "open", "event.joinPolicy": "locked_at_start", "event.isStarted": false, "event.isFinished": false};

describe("preview scenario", () => {
    it("keeps real dates that already fit the phase", () => {
        const before = previewValues(upcoming, "before", "guest", now);
        expect(before["event.startAt"]).toBe("2026-10-03T09:00:00.000Z");
        expect(before["event.registrationOpen"]).toBe(true);
        expect(currentPreviewPhase(upcoming, now)).toBe("before");
    });

    it("moves the event around now for other phases and keeps its duration", () => {
        const during = previewValues(upcoming, "during", "participant", now);
        expect(Date.parse(String(during["event.startAt"]))).toBeLessThanOrEqual(now);
        expect(Date.parse(String(during["event.effectiveFinishAt"]))).toBeGreaterThan(now);
        expect(during["event.isStarted"]).toBe(true);
        expect(during["event.registrationOpen"]).toBe(false); // locked at start
        const after = previewValues(upcoming, "after", "participant", now);
        const start = Date.parse(String(after["event.startAt"]));
        const finish = Date.parse(String(after["event.effectiveFinishAt"]));
        expect(finish).toBeLessThanOrEqual(now);
        expect(finish - start).toBe(8 * 3_600_000);
        expect(after["event.isFinished"]).toBe(true);
        expect(after["event.registrationOpen"]).toBe(false);
    });

    it("respects a closed registration type and hides team counts from guests", () => {
        const closed = previewValues({...upcoming, "event.registration": "closed", "event.availableChallengeCount": 7}, "before", "guest", now);
        expect(closed["event.registrationOpen"]).toBe(false);
        expect(closed["event.availableChallengeCount"]).toBe(0);
    });

    it("explains which viewers cannot open a page", () => {
        expect(previewPageAccess(0, "guest")).toBeNull();
        expect(previewPageAccess(1, "guest")).toContain("учасників");
        expect(previewPageAccess(1, "participant")).toBeNull();
        expect(previewPageAccess(2, "participant")).toContain("модератори");
        expect(previewPageAccess(2, "moderator")).toBeNull();
    });
});
