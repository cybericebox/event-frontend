// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {renderToString} from "react-dom/server";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {AppShell} from "./AppShell";

vi.mock("next/navigation", () => ({usePathname: () => "/"}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => new Promise(() => {}), getJoinStatus: () => new Promise(() => {}), getOwnTeam: () => new Promise(() => {})}));
vi.mock("@/api/participantEventInfo", () => ({getParticipantEventInfo: () => new Promise(() => {})}));
vi.mock("./GuestShell", () => ({GuestShell: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock("./ParticipantShell", () => ({ParticipantShell: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock("./EventLoading", () => ({EventLoading: () => <div>Завантаження події</div>}));

afterEach(cleanup);

it("keeps server-rendered public content visible during browser-only auth checks", () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const page = <QueryClientProvider client={client}><AppShell event={{EventID: "event-1"} as never} unavailable={false}><h1>Публічна сторінка</h1></AppShell></QueryClientProvider>;
    expect(renderToString(page)).toContain("Публічна сторінка");
    render(page);
    expect(screen.getByRole("heading", {name: "Публічна сторінка"})).toBeTruthy();
    expect(screen.queryByText("Завантаження події")).toBeNull();
});
