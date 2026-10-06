import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {calendarDays, datePart, formatLocal, localFromISO, localToISO, moveDay, parseLocal, stepTime, timePart} from "./dateTimePicker";

describe("date-time picker helpers", () => {
    const zone = process.env.TZ;
    beforeAll(() => { process.env.TZ = "Europe/Kyiv"; });
    afterAll(() => { process.env.TZ = zone; });

    it("round-trips local wall-clock values and UTC ISO", () => {
        expect(localFromISO("2026-09-29T07:30:00Z")).toBe("2026-09-29T10:30");
        expect(localFromISO("2026-01-15T07:30:45Z", true)).toBe("2026-01-15T09:30:45");
        expect(localToISO("2026-09-29T10:30")).toBe("2026-09-29T07:30:00.000Z");
        expect(localToISO("")).toBeNull();
        expect(localToISO("29.09.2026")).toBeNull();
        expect(localFromISO(null)).toBe("");
    });

    it("parses only complete picker values", () => {
        expect(parseLocal("2026-09-29T10:30")?.getHours()).toBe(10);
        expect(parseLocal("2026-09-29")).toBeNull();
        expect(formatLocal(new Date(2026, 8, 29, 7, 5, 9), true)).toBe("2026-09-29T07:05:09");
    });

    it("lays out six Monday-first weeks", () => {
        const days = calendarDays(new Date(2026, 8, 1));
        expect(days).toHaveLength(42);
        expect(datePart(days[0])).toBe("2026-08-31");
        expect(days[0].getDay()).toBe(1);
    });

    it("moves the focused day with the keyboard", () => {
        const day = new Date(2026, 0, 31);
        expect(datePart(moveDay(day, "ArrowRight")!)).toBe("2026-02-01");
        expect(datePart(moveDay(day, "ArrowUp")!)).toBe("2026-01-24");
        expect(datePart(moveDay(day, "PageDown")!)).toBe("2026-02-28");
        expect(datePart(moveDay(day, "PageUp", true)!)).toBe("2025-01-31");
        expect(datePart(moveDay(new Date(2026, 8, 30), "Home")!)).toBe("2026-09-28");
        expect(datePart(moveDay(new Date(2026, 8, 30), "End")!)).toBe("2026-10-04");
        expect(moveDay(day, "a")).toBeNull();
    });

    it("accepts typed time parts in range and wraps steps", () => {
        expect(timePart("7", 23)).toBe(7);
        expect(timePart("24", 23)).toBeNull();
        expect(timePart("x1", 59)).toBeNull();
        expect(stepTime(23, 1, 23)).toBe(0);
        expect(stepTime(0, -1, 59)).toBe(59);
    });
});
