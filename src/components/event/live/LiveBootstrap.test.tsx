// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout, liveScreenTokenFromHash, liveScreenURL, LiveScreenLinkError} from "@/api/manageLive";
import {ManageApiError} from "@/api/manage";
import {LiveBootstrap} from "./LiveBootstrap";
import type {LiveScreenStart} from "@/api/liveScreenServer";

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

function mount(link?: {token: string; start: LiveScreenStart}) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><LiveBootstrap link={link} /></QueryClientProvider>);
}
// The server could not read the link (a temporary failure): the browser loads it.
const viaBrowser = (token = "tok") => ({token, start: {kind: "failed" as const}});

beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.info.mockReturnValue(new Promise(() => undefined));
});
afterEach(() => {cleanup(); window.history.replaceState(null, "", "/"); vi.useRealTimers(); vi.restoreAllMocks();});

describe("live screen links", () => {
    it("puts the token in the query of the screen URL, so the server renders the screen", () => {
        expect(liveScreenURL("https://ctf.example", "abc_DEF-1")).toBe("https://ctf.example/live?token=abc_DEF-1");
        expect(liveScreenTokenFromHash("#screen=abc_DEF-1")).toBe("abc_DEF-1");
        expect(liveScreenTokenFromHash("")).toBeNull();
    });

    it("moves the token of an older #screen= link into the query once and loads the page again", async () => {
        window.history.replaceState(null, "", "/live#screen=old-token");
        mount();
        await act(async () => {await Promise.resolve();});
        expect(window.location.pathname).toBe("/live");
        expect(window.location.search).toBe("?token=old-token");
        expect(window.location.hash).toBe("");
        expect(api.info).not.toHaveBeenCalled();
    });

    it("starts from the screen the server read: no request before the first paint", async () => {
        api.results.mockReturnValue(new Promise(() => undefined));
        mount({token: "tok", start: {kind: "ok", screen: {Event: event, Layout: defaultLiveLayout, Stages: []} as never, serverNow: Date.now()}});
        expect(screen.getByText("Захід")).toBeTruthy();
        expect(api.screen).not.toHaveBeenCalled();
    });

    it("opens the screen with a link, without any session check", async () => {
        api.screen.mockResolvedValue({Event: event, Layout: defaultLiveLayout, Stages: []});
        api.results.mockReturnValue(new Promise(() => undefined));
        mount(viaBrowser());
        expect(await screen.findByText("Захід")).toBeTruthy();
        expect(api.screen).toHaveBeenCalledWith("tok");
        expect(api.info).not.toHaveBeenCalled();
        expect(api.access).not.toHaveBeenCalled();
    });

    it("retries a failed open by itself, telling when, with no button press", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        api.screen.mockRejectedValueOnce(new LiveScreenLinkError(502)).mockResolvedValue({Event: event, Layout: defaultLiveLayout, Stages: []});
        api.results.mockReturnValue(new Promise(() => undefined));
        mount(viaBrowser());
        expect(await screen.findByText(/Повторимо через \d+ с/)).toBeTruthy();
        await act(async () => {vi.advanceTimersByTime(5000);});
        expect(await screen.findByText("Захід")).toBeTruthy();
        expect(api.screen).toHaveBeenCalledTimes(2);
    });

    it("says plainly that the event is not found or not published yet, and does not retry on screen", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        api.screen.mockRejectedValue(new LiveScreenLinkError(404));
        mount(viaBrowser());
        expect(await screen.findByText("Захід не знайдено")).toBeTruthy();
        expect(screen.getByText("або його ще не опубліковано")).toBeTruthy();
        expect(screen.getByText("Посилання запрацює, щойно захід опублікують.")).toBeTruthy();
        // The platform's neutral page, not a half-themed live screen; no retry countdown or button.
        expect(document.querySelector(".live-neutral .ib-error--page")).not.toBeNull();
        expect(document.querySelector(".live-fullscreen")).toBeNull();
        expect(screen.queryByText(/Повторимо через/)).toBeNull();
        expect(screen.queryByRole("button", {name: "Спробувати ще раз"})).toBeNull();
        await act(async () => {await vi.advanceTimersByTimeAsync(30_000);});
        expect(api.screen).toHaveBeenCalledTimes(1);
    });

    it("opens by itself once the event is published", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        api.screen.mockRejectedValueOnce(new LiveScreenLinkError(404)).mockResolvedValue({Event: event, Layout: defaultLiveLayout, Stages: []});
        api.results.mockReturnValue(new Promise(() => undefined));
        mount(viaBrowser());
        expect(await screen.findByText("Захід не знайдено")).toBeTruthy();
        await act(async () => {await vi.advanceTimersByTimeAsync(60_000);});
        expect(await screen.findByText("Захід")).toBeTruthy();
    });

    it("says the link no longer works when it is revoked or expired", async () => {
        api.screen.mockRejectedValue(new LiveScreenLinkError(403));
        mount(viaBrowser());
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

describe("final answers the server already gave", () => {
    it("shows «not found» from the first paint and re-checks only after a minute", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        api.screen.mockResolvedValue({Event: event, Layout: defaultLiveLayout, Stages: []});
        api.results.mockReturnValue(new Promise(() => undefined));
        mount({token: "tok", start: {kind: "notFound"}});
        expect(screen.getByText("Захід не знайдено")).toBeTruthy();
        expect(api.screen).not.toHaveBeenCalled();
        await act(async () => {await vi.advanceTimersByTimeAsync(60_000);});
        expect(await screen.findByText("Захід")).toBeTruthy();
    });

    it("shows a closed link as final, with no request at all", async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        mount({token: "tok", start: {kind: "closed"}});
        expect(screen.getByText("Посилання для екрана не діє")).toBeTruthy();
        await act(async () => {await vi.advanceTimersByTimeAsync(120_000);});
        expect(api.screen).not.toHaveBeenCalled();
    });
});
