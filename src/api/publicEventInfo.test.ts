import {beforeEach, expect, it, vi} from "vitest";

const server = vi.hoisted(() => ({host: "ghost.example.test", pathname: "/challenges", fetchPublic: vi.fn()}));
vi.mock("next/headers", () => ({
    headers: async () => new Headers({host: server.host, "x-event-pathname": server.pathname}),
    cookies: async () => ({get: () => undefined}),
}));
vi.mock("react", async importOriginal => ({...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn}));
vi.mock("./publicFetch", () => ({fetchPublic: server.fetchPublic, SERVER_FETCH_TIMEOUT_MS: 10_000}));

let getPublicEventInfo: typeof import("./publicEventInfo").getPublicEventInfo;
beforeEach(async () => {
    vi.resetModules();
    server.fetchPublic.mockReset();
    server.host = "ghost.example.test";
    server.pathname = "/challenges";
    vi.stubEnv("NEXT_PUBLIC_DOMAIN", "example.test");
    ({getPublicEventInfo} = await import("./publicEventInfo"));
});

it("asks the API once about an unknown host, then answers from the negative cache", async () => {
    server.fetchPublic.mockResolvedValue({status: 404, body: null});
    for (let i = 0; i < 5; i++) expect(await getPublicEventInfo()).toBeNull();
    expect(server.fetchPublic).toHaveBeenCalledTimes(1);
    server.host = "other.example.test";
    expect(await getPublicEventInfo()).toBeNull();
    expect(server.fetchPublic).toHaveBeenCalledTimes(2);
});

it("does not ask for the manifest of a host whose public-info was a 404", async () => {
    server.fetchPublic.mockResolvedValue({status: 404, body: null});
    expect(await getPublicEventInfo()).toBeNull();
    const {getCommonManifest} = await import("./commonPage");
    server.pathname = "/";
    vi.stubEnv("RENDER_SECRET", "info-test-render-secret-0123456789abcdef");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await getCommonManifest()).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
});
