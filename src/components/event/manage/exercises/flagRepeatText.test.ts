import {describe, expect, it} from "vitest";
import {flagRepeatText} from "./ExerciseAttachments";

const text = (flags: number, teams: number, reason: "limit" | "teams" | "repeated" = "limit") => flagRepeatText({Flags: flags, Teams: teams, Reason: reason}, "Маршрут");

describe("the flag warning's numbers", () => {
    it("has the special line for one flag", () => {
        expect(text(1, 20)).toBe("Завдання «Маршрут» має лише один прапор: усі команди отримають однаковий.");
        expect(text(1, 3, "repeated")).toBe("Завдання «Маршрут» має лише один прапор: усі команди отримають однаковий.");
    });

    it.each([
        [2, "2 різні прапори"], [5, "5 різних прапорів"], [21, "21 різний прапор"], [22, "22 різні прапори"], [25, "25 різних прапорів"],
    ])("says %i flags in the right form", (flags, words) => {
        expect(text(flags, 100)).toBe(`Завдання «Маршрут» має ${words}, а в заході може бути до 100 команд: після ${flags}-ї команди прапори почнуть повторюватися.`);
    });

    it.each([
        [1, "до 1 команди"], [2, "до 2 команд"], [5, "до 5 команд"], [21, "до 21 команди"], [22, "до 22 команд"], [25, "до 25 команд"],
    ])("says the limit of %i teams in the genitive", (teams, words) => {
        expect(text(2, teams)).toContain(`а в заході може бути ${words}:`);
    });

    it("never says «флаг»", () => {
        for (const reason of ["limit", "teams", "repeated"] as const) expect(text(15, 40, reason)).not.toMatch(/флаг/i);
    });
});
