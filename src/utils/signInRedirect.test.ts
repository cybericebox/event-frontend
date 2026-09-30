import {describe, expect, it} from "vitest";
import {signInRedirectTarget} from "./signInRedirect";

const id = "https://id.example.test";

describe("signInRedirectTarget", () => {
    it("sends to the ID sign-in with the full current address as return_to", () => {
        expect(signInRedirectTarget("https://ev.example.test/manage/tasks?tab=1#x", id))
            .toBe(`${id}/sign-in?return_to=${encodeURIComponent("https://ev.example.test/manage/tasks?tab=1#x")}`);
    });

    it("goes to the site home when the address is already on the sign-in service", () => {
        expect(signInRedirectTarget(`${id}/sign-in?return_to=x`, id)).toBe("/");
        expect(signInRedirectTarget(id, id)).toBe("/");
    });

    it("goes to the site home when the ID service is not configured", () => {
        expect(signInRedirectTarget("https://ev.example.test/manage", "")).toBe("/");
    });
});
