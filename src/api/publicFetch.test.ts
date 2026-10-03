import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fetchPublic, PUBLIC_REVALIDATE_SECONDS} from "./publicFetch";

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

    it("reads through the 30 s stale-while-revalidate fetch cache and sends the event host as Origin", async () => {
        fetchMock.mockResolvedValueOnce(json({Data: 1}));
        await expect(fetchPublic("https://api.test/x", headers)).resolves.toEqual({status: 200, body: {Data: 1}});
        const init = fetchMock.mock.calls[0][1] as RequestInit & {next?: {revalidate?: number}};
        expect(PUBLIC_REVALIDATE_SECONDS).toBe(30);
        expect(init.next).toEqual({revalidate: 30});
        expect(init.headers).toEqual(headers);
        expect(init.cache).toBeUndefined();
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
});
