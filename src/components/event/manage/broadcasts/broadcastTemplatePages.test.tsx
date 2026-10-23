// @vitest-environment jsdom
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
const manager = vi.hoisted(() => ({canManage: true}));
const router = vi.hoisted(() => ({push: vi.fn(), replace: vi.fn()}));
vi.mock("next/navigation", () => ({useRouter: () => router, usePathname: () => "/manage/broadcast-templates"}));
vi.mock("../ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: manager.canManage})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {BroadcastTemplateEditor} from "./BroadcastTemplateEditor";
import {BroadcastTemplateList} from "./BroadcastTemplateList";
import {templateInput, templateMessage} from "./broadcastModel";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const uuid = (n: number) => `0190c6a4-0000-7000-8000-${String(n).padStart(12, "0")}`;
function record(n: number, patch: Record<string, unknown> = {}) {
    return {
        ID: uuid(n), ScopeEventID: EVENT_ID, Name: `Нагадування ${n}`, Channels: ["email"], Subject: `Тема ${n}`, Preheader: "",
        EmailBody: [{type: "button", label: "Розклад", url: "https://x.test"}], EmailStyling: {}, InAppTitle: "", InAppBody: "", InAppLink: "",
        UpdatedBy: uuid(500), UpdatedByName: "Олена Коваленко", CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-02T07:30:00Z", ...patch,
    };
}

type Call = {method: string; path: string; body: unknown};
function mockServer(routes: (call: Call) => unknown | Response) {
    const calls: Call[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const call: Call = {method: init?.method ?? "GET", path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined};
        calls.push(call);
        const result = routes(call);
        if (result instanceof Response) return result;
        return new Response(JSON.stringify({Status: {Code: 0}, Data: result ?? {}}), {status: 200});
    }) as typeof fetch;
    return calls;
}

function wrap(node: React.ReactNode) {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>);
}

beforeEach(() => {manager.canManage = true;});
afterEach(() => {cleanup(); router.push.mockClear(); router.replace.mockClear(); vi.restoreAllMocks();});

describe("Шаблони розсилок: список", () => {
    it("lists the templates and deletes one after a danger confirmation", async () => {
        const calls = mockServer(call => call.method === "GET" ? [record(1), record(2, {Channels: ["in_app"], Subject: "", InAppTitle: "Заголовок 2"})] : {});
        wrap(<BroadcastTemplateList />);
        const table = screen.getByRole("table");
        await waitFor(() => expect(within(table).getByRole("link", {name: "Нагадування 1"}).getAttribute("href")).toBe(`/manage/broadcast-templates/${uuid(1)}`));
        expect(within(table).getByText("Тема 1")).toBeTruthy();
        expect(within(table).getByText("Заголовок 2")).toBeTruthy();
        expect(screen.getByRole("link", {name: /Новий шаблон/}).getAttribute("href")).toBe("/manage/broadcast-templates/new");

        fireEvent.click(within(table).getAllByRole("button", {name: "Видалити шаблон"})[0]);
        const dialog = screen.getByText("Видалити шаблон розсилки?").closest("dialog")!;
        expect(within(dialog).getByText("Нагадування 1")).toBeTruthy();
        const confirm = within(dialog).getByRole("button", {name: "Видалити"});
        expect(confirm.className).toContain("ib-btn--danger-solid");
        expect(document.activeElement).toBe(within(dialog).getByRole("button", {name: "Скасувати"}));
        fireEvent.click(confirm);
        await waitFor(() => expect(within(table).queryByText("Нагадування 1")).toBeNull());
        expect(calls.some(call => call.method === "DELETE" && call.path.endsWith(`/manage/broadcast-templates/${uuid(1)}`))).toBe(true);
        expect(within(table).getByText("Нагадування 2")).toBeTruthy();
    });

    it("shows the empty state inside the block and a read-only header for a viewer", async () => {
        manager.canManage = false;
        mockServer(() => []);
        wrap(<BroadcastTemplateList />);
        await screen.findByText("Збережених шаблонів ще немає.");
        expect(screen.getByRole("table").querySelector("[data-empty-state]")).not.toBeNull();
        expect((screen.getByRole("button", {name: /Новий шаблон/}) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.queryByRole("columnheader", {name: "Дії"})).toBeNull();
    });
});

describe("Шаблони розсилок: редактор", () => {
    function server(extra?: (call: Call) => unknown | undefined) {
        return mockServer(call => {
            const own = extra?.(call);
            if (own !== undefined) return own;
            if (call.path.endsWith("/presets")) return [];
            if (call.path.includes("/preview")) return {Subject: "s", Preheader: "", HTML: "<p>x</p>"};
            return {};
        });
    }

    it("keeps the name error beside the name field and creates the template from the composer fields", async () => {
        const calls = server(call => call.method === "POST" ? record(9, {Name: "Старт", Channels: ["in_app"], Subject: "", EmailBody: [], InAppTitle: "Старт о 10:00"}) : undefined);
        wrap(<BroadcastTemplateEditor />);
        fireEvent.click(screen.getByRole("checkbox", {name: "Електронна пошта"}));
        fireEvent.click(screen.getByRole("checkbox", {name: "У застосунку"}));
        const title = await screen.findByRole("textbox", {name: "Заголовок"});
        title.textContent = "Старт о 10:00";
        fireEvent.input(title);
        const save = screen.getByRole("button", {name: "Зберегти"});
        await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(save);
        const name = screen.getByRole("textbox", {name: /Назва шаблону/});
        expect(name.getAttribute("aria-invalid")).toBe("true");
        const error = document.getElementById(name.getAttribute("aria-describedby")!);
        expect(error?.textContent).toBe("Вкажіть назву шаблону.");
        expect(name.closest(".event-manage-field")?.contains(error)).toBe(true);
        expect(calls.some(call => call.method === "POST")).toBe(false);

        fireEvent.change(name, {target: {value: " Старт "}});
        fireEvent.click(save);
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/manage/broadcast-templates/${uuid(9)}`));
        expect(calls.find(call => call.method === "POST")!.body).toEqual({Name: "Старт", Channels: ["in_app"], Subject: "", Preheader: "", EmailBody: [], EmailStyling: {}, InAppTitle: "Старт о 10:00", InAppBody: "", InAppLink: ""});
        expect(calls.find(call => call.method === "POST")!.path).toBe(`/api/events/${EVENT_ID}/manage/broadcast-templates`);
    });

    it("loads a template, saves the edit in place and shows a taken name beside the field", async () => {
        let puts = 0;
        const calls = server(call => {
            if (call.method === "GET" && call.path.endsWith(`/manage/broadcast-templates/${uuid(3)}`)) return record(3);
            if (call.method === "PUT") {
                puts += 1;
                return puts === 1 ? new Response(JSON.stringify({Status: {Code: 70228, Message: "taken"}}), {status: 409}) : record(3, {Name: "Інша назва"});
            }
            return undefined;
        });
        wrap(<BroadcastTemplateEditor templateID={uuid(3)} />);
        const name = await screen.findByRole("textbox", {name: /Назва шаблону/}) as HTMLInputElement;
        expect(name.value).toBe("Нагадування 3");
        expect(screen.getByRole("heading", {name: "Нагадування 3"})).toBeTruthy();
        fireEvent.change(name, {target: {value: "Нагадування 1"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(name.getAttribute("aria-invalid")).toBe("true"));
        expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("Шаблон з такою назвою вже є. Оберіть іншу назву.");
        fireEvent.change(name, {target: {value: "Інша назва"}});
        expect(name.getAttribute("aria-invalid")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(screen.getByRole("heading", {name: "Інша назва"})).toBeTruthy());
        expect((calls.filter(call => call.method === "PUT").at(-1)!.body as Record<string, unknown>).Name).toBe("Інша назва");
        expect(router.replace).not.toHaveBeenCalled();
    });

    it("shows a load error with a retry and does not let a viewer edit", async () => {
        server(() => new Response("{}", {status: 404}));
        const view = wrap(<BroadcastTemplateEditor templateID={uuid(4)} />);
        expect(await screen.findByText("Не вдалося завантажити шаблон розсилки")).toBeTruthy();
        expect(screen.getByRole("button", {name: "Спробувати ще раз"})).toBeTruthy();
        view.unmount();
        manager.canManage = false;
        wrap(<BroadcastTemplateEditor templateID={uuid(4)} />);
        expect(screen.getByText(/лише для перегляду/)).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Зберегти"})).toBeNull();
    });
});

describe("Шаблони розсилок: модель", () => {
    it("keeps exactly the template's channels and saves only their parts", () => {
        const message = templateMessage(record(5, {Channels: ["in_app"], Subject: "старе", InAppTitle: "Привіт"}) as never);
        expect(message.email).toBe(false);
        expect(message.inApp).toBe(true);
        expect(templateInput("  Назва ", message)).toEqual({Name: "Назва", Channels: ["in_app"], Subject: "", Preheader: "", EmailBody: [], EmailStyling: {}, InAppTitle: "Привіт", InAppBody: "", InAppLink: ""});
    });
});
