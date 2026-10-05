// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
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
vi.mock("./GuestShell", () => ({GuestShell: ({children}: {children: React.ReactNode}) => <div>{children}</div>}));

afterEach(cleanup);
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

    it("shows the not-found event screen for a visitor when the server and the browser both get 404", async () => {
        clientEvent.getClientEventInfo.mockRejectedValueOnce(new clientEvent.ClientEventInfoError(404));
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><PrivateEventBootstrap><p>Сторінка</p></PrivateEventBootstrap></QueryClientProvider>);
        expect(await screen.findByRole("heading", {name: "Такого заходу не існує"})).toBeTruthy();
        expect(screen.queryByText("Сторінка")).toBeNull();
    });
});
