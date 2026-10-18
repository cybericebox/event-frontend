// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://event.test/"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const nav = vi.hoisted(() => ({path: "/manage/test-mode", push: vi.fn()}));
vi.mock("next/navigation", () => ({usePathname: () => nav.path, useRouter: () => ({push: nav.push, refresh: vi.fn()})}));
vi.mock("@/api/clientAuth", async importOriginal => ({...(await importOriginal<object>()), getCatalogAccess: async () => false, getCurrentUser: async () => ({ID: "user-1"}), getJoinStatus: async () => 0, getOwnTeam: async () => null}));
vi.mock("@/api/manage", async importOriginal => ({...(await importOriginal<object>()), getManageAccess: async () => ({CanManage: true}), getManageConfig: async () => ({ScoreboardVisibility: 1}), getManageContent: () => new Promise(() => {})}));
vi.mock("@/api/clientEventInfo", () => ({getClientEventInfo: async () => event}));
vi.mock("./EventServiceStatusGate", () => ({APP_ROOT_ID: "root", EventServiceStatusGate: () => null}));
import {AppShell} from "./AppShell";
import {readPreviewCookie} from "@/utils/previewCookie";

const event = {EventID: "event-1", Name: "Hidden", LogoURL: "", FaviconURL: "", Theme: {Brand: "#1", AccentLight: "#2", AccentDark: "#3", AccentLive: "#4"}} as never;
beforeEach(() => {vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}}); document.cookie = "cib_participant_preview=; Path=/; Max-Age=0"; sessionStorage.clear(); nav.path = "/manage/test-mode";});
afterEach(cleanup);

// The route flips to the landing the way router.push does, with the layout re-rendering from the new cookie.
it("enters and leaves the preview of a hidden event (layout not re-rendered, as on a client navigation) without a render error, and shows the participant view", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    client.setQueryData(["event-current-user"], {ID: "user-1"});
    client.setQueryData(["event-management-access", "event-1"], {CanManage: true});
    const tree = (props: {event: null; previewCookie: string | null}) => <QueryClientProvider client={client}><AppShell unavailable={false} {...props}><h1>page</h1></AppShell></QueryClientProvider>;
    const view = render(tree({event: null, previewCookie: null}));
    fireEvent.click(await screen.findByRole("button", {name: "Тестувати як учасник"}));
    expect(readPreviewCookie()).toBe("event-1");
    nav.path = "/";
    await act(async () => {view.rerender(tree({event: null, previewCookie: null}));});
    expect(screen.queryByText("Редагувати головну")).toBeNull();
    expect(screen.getByRole("region", {name: "Режим тестового учасника"})).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", {name: "Дії тестового режиму"}), {button: 0, ctrlKey: false});
    nav.path = "/";
    fireEvent.click(await screen.findByRole("menuitem", {name: "Вийти з тестування"}));
    nav.path = "/manage";
    await act(async () => {view.rerender(tree({event: null, previewCookie: null}));});
    expect(readPreviewCookie()).toBeNull();
    expect(screen.queryByRole("region", {name: "Режим тестового учасника"})).toBeNull();
    expect(errors).not.toHaveBeenCalled();
});
