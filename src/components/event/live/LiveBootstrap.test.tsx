// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout, liveScreenTokenFromHash, liveScreenURL, LiveScreenLinkError} from "@/api/manageLive";
import {LiveBootstrap} from "./LiveBootstrap";

const api = vi.hoisted(() => ({screen: vi.fn(), results: vi.fn(), info: vi.fn(), access: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), getLiveScreenByLink: api.screen, getLiveScreenResultsByLink: api.results}));
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
afterEach(() => {cleanup(); window.location.hash = "";});

describe("live screen links", () => {
    it("keeps the token in the fragment of the screen URL", () => {
        const url = liveScreenURL("https://ctf.example", "abc_DEF-1");
        expect(url).toBe("https://ctf.example/live#screen=abc_DEF-1");
        expect(liveScreenTokenFromHash(new URL(url).hash)).toBe("abc_DEF-1");
        expect(liveScreenTokenFromHash("")).toBeNull();
    });

    it("opens the screen with a link, without any session check", async () => {
        window.location.hash = "#screen=tok";
        api.screen.mockResolvedValue({Event: event, Layout: defaultLiveLayout});
        api.results.mockReturnValue(new Promise(() => undefined));
        mount();
        expect(await screen.findByText("Захід")).toBeTruthy();
        expect(api.screen).toHaveBeenCalledWith("tok");
        expect(api.info).not.toHaveBeenCalled();
        expect(api.access).not.toHaveBeenCalled();
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
});
