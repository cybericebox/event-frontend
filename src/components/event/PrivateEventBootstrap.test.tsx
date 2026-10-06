// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PrivateEventBootstrap} from "./PrivateEventBootstrap";

vi.mock("next/navigation", () => ({usePathname: () => "/"}));
const clientEvent = vi.hoisted(() => {
    class ClientEventInfoError extends Error {constructor(readonly status: number) {super(String(status));}}
    return {ClientEventInfoError, getClientEventInfo: vi.fn(() => new Promise(() => {}))};
});
vi.mock("@/api/clientEventInfo", () => clientEvent);
vi.mock("@/api/manage", () => ({getManageAccess: vi.fn(() => new Promise(() => {})), ManageApiError: class extends Error {}}));
const currentUser = vi.hoisted(() => ({getCurrentUser: vi.fn(async () => null as unknown)}));
vi.mock("@/api/clientAuth", () => currentUser);
vi.mock("./GuestShell", () => ({GuestShell: ({children}: {children: React.ReactNode}) => <div>{children}</div>}));

const UNAVAILABLE = "Захід не знайдено або у вас немає доступу";
const replace = vi.fn();
afterEach(() => {cleanup(); replace.mockReset(); currentUser.getCurrentUser.mockResolvedValue(null);});
beforeEach(() => {Object.defineProperty(window, "location", {configurable: true, value: {href: "https://ev.example.test/challenges", pathname: "/challenges", replace}});});
describe("PrivateEventBootstrap", () => {
    it("reuses manager identity and access for immediate preview navigation", () => {
        const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: 60_000}}});
        client.setQueryData(["event-manager-public-info"], {
            EventID: "event-1", Name: "Подія", LogoURL: "", Theme: {Brand: "#211A52", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF"},
        });
        client.setQueryData(["event-management-access", "event-1"], {CanManage: true});
        render(<QueryClientProvider client={client}><PrivateEventBootstrap><p>Готова сторінка</p></PrivateEventBootstrap></QueryClientProvider>);
        expect(screen.getByText("Готова сторінка")).toBeTruthy();
        expect(screen.queryByRole("status", {name: "Завантажуємо попередній перегляд заходу…"})).toBeNull();
    });

    it("shows the one unavailable screen for a visitor when the server and the browser both get 404, with no redirect and no brand", async () => {
        clientEvent.getClientEventInfo.mockRejectedValueOnce(new clientEvent.ClientEventInfoError(404));
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><PrivateEventBootstrap><p>Сторінка</p></PrivateEventBootstrap></QueryClientProvider>);
        expect(await screen.findByRole("heading", {name: UNAVAILABLE})).toBeTruthy();
        expect(screen.queryByText("Сторінка")).toBeNull();
        expect(replace).not.toHaveBeenCalled();
        expect(document.querySelector("img[src^='http']")).toBeNull();
    });
});

describe("PrivateEventBootstrap without a session", () => {
    it("shows the same unavailable screen on 401 (private event, no access) with only the sign-in button and no redirect", async () => {
        clientEvent.getClientEventInfo.mockRejectedValueOnce(new clientEvent.ClientEventInfoError(401));
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><PrivateEventBootstrap><p>Сторінка</p></PrivateEventBootstrap></QueryClientProvider>);
        expect(await screen.findByRole("heading", {name: UNAVAILABLE})).toBeTruthy();
        expect(await screen.findByRole("link", {name: "Увійти"})).toBeTruthy();
        expect(replace).not.toHaveBeenCalled();
    });

    it("shows the same unavailable screen to a signed-in account without access (403), without the sign-in button", async () => {
        currentUser.getCurrentUser.mockResolvedValue({ID: "u1", Email: "a@b.test"});
        clientEvent.getClientEventInfo.mockRejectedValueOnce(new clientEvent.ClientEventInfoError(403));
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><PrivateEventBootstrap><p>Сторінка</p></PrivateEventBootstrap></QueryClientProvider>);
        expect(await screen.findByRole("heading", {name: UNAVAILABLE})).toBeTruthy();
        await vi.waitFor(() => expect(currentUser.getCurrentUser).toHaveBeenCalled());
        expect(screen.queryByRole("link", {name: "Увійти"})).toBeNull();
        expect(screen.queryByText(/a@b\.test/)).toBeNull();
        expect(replace).not.toHaveBeenCalled();
    });
});

describe("PrivateEventBootstrap when the browser read fails", () => {
    function renderBootstrap() {
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><PrivateEventBootstrap><p>Сторінка</p></PrivateEventBootstrap></QueryClientProvider>);
    }

    it("shows the not-found screen when the server saw 404 and the browser cannot reach the API (CORS)", async () => {
        clientEvent.getClientEventInfo.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        renderBootstrap();
        expect(await screen.findByRole("heading", {name: UNAVAILABLE})).toBeTruthy();
    });

    it("shows the error screen with a retry, never a blank page, on a server error", async () => {
        clientEvent.getClientEventInfo.mockRejectedValueOnce(new clientEvent.ClientEventInfoError(500));
        renderBootstrap();
        expect(await screen.findByRole("button", {name: "Оновити"})).toBeTruthy();
    });
});
