import {describe, expect, it} from "vitest";
import {registrationTabFromParam, registrationTabHref, registrationTabs} from "./registrationTabs";

describe("registration section tabs", () => {
    it("hides the team-field tab in individual mode", () => {
        expect(registrationTabs(false).map(tab => tab.value)).toEqual(["registration", "participant-fields"]);
        expect(registrationTabs(true).map(tab => tab.value)).toEqual(["registration", "participant-fields", "team-fields"]);
    });

    it("maps the tab parameter to an available tab", () => {
        expect(registrationTabFromParam("participant-fields", false)).toBe("participant-fields");
        expect(registrationTabFromParam("team-fields", false)).toBe("registration");
        expect(registrationTabFromParam("team-fields", true)).toBe("team-fields");
        expect(registrationTabFromParam(undefined, true)).toBe("registration");
        expect(registrationTabHref("registration")).toBe("/manage/registration");
        expect(registrationTabHref("team-fields")).toBe("/manage/registration?tab=team-fields");
    });
});
