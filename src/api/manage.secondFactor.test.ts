// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {manageApiError} from "./manage";
import {secondFactorRedirectTarget} from "@/utils/signInRedirect";

const replace = vi.fn();

function answer(status: number, code: number) {
    return new Response(JSON.stringify({Status: {Code: code, Message: "x"}}), {status, headers: {"content-type": "application/json"}});
}

afterEach(() => {
    vi.unstubAllGlobals();
    replace.mockReset();
});

describe("second-factor enrolment redirect", () => {
    it("builds the ID second-factor address with return_to", () => {
        expect(secondFactorRedirectTarget("https://ev.example/manage?x=1", "https://id.example"))
            .toBe("https://id.example/second-factor/?return_to=https%3A%2F%2Fev.example%2Fmanage%3Fx%3D1");
        expect(secondFactorRedirectTarget("https://id.example/second-factor/", "https://id.example")).toBe("/");
        expect(secondFactorRedirectTarget("https://ev.example/", "")).toBe("/");
    });

    it("sends a 403 with code 63812 to the ID second-factor page", async () => {
        vi.stubGlobal("location", {href: "https://ev.localhost/manage", replace});
        const error = await manageApiError(answer(403, 63812));
        expect(error.status).toBe(403);
        expect(replace).toHaveBeenCalledOnce();
        const target = new URL(replace.mock.calls[0][0] as string);
        expect(target.pathname).toBe("/second-factor/");
        expect(target.searchParams.get("return_to")).toBe("https://ev.localhost/manage");
    });

    it("leaves other 403 answers alone", async () => {
        vi.stubGlobal("location", {href: "https://ev.localhost/manage", replace});
        await manageApiError(answer(403, 60001));
        expect(replace).not.toHaveBeenCalled();
    });
});
