// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const manager = vi.hoisted(() => ({canManage: true}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ManageNotificationsPage from "./page";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const FINISHED = "participant.event.finished";
const uuid = (n: number) => `0190c6a4-0000-7000-8000-${String(n).padStart(12, "0")}`;

function template(n: number, patch: Record<string, unknown> = {}) {
    return {ID: uuid(n), ScopeEventID: null, NotificationType: FINISHED, Status: "published", Title: "Захід {{.event_name}} завершено", Body: "Дякуємо, <strong>{{.event_name}}</strong>", Link: "", Icon: "trophy", Tone: "success", AccentColor: "", Surface: "inbox", AutoDismissMs: null, Actions: [], Dismissible: true, PublishedAt: "2026-09-01T00:00:00Z", UpdatedByUserID: null, CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-01T00:00:00Z", Source: "platform", ...patch};
}

function fakeServer(templates: Array<Record<string, unknown>>) {
    const calls: {method: string; path: string; body: unknown}[] = [];
    let list = templates;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const path = url.pathname.replace(/^.*\/manage\//, "");
        const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({method, path, body: payload});
        let data: unknown = {};
        if (path === "notification-subscriptions") data = [{SignalType: FINISHED, Channel: "in_app", Enabled: true, Audience: {kind: "all_participants"}, Source: "platform", Required: false}];
        else if (path === "notification-types") data = [{Type: FINISHED, Channels: ["in_app"], Variables: [{Name: "event_name", Description: "Назва заходу", Default: "Приклад"}]}];
        else if (path === "notification-templates/in-app" && method === "GET") data = list;
        else if (path.endsWith("/customize")) {
            const copy = {...list[0], ID: uuid(900), Source: "event", Status: "draft"};
            list = [copy, ...list];
            data = copy;
        }
        return new Response(JSON.stringify({Status: {Code: 0}, Data: data}), {status: 200});
    }) as typeof fetch;
    return calls;
}

function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ManageNotificationsPage /></QueryClientProvider>);
}

describe("Сповіщення на сайті", () => {
    afterEach(() => { cleanup(); manager.canManage = true; vi.restoreAllMocks(); });

    it("opens with the notification drawn like the real one and no editable fields", async () => {
        fakeServer([template(1)]);
        const {container} = renderPage();
        await screen.findByText("У стрічці сповіщень");
        expect(screen.getAllByText("Захід CTF 2027 завершено")).toHaveLength(2);
        expect(container.querySelector(".event-notification-popin strong")?.textContent).toBe("CTF 2027");
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.getByRole("button", {name: "Налаштувати для заходу"})).toBeTruthy();
    });

    it("makes the event copy, then opens the editor with every field labelled", async () => {
        const calls = fakeServer([template(1)]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", {name: "Налаштувати для заходу"}));
        await waitFor(() => expect(calls.some(call => call.method === "POST" && call.path.endsWith(`${uuid(1)}/customize`))).toBe(true));
        expect(await screen.findByRole("textbox", {name: /Заголовок/})).toBeTruthy();
        for (const name of ["Про поле «Заголовок»", "Про поле «Текст»", "Про поле «Посилання»", "Про поле «Вигляд»", "Про поле «Час показу спливаючого повідомлення, секунди»", "Про поле «Кнопка»"]) {
            expect(screen.getByRole("button", {name})).toBeTruthy();
        }
        expect(screen.getByRole("button", {name: "Повернути стандартний"})).toBeTruthy();
        expect(screen.getByRole("button", {name: "Опублікувати"})).toBeTruthy();
    });

    it("does not let an empty title be saved", async () => {
        fakeServer([template(1), template(2, {Source: "event", Status: "draft"})]);
        renderPage();
        const title = await screen.findByRole("textbox", {name: /Заголовок/}) as HTMLInputElement;
        fireEvent.change(title, {target: {value: ""}});
        expect(screen.getByRole("alert").textContent).toBe("Заповніть заголовок.");
        expect((screen.getByRole("button", {name: "Зберегти чернетку"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(title, {target: {value: "Новий"}});
        expect((screen.getByRole("button", {name: "Зберегти чернетку"}) as HTMLButtonElement).disabled).toBe(false);
    });
});
