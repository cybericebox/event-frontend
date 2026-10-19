// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";

const state = vi.hoisted(() => ({access: null as null | {CanManage: boolean}, joinStatus: 0}));
vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("next/navigation", async importOriginal => ({...await importOriginal<object>(), useRouter: () => ({push: vi.fn(), replace: vi.fn()}), usePathname: () => "/challenges"}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => null}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => ({EventID: "event-1", Name: "Захід", Tag: "event", Participation: 1, StartTime: "2026-01-01T00:00:00Z", FinishTime: null})}));
vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => null}));
vi.mock("@/components/event/ParticipantPreview", () => ({useParticipantPreview: () => ({active: false, state: null, config: null})}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: ({label}: {label?: string}) => <div>{label}</div>}));
vi.mock("@/api/manage", async importOriginal => ({...await importOriginal<object>(), getManageAccess: async () => {
    if (!state.access) throw new Error("forbidden");
    return state.access;
}}));
vi.mock("@/api/clientAuth", async importOriginal => ({...await importOriginal<object>(), getJoinStatus: async () => state.joinStatus, getCurrentUser: async () => ({ID: "u1"})}));

const {ChallengesBoard} = await import("./ChallengesBoard");

function view() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ChallengesBoard /></QueryClientProvider>);
}

beforeEach(() => {state.access = null; state.joinStatus = 0;});
afterEach(cleanup);

it("offers a visitor without an application to join", async () => {
    view();
    expect(await screen.findByText("Завдання доступні учасникам заходу")).toBeTruthy();
    expect(screen.getByRole("link", {name: "Приєднатися"})).toBeTruthy();
});

it("names an application under review instead of «Приєднатися»", async () => {
    state.joinStatus = 1;
    view();
    expect(await screen.findByText("Заявка на участь очікує рішення організаторів.")).toBeTruthy();
    expect(screen.queryByRole("link", {name: "Приєднатися"})).toBeNull();
});

it("tells read-only staff the board is for organizers with the manage right, with no dead-end join button", async () => {
    state.access = {CanManage: false};
    view();
    expect(await screen.findByText("Перевірка завдань доступна організаторам з правом керування")).toBeTruthy();
    expect(screen.queryByRole("link", {name: "Приєднатися"})).toBeNull();
});
