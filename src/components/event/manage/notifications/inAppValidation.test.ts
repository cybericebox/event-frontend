import {describe, expect, it} from "vitest";
import type {ManageInAppTemplateInput} from "@/api/manageNotifications";
import {inAppValidation, validActionHref} from "./inAppValidation";

const draft: ManageInAppTemplateInput = {
    NotificationType: "x", Title: "Заголовок", Body: "Текст", Link: "", Icon: "bell", Tone: "info", AccentColor: "", Surface: "inbox",
    AutoDismissMs: null, Actions: [], Dismissible: true,
};

describe("in-app template validation", () => {
    it("accepts a complete draft", () => {
        expect(inAppValidation(draft)).toBe("");
        expect(inAppValidation({...draft, AutoDismissMs: 5000, Actions: [{label: "Відкрити", href: "/manage"}]})).toBe("");
    });

    it("needs a title and a text that is more than markup", () => {
        expect(inAppValidation({...draft, Title: "  "})).toBe("Заповніть заголовок.");
        expect(inAppValidation({...draft, Body: "<strong></strong><br>"})).toBe("Заповніть текст сповіщення.");
    });

    it("checks the button and the pop-in time", () => {
        expect(inAppValidation({...draft, Actions: [{label: "", href: "/x"}]})).toContain("текст кнопки");
        expect(inAppValidation({...draft, Actions: [{label: "A", href: "javascript:1"}]})).toContain("текст кнопки");
        expect(inAppValidation({...draft, Actions: [{label: "A", href: "/x"}, {label: "B", href: "/y"}]})).toBe("Можна додати лише одну кнопку.");
        expect(inAppValidation({...draft, AutoDismissMs: 2000})).toContain("від 3 до 10");
        expect(inAppValidation({...draft, AutoDismissMs: 11000})).toContain("від 3 до 10");
    });

    it("allows only safe button addresses without variables", () => {
        for (const href of ["https://a.b", "/path"]) expect(validActionHref(href)).toBe(true);
        for (const href of ["http://a.b", "mailto:a@b.c", "#top", "/\\evil.com", "https://a b.c", "//evil.com", "javascript:alert(1)", "data:text/html,x", "/x/{{.id}}", ""]) expect(validActionHref(href)).toBe(false);
    });
});
