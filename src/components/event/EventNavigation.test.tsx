// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ManageConfigSchema, ManagePageSchema, type ManagePage} from "@/api/manage";
import {PublicEventInfoSchema} from "@/types/publicEventInfo";
import {ParticipantPreviewProvider} from "./ParticipantPreview";
import {EventNavbar} from "./EventNavigation";

vi.mock("next/navigation", () => ({usePathname: () => "/", useRouter: () => ({push: vi.fn(), refresh: vi.fn()})}));
vi.mock("@/api/manage", async original => ({...await original<typeof import("@/api/manage")>(), getManageAccess: async () => null, getManagePages: async () => []}));
vi.mock("@/api/navigationPages", () => ({getNavigationPages: async () => []}));
vi.mock("@/components/event/InboxButton", () => ({InboxButton: () => null}));
vi.mock("@/components/event/vpn/EventVpn", () => ({VpnHeaderButton: () => null}));

const event = PublicEventInfoSchema.parse({EventID: "00000000-0000-4000-8000-000000000010", Tag: "event-a", Name: "Event A", StartTime: "2026-11-01T00:00:00Z", FinishTime: null, Status: 1, Participation: 1, Registration: 1, CanViewResults: false, CanViewParticipants: false, PreviewDescription: "", PreviewPicture: "", Theme: {Brand: "#123456", Accent: "", AccentLight: "#123456", AccentDark: "#123456", AccentLive: "#123456", Version: 1}});
const user = {ID: "00000000-0000-4000-8000-000000000020", Role: "admin", FirstName: "Test", LastName: "User", Email: "test@example.test", Picture: ""};
const config = ManageConfigSchema.parse({EventID: event.EventID, Participation: 1, Registration: 1, ScoreboardVisibility: 1, ParticipantsVisibility: 1, PreviewDescription: "", PreviewPicture: "", MaxTeamSize: 4, MinTeamSize: 2, MaxTeams: null, MaxFlagAttempts: null, Theme: event.Theme, UpdatedAt: "2026-10-16T10:00:00Z"});
const publicPage = ManagePageSchema.parse({ID: "00000000-0000-4000-8000-000000000030", Slug: "rules", Title: "Rules", Document: {blocks: []}, Visibility: 0, Navigation: 1, NavigationOrder: 0, PublishedAt: "2026-10-16T10:00:00Z"});
const clients: QueryClient[] = [];
beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("ResizeObserver", class {observe() {} disconnect() {}});
});
afterEach(() => {cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals();});

function view({preview = true, authenticated = true, approved = false, pages = [] as ManagePage[], pending = false} = {}) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
    clients.push(client);
    if (preview) sessionStorage.setItem("event-participant-preview-v1", JSON.stringify({eventID: event.EventID, userID: user.ID, status: approved ? 2 : 0, outcome: "approved", answers: {}, team: null}));
    client.setQueryData(["event-current-user"], user);
    client.setQueryData(["event-management-access", event.EventID], preview ? {CanManage: true, InfrastructureAllowed: false} : null);
    client.setQueryData(["event-management-config", event.EventID], config);
    if (preview) client.setQueryData(["event-management-pages", event.EventID], pages);
    client.setQueryData(["event-navigation-pages", event.EventID, approved], preview ? [] : pages.map(page => ({Slug: page.Slug, Title: page.Title, NavigationOrder: page.NavigationOrder})));
    const tree = <QueryClientProvider client={client}><ParticipantPreviewProvider><EventNavbar event={event} authenticated={authenticated} approved={approved} pending={pending} /></ParticipantPreviewProvider></QueryClientProvider>;
    return {...render(tree), client};
}

it("hides the empty hamburger for an unregistered test participant despite their real organizer access", () => {
    const {container} = view();
    expect(screen.getByRole("region", {name: "Режим тестового учасника"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Відкрити меню"})).toBeNull();
    expect(container.querySelector("#event-menu")).toBeNull();
});

it("does not count unpublished, hidden, participant-only or staff-only pages as test guest menu items", () => {
    const pages: ManagePage[] = [
        {...publicPage, PublishedAt: null},
        {...publicPage, Navigation: 0},
        {...publicPage, Visibility: 1},
        {...publicPage, Visibility: 2},
    ];
    const {container} = view({pages});
    expect(screen.queryByRole("button", {name: "Відкрити меню"})).toBeNull();
    expect(container.querySelector("#event-menu")).toBeNull();
});

it("opens the test guest menu when a published public page is available", () => {
    const {container} = view({pages: [publicPage]});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    const menu = within(container.querySelector("#event-menu")! as HTMLElement);
    expect(menu.getByRole("link", {name: "Rules"}).getAttribute("href")).toBe("/rules");
    expect(menu.queryByRole("link", {name: "Панель заходу"})).toBeNull();
    expect(menu.queryByRole("link", {name: "Участь"})).toBeNull();
});

it("keeps the menu and participation link for an approved test participant", () => {
    const {container} = view({approved: true});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    const menu = within(container.querySelector("#event-menu")! as HTMLElement);
    expect(menu.getByRole("link", {name: "Участь"}).getAttribute("href")).toBe("/participation");
    expect(menu.getByRole("link", {name: "Завдання"}).getAttribute("href")).toBe("/challenges");
});

it("hides the menu for a signed-in nonparticipant with no available event pages", () => {
    const {container} = view({preview: false});
    expect(screen.queryByRole("button", {name: "Відкрити меню"})).toBeNull();
    expect(container.querySelector("#event-menu")).toBeNull();
});

it("keeps sign-in available directly when a guest has no event navigation", () => {
    const {container} = view({preview: false, authenticated: false});
    expect(screen.queryByRole("button", {name: "Відкрити меню"})).toBeNull();
    expect(container.querySelector("#event-menu")).toBeNull();
    expect(screen.getByRole("link", {name: "Увійти"})).toBeTruthy();
});

it("removes an expanded menu if its last accessible page disappears", async () => {
    const {container, client} = view({pages: [publicPage]});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    act(() => client.setQueryData(["event-management-pages", event.EventID], []));
    await waitFor(() => expect(container.querySelector("#event-menu")).toBeNull());
    expect(container.querySelector("header")!.classList.contains("is-open")).toBe(false);
    expect(screen.queryByRole("button", {name: "Закрити меню"})).toBeNull();
});

it("does not render navigation controls while participation is still loading", () => {
    const {container} = view({pending: true, pages: [publicPage]});
    expect(screen.queryByRole("button", {name: "Відкрити меню"})).toBeNull();
    expect(container.querySelector("#event-menu")).toBeNull();
});
