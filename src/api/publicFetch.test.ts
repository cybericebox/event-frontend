import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fetchPublic} from "./publicFetch";

const headers = {Accept: "application/json", Origin: "https://one.events.test"};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});
}

describe("fetchPublic", () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("bypasses the Next stale-while-revalidate fetch cache and sends the event host as Origin", async () => {
        fetchMock.mockResolvedValueOnce(json({Data: 1}));
        await expect(fetchPublic("https://api.test/x", headers)).resolves.toEqual({status: 200, body: {Data: 1}});
        const init = fetchMock.mock.calls[0][1] as RequestInit & {next?: {revalidate?: number}};
        expect(init.next).toBeUndefined();
        expect(init.headers).toEqual(headers);
        expect(init.cache).toBe("no-store");
        expect(init.signal).toBeDefined();
    });

    it("runs one fetch per key at a time: concurrent readers share it", async () => {
        let release: (r: Response) => void = () => undefined;
        fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { release = resolve; }));
        const readers = [fetchPublic("https://api.test/y", headers), fetchPublic("https://api.test/y", headers), fetchPublic("https://api.test/y", headers)];
        release(json({Data: "same"}));
        const results = await Promise.all(readers);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(results.every((r) => (r.body as {Data: string}).Data === "same")).toBe(true);
    });

    it("keeps events apart: another host or another URL is another fetch", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(json({Data: 1})));
        await Promise.all([
            fetchPublic("https://api.test/z", headers),
            fetchPublic("https://api.test/z", {...headers, Origin: "https://two.events.test"}),
            fetchPublic("https://api.test/other", headers),
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("frees the key when the fetch ends, so the next read goes out again (and a failure does not stick)", async () => {
        fetchMock.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(json({Data: 2}));
        await expect(fetchPublic("https://api.test/w", headers)).rejects.toThrow("down");
        await expect(fetchPublic("https://api.test/w", headers)).resolves.toMatchObject({status: 200});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reports a failed status without a body and tolerates an empty success", async () => {
        fetchMock.mockResolvedValueOnce(new Response("nope", {status: 404})).mockResolvedValueOnce(new Response("", {status: 200}));
        await expect(fetchPublic("https://api.test/a", headers)).resolves.toEqual({status: 404, body: null});
        await expect(fetchPublic("https://api.test/b", headers)).resolves.toEqual({status: 200, body: null});
    });

    describe("an overloaded API", () => {
        beforeEach(() => {
            vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
            vi.spyOn(Math, "random").mockReturnValue(0);
        });
        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it("asks once more after a short Retry-After and returns the second answer", async () => {
            fetchMock.mockResolvedValueOnce(new Response(null, {status: 503, headers: {"Retry-After": "1"}})).mockResolvedValueOnce(json({Data: 3}));
            const pending = fetchPublic("https://api.test/busy", headers);
            await vi.advanceTimersByTimeAsync(1000);
            await expect(pending).resolves.toEqual({status: 200, body: {Data: 3}});
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("retries a 429 too, but only once", async () => {
            fetchMock.mockImplementation(() => Promise.resolve(new Response(null, {status: 429, headers: {"Retry-After": "1"}})));
            const pending = fetchPublic("https://api.test/limited", headers);
            await vi.advanceTimersByTimeAsync(5000);
            await expect(pending).resolves.toEqual({status: 429, body: null});
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("does not wait for a long Retry-After or a 503 without one", async () => {
            fetchMock.mockResolvedValueOnce(new Response(null, {status: 503, headers: {"Retry-After": "3"}})).mockResolvedValueOnce(new Response(null, {status: 503}));
            await expect(fetchPublic("https://api.test/long", headers)).resolves.toEqual({status: 503, body: null});
            await expect(fetchPublic("https://api.test/bare", headers)).resolves.toEqual({status: 503, body: null});
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });
});
