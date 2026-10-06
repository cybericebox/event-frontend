import {describe, expect, it} from "vitest";
import {holdPoints} from "./holdPoints";

describe("holdPoints", () => {
    it("holds the previous value just before each change", () => {
        expect(holdPoints([[0, 0], [60000, 100], [120000, 100], [180000, 250]])).toEqual([
            [0, 0], [59000, 0], [60000, 100], [120000, 100], [179000, 100], [180000, 250],
        ]);
    });

    it("adds nothing when the points are closer than the hold gap", () => {
        expect(holdPoints([[0, 0], [500, 10]])).toEqual([[0, 0], [500, 10]]);
    });

    it("keeps an empty or single series as is", () => {
        expect(holdPoints([])).toEqual([]);
        expect(holdPoints([[5, 1]])).toEqual([[5, 1]]);
    });
});
