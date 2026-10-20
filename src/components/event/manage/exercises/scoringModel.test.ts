import {describe, expect, it} from "vitest";
import {dynamicErrors, dynamicValid, staticPointsValid} from "./scoringModel";

describe("scoring validation", () => {
    it("requires static points above zero", () => {
        expect(staticPointsValid("", true)).toBe(false);
        expect(staticPointsValid("0", true)).toBe(false);
        expect(staticPointsValid("1.5", true)).toBe(false);
        expect(staticPointsValid("100", true)).toBe(true);
        expect(staticPointsValid("999", true)).toBe(true);
        expect(staticPointsValid("1000", true)).toBe(false);
    });

    it("reports each dynamic field on its own", () => {
        expect(dynamicErrors({Mode: 1, MaxPoints: 500, MinPoints: 100, FloorAtPercent: 50})).toEqual({max: "", min: "", floor: ""});
        expect(dynamicErrors({Mode: 1, MaxPoints: 100, MinPoints: 100, FloorAtPercent: 50}).max).toBe("Має бути більше за нижню межу.");
        expect(dynamicErrors({Mode: 2, MaxPoints: 500, MinPoints: -1, FloorAtPercent: 101})).toMatchObject({min: "Ціле число від 0 до 999.", floor: "Ціле число від 1 до 100."});
        // Points may decay to 0.
        expect(dynamicErrors({Mode: 1, MaxPoints: 1, MinPoints: 0, FloorAtPercent: 50})).toEqual({max: "", min: "", floor: ""});
        // Time decay has no threshold.
        expect(dynamicValid({Mode: 3, MaxPoints: 500, MinPoints: 100, FloorAtPercent: 0})).toBe(true);
        expect(dynamicValid({Mode: 1, MaxPoints: Number.NaN, MinPoints: 100, FloorAtPercent: 50})).toBe(false);
    });
});

it("caps each dynamic task bound at 999 without altering the profile", () => {
    const profile = {Mode: 1 as const, MaxPoints: 1001, MinPoints: 1000, FloorAtPercent: 50};
    expect(dynamicErrors(profile)).toMatchObject({max: "Ціле число від 1 до 999.", min: "Ціле число від 0 до 999."});
    expect(dynamicValid(profile)).toBe(false);
    expect(profile.MaxPoints).toBe(1001);
    expect(dynamicValid({...profile, MaxPoints: 999, MinPoints: 998})).toBe(true);
});
