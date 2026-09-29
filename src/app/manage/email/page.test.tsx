// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {EVENT_ID, FINISHED, REMINDER, emailTemplate, fakeServer, subscription, uuid} from "@/components/event/manage/notifications/fixtures/server";

const manager = vi.hoisted(() => ({canManage: true}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ManageEmailPage from "./page";

function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageEmailPage /></QueryClientProvider>);
}

const subs = [subscription(FINISHED, "email"), subscription(REMINDER, "email", {Enabled: false})];

describe("Електронні листи, список", () => {
    afterEach(() => { cleanup(); manager.canManage = true; vi.restoreAllMocks(); });

    it("lists every email with its status and a switch, like admin's list", async () => {
        fakeServer("email", subs, [
            emailTemplate(1, FINISHED),
            emailTemplate(2, REMINDER), emailTemplate(3, REMINDER, {Source: "event", Status: "published", UpdatedAt: "2026-09-20T00:00:00Z"}), emailTemplate(4, REMINDER, {Source: "event", Status: "draft"}),
        ]);
        renderPage();
        const table = screen.getByRole("table");
        expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Тип", "Статус", "Оновлено", "Надсилати"]);
        const reminder = (await within(table).findByRole("link", {name: "Нагадування про старт"})).closest("tr")!;
        expect(within(reminder).getByText("Опублікована", {selector: ".ib-tag"})).toBeTruthy();
        expect(within(reminder).getByText("Чернетка очікує")).toBeTruthy();
        const finished = within(table).getByRole("link", {name: "Захід завершено"}).closest("tr")!;
        expect(within(finished).getByText("Типовий шаблон платформи")).toBeTruthy();
        expect((within(finished).getByRole("switch") as HTMLInputElement).checked).toBe(true);
        expect((within(reminder).getByRole("switch") as HTMLInputElement).checked).toBe(false);
    });

    it("opens the template page of a row", async () => {
        fakeServer("email", subs, [emailTemplate(1, FINISHED), emailTemplate(2, REMINDER)]);
        renderPage();
        const link = await screen.findByRole("link", {name: "Захід завершено"});
        expect(link.getAttribute("href")).toBe(`/manage/email/${FINISHED}`);
    });

    it("switches sending from the row", async () => {
        const calls = fakeServer("email", subs, [emailTemplate(1, FINISHED), emailTemplate(2, REMINDER)]);
        renderPage();
        fireEvent.click(await screen.findByRole("switch", {name: "Надсилати «Нагадування про старт» для цього заходу"}));
        await waitFor(() => expect(calls.some(call => call.method === "PUT")).toBe(true));
        expect(calls.find(call => call.method === "PUT")!.body).toEqual({SignalType: REMINDER, Channel: "email", Enabled: true, Audience: {kind: "all_participants"}});
    });

    it("finds a row by name and lets a viewer only look", async () => {
        manager.canManage = false;
        fakeServer("email", subs, [emailTemplate(1, FINISHED), emailTemplate(2, REMINDER)]);
        renderPage();
        await screen.findByRole("link", {name: "Захід завершено"});
        expect((screen.getAllByRole("switch") as HTMLInputElement[]).every(item => item.disabled)).toBe(true);
        fireEvent.change(screen.getByRole("searchbox"), {target: {value: "нагадув"}});
        expect(screen.queryByRole("link", {name: "Захід завершено"})).toBeNull();
        expect(screen.getByRole("link", {name: "Нагадування про старт"})).toBeTruthy();
        fireEvent.change(screen.getByRole("searchbox"), {target: {value: "xyz"}});
        expect(screen.getByText("За цим запитом нічого не знайдено.")).toBeTruthy();
    });
});

void uuid;
