// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const manager = vi.hoisted(() => ({canManage: true}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ManageEmailPage from "./page";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const FINISHED = "participant.event.finished";
const REMINDER = "participant.event.start_reminder";
const uuid = (n: number) => `0190c6a4-0000-7000-8000-${String(n).padStart(12, "0")}`;
const body = [{type: "rich_text", content: {root: {type: "root", children: [{type: "paragraph", children: [{type: "text", text: "Привіт"}]}]}}}];

function template(n: number, type: string, patch: Record<string, unknown> = {}) {
    return {ID: uuid(n), ScopeEventID: null, NotificationType: type, Status: "published", Subject: "Тема листа", Preheader: "", Body: body, Styling: {}, PublishedAt: "2026-09-01T00:00:00Z", UpdatedByUserID: null, CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-01T00:00:00Z", Source: "platform", ...patch};
}

function subscription(type: string, patch: Record<string, unknown> = {}) {
    return {SignalType: type, Channel: "email", Enabled: true, Audience: {kind: "all_participants"}, Source: "platform", Required: false, Config: {}, ...patch};
}

function fakeServer(subscriptions: unknown[], templates: unknown[]) {
    const calls: {method: string; path: string; body: unknown}[] = [];
    let list = templates as Array<Record<string, unknown>>;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const path = url.pathname.replace(/^.*\/manage\//, "");
        const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({method, path, body: payload});
        let data: unknown = {};
        if (path === "notification-subscriptions" && method === "GET") data = subscriptions;
        else if (path === "notification-subscriptions") data = {...subscription(payload.SignalType), ...payload, Source: "event"};
        else if (path === "notification-types") data = [{Type: REMINDER, Channels: ["email"], Variables: [{Name: "event_name", Description: "Назва заходу", Default: "Приклад"}]}];
        else if (path === "notification-templates/email" && method === "GET") data = list;
        else if (path === "notification-templates/email/preview") data = {Subject: "Тема з прикладу", Preheader: "Вступ", HTML: "<p>Привіт, учаснику</p>"};
        else if (path.endsWith("/customize")) {
            const source = list.find(item => path.includes(String(item.ID)))!;
            const copy = {...source, ID: uuid(900), Source: "event", Status: "draft", ScopeEventID: "01a0d498-32b3-7a38-8355-30cc209f56ab"};
            list = [copy, ...list];
            data = copy;
        } else if (path.includes("notification-templates/email/type/")) {
            list = list.filter(item => item.Source !== "event");
        }
        return new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
    }) as typeof fetch;
    return calls;
}

function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageEmailPage /></QueryClientProvider>);
}

describe("Електронні листи", () => {
    afterEach(() => { cleanup(); manager.canManage = true; vi.restoreAllMocks(); });

    it("opens with a read-only preview and no editable fields", async () => {
        fakeServer([subscription(FINISHED)], [template(1, FINISHED)]);
        renderPage();
        const frame = await screen.findByTitle("Попередній вигляд електронного листа");
        expect(frame.getAttribute("srcdoc")).toContain("Привіт, учаснику");
        expect(frame.getAttribute("srcdoc")).toContain('class="sheet"');
        expect(frame.getAttribute("sandbox")).toBe("");
        expect(await screen.findByText("Тема з прикладу")).toBeTruthy();
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.getByRole("button", {name: "Налаштувати для заходу"})).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Повернути стандартний"})).toBeNull();
    });

    it("makes the event copy first and only then opens the full editor", async () => {
        const calls = fakeServer([subscription(FINISHED)], [template(1, FINISHED)]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", {name: "Налаштувати для заходу"}));
        await waitFor(() => expect(calls.some(call => call.method === "POST" && call.path.endsWith(`${uuid(1)}/customize`))).toBe(true));
        expect(await screen.findByRole("textbox", {name: /Тема листа/})).toBeTruthy();
        expect(screen.getByRole("button", {name: "Зберегти чернетку"})).toBeTruthy();
        expect(screen.getByRole("button", {name: "Опублікувати"})).toBeTruthy();
        expect(screen.getByRole("button", {name: "Повернути стандартний"})).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Налаштувати для заходу"})).toBeNull();
    });

    it("returns to the standard template through a confirmation", async () => {
        const calls = fakeServer([subscription(FINISHED)], [template(1, FINISHED), template(2, FINISHED, {Source: "event", Status: "draft"})]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", {name: "Повернути стандартний"}));
        expect(calls.some(call => call.method === "DELETE")).toBe(false);
        const dialog = screen.getByRole("alertdialog", {hidden: true});
        fireEvent.click(within(dialog).getByRole("button", {name: "Повернути стандартний", hidden: true}));
        await waitFor(() => expect(calls.some(call => call.method === "DELETE" && call.path.endsWith(`email/type/${FINISHED}`))).toBe(true));
        expect(await screen.findByRole("button", {name: "Налаштувати для заходу"})).toBeTruthy();
    });

    it("switches sending on the row without touching the options", async () => {
        const calls = fakeServer([subscription(FINISHED), subscription(REMINDER, {Config: {days_before_start: 3}})], [template(1, FINISHED), template(2, REMINDER)]);
        renderPage();
        fireEvent.click(await screen.findByRole("switch", {name: "Надсилати «Нагадування про старт» для цього заходу"}));
        await waitFor(() => expect(calls.some(call => call.method === "PUT")).toBe(true));
        const put = calls.find(call => call.method === "PUT")!;
        expect(put.body).toEqual({SignalType: REMINDER, Channel: "email", Enabled: false, Audience: {kind: "all_participants"}});
    });

    it("keeps the start reminder timing on its template, default 7 days", async () => {
        const calls = fakeServer([subscription(FINISHED), subscription(REMINDER)], [template(1, FINISHED), template(2, REMINDER)]);
        renderPage();
        await screen.findByTitle("Попередній вигляд електронного листа");
        fireEvent.click(screen.getByRole("button", {name: "Захід завершено"}));
        expect(screen.queryByRole("spinbutton")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Нагадування про старт"}));
        const days = await screen.findByRole("spinbutton") as HTMLInputElement;
        expect(days.value).toBe("7");
        fireEvent.change(days, {target: {value: "10"}});
        fireEvent.blur(days);
        await waitFor(() => expect(calls.some(call => call.method === "PUT")).toBe(true));
        expect(calls.find(call => call.method === "PUT")!.body).toEqual({SignalType: REMINDER, Channel: "email", Enabled: true, Audience: {kind: "all_participants"}, Config: {days_before_start: 10}});
    });

    it("lets a viewer see the preview but change nothing", async () => {
        manager.canManage = false;
        fakeServer([subscription(FINISHED)], [template(1, FINISHED)]);
        renderPage();
        await screen.findByTitle("Попередній вигляд електронного листа");
        expect(screen.queryByRole("button", {name: "Налаштувати для заходу"})).toBeNull();
        expect((screen.getAllByRole("switch") as HTMLInputElement[]).every(item => item.disabled)).toBe(true);
    });
});
