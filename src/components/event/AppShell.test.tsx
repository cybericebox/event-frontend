// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {act, cleanup, render, screen} from "@testing-library/react";
import {renderToString} from "react-dom/server";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {AppShell} from "./AppShell";

const path = vi.hoisted(() => ({value: "/"}));
vi.mock("next/navigation", () => ({usePathname: () => path.value, useRouter: () => ({refresh: () => {}})}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => new Promise(() => {}), getJoinStatus: () => new Promise(() => {}), getOwnTeam: () => new Promise(() => {})}));
vi.mock("@/api/participantEventInfo", () => ({getParticipantEventInfo: () => new Promise(() => {})}));
vi.mock("./GuestShell", () => ({GuestShell: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock("./ParticipantShell", () => ({ParticipantShell: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock("./PrivateEventBootstrap", () => ({PrivateEventBootstrap: ({children}: {children: React.ReactNode}) => <section data-testid="private-bootstrap">{children}</section>}));
vi.mock("./EventLoading", () => ({EventLoading: () => <div>Завантаження події</div>}));

afterEach(() => {cleanup(); path.value = "/";});

it("keeps server-rendered public content visible during browser-only auth checks", () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const page = <QueryClientProvider client={client}><AppShell event={{EventID: "event-1"} as never} unavailable={false}><h1>Публічна сторінка</h1></AppShell></QueryClientProvider>;
    expect(renderToString(page)).toContain("Публічна сторінка");
    render(page);
    expect(screen.getByRole("heading", {name: "Публічна сторінка"})).toBeTruthy();
    expect(screen.queryByText("Завантаження події")).toBeNull();
});

it.each(["/challenges", "/scoreboard", "/participation", "/join", "/invite", "/forms", "/p/rules", "/team"])("retries %s in the browser when the server had no event", route => {
    path.value = route;
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><AppShell event={null} unavailable={false}><h1>Сторінка</h1></AppShell></QueryClientProvider>);
    expect(screen.getByTestId("private-bootstrap")).toBeTruthy();
    expect(screen.getByRole("heading", {name: "Сторінка"})).toBeTruthy();
});

it("switches an open site to the not-found screen once the event is gone", async () => {
    const {reportEventNotFound, resetEventGone} = await import("@/utils/eventGone");
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><AppShell event={{EventID: "event-1"} as never} unavailable={false}><h1>Публічна сторінка</h1></AppShell></QueryClientProvider>);
    expect(screen.getByRole("heading", {name: "Публічна сторінка"})).toBeTruthy();
    await act(() => reportEventNotFound("https://api.example.com", vi.fn().mockResolvedValue(new Response(null, {status: 404}))));
    expect(screen.getByRole("heading", {name: "Такого заходу не існує"})).toBeTruthy();
    expect(screen.queryByRole("heading", {name: "Публічна сторінка"})).toBeNull();
    resetEventGone();
});

it("shows the not-found screen alone when the server had no event and the page marks it missing", async () => {
    const {markEventGone, resetEventGone} = await import("@/utils/eventGone");
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><AppShell event={null} unavailable={false}><h1>Сторінка</h1></AppShell></QueryClientProvider>);
    act(() => markEventGone());
    expect(screen.getByRole("heading", {name: "Такого заходу не існує"})).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    resetEventGone();
});
