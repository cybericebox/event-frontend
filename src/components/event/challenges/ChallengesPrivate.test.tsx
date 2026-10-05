// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PrivateEventBootstrap} from "../PrivateEventBootstrap";
import {useGuestEvent} from "../GuestShell";

vi.mock("next/navigation", () => ({usePathname: () => "/challenges"}));
vi.mock("@/api/clientEventInfo", () => ({getClientEventInfo: vi.fn(() => new Promise(() => {})), ClientEventInfoError: class extends Error {}}));
vi.mock("@/api/manage", () => ({getManageAccess: vi.fn(() => new Promise(() => {})), ManageApiError: class extends Error {}}));

vi.mock("../GuestShell", async () => {
    const {createContext, useContext} = await import("react");
    const Ctx = createContext<{Name: string} | null>(null);
    return {useGuestEvent: () => useContext(Ctx), GuestShell: ({event, children}: {event: {Name: string}; children: React.ReactNode}) => <Ctx.Provider value={event}>{children}</Ctx.Provider>};
});

afterEach(cleanup);

function Page() {
    const event = useGuestEvent();
    return <h1>{event?.Name ?? "немає заходу"}</h1>;
}

it("gives a reserved page the unpublished event from the bootstrap context", () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: 60_000}}});
    client.setQueryData(["event-manager-public-info"], {EventID: "event-1", Name: "Закритий захід", LogoURL: "", Theme: {Brand: "#211A52", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF"}});
    client.setQueryData(["event-management-access", "event-1"], {CanManage: true});
    render(<QueryClientProvider client={client}><PrivateEventBootstrap><Page /></PrivateEventBootstrap></QueryClientProvider>);
    expect(screen.getByRole("heading", {name: "Закритий захід"})).toBeTruthy();
});
