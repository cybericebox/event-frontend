// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {EVENT_ID, FINISHED, fakeServer, inAppTemplate, subscription} from "@/components/event/manage/notifications/fixtures/server";

vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: true})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ManageNotificationsPage from "./page";

describe("Сповіщення на сайті, список", () => {
    afterEach(() => { cleanup(); vi.restoreAllMocks(); });

    it("lists the in-app notifications with status and switch and links to the template page", async () => {
        const calls = fakeServer("in_app", [subscription(FINISHED, "in_app")], [inAppTemplate(1)]);
        render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageNotificationsPage /></QueryClientProvider>);
        const link = await screen.findByRole("link", {name: "Захід завершено"});
        expect(link.getAttribute("href")).toBe(`/manage/notifications/${FINISHED}`);
        const row = link.closest("tr")!;
        expect(within(row).getByText("Типовий шаблон платформи")).toBeTruthy();
        fireEvent.click(within(row).getByRole("switch"));
        await waitFor(() => expect(calls.some(call => call.method === "PUT")).toBe(true));
        expect(calls.find(call => call.method === "PUT")!.body).toEqual({SignalType: FINISHED, Channel: "in_app", Enabled: false, Audience: {kind: "all_participants"}});
    });
});
