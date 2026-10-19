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
const observations: {target: Element; resize: () => void}[] = [];
beforeEach(() => {
    sessionStorage.clear();
    observations.length = 0;
    vi.stubGlobal("ResizeObserver", class {
        constructor(private resize: () => void) {}
        observe(target: Element) {observations.push({target, resize: this.resize});}
        disconnect() {}
    });
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
    view({pages: [publicPage]});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    const menu = within(document.getElementById("event-menu")!);
    expect(menu.getByRole("link", {name: "Rules"}).getAttribute("href")).toBe("/rules");
    expect(menu.queryByRole("link", {name: "Панель заходу"})).toBeNull();
    expect(menu.queryByRole("link", {name: "Участь"})).toBeNull();
});

it("keeps the menu and participation link for an approved test participant", () => {
    view({approved: true});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    const menu = within(document.getElementById("event-menu")!);
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

it("keeps the header icons while participation is loading without exposing unknown navigation", () => {
    const {container} = view({pending: true, pages: [publicPage]});
    expect(screen.getByRole("button", {name: "Відкрити меню"})).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "Вхідні"})).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "Меню акаунта"})).toHaveProperty("disabled", true);
    expect(container.querySelector("#event-menu")).toBeNull();
});

it("opens outside document flow, locks background scrolling and closes on Escape", async () => {
    const {container} = view({pages: [publicPage]});
    const toggle = screen.getByRole("button", {name: "Відкрити меню"});
    fireEvent.click(toggle);
    await waitFor(() => expect(document.body.hasAttribute("data-scroll-locked")).toBe(true));
    expect(container.querySelector("#event-menu")).toBeNull();
    expect(document.getElementById("event-menu")).not.toBeNull();
    fireEvent.keyDown(document, {key: "Escape"});
    await waitFor(() => expect(document.getElementById("event-menu")).toBeNull());
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(toggle));
});

it("closes after choosing a menu link and releases the background lock", async () => {
    view({pages: [publicPage]});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    fireEvent.click(within(document.getElementById("event-menu")!).getByRole("link", {name: "Rules"}));
    await waitFor(() => expect(document.getElementById("event-menu")).toBeNull());
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
});

it("dismisses on an outside tap and cleans up the lock when unmounted", async () => {
    const {unmount} = view({pages: [publicPage]});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 0));});
    fireEvent.pointerDown(document.body, {pointerType: "mouse", button: 0});
    fireEvent.click(document.body);
    await waitFor(() => expect(document.getElementById("event-menu")).toBeNull());
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    await waitFor(() => expect(document.body.hasAttribute("data-scroll-locked")).toBe(true));
    unmount();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
});

it("closes and unlocks the page when resized to desktop navigation", async () => {
    view({pages: [publicPage]});
    fireEvent.click(screen.getByRole("button", {name: "Відкрити меню"}));
    const header = observations.find(item => item.target.tagName === "HEADER")!;
    Object.defineProperty(header.target, "clientWidth", {value: 960});
    act(() => header.resize());
    await waitFor(() => expect(document.getElementById("event-menu")).toBeNull());
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
});

it("gives focus back to the menu button without scrolling the page to the top", async () => {
    view({pages: [publicPage]});
    const toggle = screen.getByRole("button", {name: "Відкрити меню"});
    fireEvent.click(toggle);
    await waitFor(() => expect(document.getElementById("event-menu")).not.toBeNull());
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    fireEvent.keyDown(document, {key: "Escape"});
    await waitFor(() => expect(document.activeElement).toBe(toggle));
    const calls = focus.mock.contexts.map((element, index) => [element, focus.mock.calls[index][0]] as const).filter(([element]) => element === toggle);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([, options]) => (options as FocusOptions | undefined)?.preventScroll === true)).toBe(true);
    focus.mockRestore();
});
