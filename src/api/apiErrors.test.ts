import {describe, expect, it} from "vitest";
import {ApiErrorCode, apiErrorMessage, isOverloadOrRateLimit, readRetryAfter, waitText} from "./apiErrors";
import {manageApiError} from "./manage";

function reply(code: number, retryAfter?: string): Response {
    return new Response(JSON.stringify({Status: {Code: code}}), {status: 429, headers: retryAfter ? {"Retry-After": retryAfter} : {}});
}

describe("rate-limit errors", () => {
    it("reads the wait from Retry-After", () => {
        expect(readRetryAfter(reply(0, "30"))).toBe(30);
        // 0 is kept (the overload rule needs to know the header was there); the wait text skips it.
        expect(readRetryAfter(reply(0, "0"))).toBe(0);
        expect(readRetryAfter(reply(0, "1.2"))).toBe(2);
        expect(readRetryAfter(reply(0, "soon"))).toBeUndefined();
        expect(readRetryAfter(reply(0))).toBeUndefined();
    });

    it("carries the wait and the detail code on a manage error", async () => {
        const error = await manageApiError(reply(40000 + 428, "90"));
        expect(error.code).toBe(ApiErrorCode.AuthTooManyRequests);
        expect(error.retryAfter).toBe(90);
    });

    it("treats a bare 429 as a rate limit", async () => {
        const error = await manageApiError(new Response(null, {status: 429, headers: {"Retry-After": "12"}}));
        expect(error.code).toBe(ApiErrorCode.AuthTooManyRequests);
        expect(error.retryAfter).toBe(12);
    });

    it("shows the wait time in the message", () => {
        expect(apiErrorMessage(ApiErrorCode.AuthTooManyRequests, "x", 20)).toContain(waitText(20));
        expect(apiErrorMessage(ApiErrorCode.AuthTooManyRequests, "x")).not.toContain("{");
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

describe("isOverloadOrRateLimit", () => {
    const failure = (status: number, code?: number, retryAfter?: number) => Object.assign(new Error(`request failed: ${status}`), {status, code, retryAfter});

    it("is any answer the client already retried as busy: a 429, a 503 with Retry-After, an overload code", () => {
        expect(isOverloadOrRateLimit(failure(429))).toBe(true);
        expect(isOverloadOrRateLimit(failure(429, 428, 30))).toBe(true);
        expect(isOverloadOrRateLimit(failure(503, undefined, 1))).toBe(true);
        expect(isOverloadOrRateLimit(failure(503, 431))).toBe(true);
    });

    it("is false for other failures", () => {
        expect(isOverloadOrRateLimit(failure(503))).toBe(false);
        expect(isOverloadOrRateLimit(failure(500, undefined, 1))).toBe(false);
        expect(isOverloadOrRateLimit(failure(404))).toBe(false);
        expect(isOverloadOrRateLimit({status: 429})).toBe(false);
        expect(isOverloadOrRateLimit(null)).toBe(false);
    });
});
