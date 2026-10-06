import {describe, expect, it} from "vitest";
import {groupNameProblem} from "./groupName";

describe("group name", () => {
    it("requires a name within 80 characters, unique among other groups", () => {
        expect(groupNameProblem("  ", [])).toBe("Вкажіть назву групи.");
        expect(groupNameProblem("x".repeat(81), [])).toContain("80");
        expect(groupNameProblem(" веб ", ["Веб", "Крипто"])).toBe("Група з такою назвою вже існує.");
        expect(groupNameProblem("Веб", ["Крипто"])).toBe("");
    });
});
