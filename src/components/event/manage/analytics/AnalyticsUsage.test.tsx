// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const event = vi.hoisted(() => ({EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Participation: 1, LogoURL: null}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event, canManage: true})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {AnalyticsUsage, usageState} from "./AnalyticsUsage";

afterEach(cleanup);

const past = new Date(Date.now() - 3_600_000).toISOString();
const blue = "0190c6a4-0000-7000-8000-000000000001";
const red = "0190c6a4-0000-7000-8000-000000000002";

const none = {Sessions: 0, Seconds: 0, RxBytes: 0, TxBytes: 0, Recent: []};
const noProxy = {Requests: 0, BytesIn: 0, BytesOut: 0, FirstAt: null, LastAt: null};

function usage(extra: Record<string, unknown> = {}) {
    return {
        Available: true, At: past, Period: {From: past, To: past},
        Summary: {Users: 3, OnlineNow: 1, VPNUsers: 2, ProxyUsers: 1, Sessions: 3, OnlineSeconds: 600, RxBytes: 1024, TxBytes: 2048, ProxyRequests: 12, ProxyBytes: 4096},
        Users: [
            {UserID: "u1", UserName: "Ann", TeamID: blue, TeamName: "Blue",
                VPN: {Online: true, LastHandshakeAt: past, FirstAt: past, Sessions: 2, Seconds: 600, RxBytes: 1024, TxBytes: 2048,
                    Recent: [{StartedAt: past, EndedAt: past, Seconds: 600, RxBytes: 1024, TxBytes: 2048}]},
                Proxy: {Requests: 12, BytesIn: 3072, BytesOut: 1024, FirstAt: past, LastAt: past},
                Labs: [{ChallengeID: "c1", Task: "Web login", Surface: "proxy", Attempts: 12, BytesIn: 3072, BytesOut: 1024, FirstAt: past, LastAt: past}]},
            {UserID: "u2", UserName: "Bob", TeamID: red, TeamName: "Red",
                VPN: {Online: false, LastHandshakeAt: past, FirstAt: past, Sessions: 1, Seconds: 0, RxBytes: 0, TxBytes: 0, Recent: []}, Proxy: noProxy, Labs: []},
            {UserID: "u3", UserName: "", TeamID: red, TeamName: "Red", VPN: {Online: false, LastHandshakeAt: null, FirstAt: null, ...none}, Proxy: noProxy, Labs: []},
        ],
        ...extra,
    };
}

function mockApi(data: unknown) {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: data === undefined ? 500 : 200})) as typeof fetch;
}

function renderUsage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><AnalyticsUsage /></QueryClientProvider>);
}

describe("Використання", () => {
    it("says so, in a block, when the event has no infrastructure", async () => {
        mockApi(usage({Available: false, Users: []}));
        renderUsage();
        expect(await screen.findByText("У цьому заході немає інфраструктури, тож використання VPN і проксі немає")).toBeTruthy();
        expect(screen.queryByRole("table")).toBeNull();
    });

    it("shows the live state from the handshake, never-connected participants and the proxy use", async () => {
        mockApi(usage());
        renderUsage();
        const numbers = await screen.findByRole("region", {name: "Ключові числа використання"});
        expect(within(numbers).getByText("З 3 учасників")).toBeTruthy();
        const table = screen.getByRole("table");
        expect(within(within(table).getByText("Ann").closest("tr")!).getByText("Онлайн")).toBeTruthy();
        expect(within(within(table).getByText("Bob").closest("tr")!).getByText("Офлайн")).toBeTruthy();
        const nameless = within(table).getByText("Без імені").closest("tr")!;
        expect(within(nameless).getByText("Не підключався")).toBeTruthy();
        expect(within(within(table).getByText("Ann").closest("tr")!).getByText("12")).toBeTruthy();
    });

    it("opens the sessions and task access of a participant", async () => {
        mockApi(usage());
        renderUsage();
        await screen.findByRole("table");
        expect(screen.queryByText("Web login")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Подробиці: Ann"}));
        expect(await screen.findByText("Web login")).toBeTruthy();
        expect(screen.getByText("Веб-проксі")).toBeTruthy();
        expect(screen.getByText("Останні VPN-сесії")).toBeTruthy();
    });

    it("filters by team and says so when nobody matches", async () => {
        mockApi(usage());
        renderUsage();
        await screen.findByRole("table");
        fireEvent.change(screen.getByRole("searchbox", {name: "Пошук за учасником або командою"}), {target: {value: "nobody"}});
        expect(await screen.findByText("Немає учасників за цими умовами")).toBeTruthy();
    });

    it("shows the shared error state when the report cannot load", async () => {
        mockApi(undefined);
        renderUsage();
        await waitFor(() => expect(screen.getByText("Не вдалося завантажити використання")).toBeTruthy());
    });
});

describe("usageState", () => {
    const user = (Online: boolean, last: string | null) => ({VPN: {Online, LastHandshakeAt: last}}) as Parameters<typeof usageState>[0];
    it("follows the server's online flag and the last handshake only", () => {
        expect(usageState(user(true, past))).toBe("online");
        expect(usageState(user(false, past))).toBe("offline");
        expect(usageState(user(false, null))).toBe("never");
    });
});
