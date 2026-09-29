// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {EVENT_ID, FINISHED, REMINDER, emailTemplate, fakeServer, subscription, uuid} from "./fixtures/server";

const manager = vi.hoisted(() => ({canManage: true}));
const router = vi.hoisted(() => ({replace: vi.fn()}));
vi.mock("next/navigation", () => ({useRouter: () => router}));
vi.mock("../ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {EmailTemplatePage} from "./EmailTemplatePage";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const subs = [subscription(FINISHED, "email"), subscription(REMINDER, "email")];
function renderPage(signal = FINISHED, versionID?: string) {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><EmailTemplatePage signal={signal} versionID={versionID} /></QueryClientProvider>);
}

describe("Сторінка листа", () => {
    afterEach(() => { cleanup(); manager.canManage = true; router.replace.mockClear(); vi.restoreAllMocks(); });

    it("shows the platform template read-only with its live preview", async () => {
        fakeServer("email", subs, [emailTemplate(1, FINISHED)]);
        renderPage();
        const frame = await screen.findByTitle("Попередній вигляд електронного листа");
        expect(frame.getAttribute("srcdoc")).toContain("Привіт, учаснику");
        expect(screen.getByRole("heading", {level: 1, name: "Захід завершено"})).toBeTruthy();
        expect((screen.getByRole("textbox", {name: /Тема листа/}) as HTMLInputElement).disabled).toBe(true);
        expect(screen.getByText(/стандартний шаблон платформи/)).toBeTruthy();
        expect(screen.getByRole("button", {name: "Налаштувати для заходу"})).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Зберегти чернетку"})).toBeNull();
        expect(screen.queryByRole("button", {name: /Повернути стандартний/})).toBeNull();
    });

    it("copies the template for the event and moves to the copy", async () => {
        const calls = fakeServer("email", subs, [emailTemplate(1, FINISHED)]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", {name: "Налаштувати для заходу"}));
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/manage/email/${FINISHED}?id=${uuid(900)}`));
        expect(calls.some(call => call.method === "POST" && call.path.endsWith(`${uuid(1)}/customize`))).toBe(true);
    });

    it("edits a draft with save and publish, and offers the standard template", async () => {
        const calls = fakeServer("email", subs, [emailTemplate(1, FINISHED), emailTemplate(2, FINISHED, {Source: "event", Status: "draft"})]);
        renderPage();
        const subject = await screen.findByRole("textbox", {name: /Тема листа/}) as HTMLInputElement;
        expect(subject.disabled).toBe(false);
        expect(screen.getByRole("button", {name: "Опублікувати"})).toBeTruthy();
        expect((screen.getByRole("button", {name: "Зберегти чернетку"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(subject, {target: {value: "Нова тема"}});
        expect(screen.queryByRole("button", {name: "Опублікувати"})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти чернетку"}));
        await waitFor(() => expect(calls.some(call => call.method === "PUT" && call.path.endsWith(uuid(2)))).toBe(true));
        expect((calls.find(call => call.method === "PUT" && call.path.endsWith(uuid(2)))!.body as {Subject: string}).Subject).toBe("Нова тема");
    });

    it("does not save an empty subject", async () => {
        fakeServer("email", subs, [emailTemplate(1, FINISHED), emailTemplate(2, FINISHED, {Source: "event", Status: "draft"})]);
        renderPage();
        fireEvent.change(await screen.findByRole("textbox", {name: /Тема листа/}), {target: {value: ""}});
        expect(screen.getByRole("alert").textContent).toContain("тему листа");
        expect((screen.getByRole("button", {name: "Зберегти чернетку"}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("returns to the standard template only after a confirmation", async () => {
        const calls = fakeServer("email", subs, [emailTemplate(1, FINISHED), emailTemplate(2, FINISHED, {Source: "event", Status: "draft"})]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", {name: "Повернути стандартний"}));
        expect(calls.some(call => call.method === "DELETE")).toBe(false);
        fireEvent.click(within(screen.getByText("Повернути стандартний шаблон?").closest("dialog")!).getByRole("button", {name: "Повернути стандартний", hidden: true}));
        await waitFor(() => expect(calls.some(call => call.method === "DELETE" && call.path.endsWith(`email/type/${FINISHED}`))).toBe(true));
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/manage/email/${FINISHED}`));
    });

    it("lists the versions and restores an older one as a draft", async () => {
        const calls = fakeServer("email", subs, [
            emailTemplate(1, FINISHED), emailTemplate(2, FINISHED, {Source: "event", Status: "published", Subject: "Опублікована тема"}), emailTemplate(3, FINISHED, {Source: "event", Status: "unpublished", Subject: "Стара тема", PublishedAt: "2026-08-01T00:00:00Z"}),
        ]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", {name: "Версії шаблону"}));
        expect(screen.getByText("Стара тема")).toBeTruthy();
        expect(screen.getByText("Поточна версія")).toBeTruthy();
        expect(screen.getByRole("link", {name: "Відкрити"}).getAttribute("href")).toBe(`/manage/email/${FINISHED}?id=${uuid(3)}`);
        fireEvent.click(screen.getAllByRole("button", {name: "Відновити"})[1]);
        fireEvent.click(within(screen.getByText("Відновити цю версію?").closest("dialog")!).getByRole("button", {name: "Відновити", hidden: true}));
        await waitFor(() => expect(calls.some(call => call.method === "POST" && call.path.endsWith(`${uuid(3)}/rollback`))).toBe(true));
    });

    it("keeps the reminder timing on the template, default 7 days", async () => {
        const calls = fakeServer("email", subs, [emailTemplate(1, REMINDER)]);
        renderPage(REMINDER);
        const days = await screen.findByRole("spinbutton", {name: /За скільки днів/}) as HTMLInputElement;
        expect(days.value).toBe("7");
        fireEvent.change(days, {target: {value: "10"}});
        fireEvent.blur(days);
        await waitFor(() => expect(calls.some(call => call.method === "PUT")).toBe(true));
        expect(calls.find(call => call.method === "PUT")!.body).toEqual({SignalType: REMINDER, Channel: "email", Enabled: true, Audience: {kind: "all_participants"}, Config: {days_before_start: 10}});
    });

    it("has no reminder field on other emails and nothing to change for a viewer", async () => {
        manager.canManage = false;
        fakeServer("email", subs, [emailTemplate(1, FINISHED)]);
        renderPage();
        await screen.findByTitle("Попередній вигляд електронного листа");
        expect(screen.queryByRole("spinbutton", {name: /За скільки днів/})).toBeNull();
        expect(screen.queryByRole("button", {name: "Налаштувати для заходу"})).toBeNull();
    });

    it("says so for an unknown template", async () => {
        fakeServer("email", subs, [emailTemplate(1, FINISHED)]);
        renderPage("participant.unknown");
        expect(await screen.findByText("Такого шаблону для цього заходу немає.")).toBeTruthy();
    });
});
