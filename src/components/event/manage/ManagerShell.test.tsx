// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/api/publicEventInfo";

vi.mock("@/utils/origins", () => ({idOrigin: "https://id.example.test", mainOrigin: "https://example.test", apiOrigin: "", eventOrigin: () => ""}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage"}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: vi.fn(async () => ({ID: "u1", Email: "mod@b.test"}))}));
vi.mock("@/api/authAPI", () => ({signOut: vi.fn()}));
const getManageAccess = vi.fn();
vi.mock("@/api/manage", () => ({
    getManageAccess: (...args: unknown[]) => getManageAccess(...args),
    getManagePages: vi.fn(),
    ManageApiError: class extends Error {constructor(readonly status: number) {super(`x${status}`);}},
}));

import {ManageApiError} from "@/api/manage";
import {ManagerShell} from "./ManagerShell";

const replace = vi.fn();
const original = window.location;
const event = {EventID: "e1", Name: "Захід", Tag: "ev", LogoURL: ""} as unknown as PublicEventInfo;

function renderShell() {
    Object.defineProperty(window, "location", {configurable: true, value: {href: "https://ev.example.test/manage/tasks?x=1", pathname: "/manage/tasks", replace}});
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><ManagerShell event={event}><p>page</p></ManagerShell></QueryClientProvider>);
}

afterEach(() => {
    cleanup();
    replace.mockReset();
    getManageAccess.mockReset();
    Object.defineProperty(window, "location", {configurable: true, value: original});
});

describe("ManagerShell access errors", () => {
    it("redirects a 401 to the sign-in with the current page as return_to, with no card", async () => {
        getManageAccess.mockRejectedValue(new ManageApiError(401));
        renderShell();
        await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(`https://id.example.test/sign-in?return_to=${encodeURIComponent("https://ev.example.test/manage/tasks?x=1")}`));
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.queryByRole("link")).toBeNull();
        expect(screen.queryByText("Потрібно увійти")).toBeNull();
    });

    it("shows the no-access screen with the account email for a 403 and does not redirect", async () => {
        getManageAccess.mockRejectedValue(new ManageApiError(403));
        renderShell();
        expect(await screen.findByRole("heading", {name: "Немає доступу до керування заходом"})).toBeTruthy();
        expect(screen.getByText(/mod@b\.test/)).toBeTruthy();
        expect(replace).not.toHaveBeenCalled();
    });
});
