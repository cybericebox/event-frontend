import {describe, expect, it} from "vitest";
import {MISSING_HOST_TTL_MS, MissingHosts} from "./missingHosts";

describe("missing event hosts", () => {
    it("remembers a host for the window, per host, and forgets it after", () => {
        let now = 0;
        const hosts = new MissingHosts(() => now);
        expect(hosts.has("a.example.test")).toBe(false);
        hosts.add("a.example.test");
        expect(hosts.has("a.example.test")).toBe(true);
        expect(hosts.has("b.example.test")).toBe(false);
        now = MISSING_HOST_TTL_MS - 1;
        expect(hosts.has("a.example.test")).toBe(true);
        now = MISSING_HOST_TTL_MS + 1;
        expect(hosts.has("a.example.test")).toBe(false);
    });
    it("stays within the 10-30 s window of the spec", () => {
        expect(MISSING_HOST_TTL_MS).toBeGreaterThanOrEqual(10_000);
        expect(MISSING_HOST_TTL_MS).toBeLessThanOrEqual(30_000);
    });
    it("is bounded: a flood of random hosts cannot grow it without limit", () => {
        const hosts = new MissingHosts(() => 0);
        for (let i = 0; i < 10_000; i++) hosts.add(`h${i}.example.test`);
        expect(hosts.has("h9999.example.test")).toBe(true);
        expect(hosts.has("h0.example.test")).toBe(false);
    });
});
