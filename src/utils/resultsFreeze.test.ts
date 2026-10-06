import {describe, expect, it} from "vitest";
import {freezeLeadMinutes, freezeStartAt, frozenBannerTitle, frozenSinceLabel, nextFreezeBoundary} from "./resultsFreeze";

const freeze = {FrozenAt: "2026-11-14T15:30:00Z", FinishAt: "2026-11-14T16:00:00Z"};

describe("results freeze copy", () => {
    it("names the lead time before the finish", () => {
        expect(freezeLeadMinutes(freeze)).toBe(30);
        expect(frozenBannerTitle(freeze)).toBe("Рейтинг заморожено за 30 хв до фіналу");
        expect(frozenBannerTitle({FrozenAt: null, FinishAt: null})).toBe("Рейтинг заморожено");
    });

    it("shows the freeze start as a clock time", () => {
        expect(frozenSinceLabel(freeze, "Europe/Kyiv")).toBe("з 17:30");
        expect(frozenSinceLabel({FrozenAt: null, FinishAt: null})).toBeNull();
    });

    it("computes the settings hint and the next reload", () => {
        expect(freezeStartAt("2026-11-14T16:00:00Z", 45)?.toISOString()).toBe("2026-11-14T15:15:00.000Z");
        expect(freezeStartAt(null, 45)).toBeNull();
        expect(nextFreezeBoundary(freeze, Date.parse("2026-11-14T15:00:00Z"))).toBe(30 * 60000);
        expect(nextFreezeBoundary(freeze, Date.parse("2026-11-14T15:45:00Z"))).toBe(15 * 60000);
        expect(nextFreezeBoundary(freeze, Date.parse("2026-11-14T17:00:00Z"))).toBeNull();
    });
});
