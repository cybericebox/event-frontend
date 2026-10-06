import {describe, expect, it} from "vitest";
import {loadFailure} from "./loadFailure";

describe("loadFailure", () => {
    it("only a real 404 (and 401/403) is not found", () => {
        for (const status of [401, 403, 404]) expect(loadFailure({status})).toBe("notFound");
    });

    it("a network failure is unavailable, never not found", () => {
        expect(loadFailure(new TypeError("Failed to fetch"))).toBe("unavailable");
    });

    it("a 5xx with X-Request-ID is the 500 page, without it a proxy 502/503/504 is unavailable", () => {
        for (const status of [500, 502, 503, 504]) expect(loadFailure({status, requestId: "abc"})).toBe("error");
        for (const status of [502, 503, 504]) expect(loadFailure({status})).toBe("unavailable");
        expect(loadFailure({status: 500})).toBe("error");
    });

    it("anything else is an error", () => {
        expect(loadFailure(new Error("Invalid event info response"))).toBe("error");
    });
});
