import {describe, expect, it, vi} from "vitest";
import {HardCache} from "./commonPageCache";

describe("hard shared cache", () => {
    it("coalesces readers, reuses fresh results, and never serves old success after expiry/denial", async () => {
        let now = 0;
        const cache = new HardCache<string>({maxEntries: 2, maxBytes: 100, ttl: 1000, now: () => now});
        const load = vi.fn(async () => ({value: "public"}));
        expect(await Promise.all([cache.get("a", load), cache.get("a", load)])).toEqual(["public", "public"]);
        expect(await cache.get("a", load)).toBe("public");
        expect(load).toHaveBeenCalledTimes(1);
        now = 1001;
        await expect(cache.get("a", async () => {throw new Error("404");})).rejects.toThrow("404");
        expect(await cache.get("a", async () => ({value: "new"}))).toBe("new");
    });
    it("isolates keys and honors an upstream lifecycle deadline", async () => {
        let now = 0;
        const cache = new HardCache<string>({maxEntries: 4, maxBytes: 100, ttl: 1000, now: () => now});
        for (const key of ["a:public:r1", "a:staff:r1", "b:public:r1", "a:public:r2"]) {
            expect(await cache.get(key, async () => ({value: key, validUntil: 10}))).toBe(key);
        }
        now = 11;
        expect(await cache.get("a:public:r1", async () => ({value: "updated"}))).toBe("updated");
    });
    it("bounds entries, bytes and concurrent misses", async () => {
        const cache = new HardCache<string>({maxEntries: 1, maxBytes: 10, ttl: 1000, maxInflight: 1});
        await cache.get("a", async () => ({value: "one"}));
        await cache.get("b", async () => ({value: "two"}));
        expect(cache.size).toBe(1);
        await cache.get("huge", async () => ({value: "x".repeat(11)}));
        expect(cache.bytes).toBeLessThanOrEqual(10);
        let finish!: (v: {value: string}) => void;
        const pending = cache.get("slow", () => new Promise(resolve => {finish = resolve;}));
        await expect(cache.get("other", async () => ({value: "x"}))).rejects.toThrow("busy");
        finish({value: "ok"});
        await pending;
    });
});
