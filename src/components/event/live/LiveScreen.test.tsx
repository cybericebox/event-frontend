// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout} from "@/api/manageLive";
import {ManageApiError} from "@/api/manage";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveScreen} from "./LiveScreen";
import {applyLiveTemplate} from "./liveTemplates";
import {withLiveSceneMode} from "./liveScenes";

// Separate screens: the board, the pre-start screen before the start and the finale after the finish.
const chain = applyLiveTemplate(applyLiveTemplate(withLiveSceneMode(defaultLiveLayout, "separate"), "prestart", "before"), "finale", "finished");

const api = vi.hoisted(() => ({layout: vi.fn(), version: vi.fn(), stages: vi.fn(), results: vi.fn(), user: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(), getPublishedLiveLayout: api.layout, getLiveLayoutVersion: api.version}));
vi.mock("@/api/manageStages", () => ({getManageStages: api.stages}));
vi.mock("@/api/manageResults", async importOriginal => ({...await importOriginal<typeof import("@/api/manageResults")>(), getManageResults: api.results}));
vi.mock("@/api/clientAuth", async importOriginal => ({...await importOriginal<typeof import("@/api/clientAuth")>(), getCurrentUser: api.user}));
// The stream stays open the whole time: no change comes to reload the snapshot.
vi.mock("@/utils/eventStream", () => ({useEventStream: () => "live"}));
vi.mock("./LiveQR", () => ({LiveQR: () => null}));

const now = Date.UTC(2026, 9, 19, 12);
const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Name: "Захід", StartTime: new Date(now - 3600_000).toISOString(), FinishTime: new Date(now + 3600_000).toISOString(),
    Participation: 1, LogoURL: "", Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} as unknown as PublicEventInfo;

function board(frozen: boolean): ManageResultsSnapshot {
    return {
        Revision: 3, GeneratedAt: new Date(now).toISOString(), TotalTeams: 1,
        Freeze: {Enabled: frozen, FrozenAt: frozen ? new Date(now - 600_000).toISOString() : null, FinishAt: null, OpenedAt: null, Active: frozen, Applied: frozen},
        Display: {ChartEnabled: true, ChartTeams: 10, RowsLimit: null},
        Scoreboard: [{Rank: 1, TeamID: "01900000-0000-7000-8000-000000000011", TeamName: "IceBreakers", Points: 300, Solved: 1, LastSolveAt: null}],
        Timeline: [],
    };
}

function mount() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><LiveScreen event={event} /></QueryClientProvider>);
    return client;
}

const advance = (ms: number) => act(async () => {await vi.advanceTimersByTimeAsync(ms);});

beforeEach(() => {
    vi.useFakeTimers({now, shouldAdvanceTime: false});
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.values(api).forEach(fn => fn.mockReset());
    api.layout.mockResolvedValue(defaultLiveLayout);
    api.version.mockResolvedValue(defaultLiveLayout.version);
    api.stages.mockResolvedValue([]);
    api.user.mockResolvedValue(null);
});
afterEach(() => {cleanup(); vi.useRealTimers(); vi.restoreAllMocks();});

describe("live screen keeps its data fresh", () => {
    for (const frozen of [false, true]) {
        it(`retries a failed snapshot while the stream is open${frozen ? " (frozen results)" : ""}, with no false «no connection»`, async () => {
            api.results.mockResolvedValueOnce(board(frozen)).mockRejectedValueOnce(new ManageApiError(502)).mockResolvedValue(board(frozen));
            const client = mount();
            await advance(1000);
            expect(screen.getAllByText("IceBreakers").length).toBeGreaterThan(0);
            // A change arrives on the stream; its snapshot load fails.
            await act(async () => {await client.invalidateQueries({queryKey: ["event-live-results"]}).catch(() => undefined);});
            expect(api.results).toHaveBeenCalledTimes(2);
            await advance(5000);
            await advance(1000);
            expect(api.results).toHaveBeenCalledTimes(3);
            await advance(10_000);
            expect(document.querySelector(".live-freeze--offline")).toBeNull();
        });
    }

    it("marks the data as old while the snapshot keeps failing", async () => {
        api.results.mockResolvedValueOnce(board(false)).mockRejectedValue(new ManageApiError(502));
        const client = mount();
        await advance(1000);
        await act(async () => {await client.invalidateQueries({queryKey: ["event-live-results"]}).catch(() => undefined);});
        await advance(12_000);
        expect(document.querySelector(".live-freeze--offline")?.textContent).toMatch(/^Немає звʼязку · дані на \d\d:\d\d$/);
        // The retries go on (5, then 10 s) and keep the board on screen.
        expect(api.results.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(screen.getAllByText("IceBreakers").length).toBeGreaterThan(0);
    });
});

describe("live screen of a moderator who lost access", () => {
    it("shows «no access» on 403 and stops retrying", async () => {
        api.layout.mockRejectedValue(new ManageApiError(403));
        api.user.mockResolvedValue({ID: "01900000-0000-7000-8000-000000000099", Email: "mod@example.test"});
        mount();
        await advance(1000);
        expect(screen.getByText("Немає доступу до екрана результатів наживо")).toBeTruthy();
        await advance(60_000);
        expect(api.layout).toHaveBeenCalledTimes(1);
    });

    it("goes to the sign-in on 401 of the results and stops retrying", async () => {
        api.results.mockRejectedValue(new ManageApiError(401));
        mount();
        await advance(1000);
        expect(screen.getByRole("status", {name: "Переходимо до входу…"})).toBeTruthy();
        await advance(60_000);
        expect(api.results).toHaveBeenCalledTimes(1);
    });
});

describe("live screen scenes", () => {
    const starting = {...event, StartTime: new Date(now + 90_000).toISOString(), FinishTime: new Date(now + 3600_000).toISOString()} as PublicEventInfo;
    const mountAt = (on: PublicEventInfo) => {
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><LiveScreen event={on} /></QueryClientProvider>);
    };

    it("switches by itself: before the start → the board at the start → the results after the finish", async () => {
        api.results.mockResolvedValue(board(false));
        api.layout.mockResolvedValue(chain);
        const short = {...starting, FinishTime: new Date(now + 180_000).toISOString()} as PublicEventInfo;
        mountAt(short);
        await advance(1000);
        expect(document.querySelector(".live-widget--facts")).not.toBeNull();
        expect(document.querySelector(".live-widget--chart")).toBeNull();
        await advance(90_000);
        expect(document.querySelector(".live-widget--chart")).not.toBeNull();
        expect(document.querySelector(".live-widget--facts")).toBeNull();
        await advance(90_000);
        expect(document.querySelector(".live-widget--podium")).not.toBeNull();
    });

    it("shows the frozen scene while the results are frozen, the board without one", async () => {
        api.results.mockResolvedValue(board(true));
        api.layout.mockResolvedValue({...defaultLiveLayout, scenes: {...defaultLiveLayout.scenes, frozen: {grid: {cols: 12, rows: 8}, widgets: [{id: "ann", type: "announcement", x: 1, y: 1, w: 12, h: 8, props: {text: "Результати заморожено"}}]}}});
        mountAt(event);
        await advance(1000);
        expect(document.querySelector(".live-widget--announcement")?.textContent).toBe("Результати заморожено");
        cleanup();
        api.layout.mockResolvedValue(defaultLiveLayout);
        mountAt(event);
        await advance(1000);
        expect(document.querySelector(".live-widget--chart")).not.toBeNull();
    });

    it("shows the one screen in every state when the layout has a single screen", async () => {
        api.results.mockResolvedValue(board(false));
        api.layout.mockResolvedValue({...defaultLiveLayout, scenes: undefined});
        mountAt(starting);
        await advance(1000);
        expect(document.querySelector(".live-widget--chart")).not.toBeNull();
        expect(document.querySelector(".live-widget--facts")).toBeNull();
    });

    it("stays on the board when the hall sees live results during the freeze", async () => {
        const live = {...board(false), Freeze: {Enabled: true, FrozenAt: new Date(now - 600_000).toISOString(), FinishAt: null, OpenedAt: null, Active: true, Applied: false}};
        api.results.mockResolvedValue(live);
        api.layout.mockResolvedValue({...defaultLiveLayout, scenes: {...defaultLiveLayout.scenes, frozen: {grid: {cols: 12, rows: 8}, widgets: [{id: "ann", type: "announcement", x: 1, y: 1, w: 12, h: 8, props: {text: "Результати заморожено"}}]}}});
        mountAt(event);
        await advance(1000);
        expect(document.querySelector(".live-widget--announcement")).toBeNull();
        expect(document.querySelector(".live-widget--chart")).not.toBeNull();
    });
});
