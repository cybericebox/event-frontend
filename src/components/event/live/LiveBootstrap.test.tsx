// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout, liveScreenTokenFromHash, liveScreenURL, LiveScreenLinkError} from "@/api/manageLive";
import {ManageApiError} from "@/api/manage";
import {LiveBootstrap} from "./LiveBootstrap";

const api = vi.hoisted(() => ({screen: vi.fn(), results: vi.fn(), info: vi.fn(), access: vi.fn(), layout: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), getLiveScreenByLink: api.screen, getLiveScreenResultsByLink: api.results, getPublishedLiveLayout: api.layout}));
vi.mock("@/api/manageStages", () => ({getManageStages: () => Promise.resolve([])}));
vi.mock("@/api/clientEventInfo", () => ({getClientEventInfo: api.info, ClientEventInfoError: class extends Error {}}));
vi.mock("@/api/manage", async importOriginal => ({...await importOriginal<typeof import("@/api/manage")>(), getManageAccess: api.access}));
vi.mock("@/utils/eventStream", () => ({useEventStream: () => "live"}));
vi.mock("./LiveQR", () => ({LiveQR: () => null}));

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Name: "Захід", StartTime: "2026-09-29T08:00:00Z", FinishTime: null, Participation: 1, LogoURL: "",
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
};

function mount() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><LiveBootstrap /></QueryClientProvider>);
}

beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.info.mockReturnValue(new Promise(() => undefined));
});
afterEach(() => {cleanup(); window.location.hash = ""; vi.useRealTimers(); vi.restoreAllMocks();});

describe("live screen links", () => {
    it("keeps the token in the fragment of the screen URL", () => {
        const url = liveScreenURL("https://ctf.example", "abc_DEF-1");
        expect(url).toBe("https://ctf.example/live#screen=abc_DEF-1");
        expect(liveScreenTokenFromHash(new URL(url).hash)).toBe("abc_DEF-1");
        expect(liveScreenTokenFromHash("")).toBeNull();
    });

    it("opens the screen with a link, without any session check", async () => {
        window.location.hash = "#screen=tok";
        api.screen.mockResolvedValue({Event: event, Layout: defaultLiveLayout, Stages: []});
        api.results.mockReturnValue(new Promise(() => undefined));
        mount();
        expect(await screen.findByText("Захід")).toBeTruthy();
        expect(api.screen).toHaveBeenCalledWith("tok");
        expect(api.info).not.toHaveBeenCalled();
        expect(api.access).not.toHaveBeenCalled();
    });

    it("retries a failed open by itself, telling when, with no button press", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        window.location.hash = "#screen=tok";
        api.screen.mockRejectedValueOnce(new LiveScreenLinkError(502)).mockResolvedValue({Event: event, Layout: defaultLiveLayout, Stages: []});
        api.results.mockReturnValue(new Promise(() => undefined));
        mount();
        expect(await screen.findByText(/Повторимо через \d+ с/)).toBeTruthy();
        await act(async () => {vi.advanceTimersByTime(5000);});
        expect(await screen.findByText("Захід")).toBeTruthy();
        expect(api.screen).toHaveBeenCalledTimes(2);
    });

    it("says the link no longer works when it is revoked or expired", async () => {
        window.location.hash = "#screen=gone";
        api.screen.mockRejectedValue(new LiveScreenLinkError(403));
        mount();
        expect(await screen.findByText("Посилання для екрана не діє")).toBeTruthy();
    });

    it("without a link checks the staff session", () => {
        mount();
        expect(api.info).toHaveBeenCalled();
        expect(api.screen).not.toHaveBeenCalled();
    });

    it("a moderator screen loads the access again when the event re-read failed meanwhile", async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0.5);
        // The event loads, then its 30 s re-read fails (the data stays); the access check fails three times.
        api.info.mockReset().mockResolvedValueOnce(event).mockRejectedValue(new Error("down"));
        api.access.mockRejectedValueOnce(new ManageApiError(502)).mockRejectedValueOnce(new ManageApiError(502)).mockRejectedValueOnce(new ManageApiError(502)).mockResolvedValue({});
        api.layout.mockReturnValue(new Promise(() => undefined));
        mount();
        const advance = (ms: number) => act(async () => {await vi.advanceTimersByTimeAsync(ms);});
        await advance(100);
        expect(screen.getByText(/Повторимо через \d+ с/)).toBeTruthy();
        // The tries go on after the event re-read failed at 30 s, and they load the access.
        await advance(80_000);
        expect(api.access).toHaveBeenCalledTimes(4);
        expect(api.layout).toHaveBeenCalled();
        expect(screen.queryByText(/Повторимо через/)).toBeNull();
    });
});
