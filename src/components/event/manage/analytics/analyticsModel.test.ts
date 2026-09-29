import {describe, expect, it} from "vitest";
import {bucketSeries, emptyPeriodDraft, eventPhase, eventProgress, percent, periodInvalid, periodOf, periodSet, seriesHasActivity, visibleMarkers} from "./analyticsModel";

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

describe("event phase", () => {
    const markers = {StartAt: "2026-09-29T10:00:00Z", FinishAt: "2026-09-29T14:00:00Z"};
    const at = (iso: string) => Date.parse(iso);

    it("is before, running or finished by the clock", () => {
        expect(eventPhase(markers, false, at("2026-09-29T09:59:59Z"))).toBe("before");
        expect(eventPhase(markers, false, at("2026-09-29T10:00:00Z"))).toBe("running");
        expect(eventPhase(markers, false, at("2026-09-29T14:00:00Z"))).toBe("finished");
    });

    it("keeps a final report finished and an open-ended event running", () => {
        expect(eventPhase(markers, true, at("2026-09-29T09:00:00Z"))).toBe("finished");
        expect(eventPhase({...markers, FinishAt: null}, false, at("2030-01-01T00:00:00Z"))).toBe("running");
    });

    it("measures the progress, or nothing without a finish", () => {
        expect(eventProgress(markers, at("2026-09-29T11:00:00Z"))).toBe(0.25);
        expect(eventProgress(markers, at("2026-09-29T20:00:00Z"))).toBe(1);
        expect(eventProgress({...markers, FinishAt: null}, at("2026-09-29T11:00:00Z"))).toBeNull();
    });
});

describe("bucketSeries", () => {
    const point = (i: number) => ({At: new Date(Date.UTC(2026, 8, 29, 10, i * 5)).toISOString(), Attempts: 2, Correct: 1, Solves: 1, Opens: 3});

    it("keeps a short series as it is", () => {
        const points = [point(0), point(1)];
        expect(bucketSeries(points)).toEqual({points, minutes: 5});
    });

    it("merges neighbours, adds their counts and keeps the first time", () => {
        const points = Array.from({length: 10}, (_, i) => point(i));
        const merged = bucketSeries(points, 5);
        expect(merged.minutes).toBe(10);
        expect(merged.points).toHaveLength(5);
        expect(merged.points[0]).toEqual({At: points[0].At, Attempts: 4, Correct: 2, Solves: 2, Opens: 6});
    });
});
