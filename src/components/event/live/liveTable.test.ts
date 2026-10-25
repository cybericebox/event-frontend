import {describe, expect, it} from "vitest";
import {liveFlagsMode, liveFlagsSquare, liveInitials, livePinTop, livePoints, liveTablePage, liveTablePageAt} from "./liveTable";

const teams = (count: number) => Array.from({length: count}, (_, index) => index + 1);

describe("live table paging", () => {
    it("shows everything on one page when the teams fit", () => {
        expect(liveTablePage(teams(5), {pageSize: 10, pinTop: 3, page: 4})).toMatchObject({rows: [1, 2, 3, 4, 5], pinned: 0, from: 1, to: 5, total: 5, pageCount: 1});
    });

    it("keeps the top 3 on every page and scrolls the rest", () => {
        const first = liveTablePage(teams(40), {pageSize: 10, pinTop: 3, page: 0});
        const second = liveTablePage(teams(40), {pageSize: 10, pinTop: 3, page: 1});
        expect(first.rows).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(second.rows).toEqual([1, 2, 3, 11, 12, 13, 14, 15, 16, 17]);
        expect(second).toMatchObject({pinned: 3, from: 11, to: 17, total: 40, pageCount: 6});
        // The first page reads 1–10: the pinned places are on it.
        expect(first).toMatchObject({from: 1, to: 10});
    });

    it("tops the last page up with rows of the previous one: 15 teams never leave half a page empty", () => {
        const last = liveTablePage(teams(15), {pageSize: 10, pinTop: 3, page: 1});
        expect(last.rows).toHaveLength(10);
        expect(last.rows).toEqual([1, 2, 3, 9, 10, 11, 12, 13, 14, 15]);
        expect(last).toMatchObject({from: 9, to: 15, total: 15, pageCount: 2});
        const unpinned = liveTablePage(teams(15), {pageSize: 10, pinTop: 0, page: 1});
        expect(unpinned.rows).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    });

    it("cycles through the pages and covers every team", () => {
        const seen = new Set<number>();
        for (let page = 0; page < 20; page++) liveTablePage(teams(100), {pageSize: 12, pinTop: 5, page}).rows.forEach(row => seen.add(row));
        expect(seen.size).toBe(100);
        expect(liveTablePage(teams(100), {pageSize: 12, pinTop: 5, page: 14}).page).toBe(liveTablePage(teams(100), {pageSize: 12, pinTop: 5, page: 0}).page);
    });

    it("does not pin when the page has no room for scrolling rows", () => {
        expect(liveTablePage(teams(20), {pageSize: 3, pinTop: 3, page: 0}).pinned).toBe(0);
    });

    it("reads the pin setting with 3 as the default", () => {
        expect(livePinTop(undefined)).toBe(3);
        expect(livePinTop(0)).toBe(0);
        expect(livePinTop(5)).toBe(5);
        expect(livePinTop(4)).toBe(3);
    });

    it("turns pages by the clock and holds the first page in the editor", () => {
        expect(liveTablePageAt(25_000, 10, false)).toEqual({page: 2, elapsed: 5});
        expect(liveTablePageAt(25_000, 10, true)).toEqual({page: 0, elapsed: 0});
    });

    it("separates thousands with a narrow no-break space", () => {
        expect(livePoints(1300)).toBe("1 300");
        expect(livePoints(1234567)).toBe("1 234 567");
        expect(livePoints(950)).toBe("950");
    });
});

describe("live table progress", () => {
    it("draws squares while they stay readable, then segments, then a bar", () => {
        expect(liveFlagsMode(380, 10, 24)).toBe("squares");
        expect(liveFlagsMode(380, 40, 24)).toBe("segments");
        expect(liveFlagsMode(380, 80, 24)).toBe("bar");
        expect(liveFlagsMode(380, 0, 24)).toBe("bar");
    });

    it("spans the squares over the cell without growing past the row text", () => {
        expect(liveFlagsSquare(380, 10, 24)).toBeCloseTo(19.2);
        expect(liveFlagsSquare(100, 10, 24)).toBeCloseTo(100 / 13.15);
    });

    it("takes two initials from the first two words or the first word", () => {
        expect(liveInitials("Odnohack+Pinguins")).toBe("OP");
        expect(liveInitials("milworms")).toBe("MI");
        expect(liveInitials("518&imposter")).toBe("5I");
        expect(liveInitials("кібер ліга")).toBe("КЛ");
        expect(liveInitials("  ")).toBe("");
    });

});
