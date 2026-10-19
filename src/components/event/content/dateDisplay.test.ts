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
        expect(formatDateTime("2026-10-20T22:30:00Z", "custom", "d MMMM, HH:mm [за Києвом]")).toBe("21 жовтень, 01:30 за Києвом");
    });

    it("gives the same text on the server and in the browser for one moment", () => {
        process.env.TZ = "UTC";
        const server = ["date-time", "date", "time", "short"].map(format => formatDateTime("2026-10-20T11:01:00Z", format as "date"));
        process.env.TZ = "Asia/Tokyo";
        const browser = ["date-time", "date", "time", "short"].map(format => formatDateTime("2026-10-20T11:01:00Z", format as "date"));
        expect(browser).toEqual(server);
    });

    it("keeps the dash for an invalid value or pattern", () => {
        expect(formatDateTime("not a date")).toBe("—");
        expect(formatDateTime("2026-10-20T11:01:00Z", "custom", "<b>")).toBe("—");
    });
});
