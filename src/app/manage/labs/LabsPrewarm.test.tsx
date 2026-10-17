// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import ManageLabsPage from "./page";

const h = vi.hoisted(() => ({prewarm: null as unknown}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Tag: "e1"}, canManage: true})}));
vi.mock("@/api/manageLabs", async original => {
    const actual = await original() as typeof import("@/api/manageLabs");
    return {
        ...actual,
        // Through the real schema, so a missing Unavailable reads as 0.
        getManageLabs: async () => actual.ManageLabsSchema.parse({
            InfrastructureAllowed: true, LaboratoriesAvailable: true, TeardownDelayMinutes: 30, DeployAt: null, TeardownAt: null, ChallengesOpened: true,
            Summary: {Total: 0, NotDeployed: 0, Creating: 0, Ready: 0, Failed: 0, Removed: 0}, Items: [], Prewarm: h.prewarm,
        }),
    };
});
afterEach(cleanup);

function renderPage() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageLabsPage /></QueryClientProvider>);
}

describe("labs page image prewarm", () => {
    it("counts ready images of those that can be prewarmed and links the unavailable ones to the tasks", async () => {
        h.prewarm = {Total: 5, Done: 3, Warming: 0, Queued: 0, Failed: 0, Skipped: 0, Unavailable: 2, UpdatedAt: null};
        renderPage();
        expect(await screen.findByText(/Кеш образів: 3\/3 готово/)).toBeTruthy();
        const link = screen.getByRole("link", {name: "2 образи недоступні"});
        expect(link.getAttribute("href")).toBe("/manage/exercises");
    });

    it("pluralizes the unavailable images", async () => {
        h.prewarm = {Total: 6, Done: 1, Unavailable: 5};
        renderPage();
        expect(await screen.findByRole("link", {name: "5 образів недоступні"})).toBeTruthy();
        cleanup();
        h.prewarm = {Total: 2, Done: 1, Unavailable: 1};
        renderPage();
        expect(await screen.findByRole("link", {name: "1 образ недоступний"})).toBeTruthy();
    });

    it("says only that the images are unavailable when none can be prewarmed", async () => {
        h.prewarm = {Total: 2, Done: 0, Unavailable: 2};
        renderPage();
        expect(await screen.findByRole("link", {name: "2 образи недоступні"})).toBeTruthy();
        expect(screen.queryByText(/Кеш образів/)).toBeNull();
    });

    it("an older backend without Unavailable keeps the plain progress", async () => {
        h.prewarm = {Total: 4, Done: 2};
        renderPage();
        expect(await screen.findByText(/Кеш образів: 2\/4 готово/)).toBeTruthy();
        expect(screen.queryByRole("link", {name: /недоступн/})).toBeNull();
    });
});
