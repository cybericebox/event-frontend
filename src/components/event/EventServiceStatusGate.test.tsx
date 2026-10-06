// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {renderToStaticMarkup} from "react-dom/server";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import uk from "../../../messages/uk.json";
import {getServiceStatus, reportServiceAvailable, reportServiceUnavailable, trackApiFetch} from "@/utils/serviceStatus";
import {EventServiceStatusGate} from "./EventServiceStatusGate";
import {AppShell} from "./AppShell";

const navigation = vi.hoisted(() => ({pathname: "/", refresh: () => {}}));
vi.mock("next/navigation", () => ({usePathname: () => navigation.pathname, useRouter: () => ({refresh: navigation.refresh})}));
vi.mock("@/utils/origins", async importOriginal => ({...await importOriginal<object>(), apiOrigin: "https://api.test"}));

afterEach(() => {
    cleanup();
    act(() => { reportServiceAvailable(); });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    navigation.pathname = "/";
});

function withQuery(node: React.ReactNode, client = new QueryClient()) {
    return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

describe("trackApiFetch", () => {
    it("reports network failures and 5xx on API calls only", async () => {
        const failing = trackApiFetch(() => Promise.reject(new TypeError("Failed to fetch")), "https://api.test");
        await expect(failing("https://elsewhere.test/x")).rejects.toThrow();
        expect(getServiceStatus()).toBe("up");
        await expect(failing("https://api.test/api/x")).rejects.toThrow();
        expect(getServiceStatus()).toBe("suspect");
        reportServiceAvailable();

        await trackApiFetch(() => Promise.resolve(new Response("", {status: 404})), "https://api.test")("https://api.test/api/x");
        expect(getServiceStatus()).toBe("up");
        await trackApiFetch(() => Promise.resolve(new Response("", {status: 503})), "https://api.test")("https://api.test/api/x");
        expect(getServiceStatus()).toBe("suspect");
    });

    it("never counts a stream request, whatever happens to it", async () => {
        const failing = trackApiFetch(() => Promise.reject(new TypeError("network error")), "https://api.test");
        await expect(failing("https://api.test/api/events/e1/results/live?lastEventId=3")).rejects.toThrow();
        await expect(failing("https://api.test/api/events/e1/manage/solution-attempts/live")).rejects.toThrow();
        await expect(failing("https://api.test/api/x", {headers: {Accept: "text/event-stream"}})).rejects.toThrow();
        await trackApiFetch(() => Promise.resolve(new Response("", {status: 503})), "https://api.test")("https://api.test/api/events/e1/results/live");
        expect(getServiceStatus()).toBe("up");
    });

    it("does not count 4xx answers", async () => {
        for (const status of [400, 401, 403, 404, 409, 429]) {
            await trackApiFetch(() => Promise.resolve(new Response("", {status})), "https://api.test")("https://api.test/api/events/self/info");
        }
        expect(getServiceStatus()).toBe("up");
    });

    it("does not count a timed-out request", async () => {
        const timedOut = trackApiFetch(() => Promise.reject(new DOMException("timeout", "TimeoutError")), "https://api.test");
        await expect(timedOut("https://api.test/api/x")).rejects.toThrow();
        expect(getServiceStatus()).toBe("up");
    });

    it("does not treat an aborted request as an outage", async () => {
        const controller = new AbortController();
        controller.abort();
        const aborted = trackApiFetch(() => Promise.reject(new DOMException("aborted", "AbortError")), "https://api.test");
        await expect(aborted("https://api.test/api/x", {signal: controller.signal})).rejects.toThrow();
        expect(getServiceStatus()).toBe("up");
    });
});

describe("EventServiceStatusGate", () => {
    it("shows over the page after a failed confirmation and hides on recovery", async () => {
        vi.useFakeTimers();
        const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
        vi.stubGlobal("fetch", fetch);
        const client = new QueryClient();
        const invalidate = vi.spyOn(client, "invalidateQueries");
        render(withQuery(<><h1>Сторінка</h1><EventServiceStatusGate /></>, client));

        act(() => { reportServiceUnavailable(); });
        expect(screen.queryByRole("alertdialog")).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
        expect(fetch).toHaveBeenCalledOnce();
        expect(screen.queryByRole("alertdialog")).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
        expect(screen.queryByRole("alertdialog")).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("alertdialog")).toBeTruthy();
        expect(screen.getByText(uk["shell.unavailable.title"])).toBeTruthy();
        // The page underneath stays rendered.
        expect(screen.getByText("Сторінка")).toBeTruthy();

        fetch.mockResolvedValue(new Response("{}", {status: 200}));
        await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(getServiceStatus()).toBe("up");
        expect(invalidate).toHaveBeenCalled();
    });

    it("shows nothing when the API is back before the first probe (10 s)", async () => {
        vi.useFakeTimers();
        const fetch = vi.fn().mockResolvedValue(new Response("{}", {status: 200}));
        vi.stubGlobal("fetch", fetch);
        render(withQuery(<EventServiceStatusGate />));
        act(() => { reportServiceUnavailable(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(fetch).toHaveBeenCalledOnce();
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(getServiceStatus()).toBe("up");
    });

    it("shows nothing when the first probe fails but the API is back for the second (20 s)", async () => {
        vi.useFakeTimers();
        const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
        vi.stubGlobal("fetch", fetch);
        render(withQuery(<EventServiceStatusGate />));
        act(() => { reportServiceUnavailable(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
        expect(getServiceStatus()).toBe("suspect");
        fetch.mockResolvedValue(new Response("{}", {status: 200}));
        await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(getServiceStatus()).toBe("up");
    });

    it("stays hidden when the probe gets a 4xx: the API answers", async () => {
        vi.useFakeTimers();
        const fetch = vi.fn().mockResolvedValue(new Response("{}", {status: 403}));
        vi.stubGlobal("fetch", fetch);
        render(withQuery(<EventServiceStatusGate />));
        act(() => { reportServiceUnavailable(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
        expect(fetch).toHaveBeenCalledWith("https://api.test/api/auth/me", expect.objectContaining({credentials: "include"}));
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(getServiceStatus()).toBe("up");
    });

    it("shows the modal after a stream failure only when a normal call fails too", async () => {
        vi.useFakeTimers();
        const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
        vi.stubGlobal("fetch", fetch);
        render(withQuery(<EventServiceStatusGate />));
        const tracked = trackApiFetch(fetch, "https://api.test");
        await act(async () => { await expect(tracked("https://api.test/api/events/e1/results/live")).rejects.toThrow(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(screen.queryByRole("alertdialog")).toBeNull();

        await act(async () => { await expect(tracked("https://api.test/api/events/self/info")).rejects.toThrow(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(screen.getByRole("alertdialog")).toBeTruthy();
        expect(screen.getByText(uk["shell.unavailable.nextTry"].replace("{seconds}", "3"))).toBeTruthy();
    });

    it("retries at once on «Спробувати зараз» and keeps the modal while the API is down", async () => {
        const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
        vi.stubGlobal("fetch", fetch);
        render(withQuery(<EventServiceStatusGate serverUnavailable />));
        await act(async () => { fireEvent.click(screen.getByRole("button", {name: uk["shell.unavailable.retryNow"]})); });
        expect(fetch).toHaveBeenCalledOnce();
        expect(screen.getByRole("alertdialog")).toBeTruthy();
    });

    it("refreshes the server render once the API answers after a server-side outage", async () => {
        const refresh = vi.fn();
        navigation.refresh = refresh;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {status: 200})));
        render(withQuery(<EventServiceStatusGate serverUnavailable />));
        await act(async () => { fireEvent.click(screen.getByRole("button", {name: uk["shell.unavailable.retryNow"]})); });
        expect(refresh).toHaveBeenCalledOnce();
    });

    it("renders the /manage frame with the modal when the server-side event fetch failed", () => {
        navigation.pathname = "/manage/teams";
        const html = renderToStaticMarkup(withQuery(<AppShell event={null} unavailable><p>page</p></AppShell>));
        expect(html).toContain("ib-admin-shell");
        expect(html).toContain('role="alertdialog"');
        expect(html).toContain(uk["shell.unavailable.title"]);
        expect(html).not.toContain(">page<");
    });
});
