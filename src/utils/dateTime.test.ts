import {describe, expect, it} from "vitest";
import {formatDateTime, zoneOffset} from "./dateTime";

// vitest.config.mts pins TZ=Europe/Kyiv (GMT+3 in summer).
describe("dateTime", () => {
    it("formats in the viewer's zone, not UTC", () => {
        expect(formatDateTime("2026-09-29T20:30:00Z")).toContain("23:30");
        expect(formatDateTime("2026-09-29T21:30:00Z")).toContain("30 вер.");
    });

    it("names the zone as a GMT offset", () => {
        expect(zoneOffset(new Date("2026-09-29T20:30:00Z"))).toBe("GMT+3");
    });
});
