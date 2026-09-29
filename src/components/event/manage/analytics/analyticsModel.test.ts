import {describe, expect, it} from "vitest";
import {emptyPeriodDraft, percent, periodInvalid, periodOf, periodSet, seriesHasActivity, visibleMarkers} from "./analyticsModel";

describe("period draft", () => {
    it("leaves blank bounds to the server and sends set ones as UTC", () => {
        expect(periodOf(emptyPeriodDraft)).toEqual({from: null, to: null});
        const period = periodOf({from: "2026-09-29T10:00", to: ""});
        expect(period.to).toBeNull();
        expect(period.from).toBe(new Date(2026, 8, 29, 10, 0).toISOString());
    });

    it("flags a period that does not run forward", () => {
        expect(periodInvalid({from: "2026-09-29T12:00:00.000Z", to: "2026-09-29T10:00:00.000Z"})).toBe(true);
        expect(periodInvalid({from: "2026-09-29T10:00:00.000Z", to: "2026-09-29T10:00:00.000Z"})).toBe(true);
        expect(periodInvalid({from: "2026-09-29T10:00:00.000Z", to: null})).toBe(false);
    });

    it("knows when a filter is set", () => {
        expect(periodSet(emptyPeriodDraft)).toBe(false);
        expect(periodSet({from: "", to: "2026-09-29T10:00"})).toBe(true);
    });
});

describe("chart helpers", () => {
    it("sees activity in any counter", () => {
        expect(seriesHasActivity([])).toBe(false);
        expect(seriesHasActivity([{At: "x", Attempts: 0, Correct: 0, Solves: 0, Opens: 0}])).toBe(false);
        expect(seriesHasActivity([{At: "x", Attempts: 0, Correct: 0, Solves: 0, Opens: 1}])).toBe(true);
    });

    it("keeps only the markers inside the window, in order", () => {
        const markers = [
            {at: "2026-09-29T14:00:00Z", label: "finish"},
            {at: null, label: "freeze"},
            {at: "2026-09-29T10:00:00Z", label: "start"},
            {at: "2026-09-30T10:00:00Z", label: "later"},
        ];
        expect(visibleMarkers(markers, "2026-09-29T10:00:00Z", "2026-09-29T15:00:00Z").map(marker => marker.label)).toEqual(["start", "finish"]);
    });

    it("formats a share and guards a zero total", () => {
        expect(percent(1, 4)).toBe("25%");
        expect(percent(0, 0)).toBe("—");
    });
});
