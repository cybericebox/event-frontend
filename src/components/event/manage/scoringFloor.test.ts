import {describe, expect, it} from "vitest";
import {scoringFloorVisible, withTimeDecayFloor} from "./scoringFloor";

describe("time decay floor", () => {
    it("always sends 100 for time decay and keeps other modes", () => {
        expect(withTimeDecayFloor({Mode: 3, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50}).FloorAtPercent).toBe(100);
        expect(withTimeDecayFloor({Mode: 1, MinPoints: 100, MaxPoints: 500, FloorAtPercent: 50}).FloorAtPercent).toBe(50);
    });

    it("shows the floor only for solve-based modes", () => {
        expect([0, 1, 2, 3].map(scoringFloorVisible)).toEqual([false, true, true, false]);
    });
});
