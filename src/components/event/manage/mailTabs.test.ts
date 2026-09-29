import {describe, expect, it} from "vitest";
import {mailTabFromParam, mailTabHref} from "./mailTabs";

describe("mail section tabs", () => {
    it("maps the tab parameter", () => {
        expect(mailTabFromParam("journal")).toBe("journal");
        expect(mailTabFromParam(undefined)).toBe("settings");
        expect(mailTabFromParam("other")).toBe("settings");
        expect(mailTabHref("settings")).toBe("/manage/mail");
        expect(mailTabHref("journal")).toBe("/manage/mail?tab=journal");
    });
});
