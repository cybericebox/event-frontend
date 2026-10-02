import {describe, expect, it} from "vitest";
import {ApiErrorCode, apiErrorMessage, readRetryAfter, waitText} from "./apiErrors";
import {manageApiError} from "./manage";

function reply(code: number, retryAfter?: string): Response {
    return new Response(JSON.stringify({Status: {Code: code}}), {status: 429, headers: retryAfter ? {"Retry-After": retryAfter} : {}});
}

describe("rate-limit errors", () => {
    it("reads the wait from Retry-After", () => {
        expect(readRetryAfter(reply(0, "30"))).toBe(30);
        expect(readRetryAfter(reply(0, "0"))).toBeUndefined();
        expect(readRetryAfter(reply(0, "soon"))).toBeUndefined();
        expect(readRetryAfter(reply(0))).toBeUndefined();
    });

    it("carries the wait and the detail code on a manage error", async () => {
        const error = await manageApiError(reply(40000 + 1327, "90"));
        expect(error.code).toBe(ApiErrorCode.InvitationRateLimited);
        expect(error.retryAfter).toBe(90);
    });

    it("shows the wait time in the message", () => {
        expect(apiErrorMessage(ApiErrorCode.InvitationRateLimited, "x", 90)).toContain(waitText(90));
        expect(apiErrorMessage(ApiErrorCode.AuthTooManyRequests, "x", 20)).toContain(waitText(20));
        expect(apiErrorMessage(ApiErrorCode.InvitationRateLimited, "x")).not.toContain("{");
    });

    it("rounds the wait up to a unit", () => {
        expect(waitText(45)).toBe("45 с");
        expect(waitText(61)).toBe("2 хв");
        expect(waitText(7200)).toBe("2 год");
    });

    it("knows the template link code", () => {
        expect(apiErrorMessage(ApiErrorCode.TemplateLinkInvalid, "x")).not.toBe("x");
    });
});
