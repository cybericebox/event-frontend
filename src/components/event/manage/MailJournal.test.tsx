// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: true})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {MailJournal} from "./MailJournal";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

function item(n: number, patch: Record<string, unknown> = {}) {
    return {
        ID: `0190c6a4-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`, NotificationType: "participant.event.finished", Status: "done",
        CreatedAt: "2026-09-29T07:30:00Z", UpdatedAt: "2026-09-29T07:30:00Z", RecipientEmail: `user${n}@example.com`,
        Targets: [{Channel: "email", Status: "done", Attempts: 1, Transport: "platform", Recipient: `user${n}@example.com`, UpdatedAt: "2026-09-29T07:30:00Z"}], ...patch,
    };
}

function mockApi(pages: Array<{Items: unknown[]; Total: number; NextCursor?: string}>) {
    const urls: string[] = [];
    let index = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        const page = pages[Math.min(index++, pages.length - 1)];
        return new Response(JSON.stringify({Status: {Code: 0}, Data: page}), {status: 200});
    }) as typeof fetch;
    return urls;
}

function renderJournal() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MailJournal /></QueryClientProvider>);
}

describe("Журнал надсилання", () => {
    afterEach(cleanup);

    it("is its own page with the manage table", async () => {
        mockApi([{Items: [item(1), item(2, {Targets: [{Channel: "email", Status: "error", Error: "550 rejected", Attempts: 3, Transport: "event", Recipient: "user2@example.com", UpdatedAt: "2026-09-29T07:31:00Z"}]})], Total: 2}]);
        renderJournal();
        expect(screen.getByRole("heading", {name: "Журнал надсилання"})).toBeTruthy();
        const table = screen.getByRole("table");
        expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Час (GMT+3)", "Одержувач", "Тип", "Статус", "Спосіб", "Спроби", "Деталі"]);
        await waitFor(() => expect(within(table).getByText("user1@example.com")).toBeTruthy());
        expect(within(table).getByText("550 rejected")).toBeTruthy();
        expect(within(table).getByText("SMTP заходу")).toBeTruthy();
    });

    it("shows a deferred send as deferred with its reason, not as an error", async () => {
        mockApi([{Items: [item(3, {Targets: [{Channel: "email", Status: "deferred", Error: "Відкладено: вичерпано добовий ліміт", Attempts: 0, Transport: "event", Recipient: "user3@example.com", UpdatedAt: "2026-09-29T07:31:00Z"}]})], Total: 1}]);
        renderJournal();
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getByText("user3@example.com")).toBeTruthy());
        expect(within(table).getByText("Відкладено")).toBeTruthy();
        const reason = within(table).getByText("Відкладено: вичерпано добовий ліміт");
        expect(reason.className).not.toContain("event-manage-mail__error");
        fireEvent.click(screen.getByRole("button", {name: "Деталі надсилання: Захід завершено"}));
        const dialog = screen.getByText("Деталі надсилання", {selector: "h2"}).closest("dialog")!;
        expect(within(dialog).getByText("Причина: Відкладено: вичерпано добовий ліміт")).toBeTruthy();
    });

    it("opens the details of a row: recipient, attempts, transport and errors", async () => {
        mockApi([{Items: [item(2, {Targets: [{Channel: "email", Status: "error", Error: "550 rejected", Attempts: 3, Transport: "event", Recipient: "user2@example.com", FallbackError: "timeout", UpdatedAt: "2026-09-29T07:31:00Z"}]})], Total: 1}]);
        renderJournal();
        fireEvent.click(await screen.findByRole("button", {name: "Деталі надсилання: Захід завершено"}));
        const dialog = screen.getByText("Деталі надсилання", {selector: "h2"}).closest("dialog")!;
        expect(within(dialog).getByText("Помилка: 550 rejected")).toBeTruthy();
        expect(within(dialog).getByText("SMTP заходу")).toBeTruthy();
        expect(within(dialog).getByText("3")).toBeTruthy();
        expect(within(dialog).getAllByText("user2@example.com").length).toBeGreaterThan(0);
        expect(within(dialog).getByText(/timeout/)).toBeTruthy();
    });

    it("marks SMTP test rows with «Тест» and filters by them", async () => {
        const urls = mockApi([{Items: [item(1, {NotificationType: "smtp_test"}), item(2)], Total: 2}]);
        renderJournal();
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getByText("Тест")).toBeTruthy());
        expect(within(table).getByText("Перевірка SMTP")).toBeTruthy();
        expect(within(table).getAllByText("Тест")).toHaveLength(1);
        fireEvent.pointerDown(screen.getByRole("button", {name: "Тип листа"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Перевірка SMTP"}));
        await waitFor(() => expect(urls.some(url => url.includes("type=smtp_test"))).toBe(true));
    });

    it("shows «Розсилка» with a link to the broadcast when the row has a BroadcastID", async () => {
        mockApi([{Items: [item(1, {NotificationType: "broadcast", BroadcastID: "0190c6a4-0000-7000-8000-00000000abcd"}), item(2)], Total: 2}]);
        renderJournal();
        const link = await screen.findByRole("link", {name: "Розсилка"});
        expect(link.getAttribute("href")).toBe("/manage/broadcasts/0190c6a4-0000-7000-8000-00000000abcd");
        expect(screen.getAllByRole("link")).toHaveLength(1);
    });

    it("shows the empty state inside the table body", async () => {
        mockApi([{Items: [], Total: 0}]);
        renderJournal();
        await waitFor(() => expect(within(screen.getByRole("table")).getByText("Листів учасникам ще не надсилали.")).toBeTruthy());
    });

    it("filters by result and walks the pages by cursor", async () => {
        const urls = mockApi([{Items: [item(1)], Total: 30, NextCursor: "c2"}, {Items: [item(2)], Total: 30}, {Items: [item(3)], Total: 1}]);
        renderJournal();
        await screen.findByText("user1@example.com");
        fireEvent.click(screen.getByRole("button", {name: "Далі"}));
        await screen.findByText("user2@example.com");
        expect(urls.at(-1)).toContain("cursor=c2");
        fireEvent.pointerDown(screen.getByRole("button", {name: "Результат"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Помилка"}));
        await waitFor(() => expect(urls.at(-1)).toContain("result=error"));
        expect(urls.at(-1)).not.toContain("cursor=");
        fireEvent.pointerDown(screen.getByRole("button", {name: "Статус надсилання"}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "Очікує"}));
        await waitFor(() => expect(urls.at(-1)).toContain("status=pending"));
    });
});
