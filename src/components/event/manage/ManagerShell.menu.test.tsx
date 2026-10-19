// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {t} from "@/i18n/t";

vi.mock("@/utils/origins", () => ({idOrigin: "https://id.example.test", mainOrigin: "https://example.test", adminOrigin: "", exercisesOrigin: "", apiOrigin: "", eventOrigin: () => ""}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/teams", useRouter: () => ({push: vi.fn(), refresh: vi.fn()})}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: vi.fn(async () => ({ID: "u1", Email: "mod@b.test", Role: "user", FirstName: "", LastName: "", Picture: ""})), getCatalogAccess: vi.fn(async () => false), profilePictureUrl: () => ""}));
vi.mock("@/api/authAPI", () => ({signOut: vi.fn()}));
vi.mock("@/components/event/InboxButton", () => ({InboxButton: () => <button type="button">Вхідні</button>}));
vi.mock("./setup/SetupChip", () => ({SetupChip: () => null}));
vi.mock("./analytics/useAnalyticsAccess", () => ({useAnalyticsAccess: () => ({data: null})}));
vi.mock("../SiteBanners", () => ({SiteBannerBar: () => null}));
vi.mock("@/api/manage", async original => ({
    ...await original<typeof import("@/api/manage")>(),
    getManageAccess: vi.fn(async () => ({CanManage: true, InfrastructureAllowed: false})),
    getManagePages: vi.fn(async () => []),
}));

import {ManagerShell} from "./ManagerShell";

const event = {EventID: "e1", Name: "Захід", Tag: "ev", LogoURL: "", Registration: 1} as unknown as PublicEventInfo;
afterEach(cleanup);

async function shell() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><ManagerShell event={event}><p>Сторінка</p></ManagerShell></QueryClientProvider>);
    return screen.findByRole("button", {name: t("manage.shell.openMenu")});
}

describe("panel phone menu", () => {
    it("opens under the top bar without moving it: the bar stays usable and its button closes the menu", async () => {
        const toggle = await shell();
        const bar = toggle.closest("header")!;
        fireEvent.click(toggle);
        const frame = document.querySelector(".event-manage-shell")!;
        expect(frame.classList.contains("is-drawer-open")).toBe(true);
        // The bar is not inert and keeps its place in the frame; only the content, crumbs and actions behind are.
        expect(bar.closest("[inert]")).toBeNull();
        expect(document.getElementById("main")!.hasAttribute("inert")).toBe(true);
        expect(bar.querySelector(".ib-topbar__actions")!.hasAttribute("inert")).toBe(true);
        expect(toggle.getAttribute("aria-label")).toBe(t("manage.shell.closeMenu"));
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        fireEvent.click(toggle);
        expect(frame.classList.contains("is-drawer-open")).toBe(false);
        expect(document.getElementById("main")!.hasAttribute("inert")).toBe(false);
        expect(document.activeElement).toBe(toggle);
    });

    it("closes on Esc and on a tap outside the menu, giving focus back to the menu button", async () => {
        const toggle = await shell();
        const frame = () => document.querySelector(".event-manage-shell")!;
        fireEvent.click(toggle);
        fireEvent.keyDown(document, {key: "Escape"});
        await waitFor(() => expect(frame().classList.contains("is-drawer-open")).toBe(false));
        expect(document.activeElement).toBe(toggle);

        fireEvent.click(toggle);
        fireEvent.pointerDown(document.querySelector(".ib-admin-shell__backdrop")!);
        await waitFor(() => expect(frame().classList.contains("is-drawer-open")).toBe(false));

        fireEvent.click(toggle);
        fireEvent.pointerDown(document.querySelector(".ib-admin-side")!);
        expect(frame().classList.contains("is-drawer-open")).toBe(true);
    });
});
