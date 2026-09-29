import {describe, expect, it} from "vitest";
import {dropMove, moveItem} from "./sortableOrder";

describe("moveItem", () => {
    const items = ["a", "b", "c", "d", "e"];

    it("moves an item by any distance, both ways", () => {
        expect(moveItem(items, 0, 1)).toEqual(["b", "a", "c", "d", "e"]);
        expect(moveItem(items, 0, 3)).toEqual(["b", "c", "d", "a", "e"]);
        expect(moveItem(items, 4, 1)).toEqual(["a", "e", "b", "c", "d"]);
    });

    it("moves to the first and the last position", () => {
        expect(moveItem(items, 3, 0)).toEqual(["d", "a", "b", "c", "e"]);
        expect(moveItem(items, 1, 4)).toEqual(["a", "c", "d", "e", "b"]);
    });

    it("returns the same list for no-op and out-of-range moves", () => {
        expect(moveItem(items, 2, 2)).toBe(items);
        expect(moveItem(items, -1, 2)).toBe(items);
        expect(moveItem(items, 0, 5)).toBe(items);
    });
});

describe("dropMove", () => {
    const ids = ["a", "b", "c", "d"];

    it("moves the dragged id to the index of the id it is over", () => {
        expect(dropMove(ids, "a", "d")).toEqual({from: 0, to: 3});
        expect(dropMove(ids, "c", "a")).toEqual({from: 2, to: 0});
    });

    it("ignores drops outside, on itself or on unknown ids", () => {
        expect(dropMove(ids, "a", null)).toBeNull();
        expect(dropMove(ids, "b", "b")).toBeNull();
        expect(dropMove(ids, "x", "a")).toBeNull();
        expect(dropMove(ids, "a", "x")).toBeNull();
    });
});
