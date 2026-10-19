import {afterEach, describe, expect, it} from "vitest";
import {formatDateTime} from "./dateDisplay";

const zone = process.env.TZ;
afterEach(() => {process.env.TZ = zone;});

describe("content dates", () => {
    it.each(["UTC", "America/New_York", "Europe/Kyiv"])("are written in Kyiv time whatever the zone of the server or browser (%s)", tz => {
        process.env.TZ = tz;
        // 11:01 UTC in October is 14:01 in Kyiv (EEST, UTC+3); 11:00 UTC in December is 13:00 (EET, UTC+2).
        expect(formatDateTime("2026-10-20T11:01:00Z")).toContain("14:01");
        expect(formatDateTime("2026-10-20T11:01:00Z", "time")).toBe("14:01");
        expect(formatDateTime("2026-12-01T11:00:00Z", "short")).toBe("01.12.2026 13:00");
        expect(formatDateTime("2026-10-20T22:30:00Z", "date")).toContain("21");
        expect(formatDateTime("2026-10-20T22:30:00Z", "custom", "d MMMM, HH:mm [за Києвом]")).toBe("21 жовтня, 01:30 за Києвом");
    });

    it("gives the same text on the server and in the browser for one moment", () => {
        process.env.TZ = "UTC";
        const server = ["date-time", "date", "time", "short"].map(format => formatDateTime("2026-10-20T11:01:00Z", format as "date"));
        process.env.TZ = "Asia/Tokyo";
        const browser = ["date-time", "date", "time", "short"].map(format => formatDateTime("2026-10-20T11:01:00Z", format as "date"));
        expect(browser).toEqual(server);
    });

    it("puts the month in the genitive after a day and in the nominative alone", () => {
        expect(formatDateTime("2026-10-20T11:01:00Z", "custom", "MMMM yyyy")).toBe("жовтень 2026");
        expect(formatDateTime("2026-10-20T11:01:00Z", "custom", "dd MMMM")).toBe("20 жовтня");
        expect(formatDateTime("2026-10-20T11:01:00Z", "custom", "MMMM [день] yyyy")).toBe("жовтень день 2026");
    });

    it("follows the Kyiv clock across the autumn change to winter time (25.10.2026, 04:00 EEST → 03:00 EET)", () => {
        process.env.TZ = "UTC";
        expect(formatDateTime("2026-10-25T00:30:00Z", "short")).toBe("25.10.2026 03:30");
        expect(formatDateTime("2026-10-25T01:30:00Z", "short")).toBe("25.10.2026 03:30");
        expect(formatDateTime("2026-10-25T02:30:00Z", "time")).toBe("04:30");
    });

    it("keeps the dash for an invalid value or pattern", () => {
        expect(formatDateTime("not a date")).toBe("—");
        expect(formatDateTime("2026-10-20T11:01:00Z", "custom", "<b>")).toBe("—");
    });
});
